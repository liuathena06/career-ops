/**
 * Source-agnostic Job domain primitives for the China V0 flow.
 *
 * A discovery card and a complete job description are deliberately separate:
 * attaching a JD creates `detail_enriched`; only the preflight can promote a
 * Job to `evaluatable`. No source-specific field is required here.
 */

export const JobCompleteness = Object.freeze({
  DISCOVERY_ONLY: 'discovery_only',
  DETAIL_ENRICHED: 'detail_enriched',
  EVALUATABLE: 'evaluatable',
});

export const MIN_SUBSTANTIVE_JD_CHARACTERS = 200;

const RESPONSIBILITY_MARKER = /(岗位职责|工作职责|工作内容|职责|responsibilit(?:y|ies)|what you(?:'|’)ll do)/iu;
const REQUIREMENT_MARKER = /(任职要求|职位要求|职位资格|资格要求|任职资格|requirements?|qualifications?)/iu;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function identity(value) {
  return text(value).toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
}

function copyJob(job) {
  return {
    ...job,
    source: { ...(job.source ?? {}) },
    listing: { ...(job.listing ?? {}) },
    details: job.details
      ? {
        ...job.details,
        observed: job.details.observed ? { ...job.details.observed } : undefined,
      }
      : null,
    detailConflicts: [...(job.detailConflicts ?? [])],
  };
}

/**
 * Creates a source-agnostic discovery card. `source.kind` may be Liepin,
 * Manual, an ATS, or any future connector.
 *
 * @param {{id: string, source?: object, listing: {title: string, [key: string]: unknown}}} input
 * @returns {object}
 */
export function createDiscoveryJob({ id, source = {}, listing }) {
  if (!text(id)) throw new Error('Job id is required');
  if (!text(listing?.title)) throw new Error('Job listing title is required');
  return {
    id: text(id),
    source: { ...source },
    listing: { ...listing, title: text(listing.title) },
    details: null,
    detailConflicts: [],
    completeness: JobCompleteness.DISCOVERY_ONLY,
  };
}

/**
 * A manual JD must bind to the local Job id selected by the user. We never
 * infer identity from company/title, which could merge two distinct openings.
 *
 * @param {object} job
 * @param {{jobId: string, description: string, sourceUrl?: string, capturedAt?: string, observed?: {title?: string, companyName?: string}}} input
 * @returns {{merged: boolean, job: object, reason?: string}}
 */
export function enrichFromManualPaste(job, input) {
  const requestedJobId = text(input?.jobId);
  if (!requestedJobId || requestedJobId !== text(job?.id)) {
    return {
      merged: false,
      job: copyJob(job),
      reason: 'JOB_BINDING_MISMATCH',
    };
  }

  const description = text(input?.description);
  if (!description) {
    return {
      merged: false,
      job: copyJob(job),
      reason: 'JD_EMPTY',
    };
  }

  const next = copyJob(job);
  next.details = {
    description,
    detailSource: 'manual_paste',
    ...(text(input?.sourceUrl) ? { sourceUrl: text(input.sourceUrl) } : {}),
    capturedAt: text(input?.capturedAt) || new Date().toISOString(),
    ...(input?.observed ? { observed: { ...input.observed } } : {}),
  };
  next.detailConflicts = findDetailConflicts(next);
  // Enrichment and evaluation eligibility remain intentionally separate.
  next.completeness = JobCompleteness.DETAIL_ENRICHED;
  return { merged: true, job: next };
}

/** @param {object} job @returns {string[]} */
export function findDetailConflicts(job) {
  const observed = job?.details?.observed ?? {};
  const conflicts = [];
  if (identity(observed.title) && identity(job?.listing?.title)
      && identity(observed.title) !== identity(job.listing.title)) {
    conflicts.push('DETAIL_TITLE_CONFLICT');
  }
  if (identity(observed.companyName) && identity(job?.listing?.companyName)
      && identity(observed.companyName) !== identity(job.listing.companyName)) {
    conflicts.push('DETAIL_COMPANY_CONFLICT');
  }
  return conflicts;
}

/**
 * Removing a JD invalidates prior evaluation eligibility. Replacement follows
 * the same rule through enrichFromManualPaste(), starting at detail_enriched.
 *
 * @param {object} job
 * @returns {object}
 */
export function removeJobDetails(job) {
  const next = copyJob(job);
  next.details = null;
  next.detailConflicts = [];
  next.completeness = JobCompleteness.DISCOVERY_ONLY;
  return next;
}

/**
 * The eligibility check is intentionally deterministic and conservative. It
 * checks for substantive, structured JD evidence; it does not score fit.
 *
 * @param {object} job
 * @returns {{eligible: boolean, reasons: string[]}}
 */
export function getEvaluationEligibility(job) {
  const reasons = [];
  if (!text(job?.listing?.title)) reasons.push('JOB_TITLE_MISSING');

  const description = text(job?.details?.description);
  if (!description) {
    reasons.push('JD_MISSING');
  } else {
    if (description.length < MIN_SUBSTANTIVE_JD_CHARACTERS) reasons.push('JD_TOO_SHORT');
    if (!RESPONSIBILITY_MARKER.test(description) || !REQUIREMENT_MARKER.test(description)) {
      reasons.push('JD_LACKS_RESPONSIBILITIES_OR_REQUIREMENTS');
    }
  }

  for (const conflict of findDetailConflicts(job)) reasons.push(conflict);
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Promotes only a preflight-approved, detail-enriched Job. A failed preflight
 * remains `detail_enriched`, preserving the JD for the user to repair.
 *
 * @param {object} job
 * @returns {{job: object, eligibility: {eligible: boolean, reasons: string[]}}}
 */
export function promoteToEvaluatable(job) {
  const next = copyJob(job);
  const eligibility = getEvaluationEligibility(next);
  next.completeness = eligibility.eligible
    ? JobCompleteness.EVALUATABLE
    : next.details
      ? JobCompleteness.DETAIL_ENRICHED
      : JobCompleteness.DISCOVERY_ONLY;
  return { job: next, eligibility };
}

/**
 * The source-agnostic gate used by a recruiter-grade Evaluation Engine. The
 * evaluator receives a Job only after both state and preflight are valid.
 *
 * @param {object} job
 * @param {(job: object) => unknown} evaluator
 * @returns {{accepted: boolean, result: unknown|null, reasons: string[]}}
 */
export function evaluateRecruiterGrade(job, evaluator) {
  const eligibility = getEvaluationEligibility(job);
  const reasons = [...eligibility.reasons];
  if (job?.completeness !== JobCompleteness.EVALUATABLE) {
    reasons.unshift('JOB_NOT_EVALUATABLE_STATE');
  }
  if (reasons.length > 0) return { accepted: false, result: null, reasons };
  return { accepted: true, result: evaluator(job), reasons: [] };
}

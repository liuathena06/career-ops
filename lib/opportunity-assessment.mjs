/**
 * Local, source-agnostic opportunity recommendation for a confirmed Career
 * Profile and a Job card. Sparse discovery cards remain assessable: missing JD
 * facts become unknown rather than being invented. This answers whether a person should see an
 * opportunity; it never estimates whether an employer would hire them.
 */
import { CareerProfileStatus, InferenceStatus, validateCareerProfile } from './career-domain.mjs';

export const OpportunityRelevance = Object.freeze({
  STRONG_FIT: 'strong_fit',
  FIT: 'fit',
  MIXED: 'mixed',
  UNKNOWN: 'unknown',
});

export const CareerUpsideStatus = Object.freeze({
  PRESENT: 'present',
  ABSENT: 'absent',
  UNKNOWN: 'unknown',
});

export const OpportunityRecommendation = Object.freeze({
  APPLY: 'apply',
  EXPLORE: 'explore',
  LOW_PRIORITY: 'low_priority',
});

const POSITIVE_RELEVANCE = new Set([
  OpportunityRelevance.STRONG_FIT,
  OpportunityRelevance.FIT,
]);

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalized(value) {
  return asText(value).toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ');
}

function confirmed(entries) {
  return (entries ?? []).filter((entry) => entry?.confirmed === true && asText(String(entry.value ?? '')));
}

function candidateEvidence(entry, field, source = 'stated') {
  return {
    source,
    field,
    value: entry.value,
    evidenceRefs: structuredClone(entry.evidenceRefs ?? []),
    ...(source === 'inference'
      ? { confidence: entry.confidence, confirmationStatus: entry.status }
      : {}),
  };
}

function jobEvidence(field, value) {
  return asText(value) ? [{ source: 'job', field, value: asText(value) }] : [];
}

function jobDescription(job) {
  return asText(job?.details?.description);
}

function jobText(job, { includeTitle = true } = {}) {
  return [
    includeTitle ? job?.listing?.title : '',
    job?.listing?.companyName,
    job?.listing?.location,
    job?.listing?.salary,
    jobDescription(job),
  ].map(asText).filter(Boolean).join('\n');
}

function matches(value, corpus) {
  const candidate = normalized(typeof value === 'string' ? value : '');
  return candidate.length >= 2 && normalized(corpus).includes(candidate);
}

function confirmedInferences(profile) {
  return (profile.inferences ?? []).filter((item) => (
    item.status === InferenceStatus.CONFIRMED
    && item.needsConfirmation === false
    && asText(typeof item.value === 'string' ? item.value : '')
  ));
}

function relevance({ candidateEntries, candidateField, job, includeTitle = true, jobFields = ['details.description'] }) {
  const corpus = jobText(job, { includeTitle });
  const candidate = candidateEntries.map((entry) => candidateEvidence(entry, candidateField));
  const jobSide = jobFields.flatMap((field) => {
    const value = field === 'details.description' ? jobDescription(job) : job?.listing?.[field.split('.').at(-1)];
    return jobEvidence(field, value);
  });
  if (candidate.length === 0 || jobSide.length === 0) {
    return { judgment: OpportunityRelevance.UNKNOWN, candidateEvidence: candidate, jobEvidence: jobSide, uncertainty: 'MISSING_TWO_SIDED_EVIDENCE' };
  }
  const matched = candidate.filter((entry) => matches(entry.value, corpus));
  return {
    judgment: matched.length >= 2 ? OpportunityRelevance.STRONG_FIT
      : matched.length === 1 ? OpportunityRelevance.FIT : OpportunityRelevance.MIXED,
    candidateEvidence: candidate,
    jobEvidence: jobSide,
    uncertainty: null,
  };
}

function numberFromSalary(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = normalized(value);
  if (!text) return null;
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:k|千)?\s*[-–~至]\s*(\d+(?:\.\d+)?)\s*(k|千)/u);
  if (range) return Number(range[2]) * 1000;
  const single = text.match(/(\d+(?:\.\d+)?)\s*(k|千)\s*(?:\/|每)?\s*月?/u);
  if (single) return Number(single[1]) * 1000;
  return null;
}

function compensationValue(entry) {
  if (!entry) return null;
  if (typeof entry.value === 'number') return entry.value;
  if (entry.value && typeof entry.value === 'object') {
    return numberFromSalary(entry.value.monthly ?? entry.value.monthlyMinimum);
  }
  return numberFromSalary(entry.value);
}

function compensationRelevance(profile, job) {
  const preferences = profile.stated.hardConstraints.compensation;
  const target = preferences.target?.confirmed ? preferences.target : null;
  const acceptable = preferences.acceptable?.confirmed ? preferences.acceptable : null;
  const jobSalary = numberFromSalary(job?.listing?.salary);
  const candidate = [target, acceptable].filter(Boolean).map((entry) => candidateEvidence(entry, 'stated.hardConstraints.compensation'));
  const jobSide = jobEvidence('listing.salary', job?.listing?.salary);
  if (!jobSalary || candidate.length === 0) {
    return { judgment: OpportunityRelevance.UNKNOWN, candidateEvidence: candidate, jobEvidence: jobSide, uncertainty: 'COMPENSATION_NOT_COMPARABLE' };
  }
  const targetValue = compensationValue(target);
  const acceptableValue = compensationValue(acceptable);
  const judgment = targetValue && jobSalary >= targetValue ? OpportunityRelevance.STRONG_FIT
    : acceptableValue && jobSalary >= acceptableValue ? OpportunityRelevance.FIT
      : OpportunityRelevance.MIXED;
  return { judgment, candidateEvidence: candidate, jobEvidence: jobSide, uncertainty: null };
}

function hardFilters(profile, job) {
  const constraints = profile.stated.hardConstraints;
  const reasons = [];
  const unknowns = [];
  const locationEntries = confirmed(constraints.locations);
  const location = asText(job?.listing?.location);
  if (locationEntries.length > 0) {
    if (!location) unknowns.push('岗位地点未披露');
    else if (!locationEntries.some((entry) => matches(entry.value, location))) reasons.push('LOCATION_CONFLICT');
  }

  const dealBreakers = confirmed(constraints.dealBreakers);
  if (dealBreakers.length > 0) {
    const detail = jobDescription(job);
    if (!detail) unknowns.push('岗位详情不足以核验用户底线');
    else if (dealBreakers.some((entry) => matches(entry.value, detail))) reasons.push('DEAL_BREAKER_CONFLICT');
    else unknowns.push('岗位未明确披露与用户底线相关的信息');
  }

  const minimum = constraints.compensation.minimum?.confirmed ? constraints.compensation.minimum : null;
  if (minimum) {
    const expected = compensationValue(minimum);
    const offered = numberFromSalary(job?.listing?.salary);
    if (!offered || !expected) unknowns.push('岗位薪资无法与最低门槛比较');
    else if (offered < expected) reasons.push('MINIMUM_COMPENSATION_CONFLICT');
  }
  return { outcome: reasons.length ? 'filtered_out' : 'pass', reasons, unknowns };
}

function careerUpside(profile, job, careerDirection) {
  const candidate = careerDirection.candidateEvidence;
  const jobSide = careerDirection.jobEvidence;
  if (POSITIVE_RELEVANCE.has(careerDirection.judgment)) {
    return {
      status: CareerUpsideStatus.PRESENT,
      improvements: ['更接近用户明确确认的职业方向'],
      candidateEvidence: candidate,
      jobEvidence: jobSide,
      uncertainty: null,
    };
  }
  if (candidate.length === 0 || jobSide.length === 0) {
    return { status: CareerUpsideStatus.UNKNOWN, improvements: [], candidateEvidence: candidate, jobEvidence: jobSide, uncertainty: 'CURRENT_OR_DIRECTION_BASELINE_INSUFFICIENT' };
  }
  return { status: CareerUpsideStatus.ABSENT, improvements: [], candidateEvidence: candidate, jobEvidence: jobSide, uncertainty: null };
}

function collectUnknowns(filters, dimensions, upside) {
  const unknowns = [...filters.unknowns];
  for (const [name, dimension] of Object.entries(dimensions)) {
    if (dimension.judgment === OpportunityRelevance.UNKNOWN) unknowns.push(`${name}：信息不足`);
  }
  if (upside.status === CareerUpsideStatus.UNKNOWN) unknowns.push('职业增益：信息不足');
  return [...new Set(unknowns)];
}

function assertReady(profile, job) {
  validateCareerProfile(profile);
  if (profile.status !== CareerProfileStatus.CONFIRMED) throw new Error("Opportunity assessment requires a confirmed CareerProfile");
  if (!asText(job?.id) || !asText(job?.listing?.title)) {
    throw new Error("Opportunity assessment requires a Job with a title");
  }
}

/**
 * Deterministically decide whether a single evaluatable Job deserves attention.
 * Confirmed AI inferences may be attached by a future adapter as auxiliary
 * evidence, but are intentionally not used to establish a formal judgment.
 */
export function assessOpportunity({ profile, job }) {
  assertReady(profile, job);
  // Referencing this explicitly prevents accidental promotion of pending or
  // rejected inference in later extensions.
  void confirmedInferences(profile);
  const filters = hardFilters(profile, job);
  const dimensions = {
    careerDirection: relevance({ candidateEntries: confirmed(profile.stated.careerDirection), candidateField: 'stated.careerDirection', job, jobFields: ['details.description', 'title'] }),
    capabilityPlausibility: relevance({ candidateEntries: confirmed(profile.stated.capabilityEvidence), candidateField: 'stated.capabilityEvidence', job, jobFields: ['details.description'] }),
    seniorityScope: relevance({ candidateEntries: confirmed(profile.stated.capabilityEvidence), candidateField: 'stated.capabilityEvidence', job, includeTitle: false, jobFields: ['details.description'] }),
    compensation: compensationRelevance(profile, job),
  };
  const upside = careerUpside(profile, job, dimensions.careerDirection);
  const unknowns = collectUnknowns(filters, dimensions, upside);
  const filtered = filters.outcome === 'filtered_out';
  const directionPositive = POSITIVE_RELEVANCE.has(dimensions.careerDirection.judgment);
  const capabilityPositive = POSITIVE_RELEVANCE.has(dimensions.capabilityPlausibility.judgment);
  const shouldShow = !filtered && (directionPositive || upside.status === CareerUpsideStatus.PRESENT);
  const recommendation = filtered ? null
    : shouldShow && directionPositive && capabilityPositive
      && upside.status === CareerUpsideStatus.PRESENT && unknowns.length === 0
      ? OpportunityRecommendation.APPLY
      : shouldShow ? OpportunityRecommendation.EXPLORE : OpportunityRecommendation.LOW_PRIORITY;
  return {
    profileId: profile.id,
    profileVersion: profile.version,
    jobId: job.id,
    hardFilter: filters,
    dimensions,
    careerUpside: upside,
    unknowns,
    shouldShow,
    recommendation,
  };
}

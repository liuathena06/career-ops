/**
 * Local-first Career Interview and Career Profile domain primitives.
 *
 * This module intentionally stores candidate statements separately from
 * derived hypotheses. It does not call an LLM, parse a resume, read a Job
 * source, or persist data. A caller owns local persistence and user review.
 */

export const CareerProfileStatus = Object.freeze({
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  STALE: 'stale',
});

export const InterviewAnswerStatus = Object.freeze({
  ANSWERED: 'answered',
  SKIPPED: 'skipped',
  NEEDS_FOLLOWUP: 'needs_followup',
});

export const InferenceConfidence = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const InferenceStatus = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
});

export const CAREER_INTERVIEW_TOPICS = Object.freeze([
  'career_context',
  'motivation',
  'priorities',
  'constraints',
  'capabilities',
  'differentiation',
  'direction',
  'compensation',
  'risk_tradeoffs',
]);

const PROFILE_STATED_FIELDS = Object.freeze([
  'careerDirection',
  'motivations',
  'priorities',
  'hardConstraints',
  'capabilityEvidence',
  'selfDescribedDifferentiators',
  'riskTradeoffs',
]);

const ANSWER_STATUSES = new Set(Object.values(InterviewAnswerStatus));
const PROFILE_STATUSES = new Set(Object.values(CareerProfileStatus));
const CONFIDENCE_LEVELS = new Set(Object.values(InferenceConfidence));
const INFERENCE_STATUSES = new Set(Object.values(InferenceStatus));
const TOPICS = new Set(CAREER_INTERVIEW_TOPICS);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clone(value) {
  return structuredClone(value);
}

function fail(message) {
  throw new Error(`Career domain validation: ${message}`);
}

function validateIsoTimestamp(value, path) {
  if (!text(value) || Number.isNaN(Date.parse(value))) fail(`${path} must be an ISO-8601 timestamp`);
}

function validateUniqueIds(items, path) {
  const seen = new Set();
  for (const item of items) {
    const id = text(item?.id);
    if (!id) fail(`${path} entries require an id`);
    if (seen.has(id)) fail(`${path} contains duplicate id "${id}"`);
    seen.add(id);
  }
}

/**
 * Evidence refers stably to a source record. `quote` is a display aid only:
 * consumers must resolve identity from sourceType + sourceId.
 *
 * @param {unknown} ref
 * @param {string} path
 */
function validateEvidenceRef(ref, path) {
  if (!isPlainObject(ref)) fail(`${path} must be an object`);
  if (!text(ref.sourceType)) fail(`${path}.sourceType is required`);
  if (!text(ref.sourceId)) fail(`${path}.sourceId is required`);
  if (ref.quote !== undefined && typeof ref.quote !== 'string') {
    fail(`${path}.quote must be a string when present`);
  }
}

function validateEvidenceRefs(refs, path, { required = false } = {}) {
  if (!Array.isArray(refs)) fail(`${path} must be an array`);
  if (required && refs.length === 0) fail(`${path} must not be empty`);
  refs.forEach((ref, index) => validateEvidenceRef(ref, `${path}[${index}]`));
}

function emptyHardConstraints() {
  return {
    locations: [],
    workMode: [],
    availability: [],
    dealBreakers: [],
    compensation: { target: null, acceptable: null, minimum: null },
  };
}

function emptyStated() {
  return {
    careerDirection: [],
    motivations: [],
    priorities: [],
    hardConstraints: emptyHardConstraints(),
    capabilityEvidence: [],
    selfDescribedDifferentiators: [],
    riskTradeoffs: [],
  };
}

function normalizeStated(stated = {}) {
  if (!isPlainObject(stated)) fail('stated must be an object');
  const normalized = emptyStated();
  for (const field of PROFILE_STATED_FIELDS) {
    if (stated[field] !== undefined) normalized[field] = clone(stated[field]);
  }
  return normalized;
}

function validateStatedEntry(entry, path) {
  if (!isPlainObject(entry)) fail(`${path} must be an object`);
  if (!text(entry.id)) fail(`${path}.id is required`);
  if (entry.value === undefined || entry.value === null || entry.value === '') {
    fail(`${path}.value is required`);
  }
  if (typeof entry.confirmed !== 'boolean') fail(`${path}.confirmed must be boolean`);
  validateEvidenceRefs(entry.evidenceRefs, `${path}.evidenceRefs`, { required: true });
}

function validateStatedList(entries, path) {
  if (!Array.isArray(entries)) fail(`${path} must be an array`);
  validateUniqueIds(entries, path);
  entries.forEach((entry, index) => validateStatedEntry(entry, `${path}[${index}]`));
}

function validateHardConstraints(hardConstraints) {
  if (!isPlainObject(hardConstraints)) fail('stated.hardConstraints must be an object');
  const fields = ['locations', 'workMode', 'availability', 'dealBreakers'];
  for (const field of fields) validateStatedList(hardConstraints[field], `stated.hardConstraints.${field}`);
  if (!isPlainObject(hardConstraints.compensation)) {
    fail('stated.hardConstraints.compensation must be an object');
  }
  for (const field of ['target', 'acceptable', 'minimum']) {
    if (!Object.hasOwn(hardConstraints.compensation, field)) {
      fail(`stated.hardConstraints.compensation.${field} is required; use null when unknown`);
    }
    const entry = hardConstraints.compensation[field];
    if (entry !== null) validateStatedEntry(entry, `stated.hardConstraints.compensation.${field}`);
  }
  for (const field of Object.keys(hardConstraints.compensation)) {
    if (!['target', 'acceptable', 'minimum'].includes(field)) {
      fail(`stated.hardConstraints.compensation.${field} is not supported`);
    }
  }
  for (const field of Object.keys(hardConstraints)) {
    if (!['locations', 'workMode', 'availability', 'dealBreakers', 'compensation'].includes(field)) {
      fail(`stated.hardConstraints.${field} is not supported`);
    }
  }
}

function validateStated(stated) {
  if (!isPlainObject(stated)) fail('stated must be an object');
  for (const field of PROFILE_STATED_FIELDS) {
    if (field === 'hardConstraints') validateHardConstraints(stated[field]);
    else validateStatedList(stated[field], `stated.${field}`);
  }
  for (const field of Object.keys(stated)) {
    if (!PROFILE_STATED_FIELDS.includes(field)) fail(`stated.${field} is not a supported field`);
  }
}

function validateInference(inference, path) {
  if (!isPlainObject(inference)) fail(`${path} must be an object`);
  if (!text(inference.id)) fail(`${path}.id is required`);
  if (!text(inference.kind)) fail(`${path}.kind is required`);
  if (inference.value === undefined || inference.value === null || inference.value === '') {
    fail(`${path}.value is required`);
  }
  if (!CONFIDENCE_LEVELS.has(inference.confidence)) {
    fail(`${path}.confidence must be low, medium, or high`);
  }
  if (!text(inference.rationale)) fail(`${path}.rationale is required`);
  if (typeof inference.needsConfirmation !== 'boolean') {
    fail(`${path}.needsConfirmation must be boolean`);
  }
  if (!INFERENCE_STATUSES.has(inference.status)) {
    fail(`${path}.status must be pending, confirmed, or rejected`);
  }
  if (inference.status === InferenceStatus.PENDING && inference.needsConfirmation !== true) {
    fail(`${path}.needsConfirmation must be true while pending`);
  }
  if (inference.status !== InferenceStatus.PENDING && inference.needsConfirmation !== false) {
    fail(`${path}.needsConfirmation must be false once resolved`);
  }
  if (!isPlainObject(inference.provenance)
      || !text(inference.provenance.analyzerId)
      || !text(inference.provenance.analyzerVersion)) {
    fail(`${path}.provenance requires analyzerId and analyzerVersion`);
  }
  validateEvidenceRefs(inference.evidenceRefs, `${path}.evidenceRefs`, { required: true });
}

/**
 * Validate a Career Interview without changing it.
 *
 * @param {unknown} interview
 * @returns {true}
 */
export function validateCareerInterview(interview) {
  if (!isPlainObject(interview)) fail('interview must be an object');
  if (interview.schemaVersion !== 'v0') fail('interview.schemaVersion must be "v0"');
  if (!text(interview.id)) fail('interview.id is required');
  if (!text(interview.locale)) fail('interview.locale is required');
  if (!['in_progress', 'completed'].includes(interview.status)) {
    fail('interview.status must be in_progress or completed');
  }
  validateIsoTimestamp(interview.createdAt, 'interview.createdAt');
  validateIsoTimestamp(interview.updatedAt, 'interview.updatedAt');
  if (!Array.isArray(interview.turns)) fail('interview.turns must be an array');
  validateUniqueIds(interview.turns, 'interview.turns');

  interview.turns.forEach((turn, index) => {
    const path = `interview.turns[${index}]`;
    if (!isPlainObject(turn)) fail(`${path} must be an object`);
    if (!TOPICS.has(turn.topic)) fail(`${path}.topic is not supported`);
    if (!text(turn.questionId)) fail(`${path}.questionId is required`);
    if (!text(turn.question)) fail(`${path}.question is required`);
    if (!ANSWER_STATUSES.has(turn.answerStatus)) fail(`${path}.answerStatus is invalid`);
    if (turn.answerStatus === InterviewAnswerStatus.ANSWERED && !text(turn.userAnswer)) {
      fail(`${path}.userAnswer is required for answered turns`);
    }
    if (turn.userAnswer !== undefined && typeof turn.userAnswer !== 'string') {
      fail(`${path}.userAnswer must be a string when present`);
    }
    if (turn.confirmedAnswer !== undefined && !isPlainObject(turn.confirmedAnswer)) {
      fail(`${path}.confirmedAnswer must be an object when present`);
    }
    validateIsoTimestamp(turn.capturedAt, `${path}.capturedAt`);
  });
  return true;
}

/**
 * Create a validated, local-first Career Interview record.
 *
 * @param {object} input
 * @returns {object}
 */
export function createCareerInterview(input) {
  const interview = clone(input);
  validateCareerInterview(interview);
  return interview;
}

/**
 * Stable representation of the answered content from which a profile draft
 * was built. Skipped and follow-up turns deliberately do not participate.
 *
 * @param {object} interview
 * @returns {string}
 */
export function getInterviewFactFingerprint(interview) {
  validateCareerInterview(interview);
  const material = interview.turns
    .filter((turn) => turn.answerStatus === InterviewAnswerStatus.ANSWERED)
    .map((turn) => ({ id: turn.id, topic: turn.topic, userAnswer: turn.userAnswer.trim() }));
  return JSON.stringify(material);
}

/**
 * Validate a Career Profile without changing it.
 *
 * @param {unknown} profile
 * @returns {true}
 */
export function validateCareerProfile(profile) {
  if (!isPlainObject(profile)) fail('profile must be an object');
  if (profile.schemaVersion !== 'v0') fail('profile.schemaVersion must be "v0"');
  if (!text(profile.id)) fail('profile.id is required');
  if (!text(profile.locale)) fail('profile.locale is required');
  if (!PROFILE_STATUSES.has(profile.status)) fail('profile.status is invalid');
  if (!Number.isSafeInteger(profile.version) || profile.version < 1) {
    fail('profile.version must be a positive integer');
  }
  validateIsoTimestamp(profile.createdAt, 'profile.createdAt');
  validateIsoTimestamp(profile.updatedAt, 'profile.updatedAt');
  if (!isPlainObject(profile.derivedFrom)) fail('profile.derivedFrom must be an object');
  if (!text(profile.derivedFrom.interviewId)) fail('profile.derivedFrom.interviewId is required');
  if (!text(profile.derivedFrom.interviewFingerprint)) {
    fail('profile.derivedFrom.interviewFingerprint is required');
  }
  if (!Array.isArray(profile.derivedFrom.interviewTurnIds)) {
    fail('profile.derivedFrom.interviewTurnIds must be an array');
  }
  if (profile.derivedFrom.interviewTurnIds.some((id) => !text(id))) {
    fail('profile.derivedFrom.interviewTurnIds entries must be non-empty strings');
  }
  validateStated(profile.stated);
  if (!Array.isArray(profile.inferences)) fail('profile.inferences must be an array');
  validateUniqueIds(profile.inferences, 'profile.inferences');
  profile.inferences.forEach((inference, index) => validateInference(inference, `profile.inferences[${index}]`));
  return true;
}

function statedEntries(stated) {
  const hardConstraints = stated.hardConstraints;
  return [
    ...stated.careerDirection,
    ...stated.motivations,
    ...stated.priorities,
    ...stated.capabilityEvidence,
    ...stated.selfDescribedDifferentiators,
    ...stated.riskTradeoffs,
    ...hardConstraints.locations,
    ...hardConstraints.workMode,
    ...hardConstraints.availability,
    ...hardConstraints.dealBreakers,
    ...['target', 'acceptable', 'minimum']
      .map((field) => hardConstraints.compensation[field])
      .filter(Boolean),
  ];
}

function assertEvidenceReferencesAnsweredTurns(stated, inferences, interview) {
  const answeredTurnIds = new Set(
    interview.turns
      .filter((turn) => turn.answerStatus === InterviewAnswerStatus.ANSWERED)
      .map((turn) => turn.id),
  );
  for (const entry of [...statedEntries(stated), ...inferences]) {
    for (const ref of entry.evidenceRefs) {
      if (ref.sourceType === 'interview_turn' && !answeredTurnIds.has(ref.sourceId)) {
        fail(`evidence reference "${ref.sourceId}" must point to an answered interview turn`);
      }
    }
  }
}

/**
 * Build a profile draft from a locally stored Interview plus explicitly
 * supplied structured entries. This is intentionally not an extraction model:
 * callers must preserve the candidate's wording in the Interview and may only
 * add stated fields supplied or confirmed by the candidate.
 *
 * `previousProfile` is an explicit rebuild path for a stale profile. It never
 * merges interview content automatically: callers still supply the reviewed
 * stated/inference entries for the new draft.
 *
 * @param {{id: string, interview: object, stated?: object, inferences?: object[], previousProfile?: object, now?: string}} input
 * @returns {object}
 */
export function buildCareerProfileDraft({
  id,
  interview,
  stated = {},
  inferences = [],
  previousProfile,
  now = new Date().toISOString(),
}) {
  validateCareerInterview(interview);
  if (previousProfile !== undefined) {
    validateCareerProfile(previousProfile);
    if (text(id) !== previousProfile.id) fail("rebuilt profile id must match previousProfile.id");
    if (previousProfile.derivedFrom.interviewId !== interview.id) {
      fail("rebuilt profile and interview must have the same interview id");
    }
  }
  const normalizedStated = normalizeStated(stated);
  const normalizedInferences = clone(inferences);
  const profile = {
    schemaVersion: 'v0',
    id: text(id),
    locale: interview.locale,
    status: CareerProfileStatus.DRAFT,
    version: previousProfile ? previousProfile.version + 1 : 1,
    createdAt: previousProfile ? previousProfile.createdAt : now,
    updatedAt: now,
    derivedFrom: {
      interviewId: interview.id,
      interviewTurnIds: interview.turns
        .filter((turn) => turn.answerStatus === InterviewAnswerStatus.ANSWERED)
        .map((turn) => turn.id),
      interviewFingerprint: getInterviewFactFingerprint(interview),
    },
    stated: normalizedStated,
    inferences: normalizedInferences,
  };
  validateCareerProfile(profile);
  assertEvidenceReferencesAnsweredTurns(normalizedStated, normalizedInferences, interview);
  return profile;
}

/**
 * User confirmation turns a reviewed draft (or a stale profile refreshed by
 * the caller) into the profile that may drive normal matching. Every state
 * transition receives a monotonically increasing version.
 *
 * @param {object} profile
 * @param {{now?: string}} [options]
 * @returns {object}
 */
export function confirmCareerProfile(profile, { now = new Date().toISOString() } = {}) {
  validateCareerProfile(profile);
  validateIsoTimestamp(now, 'confirmation time');
  const next = clone(profile);
  next.status = CareerProfileStatus.CONFIRMED;
  next.version += 1;
  next.updatedAt = now;
  validateCareerProfile(next);
  return next;
}

/**
 * Detect whether an Interview changed since a profile draft/confirmation was
 * built. It does not merge the new facts: a stale profile must be reviewed and
 * rebuilt intentionally, preventing silent multi-round profile mutation.
 *
 * @param {object} profile
 * @param {object} interview
 * @param {{now?: string}} [options]
 * @returns {object}
 */
export function markProfileStaleIfInterviewChanged(profile, interview, { now = new Date().toISOString() } = {}) {
  validateCareerProfile(profile);
  validateCareerInterview(interview);
  validateIsoTimestamp(now, 'stale marking time');
  if (profile.derivedFrom.interviewId !== interview.id) {
    fail('profile and interview must have the same interview id');
  }
  if (profile.derivedFrom.interviewFingerprint === getInterviewFactFingerprint(interview)) {
    return clone(profile);
  }
  if (profile.status === CareerProfileStatus.STALE) return clone(profile);
  const next = clone(profile);
  next.status = CareerProfileStatus.STALE;
  next.version += 1;
  next.updatedAt = now;
  validateCareerProfile(next);
  return next;
}

/**
 * Produce a profile-only input for the future recruiter rubric. It deliberately
 * accepts no Job, connector, or source argument. Hard constraints are exposed
 * only when both the profile and the individual stated entry are confirmed.
 *
 * @param {object} profile
 * @returns {object}
 */
export function createRecruiterRubricCandidateInput(profile) {
  validateCareerProfile(profile);
  const confirmed = profile.status === CareerProfileStatus.CONFIRMED;
  const stated = clone(profile.stated);
  const constraints = stated.hardConstraints;
  const hardConstraints = {
    locations: confirmed ? constraints.locations.filter((entry) => entry.confirmed) : [],
    workMode: confirmed ? constraints.workMode.filter((entry) => entry.confirmed) : [],
    availability: confirmed ? constraints.availability.filter((entry) => entry.confirmed) : [],
    dealBreakers: confirmed ? constraints.dealBreakers.filter((entry) => entry.confirmed) : [],
    compensationMinimum: confirmed && constraints.compensation.minimum?.confirmed
      ? constraints.compensation.minimum
      : null,
  };
  const compensationPreferences = confirmed
    ? {
      target: constraints.compensation.target?.confirmed ? constraints.compensation.target : null,
      acceptable: constraints.compensation.acceptable?.confirmed ? constraints.compensation.acceptable : null,
      minimum: hardConstraints.compensationMinimum,
    }
    : { target: null, acceptable: null, minimum: null };

  return {
    candidateProfileId: profile.id,
    candidateProfileVersion: profile.version,
    profileStatus: profile.status,
    stated: {
      careerDirection: stated.careerDirection,
      motivations: stated.motivations,
      priorities: stated.priorities,
      capabilityEvidence: stated.capabilityEvidence,
      selfDescribedDifferentiators: stated.selfDescribedDifferentiators,
      riskTradeoffs: stated.riskTradeoffs,
    },
    hardConstraints,
    compensationPreferences,
    inferredSignals: clone(profile.inferences),
  };
}

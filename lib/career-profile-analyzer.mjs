/**
 * Provider-agnostic analysis boundary. Providers return inference proposals;
 * this module never permits them to write stated candidate facts.
 */

import {
  InferenceConfidence,
  validateCareerInterview,
  validateCareerProfile,
} from './career-domain.mjs';

const CONFIDENCES = new Set(Object.values(InferenceConfidence));

function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function hash(value) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.codePointAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function assertEvidenceRefs(refs, answeredTurnIds, path) {
  if (!Array.isArray(refs) || refs.length === 0) throw new Error(`${path}.evidenceRefs is required`);
  for (const ref of refs) {
    if (!isPlainObject(ref) || !text(ref.sourceType) || !text(ref.sourceId)) {
      throw new Error(`${path}.evidenceRefs must use sourceType + sourceId`);
    }
    if (ref.sourceType === 'interview_turn' && !answeredTurnIds.has(ref.sourceId)) {
      throw new Error(`${path}.evidenceRefs must point to an answered interview turn`);
    }
  }
}

function assertProposal(proposal, index, answeredTurnIds) {
  const path = `analysis.inferences[${index}]`;
  if (!isPlainObject(proposal)) throw new Error(`${path} must be an object`);
  if (!text(proposal.kind) || proposal.value === undefined || proposal.value === null || proposal.value === '') {
    throw new Error(`${path} requires kind and value`);
  }
  if (!CONFIDENCES.has(proposal.confidence)) throw new Error(`${path}.confidence is invalid`);
  if (!text(proposal.rationale)) throw new Error(`${path}.rationale is required`);
  if (proposal.needsConfirmation !== true) {
    throw new Error(`${path}.needsConfirmation must be true for analyzer output`);
  }
  assertEvidenceRefs(proposal.evidenceRefs, answeredTurnIds, path);
}

function stableInferenceId(analyzerId, interviewId, proposal, occurrence) {
  const evidence = proposal.evidenceRefs
    .map((ref) => `${ref.sourceType}:${ref.sourceId}`)
    .sort()
    .join('|');
  return `inference-${hash(`${analyzerId}|${interviewId}|${proposal.kind}|${JSON.stringify(proposal.value)}|${evidence}|${occurrence}`)}`;
}

/**
 * An application-layer policy guard. It rejects result shapes that try to
 * carry stated data and creates pending inferences with analyzer provenance.
 */
export function runInferencePolicyGuard({ interview, analysis }) {
  validateCareerInterview(interview);
  if (!isPlainObject(analysis)) throw new Error('analysis must be an object');
  if ('stated' in analysis || 'profile' in analysis || 'hardConstraints' in analysis) {
    throw new Error('analyzer output must not modify stated candidate data');
  }
  if (!text(analysis.analyzerId) || !text(analysis.analyzerVersion)) {
    throw new Error('analysis requires analyzerId and analyzerVersion');
  }
  if (!Array.isArray(analysis.inferences)) throw new Error('analysis.inferences must be an array');
  if (analysis.warnings !== undefined && !Array.isArray(analysis.warnings)) {
    throw new Error('analysis.warnings must be an array when present');
  }

  const answeredTurnIds = new Set(
    interview.turns
      .filter((turn) => turn.answerStatus === 'answered')
      .map((turn) => turn.id),
  );
  const occurrences = new Map();
  const inferences = analysis.inferences.map((proposal, index) => {
    assertProposal(proposal, index, answeredTurnIds);
    const key = `${proposal.kind}|${JSON.stringify(proposal.value)}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return {
      id: stableInferenceId(analysis.analyzerId, interview.id, proposal, occurrence),
      kind: proposal.kind,
      value: clone(proposal.value),
      confidence: proposal.confidence,
      rationale: proposal.rationale,
      evidenceRefs: clone(proposal.evidenceRefs),
      needsConfirmation: true,
      status: 'pending',
      provenance: {
        analyzerId: analysis.analyzerId,
        analyzerVersion: analysis.analyzerVersion,
      },
    };
  });
  return { inferences, warnings: clone(analysis.warnings ?? []) };
}

/**
 * Calls any future CareerProfileAnalyzer safely. The analyzer gets frozen
 * copies of the Interview and stated Profile, and may only return proposals.
 */
export async function analyzeCareerProfile({ analyzer, interview, profile }) {
  if (!analyzer || typeof analyzer.analyze !== 'function' || !text(analyzer.id) || !text(analyzer.version)) {
    throw new Error('CareerProfileAnalyzer requires id, version, and analyze(input)');
  }
  validateCareerInterview(interview);
  validateCareerProfile(profile);
  const input = deepFreeze(clone({
    interview: {
      id: interview.id,
      locale: interview.locale,
      answeredTurns: interview.turns.filter((turn) => turn.answerStatus === 'answered'),
    },
    statedProfile: profile.stated,
    policy: {
      statedReadOnly: true,
      forbiddenStatedFields: ['compensation', 'locations', 'workMode', 'availability', 'dealBreakers', 'priorities'],
      requireEvidenceRefs: true,
      requireNeedsConfirmation: true,
    },
  }));
  const raw = await analyzer.analyze(input);
  return runInferencePolicyGuard({
    interview,
    analysis: {
      ...raw,
      analyzerId: raw?.analyzerId ?? analyzer.id,
      analyzerVersion: raw?.analyzerVersion ?? analyzer.version,
    },
  });
}

/**
 * V0's no-network analyzer. Fixtures are explicit test data; the default
 * analyzer returns no inferences and never inspects or changes stated facts.
 */
export function createMockCareerProfileAnalyzer({
  id = 'mock-career-profile-analyzer',
  version = 'v0',
  inferences = [],
  warnings = [],
} = {}) {
  return Object.freeze({
    id,
    version,
    async analyze() {
      return {
        analyzerId: id,
        analyzerVersion: version,
        inferences: clone(inferences),
        warnings: clone(warnings),
      };
    },
  });
}

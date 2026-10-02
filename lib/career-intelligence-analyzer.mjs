/** Provider-agnostic execution boundary for Career Intelligence. */
import { validateCareerInterview, validateCareerProfile } from './career-domain.mjs';
import { applicableFounderRules, DEFAULT_CAREER_RECOMMENDATION_POLICY } from './career-knowledge/policy.mjs';
import { inferFounderRoleFamily } from './career-knowledge/rule-execution.mjs';
import { stageClock, elapsedMs } from './founder-stage-timing.mjs';

function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function clone(value) { return structuredClone(value); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value); Object.values(value).forEach(freeze); return value;
}

function validateAnalyzer(analyzer) {
  if (!analyzer || typeof analyzer.analyze !== 'function' || !text(analyzer.id) || !text(analyzer.version)) {
    throw new Error('CareerIntelligenceAnalyzer requires id, version, and analyze(input)');
  }
}

function validateResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('CareerIntelligenceAnalyzer returned an invalid result');
  if ('stated' in result || 'hardConstraints' in result || 'profile' in result) {
    throw new Error('CareerIntelligenceAnalyzer must not modify stated candidate data');
  }
  if (!result.careerThesis || !text(result.careerThesis.text) || !Array.isArray(result.nextStageDirections)) {
    throw new Error('CareerIntelligenceAnalyzer result is incomplete');
  }
  return clone(result);
}

function input({ resumeText = '', interview, profile, careerPolicy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  validateCareerInterview(interview); validateCareerProfile(profile);
  const roleFamily = inferFounderRoleFamily(profile);
  const founderRules = applicableFounderRules({ stage: 'search', roleFamily, policy: careerPolicy })
    .map(({ id, principle }) => ({ id, principle }));
  return freeze(clone({
    resumeText: text(resumeText),
    interview: clone(interview),
    answeredTurns: interview.turns.filter((turn) => turn.answerStatus === 'answered'),
    profile: clone(profile),
    statedProfile: profile.stated,
    founderRules,
    policy: {
      statedReadOnly: true,
      forbiddenStatedFields: ['locations', 'dealBreakers', 'minimumCompensation', 'compensation', 'hardConstraints'],
      mustUseEvidence: true,
      allInferencesPending: true,
      noHardFilterOrRankingDecision: true,
    },
  }));
}


function sanitizedProviderFailure(error) {
  const message = text(error instanceof Error ? error.message : '');
  if (/credential/i.test(message)) return 'Qwen credential unavailable';
  const http = message.match(/HTTP\s+(\d{3})/i);
  if (http) return 'Qwen request failed (HTTP ' + http[1] + ')';
  if (/evidenceRefs|answered interview turn/i.test(message)) return 'Qwen output evidence references could not be validated';
  if (/structured|invalid result|unreadable JSON|no structured content/i.test(message)) return 'Qwen structured output could not be accepted';
  if (/network|fetch|ECONN|ENOTFOUND|timeout/i.test(message)) return 'Qwen network request failed';
  return 'Qwen analysis failed validation';
}

/** Runs a provider and, on any provider failure, a local fallback without exposing provider errors or source text. */
export async function analyzeCareerIntelligence({ analyzer, fallbackAnalyzer = null, resumeText, interview, profile, careerPolicy = DEFAULT_CAREER_RECOMMENDATION_POLICY, stageTimings = null }) {
  validateAnalyzer(analyzer);
  if (fallbackAnalyzer) validateAnalyzer(fallbackAnalyzer);
  const safeInput = input({ resumeText, interview, profile, careerPolicy });
  const primaryStarted = stageClock();
  try {
    const result = validateResult(await analyzer.analyze(safeInput));
    if (stageTimings) stageTimings.careerIntelligenceMs = elapsedMs(primaryStarted);
    return { intelligence: result, analyzer: { id: analyzer.id, version: analyzer.version }, usedFallback: false, providerFailure: null };
  } catch (error) {
    if (stageTimings) stageTimings.careerIntelligenceMs = elapsedMs(primaryStarted);
    if (!fallbackAnalyzer) throw error;
    const fallbackStarted = stageClock();
    const result = validateResult(await fallbackAnalyzer.analyze(safeInput));
    if (stageTimings) stageTimings.fallbackIntelligenceMs = elapsedMs(fallbackStarted);
    return { intelligence: result, analyzer: { id: fallbackAnalyzer.id, version: fallbackAnalyzer.version }, usedFallback: true, providerFailure: sanitizedProviderFailure(error) };
  }
}

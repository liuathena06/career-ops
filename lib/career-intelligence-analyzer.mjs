/** Provider-agnostic execution boundary for Career Intelligence. */
import { validateCareerInterview, validateCareerProfile } from './career-domain.mjs';

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

function input({ resumeText = '', interview, profile }) {
  validateCareerInterview(interview); validateCareerProfile(profile);
  return freeze(clone({
    resumeText: text(resumeText),
    interview: clone(interview),
    answeredTurns: interview.turns.filter((turn) => turn.answerStatus === 'answered'),
    profile: clone(profile),
    statedProfile: profile.stated,
    policy: {
      statedReadOnly: true,
      forbiddenStatedFields: ['locations', 'dealBreakers', 'minimumCompensation', 'compensation', 'hardConstraints'],
      mustUseEvidence: true,
      allInferencesPending: true,
      noHardFilterOrRankingDecision: true,
    },
  }));
}

/** Runs a provider and, on any provider failure, a local fallback without exposing provider errors or source text. */
export async function analyzeCareerIntelligence({ analyzer, fallbackAnalyzer = null, resumeText, interview, profile }) {
  validateAnalyzer(analyzer);
  if (fallbackAnalyzer) validateAnalyzer(fallbackAnalyzer);
  const safeInput = input({ resumeText, interview, profile });
  try {
    return { intelligence: validateResult(await analyzer.analyze(safeInput)), analyzer: { id: analyzer.id, version: analyzer.version }, usedFallback: false };
  } catch (error) {
    if (!fallbackAnalyzer) throw error;
    return { intelligence: validateResult(await fallbackAnalyzer.analyze(safeInput)), analyzer: { id: fallbackAnalyzer.id, version: fallbackAnalyzer.version }, usedFallback: true };
  }
}

import { CareerUpsideStatus, OpportunityRelevance } from './opportunity-assessment.mjs';
import { DEFAULT_CAREER_RECOMMENDATION_POLICY } from './career-knowledge/policy.mjs';

function confidence(unknownCount) {
  if (unknownCount === 0) return 'high';
  if (unknownCount <= 2) return 'medium';
  return 'low';
}

/**
 * Internal ordering only. Scores never represent a user-facing match percent.
 * Only shouldShow opportunities may enter this function.
 */
export function rankOpportunities(assessments, { policy = DEFAULT_CAREER_RECOMMENDATION_POLICY } = {}) {
  if (!Array.isArray(assessments)) throw new Error('Opportunity ranking requires an assessment array');
  const ids = new Set();
  const coherenceRule = policy.rules.find((item) => item.id === 'industry_continuity');
  return assessments.map((assessment) => {
    if (assessment?.hardFilter?.outcome !== 'pass' || assessment?.shouldShow !== true) {
      throw new Error('Only showable, hard-filter-passing opportunities can be ranked');
    }
    if (!assessment.jobId || ids.has(assessment.jobId)) throw new Error('Opportunity ranking requires unique job ids');
    ids.add(assessment.jobId);
    const dimensions = assessment.dimensions ?? {};
    const coherence = assessment.policyExecution?.careerCoherence ?? 'unknown';
    const weights = policy.dimensionWeights;
    const cashRule = policy.rules.find((item) => item.id === 'fixed_cash');
    const weighted = [
      ['careerDirection', weights.careerCoherence],
      ['capabilityPlausibility', weights.roleScopeCapability],
      ['seniorityScope', weights.industryPlatform],
      ...(cashRule?.strength === 'disabled' ? [] : [['compensation', weights.compensation]]),
    ];
    const known = weighted.filter(([key]) => dimensions[key]?.judgment !== 'unknown' && dimensions[key]?.judgment);
    const scale = { strong_fit: 1, fit: 0.75, mixed: 0.25 };
    const relevancePoints = known.reduce((total, [key, weight]) => total + weight * (scale[dimensions[key].judgment] ?? 0), 0);
    const knownWeight = known.reduce((total, [, weight]) => total + weight, 0);
    const evidenceScore = knownWeight ? Math.round(100 * relevancePoints / knownWeight) : null;
    const formalUpsideRule = policy.rules.find((item) => item.id === 'career_upside');
    const upsidePoints = formalUpsideRule?.strength !== 'disabled' && assessment.careerUpside?.status === CareerUpsideStatus.PRESENT ? 10 : 0;
    const coherenceBonus = coherence === 'compatible' && coherenceRule?.strength !== 'disabled'
      ? (coherenceRule?.rankingWeight ?? (coherenceRule?.strength === 'strong' ? 20 : 12)) : 0;
    const unknownCount = assessment.unknowns?.length ?? 0;
    return {
      jobId: assessment.jobId,
      rankingScore: evidenceScore === null ? null : evidenceScore + upsidePoints + coherenceBonus,
      rankingConfidence: confidence(unknownCount),
      careerCoherence: coherence,
    };
  }).sort((a, b) => (coherenceRule?.strength !== 'disabled' && coherenceRule?.rankingWeight === null
    ? (b.careerCoherence === 'compatible') - (a.careerCoherence === 'compatible') : 0)
    || (b.rankingScore ?? -1) - (a.rankingScore ?? -1) || a.jobId.localeCompare(b.jobId, 'zh-CN'));
}

export { OpportunityRelevance };

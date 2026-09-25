import { CareerUpsideStatus, OpportunityRelevance } from './opportunity-assessment.mjs';

const WEIGHTS = Object.freeze({
  careerDirection: { strong_fit: 32, fit: 24, mixed: 8, unknown: 0 },
  capabilityPlausibility: { strong_fit: 24, fit: 18, mixed: 6, unknown: 0 },
  seniorityScope: { strong_fit: 16, fit: 12, mixed: 4, unknown: 0 },
  compensation: { strong_fit: 12, fit: 9, mixed: 3, unknown: 0 },
});

function confidence(unknownCount) {
  if (unknownCount === 0) return 'high';
  if (unknownCount <= 2) return 'medium';
  return 'low';
}

/**
 * Internal ordering only. Scores never represent a user-facing match percent.
 * Only shouldShow opportunities may enter this function.
 */
export function rankOpportunities(assessments) {
  if (!Array.isArray(assessments)) throw new Error('Opportunity ranking requires an assessment array');
  const ids = new Set();
  return assessments.map((assessment) => {
    if (assessment?.hardFilter?.outcome !== 'pass' || assessment?.shouldShow !== true) {
      throw new Error('Only showable, hard-filter-passing opportunities can be ranked');
    }
    if (!assessment.jobId || ids.has(assessment.jobId)) throw new Error('Opportunity ranking requires unique job ids');
    ids.add(assessment.jobId);
    const dimensions = assessment.dimensions ?? {};
    const relevancePoints = Object.entries(WEIGHTS).reduce((total, [key, weights]) => (
      total + (weights[dimensions[key]?.judgment] ?? 0)
    ), 0);
    const upsidePoints = assessment.careerUpside?.status === CareerUpsideStatus.PRESENT ? 25 : 0;
    const unknownCount = assessment.unknowns?.length ?? 0;
    return {
      jobId: assessment.jobId,
      rankingScore: Math.max(0, relevancePoints + upsidePoints - (unknownCount * 3)),
      rankingConfidence: confidence(unknownCount),
    };
  }).sort((a, b) => b.rankingScore - a.rankingScore || a.jobId.localeCompare(b.jobId, 'zh-CN'));
}

export { OpportunityRelevance };

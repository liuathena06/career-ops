import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFounderFlow } from '../lib/founder-flow-diagnostics.mjs';

const profile = {
  status: 'confirmed',
  stated: {
    careerDirection: [{ confirmed: true, value: '产品经理' }], capabilityEvidence: [{ confirmed: true, value: '产品交付' }],
    hardConstraints: { locations: [{ confirmed: true, value: '上海' }], compensation: { minimum: { confirmed: true, value: '30k/月' } } },
  },
};

test('flow summary reports sparse-card unknowns without treating them as a hard filter', () => {
  const summary = summarizeFounderFlow({
    profile, intent: { jobName: '产品经理', location: '上海' }, liepinResultCount: 2, mappedJobs: 2, skippedJobs: 0, ranked: [],
    assessments: [{
      shouldShow: false, hardFilter: { outcome: 'pass' },
      dimensions: { careerDirection: { judgment: 'mixed' }, capabilityPlausibility: { judgment: 'unknown', jobEvidence: [] }, compensation: { judgment: 'unknown' } },
      careerUpside: { status: 'absent' },
    }],
  });
  assert.equal(summary.profile.confirmed, true);
  assert.equal(summary.opportunityAssessment.shouldShow, 0);
  assert.equal(summary.opportunityAssessment.hardFiltered, 0);
  assert.equal(summary.ranking.entered, false);
  assert.ok(summary.opportunityAssessment.primaryHiddenReasons.some((item) => item.reason === 'career direction weak'));
});


test('flow summary breaks hard filters down by source-agnostic reason and preserves safe examples', () => {
  const summary = summarizeFounderFlow({
    profile, intent: { jobName: '产品经理', location: '上海' }, liepinResultCount: 3, mappedJobs: 3, skippedJobs: 0, ranked: [],
    filteredExamples: [{ jobLocation: '北京-朝阳', candidateLocations: ['北京', '上海'], filterReasons: ['LOCATION_CONFLICT'] }],
    assessments: [
      { shouldShow: false, hardFilter: { outcome: 'filtered_out', reasons: ['LOCATION_CONFLICT'] }, dimensions: {}, careerUpside: {} },
      { shouldShow: false, hardFilter: { outcome: 'filtered_out', reasons: ['MINIMUM_COMPENSATION_CONFLICT'] }, dimensions: {}, careerUpside: {} },
      { shouldShow: false, hardFilter: { outcome: 'filtered_out', reasons: ['DEAL_BREAKER_CONFLICT'] }, dimensions: {}, careerUpside: {} },
    ],
  });
  assert.deepEqual(summary.opportunityAssessment.hardFilterBreakdown, { locationConflict: 1, minimumCompensationConflict: 1, dealBreakerConflict: 1 });
  assert.equal(summary.opportunityAssessment.filteredExamples.length, 1);
});

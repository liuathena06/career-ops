import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCareerProfileDraft, confirmCareerProfile, createCareerInterview } from '../lib/career-domain.mjs';
import { createDiscoveryJob, enrichFromManualPaste, promoteToEvaluatable } from '../lib/job-domain.mjs';
import {
  CareerUpsideStatus,
  OpportunityRecommendation,
  OpportunityRelevance,
  assessOpportunity,
} from '../lib/opportunity-assessment.mjs';

const now = '2026-09-25T00:00:00.000Z';
const jd = `
岗位职责：
1. 负责 AI产品商业化方案的设计、交付和持续迭代，推动跨团队推进并对业务结果负责。
2. 与研发、销售和客户团队协作，持续识别复杂业务问题并形成可复用产品能力。
3. 推动关键决策落地，跟踪核心指标和客户价值。

任职要求：
1. 有 AI产品相关经验，能够承担跨团队推进和复杂项目管理责任。
2. 具备五年以上产品或解决方案工作经验，善于沟通、分析和业务协作。
3. 对商业化和企业服务场景有清晰理解。
`;

function entry(id, value) {
  return { id, value, confirmed: true, evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-1' }] };
}

function profile(overrides = {}) {
  const interview = createCareerInterview({
    schemaVersion: 'v0', id: 'interview-opportunity', locale: 'zh-CN', status: 'completed', createdAt: now, updatedAt: now,
    turns: [{ id: 'turn-1', topic: 'direction', questionId: 'career-direction-v0', question: '方向？', answerStatus: 'answered', userAnswer: 'AI产品与跨团队推进', capturedAt: now }],
  });
  const draft = buildCareerProfileDraft({
    id: 'profile-opportunity', interview, now,
    stated: {
      careerDirection: [entry('direction', 'AI产品')],
      capabilityEvidence: [entry('capability', '跨团队推进')],
      hardConstraints: {
        locations: [entry('location', '上海')], workMode: [], availability: [], dealBreakers: [],
        compensation: { target: entry('target', '40k/月'), acceptable: entry('acceptable', '35k/月'), minimum: entry('minimum', '30k/月') },
      },
      ...overrides,
    },
  });
  return confirmCareerProfile(draft, { now });
}

function job({ id = 'job-opportunity', source = { kind: 'manual' }, listing = {}, description = jd } = {}) {
  const discovery = createDiscoveryJob({
    id, source,
    listing: { title: 'AI产品商业化负责人', companyName: '示例公司', location: '上海', salary: '40-50k/月', ...listing },
  });
  const enriched = enrichFromManualPaste(discovery, { jobId: id, description, capturedAt: now }).job;
  return promoteToEvaluatable(enriched).job;
}

test('a confirmed profile and an evaluatable opportunity can be recommended without source-specific logic', () => {
  const result = assessOpportunity({ profile: profile(), job: job({ source: { kind: 'ats' } }) });
  assert.equal(result.hardFilter.outcome, 'pass');
  assert.equal(result.dimensions.careerDirection.judgment, OpportunityRelevance.FIT);
  assert.equal(result.dimensions.capabilityPlausibility.judgment, OpportunityRelevance.FIT);
  assert.equal(result.careerUpside.status, CareerUpsideStatus.PRESENT);
  assert.equal(result.shouldShow, true);
  assert.equal(result.recommendation, OpportunityRecommendation.APPLY);
});

test('only explicit confirmed location, deal-breaker, or minimum compensation conflicts filter a Job out', () => {
  const locationConflict = assessOpportunity({ profile: profile(), job: job({ listing: { location: '北京' } }) });
  assert.equal(locationConflict.hardFilter.outcome, 'filtered_out');
  assert.equal(locationConflict.shouldShow, false);
  assert.equal(locationConflict.recommendation, null);

  const minimumConflict = assessOpportunity({ profile: profile(), job: job({ listing: { salary: '20-25k/月' } }) });
  assert.equal(minimumConflict.hardFilter.outcome, 'filtered_out');
  assert.ok(minimumConflict.hardFilter.reasons.includes('MINIMUM_COMPENSATION_CONFLICT'));
});

test('missing Job facts remain unknown and can still support exploration when the opportunity has clear direction value', () => {
  const result = assessOpportunity({ profile: profile(), job: job({ listing: { salary: undefined } }) });
  assert.equal(result.hardFilter.outcome, 'pass');
  assert.equal(result.dimensions.compensation.judgment, OpportunityRelevance.UNKNOWN);
  assert.equal(result.shouldShow, true);
  assert.equal(result.recommendation, OpportunityRecommendation.EXPLORE);
});

test('a title alone never establishes seniority or scope relevance', () => {
  const withoutScopeEvidence = jd.replaceAll('跨团队推进', '常规协作');
  const result = assessOpportunity({
    profile: profile(),
    job: job({ listing: { title: '跨团队推进高级负责人' }, description: withoutScopeEvidence }),
  });
  assert.equal(result.dimensions.seniorityScope.judgment, OpportunityRelevance.MIXED);
});

test('a job with no clear direction relevance is retained as low priority rather than shown or filtered', () => {
  const unrelatedJd = jd.replaceAll('AI产品', '供应链采购').replaceAll('跨团队推进', '供应商管理');
  const result = assessOpportunity({ profile: profile(), job: job({ listing: { title: '采购经理' }, description: unrelatedJd }) });
  assert.equal(result.hardFilter.outcome, 'pass');
  assert.equal(result.dimensions.careerDirection.judgment, OpportunityRelevance.MIXED);
  assert.equal(result.careerUpside.status, CareerUpsideStatus.ABSENT);
  assert.equal(result.shouldShow, false);
  assert.equal(result.recommendation, OpportunityRecommendation.LOW_PRIORITY);
});

test("an assessment requires a confirmed profile but keeps sparse discovery cards as unknown", () => {
  const draftProfile = structuredClone(profile());
  draftProfile.status = "draft";
  assert.throws(() => assessOpportunity({ profile: draftProfile, job: job() }), /confirmed CareerProfile/);
  const discovery = createDiscoveryJob({ id: "discovery", listing: { title: "AI产品经理", location: "上海" } });
  const result = assessOpportunity({ profile: profile(), job: discovery });
  assert.equal(result.dimensions.capabilityPlausibility.judgment, OpportunityRelevance.UNKNOWN);
  assert.equal(result.shouldShow, true);
});


test('a Beijing district card satisfies a confirmed Beijing location constraint', () => {
  const cityProfile = structuredClone(profile());
  cityProfile.stated.hardConstraints.locations[0].value = '北京';
  const result = assessOpportunity({ profile: cityProfile, job: job({ listing: { location: '北京-朝阳' } }) });
  assert.equal(result.hardFilter.outcome, 'pass');
  assert.ok(!result.hardFilter.reasons.includes('LOCATION_CONFLICT'));
});

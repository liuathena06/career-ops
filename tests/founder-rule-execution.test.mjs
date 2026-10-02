import test from 'node:test';
import assert from 'node:assert/strict';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { createDiscoveryJob } from '../lib/job-domain.mjs';
import { createMockCareerIntelligenceAnalyzer, createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';
import { analyzeCareerIntelligence } from '../lib/career-intelligence-analyzer.mjs';
import { assessOpportunity } from '../lib/opportunity-assessment.mjs';
import { rankOpportunities } from '../lib/opportunity-ranking.mjs';
import { createCareerRecommendationPolicy } from '../lib/career-knowledge/policy.mjs';

function candidate() {
  return createFounderConfirmedProfile({ id: 'rule-test', now: '2026-09-28T00:00:00.000Z', answers: {
    'career-direction-v0': { raw: '继续企业级云计算解决方案销售', searchRole: '云计算销售负责人' },
    'career-capabilities-v0': { raw: '做过企业级云计算解决方案销售和政企客户拓展' },
    'career-constraints-v0': { raw: '上海', locations: '上海' },
  } }).profile;
}

function card(id, industry, title = '销售经理') {
  return { jobId: id, jobName: title, industry, location: '上海' };
}

function assessment(profile, item, policy) {
  const job = createDiscoveryJob({ id: item.jobId, listing: { title: item.jobName, location: item.location } });
  return assessOpportunity({ profile, job, discoveryCard: item, policy });
}

test('Founder rules gate search and Discovery across unrelated industries without a case-specific exception', () => {
  const profile = candidate();
  const intelligence = { nextStageDirections: [
    { kind: 'direct', searchTitle: '云计算销售负责人' },
    { kind: 'adjacent', searchTitle: '医药销售经理' },
    { kind: 'adjacent', searchTitle: '网络安全销售经理' },
  ] };
  const search = createOpportunitySearchStrategy({ profile, intelligence });
  assert.deepEqual([...new Set(search.searches.map((item) => item.jobName))], ['云计算销售负责人', '网络安全销售经理']);
  assert.ok(search.policyExecution.ruleResults.some((item) => item.ruleId === 'industry_continuity'));
  const unrelated = assessment(profile, card('unrelated', '医药'));
  assert.equal(unrelated.hardFilter.outcome, 'pass');
  assert.equal(unrelated.policyExecution.careerCoherence, 'discontinuous');
  assert.equal(unrelated.shouldShow, false);
  assert.equal(unrelated.careerUpside.status, 'unknown');
  const undisclosed = assessment(profile, card('undisclosed', ''));
  assert.equal(undisclosed.policyExecution.careerCoherence, 'unknown');
});

test('coherent Discovery opportunities rank first; policy configuration changes execution', () => {
  const profile = candidate();
  const coherent = assessment(profile, card('coherent', '企业软件', '云计算销售负责人'));
  const unknown = assessment(profile, card('unknown', '', '云计算销售负责人'));
  assert.deepEqual(rankOpportunities([unknown, coherent]).map((item) => item.jobId), ['coherent', 'unknown']);
  const disabled = createCareerRecommendationPolicy({ ruleOverrides: { industry_continuity: { strength: 'disabled' } } });
  const unrelated = assessment(profile, card('unrelated', '医药', '云计算销售负责人'), disabled);
  assert.equal(unrelated.policyExecution.careerCoherence, 'unknown');
  assert.equal(unrelated.shouldShow, true);
  assert.equal(unrelated.careerUpside.status, 'unknown');
  assert.equal(unrelated.upsideSignal.status, 'present');
});

test('hard filters cannot be rescued by career coherence or a ranking score', () => {
  const profile = candidate();
  const result = assessment(profile, { ...card('wrong-city', '企业软件', '云计算销售负责人'), location: '北京' });
  assert.equal(result.hardFilter.outcome, 'filtered_out');
  assert.equal(result.shouldShow, false);
  assert.throws(() => rankOpportunities([result]), /Only showable/u);
});

test('disabling search exploration retains only a confirmed direct direction', () => {
  const profile = candidate();
  const policy = createCareerRecommendationPolicy({ ruleOverrides: { search_direction: { strength: 'disabled' } } });
  const strategy = createOpportunitySearchStrategy({ profile, policy, intelligence: { nextStageDirections: [
    { kind: 'direct', searchTitle: '云计算销售负责人' },
    { kind: 'direct', searchTitle: '医药销售负责人' },
  ] } });
  assert.deepEqual(strategy.searches.map((item) => item.jobName), ['云计算销售负责人']);
});

test('local stage diagnostics contain elapsed time only', async () => {
  const founded = createFounderConfirmedProfile({ id: 'timing-test', now: '2026-09-28T00:00:00.000Z', answers: {
    'career-direction-v0': { raw: '销售方向', searchRole: '销售经理' },
  } });
  const stageTimings = {};
  const result = await analyzeCareerIntelligence({ analyzer: createMockCareerIntelligenceAnalyzer(),
    resumeText: 'Synthetic resume only', interview: founded.interview, profile: founded.profile, stageTimings });
  createOpportunitySearchStrategy({ profile: founded.profile, intelligence: result.intelligence, stageTimings });
  assert.ok(Number.isInteger(stageTimings.careerIntelligenceMs));
  assert.ok(Number.isInteger(stageTimings.knowledgeLookupMs));
  assert.ok(Object.values(stageTimings).every((item) => typeof item === 'number' && item >= 0));
  assert.doesNotMatch(JSON.stringify(stageTimings), /Synthetic resume/u);
});

test('configured coherence ranking weight can change ordering without affecting hard filters', () => {
  const rankedInput = (jobId, coherence, judgment) => ({ jobId, shouldShow: true, hardFilter: { outcome: 'pass' },
    policyExecution: { careerCoherence: coherence }, unknowns: [], careerUpside: { status: 'unknown' },
    dimensions: { careerDirection: { judgment }, capabilityPlausibility: { judgment },
      seniorityScope: { judgment }, compensation: { judgment } } });
  const items = [rankedInput('coherent', 'compatible', 'fit'), rankedInput('unknown', 'unknown', 'strong_fit')];
  assert.deepEqual(rankOpportunities(items).map((item) => item.jobId), ['coherent', 'unknown']);
  const policy = createCareerRecommendationPolicy({ ruleOverrides: { industry_continuity: { rankingWeight: 0 } } });
  assert.deepEqual(rankOpportunities(items, { policy }).map((item) => item.jobId), ['unknown', 'coherent']);
});

test('a discontinuous stretch is visible only when the search direction carries candidate evidence', () => {
  const profile = createFounderConfirmedProfile({ id: 'pr-stretch', now: '2026-09-29T00:00:00.000Z', answers: {
    'career-direction-v0': { raw: '继续企业传播', searchRole: '公关总监' },
    'career-capabilities-v0': { raw: '负责过品牌与产品发布项目' },
    'career-constraints-v0': { raw: '北京', locations: '北京' },
  } }).profile;
  const job = createDiscoveryJob({ id: 'stretch-product', listing: { title: '产品总监', location: '北京' } });
  const unsupported = assessOpportunity({ profile, job, discoveryCard: { jobName: '产品总监', searchDirection: 'stretch' } });
  assert.equal(unsupported.shouldShow, false);
  const supported = assessOpportunity({ profile, job, discoveryCard: { jobName: '产品总监', searchDirection: 'stretch',
    stretchEvidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-evidence' }] } });
  assert.equal(supported.shouldShow, true);
  assert.equal(supported.policyExecution.careerCoherence, 'stretch');
});

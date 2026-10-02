import test from 'node:test';
import assert from 'node:assert/strict';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { createDiscoveryJob } from '../lib/job-domain.mjs';
import { assessOpportunity } from '../lib/opportunity-assessment.mjs';
import { summarizeFounderFlow } from '../lib/founder-flow-diagnostics.mjs';
import { aggregateRankedCompanies } from '../lib/founder-company-aggregation.mjs';
import { compareLocationToCities } from '../lib/location-normalization.mjs';
import { rankOpportunities } from '../lib/opportunity-ranking.mjs';
import { roleFamilyFromTitle } from '../lib/career-role-normalization.mjs';
import { createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';

function profile() {
  return createFounderConfirmedProfile({ id: 'synthetic-pr', now: '2026-09-29T00:00:00.000Z', answers: {
    'career-direction-v0': { raw: '继续公关与企业传播', searchRole: 'PR 总监' },
    'career-capabilities-v0': { raw: '有媒体关系和企业传播经验' },
    'career-constraints-v0': { raw: '北京', locations: '北京' },
  } }).profile;
}

function assess(candidate, id, title, location = '北京') {
  const job = createDiscoveryJob({ id, listing: { title, location } });
  return assessOpportunity({ profile: candidate, job, discoveryCard: { jobId: id, jobName: title, location } });
}

test('Beijing municipality hierarchy accepts its districts while preserving multi-city boundaries', () => {
  for (const district of ['房山区', '通州区', '海淀区', '延庆区']) {
    assert.equal(compareLocationToCities(['北京'], district), 'compatible');
  }
  assert.equal(compareLocationToCities(['北京', '上海'], '上海市浦东新区'), 'compatible');
  assert.equal(compareLocationToCities(['北京'], '上海市浦东新区'), 'conflict');
  assert.equal(compareLocationToCities(['北京'], '地点待定'), 'unknown');
});

test('PR, IR and communications card titles stay explorable; card unknowns become needs detail', () => {
  const candidate = profile();
  const cards = [
    assess(candidate, 'pr', 'PR Director / 公关总监', '房山区'),
    assess(candidate, 'ir', 'Head of Investor Relations / 投资者关系总监', '通州区'),
    assess(candidate, 'cco', 'Chief Communications Officer (CCO) / 首席传播官'),
    assess(candidate, 'unknown', '战略项目负责人'),
    assess(candidate, 'unrelated', '制造业销售经理'),
    assess(candidate, 'wrong-city', '公关总监', '上海市'),
  ];
  for (const item of cards.slice(0, 3)) {
    assert.equal(item.hardFilter.outcome, 'pass');
    assert.equal(item.shouldShow, true);
    assert.equal(item.careerUpside.status, 'unknown');
    assert.equal(item.dimensions.capabilityPlausibility.judgment, 'unknown');
    assert.ok(item.needsDetail.some((value) => value.includes('capabilityPlausibility')));
  }
  assert.equal(cards[0].dimensions.careerDirection.relation, 'aligned');
  assert.equal(cards[1].dimensions.careerDirection.relation, 'adjacent');
  assert.equal(cards[2].dimensions.careerDirection.relation, 'aligned');
  assert.equal(cards[3].discoveryStatus, 'needs_detail');
  assert.equal(cards[3].shouldShow, true);
  assert.equal(cards[4].shouldShow, false);
  assert.equal(cards[4].policyExecution.careerCoherenceReason, 'role_family_conflict');
  assert.equal(cards[5].hardFilter.outcome, 'filtered_out');
  const ranked = rankOpportunities(cards.filter((item) => item.shouldShow));
  const companyCards = aggregateRankedCompanies({ ranked, cardsByJobId: new Map(cards.map((item) => [item.jobId,
    { company: item.jobId, jobName: item.jobId }])), topN: 10 });
  assert.equal(ranked.length, 4);
  assert.equal(companyCards.length, 4);
  const summary = summarizeFounderFlow({ profile: candidate, intents: [], liepinResultCount: cards.length,
    mappedJobs: cards.length, skippedJobs: 0, assessments: cards, ranked, displayedCompanies: companyCards.length });
  assert.equal(summary.opportunityAssessment.hardFiltered, 1);
  assert.equal(summary.opportunityAssessment.shouldShow, 4);
  assert.equal(summary.ranking.topN, 4);
  assert.deepEqual(new Set(summary.opportunityAssessment.primaryHiddenReasons.map((item) => item.reason)),
    new Set(['hard constraint conflict', 'career continuity weak']));
});

test('explicit non-adjacent role families are conflicts while genuinely unknown titles remain explorable', () => {
  const candidate = profile();
  const conflicts = [
    ['medical', 'Senior Medical Director', 'medical_clinical'],
    ['ehs', 'EHS专业顾问', 'ehs'],
    ['learning', '学习发展 Leader', 'hr'],
    ['recruiting', '招聘 Leader', 'hr'],
    ['operations', '净菜运营总监', 'operations'],
    ['general-management', '业务副总经理', 'general_management'],
  ];
  for (const [id, title, family] of conflicts) {
    assert.equal(roleFamilyFromTitle(title), family);
    const result = assess(candidate, id, title);
    assert.equal(result.dimensions.careerDirection.relation, 'discontinuous');
    assert.equal(result.policyExecution.careerCoherenceReason, 'role_family_conflict');
    assert.equal(result.shouldShow, false);
  }
  const unknown = assess(candidate, 'unknown-specialist', '战略项目专家');
  assert.equal(unknown.dimensions.careerDirection.relation, 'unknown');
  assert.equal(unknown.shouldShow, true);
});

test('PR candidate trace keeps coherent search directions, rejects returned role noise, and still ranks results', () => {
  const candidate = profile();
  const intelligence = { nextStageDirections: [
    { kind: 'direct', searchTitle: 'PR 总监', needsConfirmation: false },
    { kind: 'adjacent', searchTitle: 'Head of Investor Relations / 投资者关系总监', needsConfirmation: true },
    { kind: 'adjacent', searchTitle: 'Chief Communications Officer (CCO) / 首席传播官', needsConfirmation: true },
    { kind: 'adjacent', searchTitle: '招聘 Leader', needsConfirmation: true },
  ] };
  const strategy = createOpportunitySearchStrategy({ profile: candidate, intelligence });
  assert.deepEqual(strategy.searches.map((item) => item.jobName), [
    'PR 总监',
    'Head of Investor Relations / 投资者关系总监',
    'Chief Communications Officer (CCO) / 首席传播官',
  ]);
  const returned = [
    ['pr', 'PR Director / 公关总监'],
    ['ir', 'Head of Investor Relations / 投资者关系总监'],
    ['cco', 'Chief Communications Officer (CCO) / 首席传播官'],
    ['unknown', '战略项目专家'],
    ['medical', 'Senior Medical Director'],
    ['ehs', 'EHS专业顾问'],
    ['learning', '学习发展 Leader'],
    ['recruiting', '招聘 Leader'],
    ['operations', '净菜运营总监'],
    ['general-management', '业务副总经理'],
  ].map(([id, title]) => assess(candidate, id, title));
  const visible = returned.filter((item) => item.shouldShow);
  assert.deepEqual(visible.map((item) => item.jobId), ['pr', 'ir', 'cco', 'unknown']);
  const ranked = rankOpportunities(visible);
  assert.equal(ranked.length, 4);
  assert.ok(ranked.some((item) => item.jobId === 'pr'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';
import { createDiscoveryJob } from '../lib/job-domain.mjs';
import { assessOpportunity } from '../lib/opportunity-assessment.mjs';
import { rankOpportunities } from '../lib/opportunity-ranking.mjs';
import { DEFAULT_CAREER_KNOWLEDGE, createCareerKnowledgeCatalog, normalizeCareerTitle, knowledgeForStage, buildCareerKnowledgeContext, marketSignalsForContext } from '../lib/career-knowledge/index.mjs';
import { createCareerRecommendationPolicy, applicableFounderRules, FOUNDER_RULEBOOK } from '../lib/career-knowledge/policy.mjs';
import { runCareerKnowledgeSmoke } from '../scripts/career-knowledge-smoke.mjs';

const now = '2026-09-28T00:00:00.000Z';
function candidate(direction = '销售经理') {
  return createFounderConfirmedProfile({ id: 'synthetic-test', now, answers: {
    'career-direction-v0': { raw: 'Synthetic test direction.', searchRole: direction },
    'career-constraints-v0': { raw: 'Synthetic location.', locations: '上海' },
  } }).profile;
}
function strategyFor(profile, extra = {}) {
  return createOpportunitySearchStrategy({ profile, intelligence: { nextStageDirections: [
    { kind: 'direct', searchTitle: profile.stated.careerDirection[0].value, needsConfirmation: false },
  ] }, ...extra });
}

test('official sales occupation example reaches the existing Search Strategy offline', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Knowledge must stay offline'); };
  try { assert.equal(runCareerKnowledgeSmoke().status, 'PASS'); }
  finally { globalThis.fetch = originalFetch; }
});

test('sample budget, traceability and official-only provenance are explicit', () => {
  const records = DEFAULT_CAREER_KNOWLEDGE.stableCareerKnowledge;
  assert.equal(records.filter((item) => item.kind === 'occupation').length, 4);
  assert.ok(records.length < 50);
  for (const item of [...records, ...FOUNDER_RULEBOOK]) {
    assert.ok(item.source.id && item.version && item.provenance.locator);
    assert.ok(item.applicableStages.length && item.chinaApplicability.boundary);
  }
  for (const item of records.filter((entry) => entry.source.authority === 'official')) {
    assert.match(item.provenance.responseSha256, /^[a-f0-9]{64}$/u);
    assert.equal(item.version, 'snapshot-2026-09-28');
    assert.equal(item.provenance.sourceReleaseVerified, false);
    assert.equal(item.chinaApplicability.status, 'reference_only');
  }
  assert.equal(DEFAULT_CAREER_KNOWLEDGE.dynamicMarketSignals.length, 0);
  assert.equal(DEFAULT_CAREER_KNOWLEDGE.deferredSources[0].source.authority, 'third_party');
  assert.equal(DEFAULT_CAREER_KNOWLEDGE.deferredSources[0].status, 'deferred_not_imported');
});

test('Chinese aliases retain distinct O*NET and ESCO interpretations and their local provenance', () => {
  const result = normalizeCareerTitle({ title: ' 销售经理 ' });
  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates.every((item) => item.bases.includes('provisional_chinese_alias')));
  assert.equal(result.uncertainty, 'LEXICAL_REFERENCE_NOT_ROLE_EQUIVALENCE');
});

test('ESCO official alternative titles resolve real essential and optional skill relationships', () => {
  const profile = candidate('IT account manager');
  const knowledge = strategyFor(profile).knowledgeContext;
  assert.equal(knowledge.occupations[0].data.preferredTitle, 'ICT account manager');
  assert.ok(knowledge.relevantSkills.some((item) => item.label === 'perform customers’ needs analysis' && item.relationship === 'essential'));
  assert.ok(knowledge.relevantSkills.some((item) => item.label === 'set sales goals' && item.relationship === 'optional'));
  // An ESCO essential relationship is not re-labelled as an O*NET transferable skill.
  assert.equal(knowledge.transferableSkills.length, 0);
});

test('unknown titles preserve the original search, without fuzzy title or seniority guesses', () => {
  for (const title of ['云计算销售负责人', '高级销售经理', '销售', 'Unknown Specialist']) {
    const strategy = strategyFor(candidate(title));
    assert.equal(strategy.searches[0].jobName, title);
    assert.equal(strategy.knowledgeContext.status, 'unknown');
    assert.deepEqual(strategy.searches[0].knowledgeRefs, []);
    assert.deepEqual(strategy.knowledgeContext.proposedSearches, []);
  }
});

test('empty knowledge keeps manual/confirmed direction search complete', () => {
  const strategy = strategyFor(candidate(), { knowledgeCatalog: createCareerKnowledgeCatalog({ stableCareerKnowledge: [] }) });
  assert.equal(strategy.searches[0].jobName, '销售经理');
  assert.equal(strategy.knowledgeContext.status, 'unknown');
});

test('pending directions and unconfirmed profiles do not become knowledge-backed facts', () => {
  const profile = candidate();
  profile.stated.careerDirection[0].confirmed = false;
  assert.equal(buildCareerKnowledgeContext({ profile }).status, 'unknown');
  profile.status = 'draft';
  assert.throws(() => buildCareerKnowledgeContext({ profile }), /confirmed Career Profile/u);
});

test('knowledge does not change Profile, sparse Job, hard filters or recommendation ranking', () => {
  const profile = candidate();
  const job = createDiscoveryJob({ id: 'synthetic-job', listing: { title: '销售经理', location: '上海' } });
  const originalProfile = structuredClone(profile);
  const originalJob = structuredClone(job);
  const before = assessOpportunity({ profile, job });
  const rankedBefore = rankOpportunities([before]);
  const knowledge = strategyFor(profile).knowledgeContext;
  assert.deepEqual(profile, originalProfile);
  assert.deepEqual(job, originalJob);
  assert.deepEqual(assessOpportunity({ profile, job }), before);
  assert.deepEqual(rankOpportunities([before]), rankedBefore);
  assert.ok(knowledge.relevantSkills.every((item) => item.candidateCapability === 'unknown' && item.jobRequirement === 'unknown'));
  assert.ok(knowledge.tasks.every((item) => item.candidateExperience === 'unknown' && item.jobRequirement === 'unknown'));
  assert.equal(knowledge.scoringUse, 'none');
  assert.equal(job.details, null);
  const conflicting = createDiscoveryJob({ id: 'conflict', listing: { title: '销售经理', location: '北京' } });
  assert.equal(assessOpportunity({ profile, job: conflicting }).hardFilter.outcome, 'filtered_out');
});

test('adjacent occupations retain uncertainty and two-sided skill-reference provenance', () => {
  const strategy = strategyFor(candidate());
  const knowledge = strategy.knowledgeContext;
  const adjacent = knowledge.adjacentOccupations.find((item) => item.occupationId === 'onet:11-2021.00');
  assert.equal(adjacent.transitionReadiness, 'unknown');
  assert.ok(adjacent.sharedSkillIds.includes('onet-label:negotiation'));
  assert.ok(adjacent.knowledgeRefs.includes('onet:11-2021.00:sc:negotiation'));
  for (const ref of adjacent.knowledgeRefs) assert.ok(knowledge.references.some((record) => record.id === ref));
  assert.equal(strategy.searches.length, 1);
  assert.ok(knowledge.proposedSearches.every((item) => item.requiresConfirmation && item.autoExecute === false));
});

test('discovery cannot expose typical occupation skills/tasks as job facts', () => {
  assert.ok(knowledgeForStage({ stage: 'discovery' }).every((item) => ['occupation', 'title_mapping'].includes(item.kind)));
  assert.ok(knowledgeForStage({ stage: 'detail' }).some((item) => item.kind === 'task'));
  assert.throws(() => knowledgeForStage({ stage: 'invalid' }), /unknown stage/u);
});

test('Founder corrections and experimental parameters are retained without activating a scorer', () => {
  const policy = createCareerRecommendationPolicy({ version: 'v0.2-test',
    thresholds: { strongRecommendation: 80, worthExploring: 65 },
    dimensionWeights: { careerCoherence: 35, industryPlatform: 10 },
    ruleOverrides: { industry_continuity: { strength: 'strong', roleFamilies: ['sales'], applicableStages: ['detail'], rankingWeight: 2 } },
  });
  assert.equal(policy.thresholds.strongRecommendation, 80);
  assert.equal(policy.thresholds.experimental, true);
  assert.equal(policy.thresholds.enabled, false);
  assert.equal(policy.externalKnowledgeScoring, false);
  assert.equal(policy.stageSemantics.discovery, 'upside_signal');
  assert.equal(policy.stageSemantics.detail, 'career_upside_requires_evidence');
  assert.equal(policy.unknownHandling, 'preserve_without_zero_or_penalty');
  assert.equal(policy.rules.find((item) => item.id === 'industry_continuity').version, 'v0.2-test');
  const discovery = applicableFounderRules({ stage: 'discovery', roleFamily: 'sales', policy });
  assert.ok(discovery.some((item) => item.id === 'upside_signal'));
  assert.ok(!discovery.some((item) => ['career_upside', 'search_direction', 'industry_continuity'].includes(item.id)));
  const detail = applicableFounderRules({ stage: 'detail', roleFamily: 'finance', policy });
  assert.ok(detail.some((item) => item.id === 'general_functions'));
  assert.ok(!detail.some((item) => item.id === 'industry_continuity'));
});

test('policy cannot weaken hard constraints, score Search Direction or broaden detail evidence into discovery', () => {
  for (const ruleOverrides of [
    { confirmed_hard_constraints: { strength: 'disabled' } },
    { search_direction: { rankingWeight: 10 } },
    { career_upside: { applicableStages: ['discovery'] } },
  ]) assert.throws(() => createCareerRecommendationPolicy({ ruleOverrides }));
  assert.throws(() => createCareerRecommendationPolicy({ dimensionWeights: { compensation: 99 } }), /sum to 100/u);
  assert.throws(() => createCareerRecommendationPolicy({ thresholds: { worthExploring: 90 } }), /ordered/u);
});

test('disabling or narrowing the search knowledge rule preserves original searches', () => {
  for (const override of [{ strength: 'disabled' }, { roleFamilies: ['technical'] }]) {
    const policy = createCareerRecommendationPolicy({ ruleOverrides: { search_direction: override } });
    const strategy = strategyFor(candidate(), { roleFamily: 'sales', policy });
    assert.equal(strategy.knowledgeContext.status, 'unknown');
    assert.equal(strategy.searches[0].jobName, '销售经理');
  }
});

test('invalid provenance, foreign requirement fields, mirrors and dangling mappings fail closed', () => {
  const base = DEFAULT_CAREER_KNOWLEDGE.stableCareerKnowledge;
  for (const mutate of [
    (rows) => { delete rows[0].provenance; },
    (rows) => { rows[0].source.url = 'https://unofficial-mirror.example/data'; },
    (rows) => { rows[0].source.authority = 'third_party'; },
    (rows) => { rows[0].data.educationRequirement = 'US degree'; },
    (rows) => { rows[0].data.salary = 100000; },
    (rows) => { rows[0].data.qualification = 'EU licence'; },
    (rows) => { rows[0].chinaApplicability.status = 'chinese_job_requirement'; },
    (rows) => { rows.push(structuredClone(rows[0])); },
    (rows) => { rows.find((item) => item.kind === 'title_mapping').data.occupationIds = ['not-in-sample']; },
  ]) {
    const rows = structuredClone(base);
    mutate(rows);
    assert.throws(() => createCareerKnowledgeCatalog({ stableCareerKnowledge: rows }), /Career knowledge:/u);
  }
});

function marketFixture() {
  return {
    id: 'synthetic-market', kind: 'market_signal', version: 'test-v1',
    source: { id: 'synthetic-test', authority: 'synthetic', url: 'test:market-signal' },
    provenance: { method: 'synthetic_test', locator: 'synthetic row', capturedAt: '2026-09-01' },
    applicableStages: ['detail'],
    chinaApplicability: { status: 'test_only', boundary: 'Synthetic test observation; no live market claim.' },
    data: { metric: 'synthetic_count', value: 0, unit: 'count', geography: 'CN-Shanghai', population: 'synthetic-sales', periodStart: '2026-08-01', periodEnd: '2026-08-31', expiresAt: '2026-09-30' },
  };
}

test('dynamic signals require comparable context and an unexpired dated observation', () => {
  const catalog = createCareerKnowledgeCatalog({ dynamicMarketSignals: [marketFixture()] });
  const query = { catalog, stage: 'detail', geography: 'CN-Shanghai', population: 'synthetic-sales', asOf: '2026-09-28' };
  assert.equal(marketSignalsForContext(query).status, 'available');
  assert.equal(marketSignalsForContext(query).records[0].data.value, 0);
  for (const change of [{ stage: 'discovery' }, { geography: 'US' }, { population: 'all-workers' }, { asOf: '2026-10-01' }, { asOf: '2026-08-30' }]) {
    assert.equal(marketSignalsForContext({ ...query, ...change }).status, 'unknown');
  }
  assert.equal(marketSignalsForContext({ ...query, catalog: DEFAULT_CAREER_KNOWLEDGE }).status, 'unknown');
});

test('dynamic signals cannot be inserted into stable knowledge or omit observation dates', () => {
  assert.throws(() => createCareerKnowledgeCatalog({ stableCareerKnowledge: [marketFixture()] }), /layer/u);
  const missingDate = marketFixture();
  delete missingDate.data.periodEnd;
  assert.throws(() => createCareerKnowledgeCatalog({ dynamicMarketSignals: [missingDate] }), /field/u);
  const wrongOrder = marketFixture();
  wrongOrder.data.periodEnd = '2026-12-31';
  assert.throws(() => createCareerKnowledgeCatalog({ dynamicMarketSignals: [wrongOrder] }), /chronology/u);
});

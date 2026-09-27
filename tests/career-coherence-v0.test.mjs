import test from 'node:test';
import assert from 'node:assert/strict';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';
import { assessJobCareerCoherence, qualifyCareerDirection } from '../lib/career-coherence-v0.mjs';
import { createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';

const answers = {
  'career-context-v0': { raw: '希望发挥企业级客户资源，可以转相邻技术赛道。' },
  'career-direction-v0': { raw: '继续做企业级云计算解决方案销售。', searchRole: '云计算销售负责人' },
  'career-priorities-v0': { raw: '客户群与职业连续性。' },
  'career-constraints-v0': { raw: '北京或上海。', locations: '北京，上海' },
  'career-capabilities-v0': { raw: '长期负责企业大客户云计算解决方案销售。' },
  'career-differentiation-v0': { raw: '熟悉政企客户采购和复杂销售。' },
  'career-compensation-v0': { raw: '暂不设置最低门槛。' },
  'career-risk-tradeoffs-v0': { raw: '愿意尝试相邻软件赛道，不考虑零售式销售。' },
};

const ref = [{ sourceType: 'interview_turn', sourceId: 'turn-career-capabilities-v0' }];
const { profile } = createFounderConfirmedProfile({ answers, id: 'coherence', now: '2026-09-26T00:00:00.000Z' });
const intelligence = {
  coreCapabilities: [{ value: '企业客户解决方案销售', evidenceRefs: ref }],
  transferableCapabilities: [{ value: '企业级客户需求洞察', evidenceRefs: ref }],
  nextStageDirections: [
    { kind: 'direct', searchTitle: '云计算销售负责人', reason: '既有行业', evidenceRefs: ref },
    { kind: 'adjacent', searchTitle: '企业软件销售', reason: '客户群相近', evidenceRefs: ref },
    { kind: 'adjacent', searchTitle: '保险销售', reason: '只因职位名相似', evidenceRefs: ref },
    { kind: 'stretch', searchTitle: '制造业销售', reason: '跨行业', evidenceRefs: ref },
    { kind: 'stretch', searchTitle: '网络安全销售', reason: '企业客户能力可迁移', evidenceRefs: ref },
  ],
};

test('willingness to change industry does not open unrelated sales sectors', () => {
  const searches = createOpportunitySearchStrategy({ profile, intelligence }).searches;
  assert.deepEqual([...new Set(searches.map((item) => item.jobName))], ['云计算销售负责人', '企业软件销售', '网络安全销售']);
  assert.deepEqual([...new Set(searches.map((item) => item.location))], ['北京', '上海']);
});

test('stretch requires explicit transferable-capability evidence', () => {
  assert.equal(qualifyCareerDirection({ profile, intelligence: { transferableCapabilities: [] }, direction: intelligence.nextStageDirections[4] }), null);
  assert.ok(qualifyCareerDirection({ profile, intelligence, direction: intelligence.nextStageDirections[4] }));
});

test('sparse sales cards use only explicit continuity clues, not age or invented JD facts', () => {
  assert.equal(assessJobCareerCoherence({ profile, card: { jobName: '保险销售', industry: '保险' } }).reason, 'industry_capital_conflict');
  assert.equal(assessJobCareerCoherence({ profile, card: { jobName: '制造业销售', industry: '机械制造' } }).status, 'discontinuous');
  assert.equal(assessJobCareerCoherence({ profile, card: { jobName: '工业软件大客户销售', industry: '工业软件' } }).status, 'compatible');
  assert.equal(assessJobCareerCoherence({ profile, card: { jobName: '销售经理' } }).status, 'unknown');
});

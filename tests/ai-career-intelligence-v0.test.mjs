import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiCareerProfileSummary, createOpportunitySearchStrategy } from '../lib/ai-career-intelligence-v0.mjs';
import { createFounderConfirmedProfile } from '../lib/founder-career-flow.mjs';

const answers = {
  'career-context-v0': { raw: '希望承担更完整的产品商业化工作。' },
  'career-direction-v0': { raw: '希望成为更完整的 AI 产品负责人。', searchRole: 'AI产品经理' },
  'career-priorities-v0': { raw: '成长空间\n行业方向\n薪资' },
  'career-constraints-v0': { raw: '优先上海。', locations: '上海' },
  'career-capabilities-v0': { raw: '负责过 AI 产品从需求到上线的跨团队推进。' },
  'career-differentiation-v0': { raw: '能把客户问题转化为可落地的产品方案。' },
  'career-compensation-v0': { raw: '暂不设定。' },
  'career-risk-tradeoffs-v0': { raw: '愿意接受业务尚未验证。' },
};

test('mock intelligence keeps stated profile unchanged and marks inferred directions pending', () => {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'intelligence', now: '2026-09-26T00:00:00.000Z' });
  const before = structuredClone(profile.stated);
  const summary = buildAiCareerProfileSummary({ resumeText: 'English resume text', interview, profile });
  assert.deepEqual(profile.stated, before);
  assert.equal(summary.resumeTextAvailable, true);
  assert.deepEqual(summary.nextStageDirections.map((item) => item.kind), ['direct', 'adjacent', 'stretch']);
  assert.ok(summary.needsConfirmation.every((item) => item.status === 'pending' && item.needsConfirmation));
});

test('search strategy issues direct, adjacent, and stretch probes while retaining confirmed location', () => {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'strategy', now: '2026-09-26T00:00:00.000Z' });
  const intelligence = buildAiCareerProfileSummary({ interview, profile });
  const strategy = createOpportunitySearchStrategy({ profile, intelligence });
  assert.deepEqual(strategy.searches.map((item) => item.kind), ['direct', 'adjacent', 'stretch']);
  assert.ok(strategy.searches.every((item) => item.location === '上海'));
  assert.equal(strategy.searches[0].explorationOnly, false);
  assert.ok(strategy.searches.slice(1).every((item) => item.explorationOnly));
});

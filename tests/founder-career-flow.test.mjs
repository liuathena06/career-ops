import test from 'node:test';
import assert from 'node:assert/strict';
import { createFounderConfirmedProfile, profileSearchIntent } from '../lib/founder-career-flow.mjs';

const answers = {
  'career-context-v0': { raw: '希望寻找更有成长空间的机会。' },
  'career-direction-v0': { raw: '希望做更完整的 AI 产品商业化工作。', searchRole: 'AI产品经理' },
  'career-priorities-v0': { raw: '成长空间\n行业方向\n薪资' },
  'career-constraints-v0': { raw: '优先上海，不接受长期驻场。', locations: '上海', dealBreakers: '长期驻场' },
  'career-capabilities-v0': { raw: '负责过 AI 产品从需求到上线的跨团队推进。' },
  'career-differentiation-v0': { raw: '能把客户问题转化为可落地的产品方案。' },
  'career-compensation-v0': { raw: '理想 45k，可接受 40k，最低 35k。', target: '45k/月', acceptable: '40k/月', minimum: '35k/月' },
  'career-risk-tradeoffs-v0': { raw: '愿意接受业务尚未验证，但不接受长期驻场。' },
};

test('Founder flow creates a confirmed Profile from explicit answers without a model', () => {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'test', now: '2026-09-25T00:00:00.000Z' });
  assert.equal(interview.turns.length, 8);
  assert.equal(profile.status, 'confirmed');
  assert.equal(profile.stated.hardConstraints.locations[0].value, '上海');
  assert.equal(profile.stated.hardConstraints.compensation.minimum.value, '35k/月');
});

test('Founder search intent is derived only from confirmed Profile facts', () => {
  const { profile } = createFounderConfirmedProfile({ answers, id: 'test', now: '2026-09-25T00:00:00.000Z' });
  assert.deepEqual(profileSearchIntent(profile), { jobName: 'AI产品经理', location: '上海' });
});

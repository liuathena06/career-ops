import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCareerIntelligence } from '../lib/career-intelligence-analyzer.mjs';
import { createMockCareerIntelligenceAnalyzer } from '../lib/ai-career-intelligence-v0.mjs';
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

function fixture() { return createFounderConfirmedProfile({ answers, id: 'intelligence-interface', now: '2026-09-26T00:00:00.000Z' }); }

test('formal analyzer interface runs the deterministic mock without changing the Profile', async () => {
  const { interview, profile } = fixture(); const before = structuredClone(profile.stated);
  const result = await analyzeCareerIntelligence({ analyzer: createMockCareerIntelligenceAnalyzer(), resumeText: 'safe local text', interview, profile });
  assert.equal(result.usedFallback, false); assert.equal(result.intelligence.analyzer.mode, 'deterministic_mock');
  assert.deepEqual(profile.stated, before);
});

test('provider failures use the deterministic fallback without exposing provider errors', async () => {
  const { interview, profile } = fixture();
  const failed = { id: 'failed-provider', version: 'v0', async analyze() { throw new Error('provider response contained a secret'); } };
  const result = await analyzeCareerIntelligence({ analyzer: failed, fallbackAnalyzer: createMockCareerIntelligenceAnalyzer(), interview, profile });
  assert.equal(result.usedFallback, true); assert.equal(result.analyzer.id, 'mock-ai-career-intelligence');
});


test('provider fallback reports only a sanitized failure category', async () => {
  const { interview, profile } = fixture();
  const failed = { id: 'failed-provider', version: 'v0', async analyze() { throw new Error('internal provider failure detail'); } };
  const result = await analyzeCareerIntelligence({ analyzer: failed, fallbackAnalyzer: createMockCareerIntelligenceAnalyzer(), interview, profile });
  assert.equal(result.providerFailure, 'Qwen analysis failed validation');
  assert.ok(!result.providerFailure.includes('internal'));
});

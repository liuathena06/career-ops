import test from 'node:test';
import assert from 'node:assert/strict';
import { createBailianQwenCareerIntelligenceAnalyzer } from '../lib/bailian-qwen-career-intelligence.mjs';
import { analyzeCareerIntelligence } from '../lib/career-intelligence-analyzer.mjs';
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

test('Bailian adapter requests strict structured output and returns only pending intelligence proposals', async () => {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'qwen', now: '2026-09-26T00:00:00.000Z' });
  const directionTurn = interview.turns.find((turn) => turn.questionId === 'career-direction-v0');
  const capabilityTurn = interview.turns.find((turn) => turn.questionId === 'career-capabilities-v0');
  let request;
  const analyzer = createBailianQwenCareerIntelligenceAnalyzer({ apiKey: 'test-only-key', fetchImpl: async (_url, init) => ({ ok: true, status: 200, async json() { request = JSON.parse(init.body); return { choices: [{ message: { content: JSON.stringify({ careerThesis: '面向 AI 产品商业化的下一阶段探索。', careerThesisEvidenceRefs: [{ sourceType: 'interview_turn', sourceId: directionTurn.id }], coreCapabilities: [{ value: '跨团队产品推进', rationale: '来自项目经历', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: capabilityTurn.id }] }], transferableCapabilities: [{ value: '需求到上线的推进能力', rationale: '来自项目经历', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: capabilityTurn.id }] }], directions: [{ kind: 'adjacent', searchTitle: '产品经理', reason: '相邻探索方向', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: directionTurn.id }] }], uncertainties: ['行业偏好仍需确认'] }) } }] }; } }) });
  const result = await analyzeCareerIntelligence({ analyzer, interview, profile });
  assert.equal(request.model, 'qwen3.7-plus');
  assert.equal(request.enable_thinking, false);
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(result.usedFallback, false);
  assert.ok(result.intelligence.needsConfirmation.every((item) => item.status === 'pending'));
  assert.equal(profile.stated.hardConstraints.locations[0].value, '上海');
});

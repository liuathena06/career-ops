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
  const timing = {};
  let calls = 0;
  const analyzer = createBailianQwenCareerIntelligenceAnalyzer({ apiKey: 'test-only-key', onTiming: (stage, ms) => { timing[stage] = ms; }, fetchImpl: async (_url, init) => { calls += 1; return { ok: true, status: 200, async json() { request = JSON.parse(init.body); return { choices: [{ message: { content: JSON.stringify({ careerThesis: '面向 AI 产品商业化的下一阶段探索。', careerThesisEvidenceRefs: [{ sourceType: 'interview_turn', sourceId: directionTurn.id }], coreCapabilities: [{ value: '跨团队产品推进', rationale: '来自项目经历', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: capabilityTurn.id }] }], transferableCapabilities: [{ value: '需求到上线的推进能力', rationale: '来自项目经历', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: capabilityTurn.id }] }], directions: [{ kind: 'adjacent', searchTitle: '产品经理', reason: '相邻探索方向', evidenceRefs: [{ sourceType: 'interview_turn', sourceId: directionTurn.id }] }], uncertainties: ['行业偏好仍需确认'] }) } }] }; } }; } });
  const result = await analyzeCareerIntelligence({ analyzer, interview, profile });
  assert.equal(request.model, 'qwen3.7-plus');
  assert.equal(request.enable_thinking, false);
  assert.equal(request.response_format.type, 'json_schema');
  assert.match(request.messages[0].content, /Employer industry exposure/u);
  assert.equal(calls, 1);
  assert.ok(Number.isInteger(timing.qwenHttpMs));
  assert.ok(Number.isInteger(timing.qwenDecodeMs));
  assert.equal(result.usedFallback, false);
  assert.ok(result.intelligence.needsConfirmation.every((item) => item.status === 'pending'));
  assert.equal(profile.stated.hardConstraints.locations[0].value, '上海');
});

test('an employer name cannot become deep industry specialization or invent an adjacent sector', async () => {
  const prAnswers = {
    ...answers,
    'career-direction-v0': { raw: '继续从事公关与企业传播。', searchRole: 'PR 总监' },
    'career-capabilities-v0': { raw: '负责媒体关系和企业传播。' },
  };
  const { interview, profile } = createFounderConfirmedProfile({ answers: prAnswers, id: 'qwen-pr', now: '2026-09-29T00:00:00.000Z' });
  const resumeText = '华铁通达高铁装备股份有限公司\n公关负责人\n负责媒体沟通与新闻稿。';
  const analyzer = createBailianQwenCareerIntelligenceAnalyzer({ apiKey: 'test-only-key', fetchImpl: async () => ({
    ok: true, status: 200, async json() { return { choices: [{ message: { content: JSON.stringify({
      careerThesis: '深耕能源与轨道交通行业的资深公关专家。',
      careerThesisEvidenceRefs: [{ sourceType: 'resume', sourceId: 'local_resume' }],
      coreCapabilities: [{ value: '深厚的能源行业专业知识', rationale: '来自雇主名称', evidenceRefs: [{ sourceType: 'resume', sourceId: 'local_resume' }] }],
      transferableCapabilities: [],
      directions: [{ kind: 'adjacent', searchTitle: '能源行业公关总监', reason: '深耕能源行业', evidenceRefs: [{ sourceType: 'resume', sourceId: 'local_resume' }] }],
      uncertainties: [],
    }) } }] }; },
  }) });
  const result = await analyzeCareerIntelligence({ analyzer, resumeText, interview, profile });
  assert.doesNotMatch(result.intelligence.careerThesis.text, /深耕|能源/u);
  assert.equal(result.intelligence.coreCapabilities.length, 0);
  assert.ok(!result.intelligence.nextStageDirections.some((item) => /能源/u.test(item.searchTitle)));
  assert.match(result.intelligence.warnings.join('\n'), /employer industry exposure/u);
  assert.equal(result.intelligence.evidencePolicy.rejectedClaims.length, 3);
});

test('an employer description saying the company is deeply specialized is still exposure-only', async () => {
  const { interview, profile } = createFounderConfirmedProfile({ answers, id: 'qwen-employer-copy', now: '2026-09-29T00:00:00.000Z' });
  const analyzer = createBailianQwenCareerIntelligenceAnalyzer({ apiKey: 'test-only-key', fetchImpl: async () => ({
    ok: true, status: 200, async json() { return { choices: [{ message: { content: JSON.stringify({
      careerThesis: '深耕轨道交通行业的产品专家。',
      careerThesisEvidenceRefs: [{ sourceType: 'resume', sourceId: 'local_resume' }],
      coreCapabilities: [], transferableCapabilities: [], directions: [], uncertainties: [],
    }) } }] }; },
  }) });
  const result = await analyzeCareerIntelligence({ analyzer,
    resumeText: '某某装备集团\n公司深耕轨道交通行业二十年\n产品经理', interview, profile });
  assert.doesNotMatch(result.intelligence.careerThesis.text, /深耕轨道交通/u);
  assert.equal(result.intelligence.evidencePolicy.rejectedClaims.length, 1);
});

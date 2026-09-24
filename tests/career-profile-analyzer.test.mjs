import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CareerInterviewQuestionBankV0,
  buildStatedProfileFromInterview,
} from '../lib/career-interview-question-bank.mjs';
import {
  analyzeCareerProfile,
  createMockCareerProfileAnalyzer,
} from '../lib/career-profile-analyzer.mjs';
import {
  buildCareerProfileDraft,
  confirmCareerProfile,
  createCareerInterview,
  createRecruiterRubricCandidateInput,
} from '../lib/career-domain.mjs';

const now = '2026-09-24T00:00:00.000Z';

function definition(id) {
  return CareerInterviewQuestionBankV0.find((item) => item.questionId === id);
}

function turn(questionId, userAnswer, confirmedAnswer) {
  const item = definition(questionId);
  return {
    id: `turn-${questionId}`,
    topic: item.topic,
    questionId,
    question: item.question,
    answerStatus: 'answered',
    userAnswer,
    confirmedAnswer,
    capturedAt: now,
  };
}

function fixture() {
  const interview = createCareerInterview({
    schemaVersion: 'v0',
    id: 'analyzer-interview',
    locale: 'zh-CN',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    turns: [
      turn('career-direction-v0', '我希望承担更完整的 AI 产品商业化责任。', {
        careerDirection: ['承担更完整的 AI 产品商业化责任'],
      }),
      turn('career-constraints-v0', '只考虑上海混合办公，不接受长期驻场。', {
        locations: ['上海'],
        workMode: ['混合办公'],
        availability: [],
        dealBreakers: ['长期驻场'],
      }),
      turn('career-compensation-v0', '理想 45k，可接受 38k，最低 35k。', {
        target: '45k/月', acceptable: '38k/月', minimum: '35k/月',
      }),
    ],
  });
  const profile = buildCareerProfileDraft({
    id: 'analyzer-profile',
    interview,
    stated: buildStatedProfileFromInterview(interview),
    now,
  });
  return { interview, profile };
}

test('MockCareerProfileAnalyzer is provider-agnostic and returns pending inference provenance', async () => {
  const { interview, profile } = fixture();
  const analyzer = createMockCareerProfileAnalyzer({
    inferences: [{
      kind: 'seniority_hypothesis',
      value: '候选人可能适合更大范围的产品经营责任。',
      confidence: 'medium',
      rationale: '职业方向强调完整商业化责任。',
      evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-career-direction-v0' }],
      needsConfirmation: true,
    }],
  });
  const result = await analyzeCareerProfile({ analyzer, interview, profile });
  assert.equal(result.inferences.length, 1);
  assert.equal(result.inferences[0].status, 'pending');
  assert.equal(result.inferences[0].needsConfirmation, true);
  assert.equal(result.inferences[0].provenance.analyzerId, 'mock-career-profile-analyzer');
  assert.ok(result.inferences[0].id.startsWith('inference-'));
});

test('analyzer output cannot modify stated candidate data', async () => {
  const { interview, profile } = fixture();
  const maliciousAnalyzer = {
    id: 'malicious-test-analyzer',
    version: 'v0',
    async analyze() {
      return { stated: { priorities: ['薪资'] }, inferences: [], warnings: [] };
    },
  };
  await assert.rejects(
    () => analyzeCareerProfile({ analyzer: maliciousAnalyzer, interview, profile }),
    /must not modify stated candidate data/,
  );
  assert.equal(profile.stated.hardConstraints.compensation.minimum.value, '35k/月');
});

test('unconfirmed analyzer inference never enters the hard-filter projection', async () => {
  const { interview, profile } = fixture();
  const analyzer = createMockCareerProfileAnalyzer({
    inferences: [{
      kind: 'risk_signal',
      value: '候选人可能接受较高业务不确定性。',
      confidence: 'low',
      rationale: '职业方向包含更大职责范围。',
      evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-career-direction-v0' }],
      needsConfirmation: true,
    }],
  });
  const analysis = await analyzeCareerProfile({ analyzer, interview, profile });
  const confirmedProfile = confirmCareerProfile({ ...profile, inferences: analysis.inferences }, { now });
  const projection = createRecruiterRubricCandidateInput(confirmedProfile);
  assert.equal(projection.hardConstraints.compensationMinimum.value, '35k/月');
  assert.equal('risk_signal' in projection.hardConstraints, false);
  assert.equal(projection.inferredSignals[0].status, 'pending');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CareerProfileStatus,
  InterviewAnswerStatus,
  InferenceConfidence,
  buildCareerProfileDraft,
  confirmCareerProfile,
  createCareerInterview,
  createRecruiterRubricCandidateInput,
  markProfileStaleIfInterviewChanged,
  validateCareerProfile,
} from '../lib/career-domain.mjs';

const createdAt = '2026-09-24T00:00:00.000Z';
const confirmedAt = '2026-09-24T00:01:00.000Z';
const staleAt = '2026-09-24T00:02:00.000Z';
const reconfirmedAt = '2026-09-24T00:03:00.000Z';

function interview(overrides = {}) {
  return createCareerInterview({
    schemaVersion: 'v0',
    id: 'interview-1',
    locale: 'zh-CN',
    status: 'completed',
    createdAt,
    updatedAt: createdAt,
    turns: [
      {
        id: 'turn-direction',
        topic: 'direction',
        questionId: 'direction-v0',
        question: '下一阶段希望承担什么样的职责？',
        answerStatus: InterviewAnswerStatus.ANSWERED,
        userAnswer: '我希望继续做 AI 产品，承担更完整的商业化和跨团队推进责任。',
        capturedAt: createdAt,
      },
      {
        id: 'turn-constraint',
        topic: 'constraints',
        questionId: 'constraints-v0',
        question: '哪些条件不能接受？',
        answerStatus: InterviewAnswerStatus.ANSWERED,
        userAnswer: '我不能接受长期驻场，优先上海或远程。',
        capturedAt: createdAt,
      },
      {
        id: 'turn-skipped',
        topic: 'compensation',
        questionId: 'compensation-v0',
        question: '你的薪资底线是什么？',
        answerStatus: InterviewAnswerStatus.SKIPPED,
        capturedAt: createdAt,
      },
      {
        id: 'turn-followup',
        topic: 'capabilities',
        questionId: 'capabilities-v0',
        question: '请补充一个能证明影响力的案例。',
        answerStatus: InterviewAnswerStatus.NEEDS_FOLLOWUP,
        userAnswer: '我需要整理后补充。',
        capturedAt: createdAt,
      },
    ],
    ...overrides,
  });
}

const directionEntry = {
  id: 'stated-direction',
  value: '继续做 AI 产品，并扩大商业化和跨团队推进范围',
  confirmed: true,
  evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-direction' }],
};

const hardConstraint = {
  id: 'constraint-onsite',
  value: '不接受长期驻场；优先上海或远程',
  confirmed: true,
  evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-constraint' }],
};

const inference = {
  id: 'inference-seniority-1',
  kind: 'seniority_hypothesis',
  value: '候选人可能适合承担更大范围的产品经营责任',
  confidence: InferenceConfidence.MEDIUM,
  rationale: '基于其对商业化和跨团队推进范围的自述。',
  needsConfirmation: true,
  evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-direction' }],
};

function draft({ stated = {}, inferences = [inference] } = {}) {
  return buildCareerProfileDraft({
    id: 'profile-1',
    interview: interview(),
    stated: {
      careerDirection: [directionEntry],
      hardConstraints: [hardConstraint],
      ...stated,
    },
    inferences,
    now: createdAt,
  });
}

test('user wording remains in stated data and is never overwritten by an AI inference', () => {
  const profile = draft({
    inferences: [{ ...inference, value: 'AI 产品岗位最适合该候选人' }],
  });
  assert.equal(profile.stated.careerDirection[0].value, directionEntry.value);
  assert.equal(profile.inferences[0].value, 'AI 产品岗位最适合该候选人');
  assert.notEqual(profile.stated.careerDirection[0], profile.inferences[0]);
});

test('hard constraints can only originate from confirmed stated data', () => {
  const unconfirmed = { ...hardConstraint, confirmed: false };
  const profile = confirmCareerProfile(draft({ stated: { hardConstraints: [unconfirmed] } }), { now: confirmedAt });
  const input = createRecruiterRubricCandidateInput(profile);
  assert.deepEqual(input.hardConstraints, []);
  assert.equal(input.inferredSignals[0].kind, 'seniority_hypothesis');
});

test('every inference requires evidence references', () => {
  assert.throws(
    () => draft({ inferences: [{ ...inference, evidenceRefs: [] }] }),
    /inferences\[0\]\.evidenceRefs must not be empty/,
  );
});

test('inferences accept low, medium, and high confidence', () => {
  for (const confidence of Object.values(InferenceConfidence)) {
    const profile = draft({ inferences: [{ ...inference, id: `inference-${confidence}`, confidence }] });
    assert.equal(profile.inferences[0].confidence, confidence);
  }
});

test('user confirmation changes profile status to confirmed', () => {
  const confirmed = confirmCareerProfile(draft(), { now: confirmedAt });
  assert.equal(confirmed.status, CareerProfileStatus.CONFIRMED);
  assert.equal(confirmed.version, 2);
});

test('a changed answered interview fact makes the profile stale', () => {
  const confirmed = confirmCareerProfile(draft(), { now: confirmedAt });
  const changedInterview = interview();
  changedInterview.turns[1].userAnswer = '我只考虑上海，不考虑远程。';
  changedInterview.updatedAt = staleAt;
  const stale = markProfileStaleIfInterviewChanged(confirmed, changedInterview, { now: staleAt });
  assert.equal(stale.status, CareerProfileStatus.STALE);
  assert.equal(stale.version, 3);
});

test('skipped and needs_followup turns cannot become confirmed profile facts', () => {
  assert.throws(
    () => draft({
      stated: {
        priorities: [{
          id: 'priority-from-skipped',
          value: '高薪',
          confirmed: true,
          evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-skipped' }],
        }],
      },
    }),
    /must point to an answered interview turn/,
  );
  assert.throws(
    () => draft({
      stated: {
        capabilityEvidence: [{
          id: 'capability-from-followup',
          value: '跨团队推进能力',
          confirmed: true,
          evidenceRefs: [{ sourceType: 'interview_turn', sourceId: 'turn-followup' }],
        }],
      },
    }),
    /must point to an answered interview turn/,
  );
});

test('rubric projection excludes hard constraints until the profile and entry are confirmed', () => {
  const profile = draft();
  assert.deepEqual(createRecruiterRubricCandidateInput(profile).hardConstraints, []);

  const confirmed = confirmCareerProfile(profile, { now: confirmedAt });
  assert.deepEqual(createRecruiterRubricCandidateInput(confirmed).hardConstraints, [hardConstraint]);
});

test('profile version increases again after stale profile is re-confirmed', () => {
  const confirmed = confirmCareerProfile(draft(), { now: confirmedAt });
  const changedInterview = interview();
  changedInterview.turns[0].userAnswer = '我希望转向更偏产品战略的岗位。';
  changedInterview.updatedAt = staleAt;
  const stale = markProfileStaleIfInterviewChanged(confirmed, changedInterview, { now: staleAt });
  const refreshedDraft = buildCareerProfileDraft({
    id: stale.id,
    interview: changedInterview,
    stated: stale.stated,
    inferences: stale.inferences,
    previousProfile: stale,
    now: reconfirmedAt,
  });
  const reconfirmed = confirmCareerProfile(refreshedDraft, { now: reconfirmedAt });
  assert.equal(reconfirmed.status, CareerProfileStatus.CONFIRMED);
  assert.equal(reconfirmed.version, 5);
  assert.equal(reconfirmed.derivedFrom.interviewFingerprint, JSON.stringify([
    {
      id: "turn-direction",
      topic: "direction",
      userAnswer: "我希望转向更偏产品战略的岗位。",
    },
    {
      id: "turn-constraint",
      topic: "constraints",
      userAnswer: "我不能接受长期驻场，优先上海或远程。",
    },
  ]));
});

test('rubric projection is Job-source agnostic because it accepts only a Career Profile', () => {
  const input = createRecruiterRubricCandidateInput(confirmCareerProfile(draft(), { now: confirmedAt }));
  assert.equal('job' in input, false);
  assert.equal('source' in input, false);
  assert.equal(input.stated.careerDirection[0].value, directionEntry.value);
  validateCareerProfile(draft());
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CareerInterviewQuestionBankV0,
  buildStatedProfileFromInterview,
  validateCareerInterviewQuestionBankV0,
} from '../lib/career-interview-question-bank.mjs';
import { createCareerInterview } from '../lib/career-domain.mjs';

const now = '2026-09-24T00:00:00.000Z';

const expectedQuestionIds = [
  'career-context-v0',
  'career-direction-v0',
  'career-priorities-v0',
  'career-constraints-v0',
  'career-capabilities-v0',
  'career-differentiation-v0',
  'career-compensation-v0',
  'career-risk-tradeoffs-v0',
];

function definition(id) {
  return CareerInterviewQuestionBankV0.find((item) => item.questionId === id);
}

function turn(questionId, answerStatus, userAnswer, confirmedAnswer) {
  const item = definition(questionId);
  return {
    id: `turn-${questionId}`,
    topic: item.topic,
    questionId,
    question: item.question,
    answerStatus,
    ...(userAnswer === undefined ? {} : { userAnswer }),
    ...(confirmedAnswer === undefined ? {} : { confirmedAnswer }),
    capturedAt: now,
  };
}

function interview(turns) {
  return createCareerInterview({
    schemaVersion: 'v0',
    id: 'question-bank-interview',
    locale: 'zh-CN',
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    turns,
  });
}

test('Question Bank V0 has exactly eight stable and unique core question IDs', () => {
  assert.equal(validateCareerInterviewQuestionBankV0(), true);
  assert.equal(CareerInterviewQuestionBankV0.length, 8);
  assert.deepEqual(CareerInterviewQuestionBankV0.map((item) => item.questionId), expectedQuestionIds);
  assert.equal(new Set(expectedQuestionIds).size, 8);
});

test('every Question Definition maps to its intended Profile field', () => {
  const mappings = Object.fromEntries(CareerInterviewQuestionBankV0.map((item) => [
    item.questionId,
    item.mappings.map((mapping) => mapping.to),
  ]));
  assert.deepEqual(mappings, {
    'career-context-v0': ['stated.motivations', 'stated.careerDirection'],
    'career-direction-v0': ['stated.careerDirection'],
    'career-priorities-v0': ['stated.priorities'],
    'career-constraints-v0': [
      'stated.hardConstraints.locations',
      'stated.hardConstraints.workMode',
      'stated.hardConstraints.availability',
      'stated.hardConstraints.dealBreakers',
    ],
    'career-capabilities-v0': ['stated.capabilityEvidence'],
    'career-differentiation-v0': ['stated.selfDescribedDifferentiators'],
    'career-compensation-v0': [
      'stated.hardConstraints.compensation.target',
      'stated.hardConstraints.compensation.acceptable',
      'stated.hardConstraints.compensation.minimum',
    ],
    'career-risk-tradeoffs-v0': ['stated.riskTradeoffs'],
  });
  for (const item of CareerInterviewQuestionBankV0) {
    assert.ok(item.followUpTriggers.length > 0);
    assert.ok(item.requiredUserConfirmations.length > 0);
  }
});


test('Q4 deterministically splits confirmed constraints into four fields', () => {
  const stated = buildStatedProfileFromInterview(interview([
    turn('career-constraints-v0', 'answered', '上海、混合办公、一个月内到岗，不能长期驻场。', {
      locations: ['上海'],
      workMode: ['混合办公'],
      availability: ['一个月内到岗'],
      dealBreakers: ['长期驻场'],
    }),
  ]));
  assert.deepEqual(stated.hardConstraints.locations.map((item) => item.value), ['上海']);
  assert.deepEqual(stated.hardConstraints.workMode.map((item) => item.value), ['混合办公']);
  assert.deepEqual(stated.hardConstraints.availability.map((item) => item.value), ['一个月内到岗']);
  assert.deepEqual(stated.hardConstraints.dealBreakers.map((item) => item.value), ['长期驻场']);
});

test('Q7 keeps target, acceptable, and minimum compensation distinct', () => {
  const stated = buildStatedProfileFromInterview(interview([
    turn('career-compensation-v0', 'answered', '理想 45k，可接受 38k，最低 35k。', {
      target: '45k/月',
      acceptable: '38k/月',
      minimum: '35k/月',
    }),
  ]));
  const compensation = stated.hardConstraints.compensation;
  assert.equal(compensation.target.value, '45k/月');
  assert.equal(compensation.acceptable.value, '38k/月');
  assert.equal(compensation.minimum.value, '35k/月');
  assert.notEqual(compensation.target.id, compensation.minimum.id);
});

test('skipped and needs_followup turns never create stated facts', () => {
  const stated = buildStatedProfileFromInterview(interview([
    turn('career-priorities-v0', 'skipped', undefined, { priorities: ['薪资'] }),
    turn('career-constraints-v0', 'needs_followup', '最好上海。', { locations: ['上海'] }),
  ]));
  assert.deepEqual(stated.priorities, []);
  assert.deepEqual(stated.hardConstraints.locations, []);
});

test('ambiguous raw constraint wording is never upgraded to a hard constraint', () => {
  const rawAnswer = '最好上海，其他城市也可以看看。';
  const stated = buildStatedProfileFromInterview(interview([
    turn('career-constraints-v0', 'answered', rawAnswer),
  ]));
  assert.deepEqual(stated.hardConstraints.locations, []);
});

test('follow-up trigger metadata never changes the raw candidate answer', () => {
  const rawAnswer = '先看看机会。';
  const source = interview([
    turn('career-context-v0', 'answered', rawAnswer, { motivations: ['探索机会'] }),
  ]);
  const before = structuredClone(source.turns[0].userAnswer);
  buildStatedProfileFromInterview(source);
  assert.equal(source.turns[0].userAnswer, before);
  assert.ok(definition('career-context-v0').followUpTriggers.includes('change_trigger_vague'));
});

test('career context contributes direction evidence only when the user explicitly confirms it', () => {
  const stated = buildStatedProfileFromInterview(interview([
    turn('career-context-v0', 'answered', '我希望找更有成长空间的机会。', {
      motivations: ['希望获得成长空间'],
    }),
  ]));
  assert.deepEqual(stated.motivations.map((item) => item.value), ['希望获得成长空间']);
  assert.deepEqual(stated.careerDirection, []);
});

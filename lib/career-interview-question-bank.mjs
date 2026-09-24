/**
 * V0's founder-approved Career Interview Question Bank and deterministic
 * stated-profile builder. There is deliberately no natural-language parsing:
 * each `confirmedAnswer` is supplied or confirmed by the candidate.
 */

import { InterviewAnswerStatus, validateCareerInterview } from './career-domain.mjs';

export const CareerInterviewQuestionBankV0 = Object.freeze([
  Object.freeze({
    questionId: 'career-context-v0',
    topic: 'career_context',
    question: '你现在的工作状态怎样？是什么让你开始认真考虑下一份机会？',
    confirmedAnswerShape: Object.freeze({ motivations: 'string[]', careerDirectionEvidence: 'string[] (optional)' }),
    mappings: Object.freeze([
      Object.freeze({ from: 'motivations', to: 'stated.motivations' }),
      Object.freeze({ from: 'careerDirectionEvidence', to: 'stated.careerDirection', condition: 'explicitly_confirmed_only' }),
    ]),
    followUpTriggers: Object.freeze(['change_trigger_vague', 'only_negative_reason', 'direction_unclear']),
    requiredUserConfirmations: Object.freeze(['motivation statements', 'any career-direction evidence']),
  }),
  Object.freeze({
    questionId: 'career-direction-v0',
    topic: 'direction',
    question: '未来两三年，你希望自己成为哪一类专业人士？下一份工作最好让你获得什么新的范围、能力或影响力？',
    confirmedAnswerShape: Object.freeze({ careerDirection: 'string[]' }),
    mappings: Object.freeze([Object.freeze({ from: 'careerDirection', to: 'stated.careerDirection' })]),
    followUpTriggers: Object.freeze(['scope_unclear', 'direction_is_exploratory', 'excluded_direction_missing']),
    requiredUserConfirmations: Object.freeze(['target direction', 'scope or impact sought']),
  }),
  Object.freeze({
    questionId: 'career-priorities-v0',
    topic: 'priorities',
    question: '如果下一份工作只能满足其中三项，你最看重什么？请按优先级选：成长空间、薪资、业务前景、团队/老板、工作方式、稳定性、行业方向、管理范围。',
    confirmedAnswerShape: Object.freeze({ priorities: 'ordered string[]' }),
    mappings: Object.freeze([Object.freeze({ from: 'priorities', to: 'stated.priorities', preserveOrder: true })]),
    followUpTriggers: Object.freeze(['all_priorities_equal', 'top_priority_reason_missing', 'tradeoff_unclear']),
    requiredUserConfirmations: Object.freeze(['priority order', 'material trade-offs']),
  }),
  Object.freeze({
    questionId: 'career-constraints-v0',
    topic: 'constraints',
    question: '有哪些条件会让你直接不考虑？也请说明你能接受的城市、通勤、远程/混合办公方式，以及最早到岗时间。',
    confirmedAnswerShape: Object.freeze({ locations: 'string[]', workMode: 'string[]', availability: 'string[]', dealBreakers: 'string[]' }),
    mappings: Object.freeze([
      Object.freeze({ from: 'locations', to: 'stated.hardConstraints.locations' }),
      Object.freeze({ from: 'workMode', to: 'stated.hardConstraints.workMode' }),
      Object.freeze({ from: 'availability', to: 'stated.hardConstraints.availability' }),
      Object.freeze({ from: 'dealBreakers', to: 'stated.hardConstraints.dealBreakers' }),
    ]),
    followUpTriggers: Object.freeze(['preference_vs_hard_boundary', 'location_or_mode_ambiguous', 'availability_ambiguous']),
    requiredUserConfirmations: Object.freeze(['locations', 'work mode', 'availability', 'deal breakers']),
  }),
  Object.freeze({
    questionId: 'career-capabilities-v0',
    topic: 'capabilities',
    question: '请选一到两个最能证明你价值的项目或经历：当时的问题是什么、你具体做了什么、结果怎样？',
    confirmedAnswerShape: Object.freeze({ capabilityEvidence: 'string[]' }),
    mappings: Object.freeze([Object.freeze({ from: 'capabilityEvidence', to: 'stated.capabilityEvidence' })]),
    followUpTriggers: Object.freeze(['personal_contribution_unclear', 'outcome_missing', 'evidence_too_general']),
    requiredUserConfirmations: Object.freeze(['personal contribution', 'outcome or explicitly unknown metric']),
  }),
  Object.freeze({
    questionId: 'career-differentiation-v0',
    topic: 'differentiation',
    question: '和背景相近的人相比，你希望招聘方记住你的哪一种独特价值？',
    confirmedAnswerShape: Object.freeze({ differentiators: 'string[]' }),
    mappings: Object.freeze([Object.freeze({ from: 'differentiators', to: 'stated.selfDescribedDifferentiators' })]),
    followUpTriggers: Object.freeze(['generic_claim', 'supporting_evidence_missing', 'positioning_unclear']),
    requiredUserConfirmations: Object.freeze(['self-described differentiators']),
  }),
  Object.freeze({
    questionId: 'career-compensation-v0',
    topic: 'compensation',
    question: '什么样的薪资和整体条件，才值得你换工作？可以按月薪、年包、薪资月数、奖金/股权或其他你在意的方式表达；不确定也可以说暂不设定。',
    confirmedAnswerShape: Object.freeze({ target: 'value (optional)', acceptable: 'value (optional)', minimum: 'value (optional)' }),
    mappings: Object.freeze([
      Object.freeze({ from: 'target', to: 'stated.hardConstraints.compensation.target', hardFilter: false }),
      Object.freeze({ from: 'acceptable', to: 'stated.hardConstraints.compensation.acceptable', hardFilter: false }),
      Object.freeze({ from: 'minimum', to: 'stated.hardConstraints.compensation.minimum', hardFilter: true }),
    ]),
    followUpTriggers: Object.freeze(['target_vs_minimum_unclear', 'compensation_basis_missing', 'tradeoff_unclear']),
    requiredUserConfirmations: Object.freeze(['target', 'acceptable range', 'minimum threshold', 'compensation basis']),
  }),
  Object.freeze({
    questionId: 'career-risk-tradeoffs-v0',
    topic: 'risk_tradeoffs',
    question: '你愿意为更大的机会承担哪些不确定性？例如创业公司、业务尚未验证、职责模糊、转行业、降级别、较长通勤或较低现金。',
    confirmedAnswerShape: Object.freeze({ riskTradeoffs: 'string[]' }),
    mappings: Object.freeze([Object.freeze({ from: 'riskTradeoffs', to: 'stated.riskTradeoffs' })]),
    followUpTriggers: Object.freeze(['risk_boundary_missing', 'all_risks_acceptable', 'tradeoff_limit_missing']),
    requiredUserConfirmations: Object.freeze(['accepted risks', 'unacceptable risks', 'material trade-off limits']),
  }),
]);

const DEFINITIONS = new Map(CareerInterviewQuestionBankV0.map((definition) => [definition.questionId, definition]));

export function getCareerInterviewQuestionDefinition(questionId) {
  return DEFINITIONS.get(questionId) ?? null;
}

export function validateCareerInterviewQuestionBankV0() {
  if (CareerInterviewQuestionBankV0.length !== 8) throw new Error('Question Bank V0 must contain exactly 8 questions');
  if (DEFINITIONS.size !== 8) throw new Error('Question Bank V0 questionId values must be unique');
  for (const definition of CareerInterviewQuestionBankV0) {
    if (!definition.questionId || !definition.topic || !definition.question) {
      throw new Error('Question Definition requires questionId, topic, and question');
    }
  }
  return true;
}

function emptyHardConstraints() {
  return {
    locations: [],
    workMode: [],
    availability: [],
    dealBreakers: [],
    compensation: { target: null, acceptable: null, minimum: null },
  };
}

function emptyStated() {
  return {
    careerDirection: [],
    motivations: [],
    priorities: [],
    hardConstraints: emptyHardConstraints(),
    capabilityEvidence: [],
    selfDescribedDifferentiators: [],
    riskTradeoffs: [],
  };
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function values(value) {
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined && item !== '') : [];
}

function entry(turn, field, value, index = 0) {
  return {
    id: `${turn.id}:${field}:${index + 1}`,
    value,
    confirmed: true,
    evidenceRefs: [{ sourceType: 'interview_turn', sourceId: turn.id }],
  };
}

function addList(stated, target, turn, valuesToAdd) {
  values(valuesToAdd).forEach((value, index) => stated[target].push(entry(turn, target, value, index)));
}

function addConstraintList(stated, field, turn, valuesToAdd) {
  values(valuesToAdd).forEach((value, index) => stated.hardConstraints[field].push(entry(turn, `hardConstraints.${field}`, value, index)));
}

function isValue(value) {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Deterministically maps only explicit, user-confirmed structured answers.
 * Raw natural-language text is evidence, never a parsing input.
 */
export function buildStatedProfileFromInterview(interview) {
  validateCareerInterview(interview);
  validateCareerInterviewQuestionBankV0();
  const stated = emptyStated();

  for (const turn of interview.turns) {
    if (turn.answerStatus !== InterviewAnswerStatus.ANSWERED) continue;
    if (!DEFINITIONS.has(turn.questionId)) continue;
    const answer = turn.confirmedAnswer;
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) continue;

    switch (turn.questionId) {
      case 'career-context-v0':
        addList(stated, 'motivations', turn, answer.motivations);
        addList(stated, 'careerDirection', turn, answer.careerDirectionEvidence);
        break;
      case 'career-direction-v0':
        addList(stated, 'careerDirection', turn, answer.careerDirection);
        break;
      case 'career-priorities-v0':
        addList(stated, 'priorities', turn, answer.priorities);
        break;
      case 'career-constraints-v0':
        addConstraintList(stated, 'locations', turn, answer.locations);
        addConstraintList(stated, 'workMode', turn, answer.workMode);
        addConstraintList(stated, 'availability', turn, answer.availability);
        addConstraintList(stated, 'dealBreakers', turn, answer.dealBreakers);
        break;
      case 'career-capabilities-v0':
        addList(stated, 'capabilityEvidence', turn, answer.capabilityEvidence);
        break;
      case 'career-differentiation-v0':
        addList(stated, 'selfDescribedDifferentiators', turn, answer.differentiators);
        break;
      case 'career-compensation-v0':
        for (const field of ['target', 'acceptable', 'minimum']) {
          if (isValue(answer[field])) {
            stated.hardConstraints.compensation[field] = entry(turn, `hardConstraints.compensation.${field}`, answer[field]);
          }
        }
        break;
      case 'career-risk-tradeoffs-v0':
        addList(stated, 'riskTradeoffs', turn, answer.riskTradeoffs);
        break;
      default:
        break;
    }
  }
  return stated;
}

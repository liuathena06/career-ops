/** Browser-session intake helpers for the local Founder flow; no persistence. */
import { CareerInterviewQuestionBankV0, buildStatedProfileFromInterview } from './career-interview-question-bank.mjs';
import { buildCareerProfileDraft, confirmCareerProfile, createCareerInterview } from './career-domain.mjs';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lines(value) {
  return text(value).split(/\r?\n|[；;]/u).map((item) => item.trim()).filter(Boolean);
}

function confirmedAnswer(questionId, answer) {
  switch (questionId) {
    case 'career-context-v0': return { motivations: lines(answer.raw) };
    case 'career-direction-v0': return { careerDirection: lines(answer.searchRole) };
    case 'career-priorities-v0': return { priorities: lines(answer.raw) };
    case 'career-constraints-v0': return {
      locations: lines(answer.locations), workMode: lines(answer.workMode),
      availability: lines(answer.availability), dealBreakers: lines(answer.dealBreakers),
    };
    case 'career-capabilities-v0': return { capabilityEvidence: lines(answer.raw) };
    case 'career-differentiation-v0': return { differentiators: lines(answer.raw) };
    case 'career-compensation-v0': return {
      ...(text(answer.target) ? { target: text(answer.target) } : {}),
      ...(text(answer.acceptable) ? { acceptable: text(answer.acceptable) } : {}),
      ...(text(answer.minimum) ? { minimum: text(answer.minimum) } : {}),
    };
    case 'career-risk-tradeoffs-v0': return { riskTradeoffs: lines(answer.raw) };
    default: return {};
  }
}

/** Builds a confirmed V0 profile from explicit browser-form confirmations only. */
export function createFounderConfirmedProfile({ answers, now = new Date().toISOString(), id = `founder-${Date.now()}` }) {
  if (!answers || typeof answers !== 'object') throw new Error('Interview answers are required');
  const turns = CareerInterviewQuestionBankV0.map((definition) => {
    const answer = answers[definition.questionId] ?? {};
    const raw = text(answer.raw);
    return {
      id: `turn-${definition.questionId}`,
      topic: definition.topic,
      questionId: definition.questionId,
      question: definition.question,
      answerStatus: raw ? 'answered' : 'skipped',
      ...(raw ? { userAnswer: raw, confirmedAnswer: confirmedAnswer(definition.questionId, answer) } : {}),
      capturedAt: now,
    };
  });
  const interview = createCareerInterview({
    schemaVersion: 'v0', id: `${id}-interview`, locale: 'zh-CN', status: 'completed',
    createdAt: now, updatedAt: now, turns,
  });
  const draft = buildCareerProfileDraft({
    id: `${id}-profile`, interview, stated: buildStatedProfileFromInterview(interview), now,
  });
  return { interview, profile: confirmCareerProfile(draft, { now }) };
}

/** The primary search inputs come only from explicit confirmed Profile facts. */
export function profileSearchIntent(profile) {
  const direction = profile?.stated?.careerDirection?.find((entry) => entry.confirmed)?.value;
  const location = profile?.stated?.hardConstraints?.locations?.find((entry) => entry.confirmed)?.value;
  if (!text(direction)) throw new Error('请先在职业方向问题中确认用于搜索的目标职位名称。');
  return { jobName: text(direction), ...(text(location) ? { location: text(location) } : {}) };
}

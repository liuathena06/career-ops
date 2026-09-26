/** Local, provider-agnostic deterministic mock for V0 Career Intelligence. */
import { validateCareerInterview, validateCareerProfile } from './career-domain.mjs';
import { runInferencePolicyGuard } from './career-profile-analyzer.mjs';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const confirmed = (entries) => (entries ?? []).filter((entry) => entry?.confirmed && text(String(entry.value ?? '')));
const evidence = (entry) => structuredClone(entry?.evidenceRefs ?? []);

function variants(value) {
  const direct = text(value);
  if (!direct) return [];
  const adjacent = direct.replace(/^(?:资深|高级|初级|主任|专家|senior|junior)\s*/iu, '').replace(/^(?:ai|人工智能)\s*/iu, '');
  const stretch = /^(?:资深|高级|主任|专家|senior)\b/iu.test(direct) ? '' : '高级' + direct;
  return [
    { kind: 'direct', searchTitle: direct, needsConfirmation: false },
    ...(adjacent && adjacent !== direct ? [{ kind: 'adjacent', searchTitle: adjacent, needsConfirmation: true }] : []),
    ...(stretch && stretch !== direct ? [{ kind: 'stretch', searchTitle: stretch, needsConfirmation: true }] : []),
  ];
}

function unique(directions) {
  const seen = new Set();
  return directions.filter((direction) => {
    const key = direction.searchTitle.toLocaleLowerCase('zh-CN');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

/**
 * Builds a read-only summary. Resume text is only an in-memory input signal;
 * neither it nor user answers are logged, persisted, or returned in full.
 */
export function buildAiCareerProfileSummary({ resumeText = '', interview, profile }) {
  validateCareerInterview(interview);
  validateCareerProfile(profile);
  const direction = confirmed(profile.stated.careerDirection)[0] ?? null;
  const motivation = confirmed(profile.stated.motivations)[0] ?? null;
  const capabilities = confirmed(profile.stated.capabilityEvidence).slice(0, 3);
  const differentiators = confirmed(profile.stated.selfDescribedDifferentiators).slice(0, 2);
  const directionTurn = interview.turns.find((turn) => turn.questionId === 'career-direction-v0' && turn.answerStatus === 'answered');
  const proposals = capabilities.map((entry) => ({
    kind: 'transferable_capability', value: entry.value, confidence: 'medium',
    rationale: '基于用户确认的项目证据，建议确认其可迁移范围。',
    evidenceRefs: evidence(entry), needsConfirmation: true,
  }));
  for (const item of variants(direction?.value).filter((item) => item.needsConfirmation)) {
    if (!directionTurn) continue;
    proposals.push({
      kind: 'next_stage_direction', value: { kind: item.kind, searchTitle: item.searchTitle }, confidence: 'low',
      rationale: '这是基于已确认目标方向生成的探索性搜索方向，需由用户确认。',
      evidenceRefs: [{ sourceType: 'interview_turn', sourceId: directionTurn.id }], needsConfirmation: true,
    });
  }
  const guarded = runInferencePolicyGuard({ interview, analysis: {
    analyzerId: 'mock-ai-career-intelligence', analyzerVersion: 'v0', inferences: proposals,
    warnings: text(resumeText) ? [] : ['未获得可解析的简历文本；本次摘要仅基于访谈与已确认 Profile。'],
  } });
  const nextStageDirections = unique(variants(direction?.value).map((item) => ({
    ...item, source: item.needsConfirmation ? 'mock_inference' : 'confirmed_profile',
    reason: item.kind === 'direct' ? '来自用户确认的目标职业方向。' : '探索性方向；不改变用户已确认的职业方向或底线。',
    evidenceRefs: item.needsConfirmation
      ? (directionTurn ? [{ sourceType: 'interview_turn', sourceId: directionTurn.id }] : []) : evidence(direction),
  })));
  return {
    analyzer: { id: 'mock-ai-career-intelligence', version: 'v0', mode: 'deterministic_mock' },
    careerThesis: {
      text: [motivation && '下一步动机：' + motivation.value, direction && '目标方向：' + direction.value].filter(Boolean).join('；') || '需要补充下一阶段职业方向与动机。',
      evidenceRefs: [...evidence(motivation), ...evidence(direction)],
    },
    coreCapabilities: capabilities.map((entry) => ({ value: entry.value, evidenceRefs: evidence(entry) })),
    transferableCapabilities: guarded.inferences.filter((item) => item.kind === 'transferable_capability'),
    nextStageDirections,
    needsConfirmation: guarded.inferences.filter((item) => item.kind === 'next_stage_direction' || item.kind === 'transferable_capability'),
    warnings: guarded.warnings,
    resumeTextAvailable: Boolean(text(resumeText)),
    differentiators: differentiators.map((entry) => ({ value: entry.value, evidenceRefs: evidence(entry) })),
  };
}

/** Pending directions are discovery probes only, never profile facts or hard filters. */
export function createOpportunitySearchStrategy({ profile, intelligence }) {
  validateCareerProfile(profile);
  const location = confirmed(profile.stated.hardConstraints.locations)[0]?.value;
  const directions = Array.isArray(intelligence?.nextStageDirections) ? intelligence.nextStageDirections : [];
  const searches = directions.filter((item) => ['direct', 'adjacent', 'stretch'].includes(item?.kind) && text(item.searchTitle)).map((item) => ({
    kind: item.kind, jobName: text(item.searchTitle), ...(text(location) ? { location: text(location) } : {}),
    reason: text(item.reason), explorationOnly: item.needsConfirmation === true,
  }));
  if (searches.length === 0) throw new Error('无法从已确认 Profile 生成搜索方向。');
  return { searches: unique(searches.map((item) => ({ ...item, searchTitle: item.jobName }))).map(({ searchTitle, ...item }) => item) };
}


/** The existing deterministic logic as a formal, replaceable provider implementation. */
export function createMockCareerIntelligenceAnalyzer({ id = 'mock-ai-career-intelligence', version = 'v0' } = {}) {
  return Object.freeze({ id, version, async analyze(input) {
    const result = buildAiCareerProfileSummary({ resumeText: input.resumeText, interview: input.interview, profile: input.profile });
    return { ...result, analyzer: { id, version, mode: 'deterministic_mock' } };
  } });
}

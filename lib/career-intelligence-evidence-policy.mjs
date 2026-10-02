/**
 * Deterministic evidence-strength boundary for Career Intelligence prose.
 * A provider may summarize candidate evidence, but an employer name or its
 * apparent sector establishes exposure only. It cannot establish experience,
 * expertise, customer capital, or deep specialization.
 */

export const INDUSTRY_EVIDENCE_LEVELS = Object.freeze({
  EMPLOYER_EXPOSURE: 'employer_industry_exposure',
  CANDIDATE_EXPERIENCE: 'candidate_industry_experience',
  DEMONSTRATED_EXPERTISE: 'demonstrated_industry_expertise',
  DEEP_SPECIALIZATION: 'deep_specialization',
});

const text = (value) => typeof value === 'string' ? value.trim() : '';
const DEPTH_ASSERTION = /深耕|专精|精通(?:于)?.{0,16}(?:行业|领域)|行业专家|产业专家|深厚.{0,16}(?:行业|产业)(?:专业知识|知识|经验|积累)|丰富.{0,12}(?:行业|产业)经验|多年.{0,12}(?:行业|产业)经验|长期.{0,12}(?:行业|产业)|\b(?:strong industry expertise|deep (?:industry )?(?:expertise|speciali[sz]ation)|industry expert|speciali[sz](?:ed|ation) in)\b/iu;
const EXPERIENCE_ASSERTION = /(?:行业|产业)经验|\bindustry experience\b/iu;
const EXPLICIT_USER_DEPTH = /深耕|专精|行业专家|产业专家|(?:^|[，。；;\s])(?:拥有|具备|积累).{0,20}(?:多年|丰富|深厚).{0,16}(?:行业|产业|领域)|\b(?:strong industry expertise|deep (?:industry )?(?:expertise|speciali[sz]ation)|industry expert|speciali[sz](?:ed|ation) in)\b/iu;

function hasExplicitUserDepth(input, refs) {
  const turns = new Map((input?.answeredTurns ?? []).map((turn) => [turn.id, text(turn.userAnswer)]));
  for (const ref of refs ?? []) {
    if (ref?.sourceType === 'interview_turn' && EXPLICIT_USER_DEPTH.test(turns.get(ref.sourceId) ?? '')) return true;
    if (ref?.sourceType !== 'resume' || ref.sourceId !== 'local_resume') continue;
    const supportedLine = text(input?.resumeText).split(/\r?\n/u).some((line) => (
      EXPLICIT_USER_DEPTH.test(line)
      && !/(?:公司|企业|集团|雇主).{0,16}(?:深耕|专精|行业专家|产业专家)/u.test(line)
    ));
    if (supportedLine) return true;
  }
  return false;
}

function unsupportedIndustryDepth(value, refs, input) {
  const claim = text(value);
  if (!DEPTH_ASSERTION.test(claim) && !EXPERIENCE_ASSERTION.test(claim)) return false;
  return !hasExplicitUserDepth(input, refs);
}

function safeThesis(input) {
  const direction = (input?.statedProfile?.careerDirection ?? [])
    .find((entry) => entry?.confirmed === true && text(entry.value));
  return direction
    ? `目标方向：${text(direction.value)}；行业 exposure 与经验深度需以明确职责、项目、成果或用户陈述核实。`
    : '职业主线仍需基于明确职责、项目、成果或用户陈述进一步确认。';
}

/**
 * Provider output is reduced, never promoted. Unsupported strong claims are
 * removed or replaced with a neutral evidence boundary before reaching UI or
 * search strategy.
 */
export function enforceCareerIntelligenceEvidencePolicy({ raw, input }) {
  const guarded = structuredClone(raw);
  const rejected = [];
  if (unsupportedIndustryDepth(guarded.careerThesis, guarded.careerThesisEvidenceRefs, input)) {
    rejected.push({ field: 'careerThesis', level: INDUSTRY_EVIDENCE_LEVELS.EMPLOYER_EXPOSURE });
    guarded.careerThesis = safeThesis(input);
  }
  for (const field of ['coreCapabilities', 'transferableCapabilities']) {
    guarded[field] = (guarded[field] ?? []).filter((item, index) => {
      const unsupported = unsupportedIndustryDepth(`${text(item?.value)} ${text(item?.rationale)}`, item?.evidenceRefs, input);
      if (unsupported) rejected.push({ field: `${field}[${index}]`, level: INDUSTRY_EVIDENCE_LEVELS.EMPLOYER_EXPOSURE });
      return !unsupported;
    });
  }
  guarded.directions = (guarded.directions ?? []).filter((item, index) => {
    const unsupported = unsupportedIndustryDepth(`${text(item?.searchTitle)} ${text(item?.reason)}`, item?.evidenceRefs, input);
    if (unsupported) rejected.push({ field: `directions[${index}]`, level: INDUSTRY_EVIDENCE_LEVELS.EMPLOYER_EXPOSURE });
    return !unsupported;
  });
  if (rejected.length) {
    guarded.uncertainties = [...new Set([
      ...(guarded.uncertainties ?? []).map(text).filter(Boolean),
      '雇主名称或雇主行业只支持 employer industry exposure；不支持行业经验、专业知识或深耕结论。',
    ])];
  }
  return {
    raw: guarded,
    audit: {
      policyVersion: 'industry-evidence-v0.1',
      levels: Object.values(INDUSTRY_EVIDENCE_LEVELS),
      rejectedClaims: rejected,
    },
  };
}

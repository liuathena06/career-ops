/** One execution boundary for Founder rules. Judgments require two-sided evidence. */
import { applicableFounderRules, DEFAULT_CAREER_RECOMMENDATION_POLICY } from './policy.mjs';
import { assessJobCareerCoherence, qualifyCareerDirection } from '../career-coherence-v0.mjs';
import { roleFamilyFromTitle } from '../career-role-normalization.mjs';

const value = (entry) => typeof entry?.value === 'string' ? entry.value.trim() : '';
const confirmed = (entries) => (entries ?? []).filter((entry) => entry?.confirmed === true && value(entry));
const capitalText = (profile) => [
  ...confirmed(profile?.stated?.careerDirection),
  ...confirmed(profile?.stated?.capabilityEvidence),
  ...confirmed(profile?.stated?.selfDescribedDifferentiators),
].map(value).join('；');

export function inferFounderRoleFamily(profile) {
  const capital = capitalText(profile);
  const direction = confirmed(profile?.stated?.careerDirection)[0];
  const fromDirection = roleFamilyFromTitle(value(direction));
  if (fromDirection !== 'unknown') return fromDirection;
  if (/销售|商务拓展|大客户|客户经理|渠道|\b(?:sales|account executive|business development)\b/iu.test(capital)) return 'sales';
  if (/人力|招聘|\bHR\b/iu.test(capital)) return 'hr';
  if (/财务|会计|审计/iu.test(capital)) return 'finance';
  if (/法务|法律|律师/iu.test(capital)) return 'legal';
  if (/市场|营销|品牌/iu.test(capital)) return 'marketing';
  if (/产品经理|产品负责人/iu.test(capital)) return 'product';
  if (/研发|工程师|开发/iu.test(capital)) return 'engineering_technical';
  return 'unknown';
}

function active(policy, stage, roleFamily, id) {
  return applicableFounderRules({ stage, roleFamily, policy }).find((rule) => rule.id === id);
}

/** Search proposals are evidence-gated hypotheses, never scored jobs. */
export function executeFounderSearchRules({ profile, intelligence, directions, roleFamily = inferFounderRoleFamily(profile), policy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  const searchRule = active(policy, 'search', roleFamily, 'search_direction');
  if (!searchRule) return { directions: directions.filter((item) => item.kind === 'direct'
    && confirmed(profile.stated.careerDirection).some((entry) => value(entry) === item.searchTitle)), ruleResults: [] };
  const industryRule = active(policy, 'search', roleFamily, 'industry_continuity');
  const stretchRule = active(policy, 'search', roleFamily, 'stretch_capital');
  const results = directions.map((direction) => {
    const qualified = qualifyCareerDirection({ profile, intelligence, direction,
      enforceIndustryContinuity: Boolean(industryRule), enforceStretchCapital: Boolean(stretchRule) });
    return { ruleId: searchRule.id, status: qualified ? 'supported' : 'unsupported', direction: qualified };
  });
  return { directions: results.filter((item) => item.direction).map((item) => item.direction), ruleResults: [
    ...results.map(({ ruleId, status }) => ({ ruleId, status })),
    ...(industryRule ? [{ ruleId: industryRule.id, status: 'executed' }] : []),
    ...(stretchRule ? [{ ruleId: stretchRule.id, status: 'executed' }] : []),
  ] };
}

/** Discovery uses only card fields. Unknown never becomes a mismatch. */
export function executeFounderDiscoveryRules({ profile, card, hardFilter, dimensions, roleFamily = inferFounderRoleFamily(profile), policy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  const rules = applicableFounderRules({ stage: 'discovery', roleFamily, policy });
  const continuity = assessJobCareerCoherence({ profile, card });
  const ruleResults = rules.map((rule) => {
    if (rule.id === 'confirmed_hard_constraints') return { ruleId: rule.id,
      status: hardFilter?.outcome === 'filtered_out' ? 'filtered_out' : hardFilter?.unknowns?.length ? 'pass_with_unknowns' : 'pass' };
    if (rule.id === 'role_family_relevance') {
      const relation = dimensions?.careerDirection?.relation ?? 'unknown';
      const supportedStretch = relation === 'discontinuous'
        && card?.searchDirection === 'stretch'
        && Array.isArray(card?.stretchEvidenceRefs)
        && card.stretchEvidenceRefs.length > 0;
      return { ruleId: rule.id,
      status: supportedStretch ? 'supported_stretch' : relation,
      candidateEvidenceRefs: confirmed(profile.stated.careerDirection).flatMap((item) => item.evidenceRefs ?? []),
      stretchEvidenceRefs: supportedStretch ? structuredClone(card.stretchEvidenceRefs) : [],
      jobFields: card?.jobName ? ['jobName'] : [] };
    }
    if (rule.id === 'industry_continuity') {
      const candidateEvidence = confirmed(profile.stated.careerDirection).concat(confirmed(profile.stated.capabilityEvidence));
      const jobEvidence = [card?.industry, card?.jobName].filter((item) => typeof item === 'string' && item.trim());
      const industryStatus = continuity.reason === 'sales_model_conflict' ? 'unknown' : continuity.status;
      return { ruleId: rule.id, status: candidateEvidence.length && jobEvidence.length ? industryStatus : 'unknown',
        reason: continuity.reason, candidateEvidenceRefs: candidateEvidence.flatMap((item) => item.evidenceRefs ?? []), jobFields: [card?.industry ? 'industry' : null, card?.jobName ? 'jobName' : null].filter(Boolean) };
    }
    if (rule.id === 'sales_motion_card') return { ruleId: rule.id,
      status: continuity.reason === 'sales_model_conflict' ? 'discontinuous' : 'unknown',
      reason: continuity.reason === 'sales_model_conflict' ? continuity.reason : null };
    if (rule.id === 'fixed_cash') return { ruleId: rule.id, status: dimensions?.compensation?.judgment ?? 'unknown' };
    if (rule.id === 'upside_signal') return { ruleId: rule.id,
      status: ['fit', 'strong_fit'].includes(dimensions?.careerDirection?.judgment) ? 'present' : 'unknown' };
    return { ruleId: rule.id, status: 'unknown' };
  });
  const conflict = ruleResults.find((item) => item.status === 'discontinuous');
  const roleRelation = ruleResults.find((item) => item.ruleId === 'role_family_relevance')?.status ?? 'unknown';
  const industryCompatible = ruleResults.some((item) => item.ruleId === 'industry_continuity' && item.status === 'compatible');
  return { stage: 'discovery', policyVersion: policy.version, roleFamily, ruleResults,
    careerCoherence: conflict ? 'discontinuous' : industryCompatible || roleFamily !== 'sales' && roleRelation === 'aligned' ? 'compatible'
      : roleRelation === 'adjacent' ? 'adjacent' : roleRelation === 'supported_stretch' ? 'stretch' : 'unknown',
    careerCoherenceReason: conflict?.reason ?? (conflict?.ruleId === 'role_family_relevance' ? 'role_family_conflict' : null),
    recommendationAllowed: !conflict };
}

/** Detail rules run only after an actual JD is present; unsupported dimensions stay unknown. */
export function executeFounderDetailRules({ profile, job, hardFilter, dimensions, careerUpside, roleFamily = inferFounderRoleFamily(profile), policy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  const rules = applicableFounderRules({ stage: 'detail', roleFamily, policy });
  const hasJd = typeof job?.details?.description === 'string' && Boolean(job.details.description.trim());
  const ruleResults = rules.map((rule) => {
    if (rule.id === 'confirmed_hard_constraints') return { ruleId: rule.id,
      status: hardFilter?.outcome === 'filtered_out' ? 'filtered_out' : hardFilter?.unknowns?.length ? 'pass_with_unknowns' : 'pass' };
    if (!hasJd) return { ruleId: rule.id, status: 'unknown', reason: 'job_detail_missing' };
    if (rule.id === 'role_scope_capability') {
      const capability = dimensions?.capabilityPlausibility?.judgment;
      const scope = dimensions?.seniorityScope?.judgment;
      return { ruleId: rule.id, status: ['fit', 'strong_fit'].includes(capability) && ['fit', 'strong_fit'].includes(scope) ? 'supported' : 'unknown' };
    }
    if (rule.id === 'fixed_cash') return { ruleId: rule.id, status: dimensions?.compensation?.judgment ?? 'unknown' };
    if (rule.id === 'career_upside') return { ruleId: rule.id, status: careerUpside?.status ?? 'unknown' };
    return { ruleId: rule.id, status: 'unknown', reason: 'rule_specific_evidence_not_established' };
  });
  return { stage: 'detail', policyVersion: policy.version, roleFamily, ruleResults,
    careerCoherence: 'unknown', careerCoherenceReason: null, recommendationAllowed: true };
}

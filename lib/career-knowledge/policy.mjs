/** Founder-owned product policy; public rules only, never candidate facts. */
export const KNOWLEDGE_STAGES = Object.freeze(['search', 'discovery', 'detail']);

export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const founderMetadata = {
  source: { id: 'founder', authority: 'founder', url: 'conversation:career-recommendation-expert-rules-v0' },
  version: 'v0.1',
  provenance: { method: 'founder_confirmed_design', locator: 'Career Recommendation Expert Rules V0 and three confirmed corrections', capturedAt: '2026-09-28' },
  chinaApplicability: { status: 'local_policy', boundary: 'Only confirmed candidate and explicit job evidence support judgments. Expert rules cannot change the Career Profile.' },
};

function rule(id, type, stages, roleFamilies, principle, candidateEvidence, jobEvidence) {
  return {
    ...structuredClone(founderMetadata), id, type, applicableStages: stages, roleFamilies,
    principle, candidateEvidence, jobEvidence, missingEvidence: 'unknown',
    strength: type === 'hard_constraint' ? 'mandatory' : 'advisory',
    rankingWeight: null,
  };
}

const both = ['discovery', 'detail'];
const allRoles = ['*'];
const relationshipRoles = ['sales', 'business_development', 'industry_consulting', 'government_affairs'];

export const FOUNDER_RULEBOOK = deepFreeze([
  rule('confirmed_hard_constraints', 'hard_constraint', both, allRoles,
    'Only confirmed location, deal breakers and minimum compensation may filter out. Unknown is not failure; no score or upside can override failure.',
    ['confirmed_location', 'confirmed_deal_breakers', 'confirmed_compensation_minimum_and_basis'],
    ['explicit_location', 'explicit_deal_breaker_conditions', 'comparable_compensation_range']),
  rule('search_direction', 'contextual_knowledge', ['search'], allRoles,
    'Title and occupation knowledge inform search hypotheses only. Search Direction never contributes to a job recommendation score.',
    ['confirmed_career_direction'], ['occupation_title_reference']),
  rule('role_family_relevance', 'recommendation_signal', ['discovery'], allRoles,
    'Compare the explicit card title with confirmed candidate direction using role families and cautious adjacent functions; search provenance itself adds no score.',
    ['confirmed_career_direction'], ['explicit_job_title']),
  rule('industry_continuity', 'recommendation_signal', ['search', ...both], relationshipRoles,
    'Prefer evidence of current, upstream, downstream or adjacent industry capital; identical titles and willingness to change industry are insufficient.',
    ['industry_experience', 'relationship_or_domain_capital'], ['explicit_industry', 'supported_industry_relationship']),
  rule('customer_and_sales_motion', 'recommendation_signal', ['detail'], relationshipRoles,
    'Distinguish enterprise, SMB, channel and consumer work using actual customers, selling motion and partner ecosystem.',
    ['customer_segments', 'selling_motion', 'demonstrated_results'], ['target_customers', 'selling_motion', 'partner_ecosystem']),
  rule('sales_motion_card', 'recommendation_signal', ['discovery'], relationshipRoles,
    'An explicit telephone, retail or door-to-door sales card can conflict with confirmed enterprise selling capital; otherwise selling motion is unknown until the JD.',
    ['confirmed_enterprise_selling_capital'], ['explicit_sales_motion_in_card']),
  rule('stretch_capital', 'recommendation_signal', ['search', 'detail'], allRoles,
    'A stretch requires demonstrated transferable capital and evidence that the target work uses it.',
    ['demonstrated_transferable_capital'], ['actual_tasks_using_that_capital']),
  rule('transition_cost', 'ranking_signal', ['detail'], allRoles,
    'Simultaneous industry, function and scope changes imply transition cost; consider verified upside before lowering priority.',
    ['current_industry_function_scope'], ['target_industry_function_scope', 'verified_upside']),
  rule('general_functions', 'recommendation_signal', ['detail'], ['hr', 'finance', 'legal', 'administration'],
    'Reduce industry emphasis; compare governance, scale, organization and regulatory complexity.',
    ['organization_and_regulatory_experience'], ['organization_and_regulatory_complexity']),
  rule('market_product_functions', 'recommendation_signal', ['detail'], ['communications', 'investor_relations', 'marketing', 'product'],
    'Distinguish strategy, execution, channel, industry depth and stakeholder scope; titles alone do not demonstrate transferability.',
    ['demonstrated_work_content'], ['actual_work_content_and_stakeholders']),
  rule('technical_capital', 'recommendation_signal', ['detail'], ['technical', 'professional'],
    'Compare actual technology and professional methods. Claims of obsolescence or market value require dated sources.',
    ['demonstrated_technology_and_methods'], ['actual_technology_and_tasks']),
  rule('role_scope_capability', 'recommendation_signal', ['detail'], allRoles,
    'Compare proven capability, authority, team, budget, P&L and complexity. A higher title at a smaller company is not proof of promotion.',
    ['proven_capability_and_scope'], ['responsibility_authority_team_budget_pnl']),
  rule('platform_upside', 'ranking_signal', ['detail'], allRoles,
    'Require verified business, resources, ownership or competitive position. Large-company, financing and AI labels alone do not earn points.',
    ['current_platform_and_desired_resources'], ['verified_business_resources_and_investment']),
  rule('fixed_cash', 'ranking_signal', both, allRoles,
    'Compare fixed cash on the same basis. Never treat a range ceiling as obtainable pay or an overlapping minimum range as a confirmed pass.',
    ['current_fixed_cash_and_basis'], ['fixed_cash_range_and_basis']),
  rule('compensation_structure', 'ranking_signal', ['detail'], allRoles,
    'Prefer certain cash; unpriced equity cannot be counted at face value and missing terms remain unknown.',
    ['current_compensation_structure', 'confirmed_risk_preferences'], ['bonus_certainty', 'equity_terms']),
  rule('personal_preferences', 'recommendation_signal', both, allRoles,
    'Use only stated commute, travel, lifestyle and company preferences. Soft preferences cannot silently become hard constraints.',
    ['confirmed_personal_preferences'], ['explicit_corresponding_conditions']),
  rule('long_term_optionality', 'ranking_signal', ['detail'], allRoles,
    'Explain plausible gains in career narrative, skills, industry position and management scope; do not promise future outcomes.',
    ['career_direction_and_current_capital'], ['actual_capital_building_opportunities']),
  rule('upside_signal', 'recommendation_signal', ['discovery'], allRoles,
    'An explicit potential improvement is an Upside Signal requiring detail verification, never a formal Career Upside conclusion.',
    ['confirmed_baseline_or_direction'], ['explicit_improvement_clue']),
  rule('career_upside', 'recommendation_signal', ['detail'], allRoles,
    'With sufficient two-sided evidence, compensation, scope, positioning, capability, management or long-term direction upside can justify explore; never override a hard failure or automatically become Top Recommendation.',
    ['confirmed_baseline_or_direction'], ['verified_improvement']),
]);

/** Adjustable experiment parameters. V0 deliberately does not run a scorer. */
export function createCareerRecommendationPolicy({
  version = 'v0.1',
  dimensionWeights = {},
  thresholds = {},
  ruleOverrides = {},
} = {}) {
  if (typeof version !== 'string' || !version.trim()) throw new Error('Policy requires a version');
  const weights = { careerCoherence: 30, roleScopeCapability: 25, industryPlatform: 15, compensation: 15, personalOptionality: 15 };
  for (const [key, value] of Object.entries(dimensionWeights)) {
    if (!Object.hasOwn(weights, key) || !Number.isFinite(value) || value < 0) throw new Error('Invalid dimension weight');
    weights[key] = value;
  }
  if (Object.values(weights).reduce((sum, value) => sum + value, 0) !== 100) throw new Error('Dimension weights must sum to 100');
  const limits = { strongRecommendation: 75, worthExploring: 60 };
  for (const [key, value] of Object.entries(thresholds)) {
    if (!Object.hasOwn(limits, key) || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('Invalid experimental threshold');
    limits[key] = value;
  }
  if (limits.strongRecommendation <= limits.worthExploring) throw new Error('Experimental thresholds must be ordered');
  for (const id of Object.keys(ruleOverrides)) {
    if (!FOUNDER_RULEBOOK.some((item) => item.id === id)) throw new Error('Unknown Founder rule');
  }
  const rules = structuredClone(FOUNDER_RULEBOOK).map((item) => {
    const overrides = ruleOverrides[item.id] ?? {};
    if (item.type === 'hard_constraint' && Object.keys(overrides).length) throw new Error('Confirmed hard constraints cannot be overridden');
    for (const [key, value] of Object.entries(overrides)) {
      if (!['strength', 'roleFamilies', 'applicableStages', 'rankingWeight'].includes(key)) throw new Error('Unsupported rule override');
      if (key === 'strength' && !['disabled', 'advisory', 'strong'].includes(value)) throw new Error('Invalid rule strength');
      if (key === 'roleFamilies' && (!Array.isArray(value) || !value.length || value.some((entry) => typeof entry !== 'string' || !entry.trim()))) throw new Error('Invalid role families');
      // A policy may narrow a stage boundary, but cannot use detail-only facts in discovery.
      if (key === 'applicableStages' && (!Array.isArray(value) || !value.length || value.some((stage) => !item.applicableStages.includes(stage)))) throw new Error('Cannot broaden rule evidence stage');
      if (key === 'rankingWeight' && value !== null && (!Number.isFinite(value) || value < 0 || item.type === 'contextual_knowledge')) throw new Error('Invalid ranking weight');
      item[key] = structuredClone(value);
    }
    if (Object.keys(overrides).length) {
      item.version = version;
      item.provenance = { ...item.provenance, method: 'policy_configuration', locator: item.id + ' override of Founder v0.1' };
    }
    return item;
  });
  return deepFreeze({
    ...structuredClone(founderMetadata), version, id: 'career-recommendation-policy',
    applicableStages: [...KNOWLEDGE_STAGES], rules, dimensionWeights: weights,
    thresholds: { ...limits, experimental: true, enabled: false },
    externalKnowledgeScoring: false, unknownHandling: 'preserve_without_zero_or_penalty',
    stageSemantics: { search: 'search_strategy_only', discovery: 'upside_signal', detail: 'career_upside_requires_evidence' },
  });
}

export const DEFAULT_CAREER_RECOMMENDATION_POLICY = createCareerRecommendationPolicy();

export function applicableFounderRules({ stage, roleFamily, policy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  if (!KNOWLEDGE_STAGES.includes(stage)) throw new Error('Unknown knowledge stage');
  return policy.rules.filter((item) => item.strength !== 'disabled' && item.applicableStages.includes(stage)
    && (item.roleFamilies.includes('*') || item.roleFamilies.includes(roleFamily)));
}

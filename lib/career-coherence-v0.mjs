/** Conservative V0 continuity checks for sales opportunities with sparse job cards. */
import { compareCareerRole } from './career-role-normalization.mjs';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const SALES_ROLE = /销售|商务拓展|客户经理|大客户|渠道经理|客户拓展|\b(?:sales|account executive|business development)\b/iu;
const ENTERPRISE_SALES = /企业客户|企业级|大客户|政企|B2B|渠道销售|解决方案销售/iu;
const RETAIL_SALES = /电销|保险代理|门店销售|零售导购|地推|电话销售/iu;
const SECTORS = Object.freeze([
  { id: 'technology', pattern: /云计算|云服务|公有云|SaaS|软件|人工智能|\bAI\b|大数据|数据中心|网络安全|信息技术|互联网|数字化|工业软件|物联网|\b(?:ICT|IT)\b/iu },
  { id: 'insurance', pattern: /保险|寿险|财险|保险代理/iu },
  { id: 'manufacturing', pattern: /制造业|工业制造|机械制造|工厂|汽车零部件/iu },
  { id: 'finance', pattern: /银行|证券|信托|期货|金融服务/iu },
  { id: 'retail', pattern: /快消|零售|门店|餐饮|房地产/iu },
  { id: 'healthcare', pattern: /医疗|医药|器械|医院/iu },
]);
const SEARCH_ANCHOR = /云计算|云服务|公有云|SaaS|企业软件|工业软件|软件|人工智能|\bAI\b|大数据|数据中心|网络安全|数字化|物联网|保险|制造业|金融服务|医疗|医药|快消|零售/iu;

function confirmedText(profile) {
  return [
    ...(profile?.stated?.careerDirection ?? []),
    ...(profile?.stated?.capabilityEvidence ?? []),
    ...(profile?.stated?.selfDescribedDifferentiators ?? []),
  ].filter((entry) => entry?.confirmed === true).map((entry) => text(entry.value)).filter(Boolean).join('；');
}

function sectors(value) {
  return new Set(SECTORS.filter((sector) => sector.pattern.test(value)).map((sector) => sector.id));
}

function sharesSector(left, right) {
  return [...left].some((sector) => right.has(sector));
}

function evidenceKey(ref) {
  return text(ref?.sourceType) + ':' + text(ref?.sourceId);
}

function transferableSupport(direction, intelligence) {
  const directionRefs = new Set((direction.evidenceRefs ?? []).map(evidenceKey));
  return (intelligence?.transferableCapabilities ?? []).find((capability) => (
    text(capability?.value)
    && Array.isArray(capability.evidenceRefs)
    && capability.evidenceRefs.length > 0
    && capability.evidenceRefs.some((ref) => directionRefs.has(evidenceKey(ref)))
  ));
}

/** AI directions are discovery suggestions; this check cannot change stated facts. */
export function qualifyCareerDirection({ profile, intelligence, direction, enforceIndustryContinuity = true, enforceStretchCapital = true }) {
  let searchTitle = text(direction?.searchTitle);
  if (!searchTitle) return null;
  const capital = confirmedText(profile);
  const salesCandidate = SALES_ROLE.test(capital);
  const confirmedSectors = sectors(capital);
  const inferredCapital = (intelligence?.coreCapabilities ?? []).map((item) => text(item?.value)).join('；');
  const searchCapital = confirmedSectors.size ? capital : inferredCapital;
  const capitalSectors = sectors(searchCapital);
  const proposedSectors = sectors(searchTitle);
  const explicitlyConfirmed = (profile?.stated?.careerDirection ?? []).some((entry) => entry?.confirmed && text(entry.value) === searchTitle);
  const roleRelation = compareCareerRole({ confirmedDirections: profile?.stated?.careerDirection, jobTitle: searchTitle }).relation;

  if (!explicitlyConfirmed && roleRelation === 'discontinuous' && direction.kind !== 'stretch') return null;
  if (enforceIndustryContinuity && salesCandidate && capitalSectors.size && proposedSectors.size && !sharesSector(capitalSectors, proposedSectors) && !explicitlyConfirmed) return null;
  if (enforceStretchCapital && direction.kind === 'stretch' && !transferableSupport(direction, intelligence)) return null;
  if (salesCandidate && capitalSectors.size && proposedSectors.size === 0) {
    const anchor = searchCapital.match(SEARCH_ANCHOR)?.[0];
    if (anchor) searchTitle = anchor + searchTitle;
  }

  const capability = direction.kind === 'stretch' ? transferableSupport(direction, intelligence) : null;
  const reason = [text(direction.reason), capability && '可迁移能力：' + capability.value].filter(Boolean).join('；');
  return { ...direction, searchTitle, reason,
    ...(capability ? { stretchEvidenceRefs: structuredClone(capability.evidenceRefs) } : {}),
    needsConfirmation: direction.needsConfirmation === true || searchTitle !== text(direction.searchTitle) && !confirmedSectors.size };
}

/** Only explicit card evidence can exclude a sales job for poor continuity. */
export function assessJobCareerCoherence({ profile, card }) {
  const capital = confirmedText(profile);
  if (!SALES_ROLE.test(capital)) return { status: 'unknown', reason: 'sales_context_not_confirmed' };
  const jobTitle = text(card?.jobName);
  // A disclosed industry is stronger evidence than a marketing phrase in the title.
  const jobContext = text(card?.industry) || jobTitle;
  if (ENTERPRISE_SALES.test(capital) && RETAIL_SALES.test(jobTitle)) return { status: 'discontinuous', reason: 'sales_model_conflict' };
  const candidateSectors = sectors(capital);
  const jobSectors = sectors(jobContext);
  if (candidateSectors.size && jobSectors.size && !sharesSector(candidateSectors, jobSectors)) {
    return { status: 'discontinuous', reason: 'industry_capital_conflict' };
  }
  return { status: jobSectors.size ? 'compatible' : 'unknown', reason: jobSectors.size ? null : 'industry_not_disclosed' };
}

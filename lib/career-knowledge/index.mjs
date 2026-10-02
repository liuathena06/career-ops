/** Pure local knowledge lookup. No network, persistence, scoring, or Job writes. */
import { CareerProfileStatus, validateCareerProfile } from '../career-domain.mjs';
import { KNOWLEDGE_STAGES, DEFAULT_CAREER_RECOMMENDATION_POLICY, applicableFounderRules, deepFreeze } from './policy.mjs';
import { STABLE_CAREER_KNOWLEDGE, DEFERRED_KNOWLEDGE_SOURCES } from './samples.mjs';

const text = (value) => typeof value === 'string' ? value.trim() : '';
const normalize = (value) => text(value).normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/gu, ' ');
const fail = (message) => { throw new Error('Career knowledge: ' + message); };
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/u.test(value) && Number.isFinite(Date.parse(value));
const FIELDS = {
  occupation: ['preferredTitle', 'alternativeTitles'],
  skill_relationship: ['occupationId', 'skillId', 'label', 'relationship'],
  task: ['occupationId', 'text'],
  related_occupation: ['occupationId', 'relatedOccupationId', 'relationship'],
  title_mapping: ['title', 'occupationIds'],
  market_signal: ['metric', 'value', 'unit', 'geography', 'population', 'periodStart', 'periodEnd', 'expiresAt'],
};

function stringList(value) {
  return Array.isArray(value) && value.every((entry) => text(entry));
}

function metadata(record) {
  if (!text(record?.id) || !text(record.version)) fail('record id and version are required');
  if (!text(record.source?.id) || !text(record.source?.authority) || !text(record.source?.url)) fail('source is required');
  if (!text(record.provenance?.method) || !text(record.provenance?.locator) || !validDate(record.provenance?.capturedAt)) fail('provenance is required');
  if (!Array.isArray(record.applicableStages) || !record.applicableStages.length
      || record.applicableStages.some((stage) => !KNOWLEDGE_STAGES.includes(stage))) fail('invalid applicable stage');
  if (!text(record.chinaApplicability?.status) || !text(record.chinaApplicability?.boundary)) fail('China applicability and boundary are required');
}

function validateRecord(record, dynamic) {
  metadata(record);
  if (!Object.hasOwn(FIELDS, record.kind) || (record.kind === 'market_signal') !== dynamic) fail('invalid knowledge layer');
  const allowed = FIELDS[record.kind];
  const data = record.data;
  if (!data || Array.isArray(data) || typeof data !== 'object'
      || Object.keys(data).some((key) => !allowed.includes(key))
      || allowed.some((key) => !Object.hasOwn(data, key))) fail('unsupported or missing data field');
  for (const key of allowed.filter((key) => !['alternativeTitles', 'occupationIds', 'value'].includes(key))) {
    if (!text(data[key])) fail('empty data field');
  }
  if (record.kind === 'occupation' && !stringList(data.alternativeTitles)) fail('invalid alternative titles');
  if (record.kind === 'title_mapping' && (!stringList(data.occupationIds) || !data.occupationIds.length)) fail('invalid title mapping');
  if (record.kind === 'skill_relationship' && !['essential', 'transferable', 'optional'].includes(data.relationship)) fail('invalid skill relationship');
  if (!dynamic && record.source.authority !== 'official'
      && !(record.kind === 'title_mapping' && record.source.authority === 'local_curation')) fail('V0 stable knowledge requires official sources or explicit local title mappings');
  if (!dynamic && record.source.authority === 'official' && record.chinaApplicability.status !== 'reference_only') fail('foreign occupation knowledge must remain reference only');
  if (!dynamic && record.source.authority === 'official') {
    const hosts = { onet: ['www.onetcenter.org', 'www.onetonline.org'], esco: ['esco.ec.europa.eu', 'ec.europa.eu'] };
    const permitted = hosts[record.source.id];
    for (const url of [record.source.url, record.provenance.url]) {
      let parsed;
      try { parsed = new URL(url); } catch { fail('official source URL is required'); }
      if (!permitted?.includes(parsed.hostname) || parsed.protocol !== 'https:') fail('official source must use its official host');
    }
    if (!/^[a-f0-9]{64}$/u.test(record.provenance.responseSha256 ?? '')) fail('official snapshot checksum is required');
  }
  if (dynamic) {
    if (!Number.isFinite(data.value)) fail('market signal requires a finite observed value');
    if (![data.periodStart, data.periodEnd, data.expiresAt].every(validDate)) fail('market signal dates are required');
    if (Date.parse(data.periodStart) > Date.parse(data.periodEnd)
        || Date.parse(data.periodEnd) > Date.parse(record.provenance.capturedAt)
        || Date.parse(data.expiresAt) < Date.parse(record.provenance.capturedAt)) fail('invalid market signal chronology');
  }
}

/** Separate buckets prevent market observations from masquerading as stable facts. */
export function createCareerKnowledgeCatalog({ stableCareerKnowledge = STABLE_CAREER_KNOWLEDGE, dynamicMarketSignals = [] } = {}) {
  if (!Array.isArray(stableCareerKnowledge) || !Array.isArray(dynamicMarketSignals)) fail('knowledge layers must be arrays');
  stableCareerKnowledge.forEach((record) => validateRecord(record, false));
  dynamicMarketSignals.forEach((record) => validateRecord(record, true));
  const ids = new Set();
  for (const record of [...stableCareerKnowledge, ...dynamicMarketSignals]) {
    if (ids.has(record.id)) fail('duplicate record id');
    ids.add(record.id);
  }
  const occupations = new Set(stableCareerKnowledge.filter((record) => record.kind === 'occupation').map((record) => record.id));
  for (const { kind, data } of stableCareerKnowledge) {
    const refs = kind === 'title_mapping' ? data.occupationIds
      : kind === 'related_occupation' ? [data.occupationId, data.relatedOccupationId]
        : data.occupationId ? [data.occupationId] : [];
    if (refs.some((ref) => !occupations.has(ref))) fail('dangling occupation reference');
  }
  return deepFreeze(structuredClone({ version: 'v0.1', stableCareerKnowledge, dynamicMarketSignals, deferredSources: DEFERRED_KNOWLEDGE_SOURCES }));
}

export const DEFAULT_CAREER_KNOWLEDGE = createCareerKnowledgeCatalog();

export function knowledgeForStage({ stage, catalog = DEFAULT_CAREER_KNOWLEDGE }) {
  if (!KNOWLEDGE_STAGES.includes(stage)) fail('unknown stage');
  return catalog.stableCareerKnowledge.filter((record) => record.applicableStages.includes(stage));
}

/** Exact lexical lookup preserves multiple source interpretations and unknowns. */
export function normalizeCareerTitle({ title, stage = 'search', catalog = DEFAULT_CAREER_KNOWLEDGE }) {
  const records = knowledgeForStage({ stage, catalog });
  const needle = normalize(title);
  const matches = new Map();
  const add = (occupation, ref, basis) => {
    if (!occupation) return;
    const existing = matches.get(occupation.id) ?? {
      occupationId: occupation.id, preferredTitle: occupation.data.preferredTitle,
      knowledgeRefs: [occupation.id], bases: [],
    };
    existing.knowledgeRefs = [...new Set([...existing.knowledgeRefs, ref])];
    existing.bases = [...new Set([...existing.bases, basis])];
    matches.set(occupation.id, existing);
  };
  if (needle) for (const record of records) {
    if (record.kind === 'occupation' && [record.data.preferredTitle, ...record.data.alternativeTitles].some((label) => normalize(label) === needle)) {
      add(record, record.id, 'source_title');
    }
    if (record.kind === 'title_mapping' && normalize(record.data.title) === needle) {
      for (const id of record.data.occupationIds) add(records.find((item) => item.id === id && item.kind === 'occupation'), record.id, 'provisional_chinese_alias');
    }
  }
  return {
    inputTitle: text(title), status: matches.size ? 'candidate_mappings' : 'unknown',
    candidates: [...matches.values()],
    uncertainty: matches.size ? 'LEXICAL_REFERENCE_NOT_ROLE_EQUIVALENCE' : 'TITLE_OUTSIDE_SAMPLE_COVERAGE',
  };
}

/** No guessing of individual capabilities from occupation membership. */
export function buildCareerKnowledgeContext({ profile, roleFamily, catalog = DEFAULT_CAREER_KNOWLEDGE, policy = DEFAULT_CAREER_RECOMMENDATION_POLICY }) {
  validateCareerProfile(profile);
  if (profile.status !== CareerProfileStatus.CONFIRMED) fail('confirmed Career Profile required');
  const records = knowledgeForStage({ stage: 'search', catalog });
  const enabled = applicableFounderRules({ stage: 'search', roleFamily, policy }).some((rule) => rule.id === 'search_direction');
  const normalizations = enabled ? profile.stated.careerDirection
    .filter((entry) => entry.confirmed === true && text(entry.value))
    .map((entry) => ({ ...normalizeCareerTitle({ title: entry.value, catalog }),
      candidateEvidenceRefs: structuredClone(entry.evidenceRefs), evidenceField: 'stated.careerDirection',
    })) : [];
  const occupationIds = new Set(normalizations.flatMap((item) => item.candidates.map((candidate) => candidate.occupationId)));
  const occupations = records.filter((item) => item.kind === 'occupation' && occupationIds.has(item.id));
  const relevantSkills = records.filter((item) => item.kind === 'skill_relationship' && occupationIds.has(item.data.occupationId)).map((item) => ({
    ...item.data, knowledgeRefs: [item.id], candidateCapability: 'unknown', jobRequirement: 'unknown',
  }));
  const tasks = records.filter((item) => item.kind === 'task' && occupationIds.has(item.data.occupationId)).map((item) => ({
    ...item.data, knowledgeRefs: [item.id], candidateExperience: 'unknown', jobRequirement: 'unknown',
  }));
  const adjacentOccupations = records.filter((item) => item.kind === 'related_occupation' && occupationIds.has(item.data.occupationId)).flatMap((item) => {
    const target = records.find((record) => record.kind === 'occupation' && record.id === item.data.relatedOccupationId);
    if (!target || occupationIds.has(target.id)) return [];
    const targetSkills = records.filter((record) => record.kind === 'skill_relationship' && record.data.occupationId === target.id);
    const shared = relevantSkills.filter((skill) => skill.occupationId === item.data.occupationId && targetSkills.some((targetSkill) => targetSkill.data.skillId === skill.skillId));
    const sharedRefs = shared.flatMap((skill) => [...skill.knowledgeRefs, ...targetSkills.filter((targetSkill) => targetSkill.data.skillId === skill.skillId).map((targetSkill) => targetSkill.id)]);
    return [{
      occupationId: target.id, preferredTitle: target.data.preferredTitle,
      fromOccupationId: item.data.occupationId, knowledgeRefs: [item.id, target.id, ...sharedRefs],
      sharedSkillIds: shared.map((skill) => skill.skillId),
      transitionReadiness: 'unknown', requiresConfirmation: true,
    }];
  });
  const proposedSearches = adjacentOccupations.map((item) => {
    const alias = records.find((record) => record.kind === 'title_mapping' && record.data.occupationIds.includes(item.occupationId));
    return {
      jobName: alias?.data.title ?? item.preferredTitle, kind: 'adjacent', explorationOnly: true,
      requiresConfirmation: true, autoExecute: false,
      reason: '官方相关职业线索；行业、客户、工作模式、scope 与可迁移资本仍需核实。',
      knowledgeRefs: [...item.knowledgeRefs, ...(alias ? [alias.id] : [])],
    };
  });
  const refs = new Set([
    ...normalizations.flatMap((item) => item.candidates.flatMap((candidate) => candidate.knowledgeRefs)),
    ...relevantSkills.flatMap((item) => item.knowledgeRefs), ...tasks.flatMap((item) => item.knowledgeRefs),
    ...proposedSearches.flatMap((item) => item.knowledgeRefs),
  ]);
  return {
    stage: 'search', policyVersion: policy.version, catalogVersion: catalog.version,
    status: occupationIds.size ? 'available' : 'unknown',
    normalizations, occupations, relevantSkills,
    transferableSkills: relevantSkills.filter((item) => item.relationship === 'transferable'),
    tasks, adjacentOccupations, proposedSearches,
    references: records.filter((record) => refs.has(record.id)),
    missingEvidence: ['candidate_skill_evidence', 'actual_job_requirements', 'transition_feasibility'],
    scoringUse: 'none',
  };
}

/** Empty, expired, future and non-comparable market samples stay unknown. */
export function marketSignalsForContext({ stage, geography, population, asOf, catalog = DEFAULT_CAREER_KNOWLEDGE }) {
  if (!KNOWLEDGE_STAGES.includes(stage) || !validDate(asOf) || !text(geography) || !text(population)) fail('market query requires stage, date, geography and population');
  const when = Date.parse(asOf);
  const records = catalog.dynamicMarketSignals.filter((record) => record.applicableStages.includes(stage)
    && record.data.geography === geography && record.data.population === population
    && Date.parse(record.provenance.capturedAt) <= when && when <= Date.parse(record.data.expiresAt));
  return { status: records.length ? 'available' : 'unknown', records, scoringUse: 'none' };
}

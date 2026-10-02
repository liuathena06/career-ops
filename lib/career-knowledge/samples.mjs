/**
 * Small, selected official occupation snapshots captured 2026-09-28.
 * O*NET OnLine: USDOL/ETA / National Center for O*NET Development.
 * ESCO: European Commission, DG Employment, Social Affairs and Inclusion.
 * Changes: selected fields/rows, local record IDs, separate Chinese search aliases.
 * Ratings, salaries, education, credentials and market statistics are NOT imported.
 * See SOURCE_REGISTRY for attribution and exact limits on these snapshots.
 */
import { deepFreeze } from './policy.mjs';

export const SOURCE_REGISTRY = deepFreeze({
  onet: {
    id: 'onet', authority: 'official', region: 'US',
    publisher: 'U.S. Department of Labor, Employment and Training Administration',
    url: 'https://www.onetcenter.org/database.html',
    catalogVersionAtCapture: '31.0',
    attribution: 'O*NET® data, USDOL/ETA, via official per-occupation OnLine exports; selected and reformatted. No endorsement implied.',
    licenseUrl: 'https://www.onetonline.org/help/license',
  },
  esco: {
    id: 'esco', authority: 'official', region: 'EU',
    publisher: 'European Commission, DG Employment, Social Affairs and Inclusion',
    url: 'https://esco.ec.europa.eu/en/use-esco/download',
    catalogVersionAtCapture: 'v1.2.1',
    attribution: 'ESCO, European Commission; selected English occupation fields and skill relationships from its official Web Services API.',
    licenseUrl: 'https://esco.ec.europa.eu/es/node/456',
  },
});

// Snapshot versions are immutable local captures, not claims that an unversioned
// OnLine export or an API response without a version echo proves a release number.
const SNAPSHOTS = {
  "onet-sales": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/details/11-2022.00",
    "sha256": "acb5e133df5ba0c2042598a16164a20a6bc7e7353c0002ca22e4c6bf10447eb4"
  },
  "onet-sales-sb": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/sb/11-2022.00/Essential_Skills_11-2022-00.csv?fmt=csv",
    "sha256": "3a960e97bffe9b367f484209e4bbfa597cf3e09a0b0a9dd07868d9b338c256b1"
  },
  "onet-sales-sc": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/sc/11-2022.00/Transferable_Skills_11-2022-00.csv?fmt=csv",
    "sha256": "76ad0ff99f8905286ea5b33332966d466e174a0df010df97b58ada6f63540bbf"
  },
  "onet-sales-tk": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/tk/11-2022.00/Tasks_11-2022-00.csv?fmt=csv",
    "sha256": "2c7d68995e1349588d6045402ed744818bf8218e0d15b5f1460614087cfd143f"
  },
  "onet-sales-ro": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/ro/11-2022.00/Related_Occupations_11-2022-00.csv?fmt=csv",
    "sha256": "14aafe448cf2308a6aff4114cad1b8a26848bfe4477472b9b88888623afd9ff1"
  },
  "onet-marketing": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/details/11-2021.00",
    "sha256": "c34aa663802a166ff709e4f46bbd7175448c9469e07e2b9774b4c129a7450dcc"
  },
  "onet-marketing-sb": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/sb/11-2021.00/Essential_Skills_11-2021-00.csv?fmt=csv",
    "sha256": "18894102e033517b5e4085f3d6997378f6319f7158880255fc966f123244e877"
  },
  "onet-marketing-sc": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/sc/11-2021.00/Transferable_Skills_11-2021-00.csv?fmt=csv",
    "sha256": "7c99bc067020d03ee7bcdfd932dacf50118504422601d8858dc4663946e5e01c"
  },
  "onet-marketing-tk": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/tk/11-2021.00/Tasks_11-2021-00.csv?fmt=csv",
    "sha256": "1bb8e038fe8afbd5476e188e86fc2ac6cedb1e30a201f2def589a9e9e29252f3"
  },
  "onet-marketing-ro": {
    "source": "onet",
    "url": "https://www.onetonline.org/link/table/details/ro/11-2021.00/Related_Occupations_11-2021-00.csv?fmt=csv",
    "sha256": "c7ff296f10ec2bb4a0622bee258416387e472cf9a1b9f9166939a698809e31bc"
  },
  "esco-sales": {
    "source": "esco",
    "url": "https://ec.europa.eu/esco/api/resource/occupation?uri=http%3A%2F%2Fdata.europa.eu%2Fesco%2Foccupation%2Fa7594892-ff23-4e2a-aedf-2f967ebca15c&language=en&selectedVersion=v1.2.1",
    "sha256": "3b9aab03364376932fb3f54aff8c9d75c0ebdc6ac59d3454f7c496bf1a9f0f3f"
  },
  "esco-ict-account": {
    "source": "esco",
    "url": "https://ec.europa.eu/esco/api/resource/occupation?uri=http%3A%2F%2Fdata.europa.eu%2Fesco%2Foccupation%2F89b85c45-ddc7-4fe1-be5a-d3db2be11f3b&language=en&selectedVersion=v1.2.1",
    "sha256": "0a5205fdee939c6b8362f8f7ac7c3267605b896686766e25a99319e43fb0d18b"
  }
};

function fromSnapshot(snapshotId, id, kind, data, locator, applicableStages) {
  const snapshot = SNAPSHOTS[snapshotId];
  return {
    id, kind, data,
    source: SOURCE_REGISTRY[snapshot.source],
    version: 'snapshot-2026-09-28',
    provenance: {
      method: 'selected_official_fields', capturedAt: '2026-09-28', locator,
      url: snapshot.url, responseSha256: snapshot.sha256,
      sourceReleaseVerified: false,
      ...(snapshot.source === 'esco' ? { requestedSourceVersion: 'v1.2.1' } : {}),
      changes: 'Selected rows; source wording retained; no source numeric ratings retained.',
    },
    applicableStages,
    chinaApplicability: {
      status: 'reference_only',
      boundary: 'Occupation-level US/EU context only. Does not establish candidate capability, actual Chinese job requirements, transfer readiness, education, compensation or qualifications.',
    },
  };
}

function localTitle(title, occupationIds) {
  return {
    id: 'local-title:' + title, kind: 'title_mapping', data: { title, occupationIds },
    source: { id: 'local-curation', authority: 'local_curation', url: 'local:career-knowledge/samples.mjs' },
    version: 'v0.1',
    provenance: { method: 'agent_curated_search_alias', capturedAt: '2026-09-28', locator: title, inputRefs: occupationIds },
    applicableStages: ['search', 'discovery', 'detail'],
    chinaApplicability: { status: 'provisional_mapping', boundary: 'Chinese search alias only; not an official translation, occupation equivalence, industry or seniority assertion. Preserve all candidate mappings.' },
  };
}

export const STABLE_CAREER_KNOWLEDGE = deepFreeze([
  fromSnapshot("onet-sales", "onet:11-2022.00", "occupation", {"preferredTitle": "Sales Managers","alternativeTitles": ["Sales Manager","Sales Director","Regional Sales Manager"]}, "Occupation title and selected Sample of reported job titles", ["search","discovery","detail"]),
  fromSnapshot("onet-sales-sb", "onet:11-2022.00:sb:active-listening", "skill_relationship", {"occupationId": "onet:11-2022.00","skillId": "onet-label:active-listening","label": "Active Listening","relationship": "essential"}, "Essential Skill = Active Listening", ["search","detail"]),
  fromSnapshot("onet-sales-sb", "onet:11-2022.00:sb:speaking", "skill_relationship", {"occupationId": "onet:11-2022.00","skillId": "onet-label:speaking","label": "Speaking","relationship": "essential"}, "Essential Skill = Speaking", ["search","detail"]),
  fromSnapshot("onet-sales-sc", "onet:11-2022.00:sc:negotiation", "skill_relationship", {"occupationId": "onet:11-2022.00","skillId": "onet-label:negotiation","label": "Negotiation","relationship": "transferable"}, "Transferable Skill = Negotiation", ["search","detail"]),
  fromSnapshot("onet-sales-sc", "onet:11-2022.00:sc:persuasion", "skill_relationship", {"occupationId": "onet:11-2022.00","skillId": "onet-label:persuasion","label": "Persuasion","relationship": "transferable"}, "Transferable Skill = Persuasion", ["search","detail"]),
  fromSnapshot("onet-sales-sc", "onet:11-2022.00:sc:management-of-personnel-resources", "skill_relationship", {"occupationId": "onet:11-2022.00","skillId": "onet-label:management-of-personnel-resources","label": "Management of Personnel Resources","relationship": "transferable"}, "Transferable Skill = Management of Personnel Resources", ["search","detail"]),
  fromSnapshot("onet-sales-tk", "onet:11-2022.00:task:1", "task", {"occupationId": "onet:11-2022.00","text": "Oversee regional and local sales managers and their staffs."}, "Task = Oversee regional and local sales managers and their staffs.", ["search","detail"]),
  fromSnapshot("onet-sales-tk", "onet:11-2022.00:task:2", "task", {"occupationId": "onet:11-2022.00","text": "Resolve customer complaints regarding sales and service."}, "Task = Resolve customer complaints regarding sales and service.", ["search","detail"]),
  fromSnapshot("onet-sales-ro", "onet:11-2022.00:related:11-2021.00", "related_occupation", {"occupationId": "onet:11-2022.00","relatedOccupationId": "onet:11-2021.00","relationship": "Primary-Short"}, "O*NET-SOC Code = 11-2021.00", ["search","detail"]),
  fromSnapshot("onet-marketing", "onet:11-2021.00", "occupation", {"preferredTitle": "Marketing Managers","alternativeTitles": ["Marketing Director","Product Marketing Manager","Brand Manager"]}, "Occupation title and selected Sample of reported job titles", ["search","discovery","detail"]),
  fromSnapshot("onet-marketing-sb", "onet:11-2021.00:sb:active-listening", "skill_relationship", {"occupationId": "onet:11-2021.00","skillId": "onet-label:active-listening","label": "Active Listening","relationship": "essential"}, "Essential Skill = Active Listening", ["search","detail"]),
  fromSnapshot("onet-marketing-sb", "onet:11-2021.00:sb:speaking", "skill_relationship", {"occupationId": "onet:11-2021.00","skillId": "onet-label:speaking","label": "Speaking","relationship": "essential"}, "Essential Skill = Speaking", ["search","detail"]),
  fromSnapshot("onet-marketing-sc", "onet:11-2021.00:sc:negotiation", "skill_relationship", {"occupationId": "onet:11-2021.00","skillId": "onet-label:negotiation","label": "Negotiation","relationship": "transferable"}, "Transferable Skill = Negotiation", ["search","detail"]),
  fromSnapshot("onet-marketing-sc", "onet:11-2021.00:sc:persuasion", "skill_relationship", {"occupationId": "onet:11-2021.00","skillId": "onet-label:persuasion","label": "Persuasion","relationship": "transferable"}, "Transferable Skill = Persuasion", ["search","detail"]),
  fromSnapshot("onet-marketing-sc", "onet:11-2021.00:sc:management-of-personnel-resources", "skill_relationship", {"occupationId": "onet:11-2021.00","skillId": "onet-label:management-of-personnel-resources","label": "Management of Personnel Resources","relationship": "transferable"}, "Transferable Skill = Management of Personnel Resources", ["search","detail"]),
  fromSnapshot("onet-marketing-tk", "onet:11-2021.00:task:1", "task", {"occupationId": "onet:11-2021.00","text": "Formulate, direct, or coordinate marketing activities or policies to promote products or services, working with advertising or promotion managers."}, "Task = Formulate, direct, or coordinate marketing activities or policies to promote products or services, working with advertising or promotion managers.", ["search","detail"]),
  fromSnapshot("onet-marketing-tk", "onet:11-2021.00:task:2", "task", {"occupationId": "onet:11-2021.00","text": "Use sales forecasting or strategic planning to ensure the sale and profitability of products, lines, or services, analyzing business developments and monitoring market trends."}, "Task = Use sales forecasting or strategic planning to ensure the sale and profitability of products, lines, or services, analyzing business developments and monitoring market trends.", ["search","detail"]),
  fromSnapshot("onet-marketing-ro", "onet:11-2021.00:related:11-2022.00", "related_occupation", {"occupationId": "onet:11-2021.00","relatedOccupationId": "onet:11-2022.00","relationship": "Primary-Short"}, "O*NET-SOC Code = 11-2022.00", ["search","detail"]),
  fromSnapshot("esco-sales", "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c", "occupation", {"preferredTitle": "sales manager","alternativeTitles": ["group sales manager","sales coordinator","area sales manager","inside sales manager","sales director","international sales manage","sales commercial manager","sales executive"]}, "preferredLabel.en, alternativeLabel.en", ["search","discovery","detail"]),
  fromSnapshot("esco-sales", "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c:hasEssentialSkill:cbdce1f8-affe-4013-a519-283fa8ec1f6e", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c","skillId": "http://data.europa.eu/esco/skill/cbdce1f8-affe-4013-a519-283fa8ec1f6e","label": "set sales goals","relationship": "essential"}, "_links.hasEssentialSkill[uri=http://data.europa.eu/esco/skill/cbdce1f8-affe-4013-a519-283fa8ec1f6e]", ["search","detail"]),
  fromSnapshot("esco-sales", "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c:hasEssentialSkill:b99aa3b8-0066-46b2-a027-30afae444ad8", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c","skillId": "http://data.europa.eu/esco/skill/b99aa3b8-0066-46b2-a027-30afae444ad8","label": "implement sales strategies","relationship": "essential"}, "_links.hasEssentialSkill[uri=http://data.europa.eu/esco/skill/b99aa3b8-0066-46b2-a027-30afae444ad8]", ["search","detail"]),
  fromSnapshot("esco-sales", "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c:hasOptionalSkill:65715f7a-c791-416b-b88a-2933a1c81647", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c","skillId": "http://data.europa.eu/esco/skill/65715f7a-c791-416b-b88a-2933a1c81647","label": "recruit personnel","relationship": "optional"}, "_links.hasOptionalSkill[uri=http://data.europa.eu/esco/skill/65715f7a-c791-416b-b88a-2933a1c81647]", ["search","detail"]),
  fromSnapshot("esco-ict-account", "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b", "occupation", {"preferredTitle": "ICT account manager","alternativeTitles": ["ICT account managers","IT account manager","ICT key account manager","IT service delivery manager","IT key account manager"]}, "preferredLabel.en, alternativeLabel.en", ["search","discovery","detail"]),
  fromSnapshot("esco-ict-account", "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b:hasEssentialSkill:31c83903-8fc8-4bd8-9ca4-7a98a9c31eae", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b","skillId": "http://data.europa.eu/esco/skill/31c83903-8fc8-4bd8-9ca4-7a98a9c31eae","label": "perform customers’ needs analysis","relationship": "essential"}, "_links.hasEssentialSkill[uri=http://data.europa.eu/esco/skill/31c83903-8fc8-4bd8-9ca4-7a98a9c31eae]", ["search","detail"]),
  fromSnapshot("esco-ict-account", "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b:hasEssentialSkill:b99aa3b8-0066-46b2-a027-30afae444ad8", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b","skillId": "http://data.europa.eu/esco/skill/b99aa3b8-0066-46b2-a027-30afae444ad8","label": "implement sales strategies","relationship": "essential"}, "_links.hasEssentialSkill[uri=http://data.europa.eu/esco/skill/b99aa3b8-0066-46b2-a027-30afae444ad8]", ["search","detail"]),
  fromSnapshot("esco-ict-account", "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b:hasEssentialSkill:b0b453d0-c5d2-4799-ab26-8d90b17d0e67", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b","skillId": "http://data.europa.eu/esco/skill/b0b453d0-c5d2-4799-ab26-8d90b17d0e67","label": "develop account strategy","relationship": "essential"}, "_links.hasEssentialSkill[uri=http://data.europa.eu/esco/skill/b0b453d0-c5d2-4799-ab26-8d90b17d0e67]", ["search","detail"]),
  fromSnapshot("esco-ict-account", "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b:hasOptionalSkill:cbdce1f8-affe-4013-a519-283fa8ec1f6e", "skill_relationship", {"occupationId": "http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b","skillId": "http://data.europa.eu/esco/skill/cbdce1f8-affe-4013-a519-283fa8ec1f6e","label": "set sales goals","relationship": "optional"}, "_links.hasOptionalSkill[uri=http://data.europa.eu/esco/skill/cbdce1f8-affe-4013-a519-283fa8ec1f6e]", ["search","detail"]),
  localTitle('销售经理', ['onet:11-2022.00', 'http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c']),
  localTitle('销售总监', ['onet:11-2022.00', 'http://data.europa.eu/esco/occupation/a7594892-ff23-4e2a-aedf-2f967ebca15c']),
  localTitle('市场经理', ['onet:11-2021.00']),
  localTitle('ICT客户经理', ['http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b']),
  localTitle('IT客户经理', ['http://data.europa.eu/esco/occupation/89b85c45-ddc7-4fe1-be5a-d3db2be11f3b']),
]);

// Reference registration only: this repository is a third-party conversion of
// the 2022 public-consultation draft, not an official final-release JSON feed.
export const DEFERRED_KNOWLEDGE_SOURCES = deepFreeze([{
  id: 'china-occupation-community-json', status: 'deferred_not_imported',
  source: { id: 'leo4stone-occupation-json', authority: 'third_party', url: 'https://github.com/leo4stone/ZHONGHUARENMINGONGHEGUOZHIYEFENLEIDADIAN' },
  version: '2022-public-consultation-draft-as-described-by-maintainer',
  provenance: { method: 'user_provided_reference_readme_review', capturedAt: '2026-09-28', locator: 'README: 数据来源' },
  applicableStages: ['search', 'discovery', 'detail'],
  chinaApplicability: { status: 'unverified', boundary: 'Third-party transcription of a consultation draft. Verify against official published entries and reuse terms before activation.' },
}]);

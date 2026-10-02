# Third-party Notices

This repository is a fork of `career-ops` and contains its source code.

## career-ops

- Upstream: https://github.com/career-ops-hq/career-ops
- License: MIT, retained in [LICENSE](LICENSE)
- Copyright: Copyright (c) 2026 Santiago Fernández de Valderrama
- Fork base checked on 2026-09-23: `a7ae62825ac764ec95d1d1822df92fd238800d5c`

The upstream LICENSE file and copyright notice must remain included in all copies or substantial portions of the upstream-derived software.

## Career Recommendation Knowledge samples

`lib/career-knowledge/samples.mjs` contains a small selection of public occupation information captured on 2026-09-28. Each source response has a recorded URL, selected-field locator and SHA-256 checksum. Local snapshot version `snapshot-2026-09-28` does not assert that a response without a release-version echo proves a particular upstream release.

### O*NET® OnLine

- Source: U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), [O*NET OnLine](https://www.onetonline.org/).
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/), per the [OnLine content license](https://www.onetonline.org/help/license).
- Selected occupations: Sales Managers (`11-2022.00`) and Marketing Managers (`11-2021.00`). Fields: occupational and reported titles, Essential Skills, Transferable Skills, Tasks, and Related Occupations from their official per-occupation exports.
- The [database catalog](https://www.onetcenter.org/database.html) advertised version 31.0 at capture. The OnLine exports do not echo a database release number; their capture date is the sample version.
- Changes: selected rows and fields, local record identifiers and metadata. Source numeric ratings are omitted. Chinese search aliases are separately attributed local curation. USDOL/ETA has not approved, endorsed or tested these changes. O*NET® is a trademark of USDOL/ETA.

### ESCO

- Source: European Commission, DG Employment, Social Affairs and Inclusion, [ESCO](https://esco.ec.europa.eu/en/use-esco/download).
- Reuse: [ESCO copyright notice](https://esco.ec.europa.eu/es/node/456) and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Selected occupations: `sales manager` and `ICT account manager`. Fields: occupation URI, English preferred/alternative titles and selected essential/optional skill relationships.
- Acquired individually through the official `ec.europa.eu/esco/api/resource/occupation` endpoint with `selectedVersion=v1.2.1`. The returned resource did not echo a release version, so this is a dated snapshot with the requested version retained separately.
- Changes: selected English fields and relationships, record identifiers and metadata; no ESCO software or full dataset is embedded. Chinese aliases are provisional local mappings and are not official translations.

The samples contain no candidate data. The provided Chinese occupation GitHub repository is referenced as a deferred, third-party source; no content from its dataset has been incorporated.

## Reserved notice entries

If this project copies, modifies, distributes, or embeds material from an open-source project, add the relevant copyright notice, license text or license reference, version/commit, and a clear description of the incorporated material here.

Potential future reference projects include:

- OpenWorker — no code has been incorporated at this time.

Before incorporating any code, independently verify the applicable license and attribution requirements for the exact upstream version.

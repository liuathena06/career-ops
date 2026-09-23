# Local-first Career Agent — architecture proposal

Status: **proposal; await founder approval before implementation**.

## Product promise

Core career data is stored locally by default. Our servers do not centrally store résumés, Career Profiles, interview content, or recruiting-platform credentials. When a user selects a cloud model, only the request needed for that inference is sent directly from the local client to the selected provider. This is not a claim that data never leaves the device.

## Proposed delivery path

### V0: Local Career Agent + Real Job Source Prototype

- One React + TypeScript UI plus one local FastAPI process, opened at `localhost` in the browser. This is one deployable local application, not a service architecture.
- SQLite for non-secret records: résumé/source text, Career Profile, interview answers, jobs, evaluations, preferences, and history.
- Two end-to-end loops:
  1. **Career Intelligence** — résumé/user materials → Career Interview → Career Profile → recruiter rubric → Job Evaluation → Recommendation Explanation.
  2. **Job Discovery** — user-owned Liepin MCP key → profile-led job search → normalized Job → recruiter evaluation → a small set of roles worth reviewing.
- Two Job Source Connectors only: `ManualJobConnector` (paste/import, always available) and experimental `LiepinMCPConnector` (personal development testing only). A manual JD or URL must always be able to complete the full Career Intelligence loop when Liepin is unavailable, unauthorized, rate-limited, or changes.
- One model-provider adapter, initially one OpenAI-compatible endpoint, with a local “demo evaluation” fixture so the full UI can be tested without a key. In V0, model keys are entered per session and are never persisted. The Liepin MCP key is supplied only from the developer's local environment for the experimental connector; it is never sent to our server, persisted in the product datastore, included in logs, exports, or source control.
- Career Interview, structured Career Profile, rubric-guided evaluation, and evidence/unknowns/next questions in a single serial workflow.

### V1: usable local alpha

- Keep one local app and one datastore; add local export/delete, migration/versioning, activity history, and Chinese-first UI.
- Add direct provider choices only after the evaluation schema and prompt outputs are stable. For the macOS-only test alpha, use the operating-system keychain through a small local backend adapter; do not persist keys in SQLite, files, or browser storage.
- Add one optional URL-to-JD extraction adapter behind an explicit user action. No job-board credentials, crawling, auto-apply, or MCP required.

### V2: desktop technical proof

- Tauri 2 shell + existing React UI + the already-proven local FastAPI sidecar.
- SQLite for user-owned structured data; OS keychain via Tauri/plugin facilities for provider tokens.
- Tauri owns sidecar start, health check, authenticated loopback binding, shutdown, and crash reporting without career-content telemetry.
- One connector/MCP adapter seam, initially with no China-platform implementation.

## Explicit non-goals this week

- ATS/job-board crawling, BOSS/猎聘 integration, automatic application, platform-token support, MCP execution, OAuth, multi-agent orchestration, multi-model routing, cloud sync, accounts, payment, auto-update, Windows release, or production signing/notarization.

## Data boundary

Use a versioned local record model and keep three separate categories:

1. **Career records**: résumé source, interview transcript, Career Profile, job/JD, evaluation, evidence, preference, audit history.
2. **Secrets**: provider API key and future connector credentials. Never put these in application logs, exports by default, source control, or general app configuration.
3. **Derived artifacts**: summaries and evaluation reports, each retaining source references and unknown/assumption labels.

Every evaluation must record its input record versions, provider/model, prompt/schema version, timestamp, and evidence references. This provides explainability and lets later rubric improvements trigger a deliberate re-evaluation rather than silently changing history.

## Integration seam (later)

`JobSourceConnector -> NormalizedJob -> EvaluationService`

`ManualJobConnector` and `LiepinMCPConnector` are V0 implementations of this boundary. Future implementations may include `CompanyCareerPageConnector`, `ATSConnector`, `PartnerAPIConnector`, and other platform MCP connectors. Every connector must produce the same internal `NormalizedJob` / `Job` schema and attach provenance, retrieval time, source URL or opaque source id, and available-field confidence. No connector may write credentials into the job record.

Career Interview, Career Profile, Job Evaluation, and Recommendation Explanation consume only the internal Job schema. They must not reference Liepin field names, identifiers, ranking signals, or assumptions.

## Experimental Liepin MCP boundary

The V0 Liepin connector validates only: **Career Agent → Liepin MCP → search/get real postings → normalized Job → Career Agent evaluation**. It is not a commercial-product dependency or a promise of coverage.

Before any commercial release using this connector, confirm the official terms, third-party desktop-client authorization, whether a personal token may be used by commercial software, the permissions for search/recommendation/application actions, rate limits, and any partner/commercial authorization requirement. Until then, do not add auto-apply, platform credential persistence, or claims of platform support.

## Decision rule for FastAPI

Use FastAPI from V0 because it provides one controlled point for direct-to-provider calls, local SQLite access, document parsing, and session-only secret handling. Keep it deliberately thin: no task queue, no agent runtime, no external server, and no separate database process. Tauri in V2 supervises this proven single local process.

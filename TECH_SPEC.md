# Technical Specification

## Confirmed principles

- The product is local-first: core career records are stored on the user's device by default.
- One product repository and a small local application are preferred over distributed services.
- Career data, tokens, and job-source credentials must be separated; secrets must not enter Git, ordinary logs, or exports by default.
- Job inputs cross a replaceable `JobSourceConnector` boundary and are converted to one internal `Job` schema before evaluation.
- Manual JD/URL input is a first-class fallback and must remain usable without any connector.
- Cloud-model use must clearly disclose that the inference payload can be sent directly to the user-selected provider.

## Pending validation — not current implementation commitments

- Web/PWA-first is the current product-validation and early-commercialization direction. Formal Web/PWA deployment and Tauri/Desktop packaging are both out of scope until explicitly started; their future credential/connectivity model must not reshape the core domain.

- `career-ops` may inform evaluation workflow, data ownership, evidence-based reports, and normalized job-source design. It will not be mechanically copied or treated as the product runtime.
- OpenWorker may inform desktop-shell and local-sidecar lifecycle thinking.
- Tauri 2 + React + local FastAPI is a V2 technical hypothesis that needs validation. It is not being started on Day 1 and is not yet an adopted production architecture.
- Liepin MCP is an experimental personal-development source only. Its commercial eligibility, terms, permissions, rate limits, and required authorization remain unverified.

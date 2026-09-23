# ADR-001: V0 uses replaceable job-source connectors

**Status:** accepted for V0 planning

## Decision

V0 has two independent loops:

1. Career Intelligence: résumé/materials → Career Interview → Career Profile → recruiter rubric → Job Evaluation → Recommendation Explanation.
2. Job Discovery: user-owned Liepin MCP key → profile-led search → internal Job schema → recruiter evaluation → a small shortlist.

All job supply enters through `JobSourceConnector` and is transformed to the internal `Job` schema before it reaches Career Intelligence. V0 implements exactly two connectors:

- `ManualJobConnector`: pasted JD, import, and URL metadata; always available fallback.
- `LiepinMCPConnector`: experimental personal-development test only.

## Credential and commercial boundary

The development Liepin MCP key exists only in the developer's local environment. It must not reach our servers or be saved in the app datastore, logs, exports, or Git.

Liepin MCP is not approved as a commercial dependency. Before release, verify terms, desktop-client authorization, personal-token commercial use, allowed actions, rate limits, and partner/commercial requirements.

## Consequences

- No Career Profile, rubric, evaluation, recommendation explanation, or storage record may depend on Liepin-specific fields.
- Any connector failure must leave the ManualJobConnector workflow fully usable.
- No other real job source is implemented in V0.

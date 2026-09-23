# Privacy and Local-first Data Boundary

## Default storage

The following core data is stored on the user's device by default:

- résumés and source career materials;
- Career Profiles and Career Interview content;
- job records, job history, evaluations, and recommendation history;
- user preferences; and
- model-provider and recruiting-platform tokens.

Our servers are not intended to centrally store these records or credentials.

## Cloud model disclosure

When a user selects a cloud LLM, the data needed for that specific inference may be sent directly from the local client to the provider the user selected. Local storage does not mean that all data permanently remains on the computer. This product must state that distinction plainly before such a request is made.

## Engineering boundary

Tokens must not be committed to Git, written to ordinary logs, included in default exports, or stored in unsafe plain-text configuration. A future formal desktop application should use the operating system's secure credential store.

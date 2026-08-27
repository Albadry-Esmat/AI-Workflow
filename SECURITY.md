# Security Policy

## Reporting a vulnerability

Please do not publish credentials, tokens, private URLs, or exploit details in a public issue. Use GitHub’s private vulnerability reporting channel for this repository when available, or contact the repository owner directly through the GitHub account associated with `@Albadry-Esmat`.

Include the affected path, impact, reproduction steps that do not disclose secrets, and the first version or commit where the issue was observed.

## Suspected credential exposure

If a credential may have entered a commit, workflow log, artifact, or public deployment, treat it as compromised immediately. Revoke or rotate it at its issuing provider, remove the exposure from active branches and logs where possible, search reachable history, and document the incident privately. Do not rely on log redaction as a substitute for rotation.

## Scope

The production workflow, publication-sync scripts, dependency manifests, and generated website artifacts are in scope. Third-party services and credentials must be reported to their respective owners as well as to this repository when the integration is affected.

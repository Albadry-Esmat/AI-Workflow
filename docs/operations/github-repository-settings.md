# GitHub Repository Settings for Production

## Required Main-Branch Policy

Apply the settings in `.github/branch-protection-policy.json` to `main` before general release. The intended policy requires pull requests, at least one approval, dismissal of stale approvals, approval of the latest push, strict required checks, administrator enforcement, no force-pushes, no branch deletion, and no direct pushes to `main`.

The required checks are the named jobs from the validation workflow:

| Required check | Workflow source | Purpose |
|---|---|---|
| `Skill Validation` | `.github/workflows/validate-skills.yml` | Structural validation, semantic pipeline checks, security scan, dependency audit, and conformance tests. |
| `Docs Broken-Link Check` | `.github/workflows/validate-skills.yml` | Internal Markdown link validation. |
| `Website Data Sync Check` | `.github/workflows/validate-skills.yml` | Detects drift between source files and generated website data. |

## Current Repository Limitation

The repository is private and the current GitHub plan returned HTTP 403 with the message that branch protection requires GitHub Pro or a public repository. The policy is therefore committed locally as a machine-readable release requirement, but it could not be enabled through the available account plan.

Do not treat the absence of remote branch protection as a green production gate. Until the plan is upgraded or the repository is made public, enforce the policy operationally by requiring pull requests, using the committed workflow checks, restricting write access to release owners, and recording an explicit exception in the release report.

## Website Publication Policy

The website synchronization workflow now creates a branch and opens a pull request in `Albadry-Esmat/ASE-OS-Website` rather than pushing directly to its `main` branch. The publication credential should be a dedicated fine-grained token restricted to that repository. Local direct publication remains available only with the explicit `--confirm-website` flag.

## Release Tag Policy

Create a release tag only from a commit whose pull request has passed all required checks and received the required review. Record the source commit, tag, website-data PR, and rollback commit in the release report. Never force-push release tags or rewrite the protected branch history.

# Deterministic Toolchain — Onboarding Batch O1

## Purpose

O1 makes the AI-Workflow core reproducible without making any named AI-agent runtime a dependency. The source-owned toolchain manifest is `config/toolchain-manifest.json`; its schema is `config/toolchain-manifest-schema.json`. The concrete policy is `config/toolchain-policy.json` and its schema is `config/toolchain-policy-schema.json`.

The design follows two established lockfile principles. npm documents `package-lock.json` as the exact dependency tree intended to be committed so teams, deployments, and CI install the same dependencies [1]. Python documents `venv` as an isolated, disposable environment that should be recreated from a requirements file rather than moved or committed [2]. mise documents exact tool versions, checksums, platform URLs, and strict locked mode for reproducible tools [3].

## Core policy

The core requires Git, Python, Node, and npm within the supported ranges declared by the manifest. Python validation dependencies are pinned in `requirements-dev.txt` and installed into `.venv`. Node validation tools are declared in root `package.json` and installed from the committed `package-lock.json` using `npm ci`. Global `pip` and global npm package installation are forbidden by O1.

The agent runtime remains separate. AI-Workflow does not install OpenCode, Claude Code, Codex CLI, or a generic command. The adapter catalog owns runtime installation channels and future exact-version selection. O1 only verifies an existing runtime when a later adapter-aware check requests it; it does not add provider login or runtime launch behavior.

## Commands

The O1 controls are:

```bash
make setup
aiw health
aiw toolchain-check
aiw validate-onboarding-o1
```

`aiw toolchain-check` is equivalent to the non-mutating no-network gate:

```bash
python .venv/bin/python scripts/check-toolchain.py \
  --check-only \
  --no-network \
  --json-output artifacts/onboarding-o1-toolchain-evidence.json
```

The checker probes host versions, validates supported ranges, confirms `.venv`, verifies exact Python requirements, checks the root npm lockfile and local AJV binary, scans setup/health policy for global mutations, and confirms runtime installation remains adapter-owned. It does not install packages, modify files, resolve dependencies, or call a network service.

## Failure behavior

Unknown or out-of-range core tool versions fail closed. A missing local `.venv`, missing local AJV binary, lockfile drift, or missing pinned requirement blocks the O1 gate. A missing named runtime does not block core validation because runtime installation and authentication are intentionally deferred and user-controlled.

The `setup` script creates `.venv`, installs `requirements-dev.txt`, runs root `npm ci --ignore-scripts --no-audit --no-fund`, and installs `.opencode` packages locally. It does not run `sudo pip3 install`, `npm install -g`, or an agent-runtime installer. The `.env` file remains a local configuration boundary; credentials are optional for the no-secret validation path.

## Reproducibility and rollback

`.venv` and `node_modules` are disposable and recreatable. The source manifests and lockfiles are the reproducibility boundary. A failed install must not change the committed manifests. To roll back local dependencies, remove `.venv` and `node_modules`, restore the lockfiles, and rerun `make setup`.

O1 does not yet provide a transactional setup wizard, runtime auto-detection, provider authentication, target-project preflight, or neutral runtime launch. Those capabilities are O2 and later.

## References

[1]: https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/ "npm package-lock.json documentation"

[2]: https://docs.python.org/3/library/venv.html "Python venv documentation"

[3]: https://mise.jdx.dev/dev-tools/mise-lock.html "mise.lock lockfile documentation"

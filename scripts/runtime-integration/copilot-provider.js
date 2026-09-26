#!/usr/bin/env node
'use strict';
// Runtime Integration — Copilot provider (BELOW the boundary).
//
// INTENTIONALLY UNSUPPORTED (returns []): `opencode models` is the single
// authoritative source for models the OpenCode runtime can actually execute.
// A separate Copilot probe would duplicate runtime responsibility and could
// disagree with `opencode models` (e.g. report a model OpenCode cannot invoke),
// which would be a false availability claim. If the operator connects the
// github-copilot provider to OpenCode, its models appear via opencode-provider.
// Do NOT add Copilot authentication or credential handling here — the runtime
// owns provider configuration/authentication.
function listModels() { return []; }
module.exports = { listModels };

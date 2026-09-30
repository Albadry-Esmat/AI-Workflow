#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node - "$ROOT" <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { computeGitSubject, verifyTriad } = require(process.argv[2] + '/scripts/verify-governance-execution-evidence');

const git = '/usr/bin/git';
const repo = fs.mkdtempSync(path.join(os.tmpdir(),'aiw-stage-c-subject-'));
const run = (...args) => execFileSync(git,['-C',repo,...args],{stdio:'ignore'});
run('init','-q'); run('config','user.email','aiw-test@example.invalid'); run('config','user.name','AIW Test');
fs.writeFileSync(path.join(repo,'payload.txt'),'base\n'); run('add','payload.txt'); run('commit','-qm','base');
const base = execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
fs.writeFileSync(path.join(repo,'payload.txt'),'head\n'); run('commit','-am','head','-q');
const head = execFileSync(git,['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const recomputed = computeGitSubject({repoDir:repo,gitPath:git,baseSha:base,headSha:head,allowedPaths:['payload.txt']});
assert.equal(recomputed.base_sha,base); assert.equal(recomputed.head_sha,head); assert.match(recomputed.diff_sha256,/^[a-f0-9]{64}$/); assert.match(recomputed.scope_sha256,/^[a-f0-9]{64}$/);
assert.throws(()=>computeGitSubject({repoDir:repo,gitPath:git,baseSha:head,headSha:base,allowedPaths:['payload.txt']}),/merge-base/);
assert.throws(()=>computeGitSubject({repoDir:repo,gitPath:git,baseSha:base,headSha:head,allowedPaths:['outside.txt']}),/allowlist/);

const previousEnv = {};
for (const key of ['GITHUB_REPOSITORY','GITHUB_REF','GITHUB_WORKFLOW_REF','GITHUB_WORKFLOW_SHA','GITHUB_RUN_ID']) previousEnv[key]=process.env[key];
Object.assign(process.env,{GITHUB_REPOSITORY:'Albadry-Esmat/AI-Workflow',GITHUB_REF:'refs/heads/main',GITHUB_WORKFLOW_REF:'Albadry-Esmat/AI-Workflow/.github/workflows/source-governance-witness.yml@refs/heads/main',GITHUB_WORKFLOW_SHA:'e'.repeat(40),GITHUB_RUN_ID:'123'});
const gateIdentity = {trusted:true,workflow_path:'.github/workflows/source-governance-witness.yml',workflow_source_sha:'e'.repeat(40),repository:'Albadry-Esmat/AI-Workflow',ref:'refs/heads/main',run_id:'123'};
const noCredentials = {merge:false,source_signing:false,witness_signing:false};
const model = {requested:'openai/gpt-6-luna',resolved:'openai/gpt-6-luna',available:true,attested:false,same_model_allowed:true,same_execution_not_allowed:true};
const subject = {...recomputed};
const producer = {role:'producer',execution_id:'p-1',session_id:'ps-1',...subject,outcome:'recorded',model,credentials:noCredentials,capabilities:{source_write:true,source_write_scope_sha256:subject.scope_sha256,read_only:false,merge:false,reviewer_evidence:false,gatekeeper:false,witness_signing:false}};
const reviewer = {role:'reviewer',execution_id:'r-1',session_id:'rs-1',...subject,outcome:'pass',reviewer_execution_id:'r-1',model,credentials:noCredentials,capabilities:{source_write:false,source_write_scope_sha256:null,read_only:true,merge:false,reviewer_evidence:true,gatekeeper:false,witness_signing:false}};
const gatekeeper = {role:'gatekeeper',execution_id:'g-1',session_id:'gs-1',...subject,outcome:'pass',model,credentials:noCredentials,gatekeeper_identity:gateIdentity,capabilities:{source_write:false,source_write_scope_sha256:null,read_only:true,merge:false,reviewer_evidence:false,gatekeeper:true,witness_signing:false}};
const authorization = {authorization_id:'A0-child-fixture',canonical_payload_sha256:'f'.repeat(64),approver_login:'Albadry-Esmat',state:'active',consumed:false,expires_at:'2099-01-01T00:00:00Z',base_sha:base,head_sha:head,allowed_paths:['payload.txt']};
const input = {subject,producers:[producer],reviewer,gatekeeper,authorization,repoDir:repo,gitPath:git};
assert.equal(verifyTriad(input).valid,true);
assert.equal(verifyTriad({...input,reviewer:{...reviewer,execution_id:'p-1'}}).reason,'producer and reviewer execution/session must differ');
assert.equal(verifyTriad({...input,reviewer:{...reviewer,session_id:'ps-1'}}).reason,'producer and reviewer execution/session must differ');
assert.match(verifyTriad({...input,reviewer:{...reviewer,diff_sha256:'f'.repeat(64)}}).reason,/stale/);
assert.match(verifyTriad({...input,reviewer:{...reviewer,outcome:'fail'}}).reason,/outcome blocks/);
assert.match(verifyTriad({...input,gatekeeper:{...gatekeeper,outcome:'fail'}}).reason,/outcome blocks/);
assert.match(verifyTriad({...input,producers:[{...producer,capabilities:{...producer.capabilities,merge:true}}]}).reason,/forbidden authority/);
assert.match(verifyTriad({...input,reviewer:{...reviewer,capabilities:{...reviewer.capabilities,source_write:true}}}).reason,/read-only/);
assert.match(verifyTriad({...input,gatekeeper:{...gatekeeper,gatekeeper_identity:{...gateIdentity,trusted:false}}}).reason,/identity incomplete/);
assert.match(verifyTriad({...input,subject:{...subject,diff_sha256:'f'.repeat(64)}}).reason,/independently recomputed/);
assert.match(verifyTriad({...input,reviewer:{...reviewer,credentials:{...noCredentials,merge:true}}}).reason,/forbidden credential/);
assert.match(verifyTriad({...input,producers:[{...producer,capabilities:{...producer.capabilities,source_write_scope_sha256:'f'.repeat(64)}}]}).reason,/out-of-scope/);
assert.match(verifyTriad({...input,gatekeeper:{...gatekeeper,gatekeeper_identity:{...gateIdentity,run_id:'999'}}}).reason,/independently bound/);
assert.match(verifyTriad({...input,reviewer:{...reviewer,model:{...model,resolved:'openai/gpt-5.6-luna'}}}).reason,/model resolution mismatch/);
process.env.GITHUB_WORKFLOW_REF='Albadry-Esmat/AI-Workflow/.github/workflows/agent-review.yml@refs/heads/main';
assert.match(verifyTriad(input).reason,/Gatekeeper runtime identity unavailable/);
process.env.GITHUB_WORKFLOW_REF='Albadry-Esmat/AI-Workflow/.github/workflows/source-governance-witness.yml@refs/pull/9/merge';
process.env.GITHUB_REF='refs/pull/9/merge';
assert.match(verifyTriad(input).reason,/Gatekeeper runtime identity unavailable/);
for (const key of Object.keys(previousEnv)) delete process.env[key];
assert.match(verifyTriad(input).reason,/Gatekeeper runtime identity unavailable/);
for (const [key,value] of Object.entries(previousEnv)) if (value !== undefined) process.env[key]=value;
console.log('PASS: Git recomputation, trusted workflow identity, exact model, capabilities, freshness, and fail-closed roles');
NODE

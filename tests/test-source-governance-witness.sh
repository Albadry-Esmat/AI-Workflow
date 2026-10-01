#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node - "$ROOT" <<'NODE'
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = process.argv[2];
const { canonicalize } = require(path.join(root, 'scripts/canonicalize-source-governance'));
const witness = require(path.join(root, 'scripts/verify-source-governance-witness'));
const digest = (s) => crypto.createHash('sha256').update(s).digest('hex');

assert.equal(canonicalize({b:'two',a:'one'}), '{"a":"one","b":"two"}');
assert.deepEqual(witness.parseCanonicalEnvelope(Buffer.from('{"a":"one","b":"two"}\n')),{a:'one',b:'two'});
assert.throws(()=>witness.parseCanonicalEnvelope(Buffer.from('{"b":"two","a":"one"}\n')),/not canonical JCS/);
assert.equal(digest(canonicalize({b:'two',a:'one'})), '8f770258ab53f8b20001e6ba82ae42d66479db3053a3b74776bafa2a92674514');
assert.equal(canonicalize({a:'ascii','é':'bmp','😀':'emoji','':'private'}), '{"a":"ascii","é":"bmp","😀":"emoji","":"private"}');
assert.equal(digest(canonicalize({a:'مرحبا',combining:'é',items:['z','a']})), '30fe170e117611f2e2d95a0a663e3da6be971e5a3e71ba57458e149ff0d1844c');
assert.throws(() => canonicalize({x: Number.NaN}), /non-finite/);
assert.throws(() => canonicalize({x: undefined}), /non-JSON/);
assert.throws(() => canonicalize(new Date()), /plain objects/);

const a0 = {schema:'aiw-source-governance-a0/1',authorization_id:'A0-fixture',state:'pending_witness',expires_at:'2099-01-01T00:00:00Z',witness_profile_sha256:'a'.repeat(64),governance:{governance_mode:'solo-owner-autonomous',independent_human_review:false},repository:{full_name:'Albadry-Esmat/AI-Workflow',default_branch:'main',base_sha:'b'.repeat(40)}};
const a0Digest = digest(canonicalize(a0));
const canonicalization = 'RFC8785-JCS (ASCII member names/values; integer-only numeric fields)';
assert.equal(witness.parseA0Body(JSON.stringify({canonicalization,canonical_payload_sha256:a0Digest,a0_payload:a0})).digest, a0Digest);
assert.throws(() => witness.parseA0Body(JSON.stringify({canonicalization,canonical_payload_sha256:'0'.repeat(64),a0_payload:a0})), /digest mismatch/);
assert.equal(witness.parseIssueReference('A0 Issue: #47\nW0 Authorization ID: W0-fixture').issueNumber, 47);
assert.throws(() => witness.checkApiPath('/repos/Albadry-Esmat/AI-Workflow/issues/47/labels'), /outside allowlist/);
assert.throws(() => witness.checkApiPath('/repos/Albadry-Esmat/AI-Workflow/pulls/8/merge','POST'), /write endpoint outside/);
assert.doesNotThrow(() => witness.checkApiPath('/repos/Albadry-Esmat/AI-Workflow/commits/' + 'a'.repeat(40)));
const auth = {schema:'aiw-w0-authorization/1',authorization_id:'W0-fixture',nonce:'c'.repeat(64),parent_a0_nonce:'9'.repeat(64),state:'active',consumed:false,issue_number:47,pr_number:8,repository:'Albadry-Esmat/AI-Workflow',base_sha:'b'.repeat(40),head_sha:'d'.repeat(40),diff_sha256:'e'.repeat(64),allowed_paths:['one','two'],expires_at:'2099-01-01T00:00:00Z',parent_a0_id:'A0-fixture',parent_a0_sha256:'f'.repeat(64),b0_before_sha256:'1'.repeat(64),b0_after_sha256:'2'.repeat(64),witness_profile_sha256:'a'.repeat(64),verifier:{id:'AIW-SOLO-W0-BOOTSTRAP-VERIFIER',version:'1.0.1'},acquirer:{id:'AIW-SOLO-W0-EVIDENCE-ACQUIRER',version:'1.0.0'},required_checks:[]};
auth.canonical_payload_sha256=digest(canonicalize(auth));
const authComment = '<!-- AIW-W0-AUTHORIZATION/1 -->\n' + JSON.stringify(auth) + '\n<!-- /AIW-W0-AUTHORIZATION/1 -->';
assert.equal(witness.parseW0Authorization(authComment,47).authorization_id,'W0-fixture');
const lifecycleRecord = {w0_authorization_id:'W0-fixture',w0_state:'witnessing',witness_workflow_run_id:'r1'};
const lifecycleComment = {user:{login:'github-actions[bot]'},body:'<!-- AIW-A0-W0-LIFECYCLE/1 -->\n'+JSON.stringify(lifecycleRecord)+'\n<!-- /AIW-A0-W0-LIFECYCLE/1 -->'};
assert.equal(witness.parseLifecycleComments([lifecycleComment])[0].w0_state,'witnessing');
assert.throws(()=>witness.assertW0NotAttempted([lifecycleRecord],'W0-fixture'),/replay is blocked/);
const receipt = {verdict:'PASS',repository:auth.repository,pr_number:auth.pr_number,base_sha:auth.base_sha,head_sha:auth.head_sha,diff_sha256:auth.diff_sha256,w0_authorization_id:auth.authorization_id,b0_before_sha256:auth.b0_before_sha256,b0_after_sha256:auth.b0_after_sha256,witness_profile_sha256:auth.witness_profile_sha256,verifier:auth.verifier,acquirer:auth.acquirer,allowed_paths:auth.allowed_paths,evidence_manifest_sha256:'3'.repeat(64),required_checks:[]};
receipt.canonical_payload_sha256=digest(canonicalize(receipt));
assert.equal(witness.parseVerifierPass('<!-- AIW-W0-VERIFIER-PASS/1 -->\n'+JSON.stringify(receipt)+'\n<!-- /AIW-W0-VERIFIER-PASS/1 -->',auth).verdict,'PASS');
const verifier = {...auth.verifier,sha256:'4'.repeat(64)};
const acquirer = {...auth.acquirer,sha256:'5'.repeat(64)};
auth.verifier = verifier; auth.acquirer = acquirer;
auth.required_checks = [{context:'Skill Validation',app_id:15368}];
const a0Full = {...a0,package:{verifier,acquirer},witness_profile_sha256:auth.witness_profile_sha256};
auth.parent_a0_sha256 = digest(canonicalize(a0Full));
const pr = {number:8,merged:true,base:{ref:'main',repo:{full_name:auth.repository}},head:{sha:auth.head_sha,repo:{full_name:auth.repository}},merge_commit_sha:'6'.repeat(40)};
const checks = [{name:'Skill Validation',app:{id:15368},head_sha:auth.head_sha,status:'completed',conclusion:'success'}];
const good = witness.createWitnessEnvelope({a0:a0Full,a0Digest:auth.parent_a0_sha256,authorization:auth,pr,files:[{filename:'one'},{filename:'two'}],checks,diffDigest:auth.diff_sha256,workflowSha:'7'.repeat(40),currentSha:pr.merge_commit_sha,mergeCommit:{sha:pr.merge_commit_sha,parents:[{sha:auth.base_sha}]},verifierReceipt:{verdict:'PASS'}});
assert.equal(good.event,'A0_W0_BOOTSTRAP_WITNESSED');
assert.equal(good.w0.state_after_witness,'consumed');
assert.throws(()=>witness.createWitnessEnvelope({a0:a0Full,a0Digest:auth.parent_a0_sha256,authorization:auth,pr,files:[{filename:'one'},{filename:'two'}],checks,diffDigest:'8'.repeat(64),workflowSha:'7'.repeat(40),currentSha:pr.merge_commit_sha,mergeCommit:{sha:pr.merge_commit_sha,parents:[{sha:auth.base_sha}]},verifierReceipt:{verdict:'PASS'}}),/diff digest mismatch/);
const tufHome = fs.mkdtempSync(path.join(os.tmpdir(),'aiw-tuf-fixture-'));
const tufUrl = 'https://tuf-repo-cdn.sigstore.dev';
const encoded = encodeURIComponent(tufUrl);
const targetDir = path.join(tufHome,'.cache','sigstore-python','tuf',encoded);
const metadataDir = path.join(tufHome,'.local','share','sigstore-python','tuf',encoded,'metadata');
fs.mkdirSync(targetDir,{recursive:true}); fs.mkdirSync(metadataDir,{recursive:true});
const rootBytes = Buffer.from('{"trusted":true}\n');
fs.writeFileSync(path.join(targetDir,'trusted_root.json'),rootBytes);
for (const name of ['root.json','timestamp.json','snapshot.json']) fs.writeFileSync(path.join(metadataDir,name),JSON.stringify({signed:{version:1}}));
const targetsMeta = {signed:{version:7,targets:{'trusted_root.json':{length:rootBytes.length,hashes:{sha256:digest(rootBytes.toString())}}}}};
fs.writeFileSync(path.join(metadataDir,'targets.json'),JSON.stringify(targetsMeta));
const witnessPath=path.join(tufHome,'primary.json'); fs.writeFileSync(witnessPath,'{}\n'); fs.writeFileSync(witnessPath+'.sigstore.json','{"bundle":true}\n');
const tufOutput=path.join(tufHome,'tuf-evidence.json');
const tufCapture=witness.captureTufEvidence({home:tufHome,witnessPath,outputPath:tufOutput});
const tufEvidence=JSON.parse(fs.readFileSync(tufOutput,'utf8'));
assert.equal(tufEvidence.trusted_root.sha256,tufCapture.trusted_root_sha256);
assert.equal(tufEvidence.metadata.find(x=>x.name==='targets.json').version,7);
assert.equal(tufEvidence.signed_witness_bundle.sha256,digest(fs.readFileSync(witnessPath+'.sigstore.json').toString()));
const chunks=witness.tufEvidenceChunkRecords(fs.readFileSync(tufOutput),'W0-fixture',40);
assert.equal(Buffer.concat(chunks.map(x=>Buffer.from(x.content_base64,'base64'))).toString(),fs.readFileSync(tufOutput,'utf8'));
assert.ok(chunks.every(x=>x.tuf_evidence_sha256===digest(fs.readFileSync(tufOutput))));
assert.throws(()=>witness.tufEvidenceChunkRecords(Buffer.alloc(0),'W0-fixture'),/size/);

const workflow = fs.readFileSync(path.join(root,'.github/workflows/source-governance-witness.yml'),'utf8');
const website = fs.readFileSync(path.join(root,'.github/workflows/sync-website.yml'),'utf8');
const witnessSource=fs.readFileSync(path.join(root,'scripts/verify-source-governance-witness.js'),'utf8');
assert.match(workflow,/sigstore\/gh-action-sigstore-python@790bc6befb9d733738f18d8f895854b453640ec9/);
assert.match(workflow,/rekor-version: "1"/);
assert.match(workflow,/staging: false/);
assert.match(workflow,/verify-cert-identity: https:\/\/github.com\/Albadry-Esmat\/AI-Workflow\/\.github\/workflows\/source-governance-witness\.yml@refs\/heads\/main/);
assert.match(workflow,/verify-oidc-issuer: https:\/\/token\.actions\.githubusercontent\.com/);
assert.match(workflow,/id-token: write/);
assert.match(workflow,/--capture-trust-root/);
assert.ok(workflow.indexOf('--mark-witnessing') < workflow.indexOf('Sign and verify canonical bootstrap evidence'));
const markBranch=witnessSource.indexOf("if (mode === '--mark-witnessing')");
assert.ok(markBranch >= 0 && markBranch < witnessSource.indexOf('const tufPath',markBranch),'reservation branch must not read post-signing artifacts');
assert.match(workflow,/actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
assert.equal((workflow.match(/sigstore\/gh-action-sigstore-python@790bc6befb9d733738f18d8f895854b453640ec9/g)||[]).length,2);
const validateSkills=fs.readFileSync(path.join(root,'.github/workflows/validate-skills.yml'),'utf8');
const yamlCheck=require('child_process').spawnSync('python3',['-c','import sys,yaml; d=yaml.safe_load(open(sys.argv[1])); x=d.get("on",d.get(True)); assert x["push"]["branches"]==["main"]; assert x["push"]["paths"]==x["pull_request"]["paths"]',path.join(root,'.github/workflows/validate-skills.yml')],{encoding:'utf8'});
assert.equal(yamlCheck.status,0,yamlCheck.stderr||yamlCheck.stdout);
for (const source of [workflow,website]) {
  assert.ok(!source.includes('WEBSITE_DEPLOY_TOKEN'));
  assert.ok(!source.includes('Albadry-Esmat/ASE-OS-Website'));
  assert.ok(!/\bgit\s+push\b/.test(source));
}
console.log('PASS: canonicalization, A0 binding, endpoint allowlist, Sigstore profile, and website isolation');
NODE

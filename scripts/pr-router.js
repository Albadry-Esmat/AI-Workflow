#!/usr/bin/env node
'use strict';
// PR event routing (P2) — maps GitHub PR events to workflow actions.
// opened/reopened -> REVIEW (first pass) | synchronize -> re-review (SHA changed)
// checks completed -> gate evaluation. Draft PRs get visibility only, never review-ready.
function route({ action, draft = false, headShaChanged = false } = {}) {
  if (draft) return { route: 'observe', reason: 'draft PR: visibility only, never review-ready' };
  switch (action) {
    case 'opened':
    case 'reopened':
      return { route: 'review', reason: 'first pass review' };
    case 'synchronize':
      return headShaChanged
        ? { route: 're-review', reason: 'head SHA moved; prior approvals invalid' }
        : { route: 'observe', reason: 'no SHA change' };
    case 'checks_completed':
      return { route: 'gate', reason: 'evaluate merge conditions on live state' };
    default:
      return { route: 'ignore', reason: `unhandled action: ${action}` };
  }
}
module.exports = { route };
if (require.main === module) {
  const [action, draft] = process.argv.slice(2);
  console.log(JSON.stringify(route({ action, draft: draft === 'draft', headShaChanged: true })));
}

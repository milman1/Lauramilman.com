# Finished-jewelry intake and activation gate

- Issue: https://github.com/milman1/Lauramilman.com/issues/209
- PR: https://github.com/milman1/Lauramilman.com/pull/210
- Updated: 2026-10-05 UTC
- Owner: Codex; branch `jewelry-activation-gate-2026-10-05`
- Status: implementation tested; merge blocked pending merchant permission.
- Code commit: `17fb749ddece02583f5a7af62303a28e58691b35` (this handoff is a subsequent documentation-only addition).

Completed: draft-only API creation command, draft CSV preflight, reviewed
activation with fresh snapshot binding and independent readback, full listing
checklist and shared model instructions. Finished lab-grown price rule is 2×
cost rounded to cents; settings remain 3× rounded to dollars. No live product
creation, editing, repricing, status changes or publication occurred.

Verified: full suite 807 tests passed before the final three focused additions;
final focused suite 41 tests passed. Strict compile of new modules/tests passed.
Full-repo typecheck has 19 existing errors reproduced on base c88aec2. Shopify
schema validation passed; five live draft products were sampled read-only and
the gate flagged missing SEO/SKU/cost data. The final query including sales
channel assignments also succeeded live. Tested local tree and uploaded remote
code tree match (`95a0db84e272c8f5155701f5ab136685ffab37e3`). Private source
snapshots are not needed to resume and were not committed.

Blocker: automatic approval review rejected merging PR #210 because the
merchant's implementation instruction did not explicitly authorize merging
that named PR into default/main, which can deploy changes. Do not work around
this by pushing main or merging through another tool. Ask for approval to merge
PR #210. After approval, inspect its latest head and checks, merge with the
expected head SHA, verify main contains the gate, then update this issue.

Read `docs/seo/jewelry-activation-gate.md` for usage and limits. This is not a
Shopify-wide proxy or interception service. Unrelated chat apps and direct
Shopify product-write access can bypass the repo commands. Universal enforcement
would need a controlled write service and credential/access migration; neither
has been installed. Do not claim all other chat models automatically use it.
Source/preview evidence is an attestation, not a signed identity; do not fill
it without actual review. No existing draft/archived item is authorized for
activation by this implementation task.

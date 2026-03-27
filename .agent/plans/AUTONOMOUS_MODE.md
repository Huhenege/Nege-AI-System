# Autonomous Quality Improvement Mode

Project: Nege Management Systems
Mode: Guardrailed autonomy
Primary human interface: Telegram

## Mission
Improve system quality without breaking existing behavior.

Primary goals:
- keep production build healthy
- restore reliable typecheck/test/lint gates
- reduce regression risk
- improve maintainability in small validated batches
- escalate risky security/tenant/business-rule changes instead of guessing

## Human interaction model
The human is not expected to sit at the computer continuously.
Agents may continue working asynchronously within the approved scope below.
When risky decisions are encountered, agents must pause that branch of work, record it in `PENDING_APPROVALS.md`, and send a short approval request summary through the human communication channel when configured.

## Standing approval: automatically allowed work
Agents may proceed without asking for approval when all of the following are true:
- the change is behavior-preserving or low-risk
- the batch is small and reviewable
- validation is run after the change
- no protected domain below is modified

### Auto-approved work classes
- build / typecheck / test / lint runs
- audit reports and documentation updates
- safe refactors
- lint error cleanup
- typecheck reliability fixes
- adding or improving tests
- low-risk file reorganization
- extracting repeated local logic
- readability and maintainability improvements
- warning inventories and hotspot reports

## Protected domains: must pause for approval
Agents must not proceed automatically when work touches any of the following in a meaningful way:
- auth or session logic
- tenant/company isolation logic
- billing or pricing logic
- Firestore rules or storage rules
- schema or data migrations
- destructive file/data operations
- unclear business rules
- major API contract changes
- wide renames across critical modules

## Stop conditions
Agents must stop the current branch of work when:
- a quality gate becomes worse than before
- the intended behavior is ambiguous
- the fix expands beyond the approved scope
- more than a small bounded batch is required
- a protected domain must be changed
- rollback confidence is low

## Validation rules
Every execution batch must end with the smallest relevant validation set, and critical batches must run the full set.

### Default full validation set
- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run lint`

### Minimum rule
No batch is complete unless its agreed validation set has passed or any remaining failure is explicitly documented.

## Batch size policy
Default batch target:
- 1 focused objective
- 3 to 10 files changed
- 1 validation pass
- 1 summary entry

If a task grows beyond that size, split it.

## Reporting policy
Agents should leave durable written status, not rely on chat memory.

### Required outputs
- append work summaries to `DAILY_AUTOMATION_LOG.md`
- record blocked risky items in `PENDING_APPROVALS.md`
- update reports/checklists when baseline status changes

### Telegram-style message categories
- `SUMMARY` — progress update
- `BATCH_DONE` — completed validated batch
- `ALERT` — gate failed or unexpected breakage
- `APPROVAL_NEEDED` — protected-domain decision required

## Current approved objective
Phase 1 baseline recovery:
1. restore reliable typecheck
2. resolve middleware test drift safely
3. eliminate current lint hard errors
4. keep build passing

## Explicitly not approved in this phase
- auth redesign
- tenant model rewrite
- billing behavior change
- Firestore rule changes
- migration execution
- destructive cleanup

## Completion criteria for this phase
This autonomous phase is considered successful when:
- build passes
- typecheck passes reliably
- tests pass reliably
- lint hard errors are resolved
- risky auth/tenant follow-up items are documented for later approval

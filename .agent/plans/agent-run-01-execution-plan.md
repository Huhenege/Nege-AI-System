# Agent Run 01 — Execution Plan

Project: Nege Management Systems  
Mode: Autonomous quality improvement (guardrailed)  
Date: 2026-03-23

## Run objective
Recover the baseline quality gates without changing protected domains.

## In scope
1. Restore reliable `npm run typecheck`
2. Resolve current middleware test drift safely
3. Eliminate current lint hard errors
4. Keep `npm run build` passing

## Out of scope
- auth redesign
- tenant/company isolation rewrites
- billing/pricing changes
- Firestore/storage rules changes
- migration execution
- destructive cleanup
- wide architectural rewrites

## Specialist roles for this run

### Coordinator
- own task order
- keep batches small
- enforce stop conditions
- publish run summary

### Type Guardian
- identify root cause of `.next/types` dependency drift
- propose smallest safe fix
- validate `npm run typecheck`

### Test Guardian
- inspect failing middleware tests
- compare expected behavior against current middleware logic
- repair test drift safely
- avoid changing middleware behavior unless absolutely necessary

### Safe Refactorer
- fix lint hard errors only
- keep changes local and behavior-preserving

### Release Guardian
- run final validation set
- report READY / NOT READY

## Execution order

### Batch 1 — Typecheck reliability
Goal:
- make `npm run typecheck` trustworthy again

Likely focus:
- `tsconfig.json`
- generated type include strategy
- stale `.next/types` assumptions

Validation:
- `npm run typecheck`

Stop if:
- fix requires broad Next.js config changes with uncertain behavior
- fix touches protected domains

---

### Batch 2 — Middleware test stabilization
Goal:
- make tests match the intended current behavior safely

Likely focus:
- `src/__tests__/middleware.test.ts`
- `middleware.ts` only for understanding unless a very small safe correction is clearly required

Validation:
- `npm test`

Stop if:
- intended redirect behavior is ambiguous
- fix requires auth policy change rather than test update

---

### Batch 3 — Lint hard errors
Goal:
- clear current lint hard errors without chasing the full warning backlog

Known targets:
- `src/app/api/vacancies/[id]/apply/route.ts`
- `src/app/dashboard/employees/[id]/work-years/page.tsx`
- `src/app/super-admin/layout.tsx`
- `src/scripts/migrate-to-tenant.ts`

Validation:
- `npm run lint`

Stop if:
- fixes expose hidden behavior changes
- scope expands into warning cleanup across many files

---

### Batch 4 — Full gate validation
Run:
- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run lint`

Result states:
- READY = all targeted baseline gates recovered for this run
- PARTIAL = some gates improved, with exact blockers documented
- BLOCKED = protected-domain or ambiguous behavior issue discovered

## Change policy for this run

### Allowed
- local config fixes
- local test fixes
- local lint fixes
- documentation updates

### Must pause
- changing auth meaning
- changing tenant scoping behavior
- billing/rules/migration changes
- deleting data or large renames

## Documentation updates required after each batch
- append progress to `DAILY_AUTOMATION_LOG.md`
- add any protected-domain blockers to `PENDING_APPROVALS.md`
- summarize status in this run plan if scope changes

## Definition of success
Agent Run 01 succeeds when:
- build still passes
- typecheck passes reliably
- tests pass reliably
- lint hard errors are removed
- no protected-domain changes were made without approval

## Expected outputs
- small validated code changes
- updated automation log
- final run summary
- explicit next-step recommendation for Run 02

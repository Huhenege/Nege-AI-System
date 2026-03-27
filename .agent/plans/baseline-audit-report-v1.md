# Baseline Audit Report v1

Project: Nege Management Systems  
Date: 2026-03-23  
Audit mode: non-destructive baseline quality audit

## Executive summary
The project already resembles a real multi-surface SaaS system rather than a simple MVP. It includes dashboard, mobile, super-admin, billing, recruitment, organization, attendance, notifications, and AI-related surfaces.

Current state is promising but uneven:
- production build passes
- typecheck is not currently reliable
- tests exist but already drift from current middleware behavior
- lint reveals a small set of hard errors and a large warning backlog
- tenant/auth/security boundaries exist, but need deeper review before risky changes

## Repo shape snapshot
Observed major areas:
- `src/app/dashboard/*`
- `src/app/mobile/*`
- `src/app/super-admin/*`
- `src/app/api/*`
- `src/lib/*`
- `src/firebase/*`
- `src/hooks/*`
- `ai-service/*`
- `flutter-app/*`

Approximate file concentration snapshot:
- dashboard area is the largest hotspot
- mobile and api areas are the next major surfaces
- system is functionally broad and likely to accumulate coupling if left unmanaged

## Quality gate baseline

### Build
Command:
- `npm run build`

Status:
- PASS

Notes:
- Next.js production build completed successfully.
- Sentry emitted deprecation warnings.
- Tailwind emitted an ambiguous utility warning.
- Build currently skips linting by config.

### Typecheck
Command:
- `npm run typecheck`

Status:
- FAIL

Observed root issue:
- `tsc --noEmit` references generated `.next/types/**/*.ts` files that are missing.
- This suggests stale/generated artifact dependency drift in TypeScript configuration or build-state assumptions.

Impact:
- Type system cannot currently be treated as a trustworthy gate.
- CI and local developer confidence are reduced.

Priority:
- Critical

### Tests
Command:
- `npm test`

Status:
- FAIL

Observed failures:
- `src/__tests__/middleware.test.ts`
- 2 failing expectations

Failure pattern:
- middleware behavior and test expectations are out of sync
- authenticated dashboard access expectation differs from current middleware result
- login redirect expectation differs from current middleware result

Impact:
- security-sensitive behavior is not under trustworthy regression protection

Priority:
- Critical

### Lint
Command:
- `npm run lint`

Status:
- FAIL

Hard errors observed:
- `src/app/api/vacancies/[id]/apply/route.ts` → `prefer-const`
- `src/app/dashboard/employees/[id]/work-years/page.tsx` → `@typescript-eslint/no-unused-expressions`
- `src/app/super-admin/layout.tsx` → `@typescript-eslint/no-unused-expressions`
- `src/scripts/migrate-to-tenant.ts` → `prefer-const`

Warning profile:
- many `react-hooks/exhaustive-deps` warnings
- repeated `<img>` optimization warnings
- some missing `alt` warnings
- some stale/unused eslint directive issues

Impact:
- hard errors are low-effort cleanup candidates
- warning backlog suggests hidden UI/reactivity bugs and maintainability risk

Priority:
- Hard errors: High
- Warning backlog: Medium to High

---

## Hotspot map

### 1) Dashboard surface
Signals:
- highest file concentration in repo snapshot
- many hook dependency warnings
- likely primary maintainability hotspot

Risk:
- stale closures
- repeated patterns
- large page/component sprawl

Recommended treatment:
- do not rewrite
- start with warning clustering and low-risk extraction work

### 2) Middleware / session / auth routing
Signals:
- failing middleware tests
- route protection logic in central middleware
- decoded token payload used for redirect decisions

Risk:
- behavior drift
- security misunderstandings
- accidental role/tenant regressions

Recommended treatment:
- clarify intended behavior contract first
- fix tests only after confirming desired behavior
- deeper security review before structural changes

### 3) Tenant / company scoping
Signals:
- presence of tenant hooks, migration scripts, companyId logic, super_admin area

Risk:
- cross-tenant access bugs
- inconsistent route or data enforcement
- client-side assumptions where server-side guarantees are required

Recommended treatment:
- dedicated tenant/security audit before risky code changes

### 4) Migration and scripts surface
Signals:
- migration scripts exist
- lint issue found in migration file

Risk:
- low day-to-day runtime risk, but potentially high operational risk when executed

Recommended treatment:
- lint-safe cleanup okay
- functional changes only with explicit approval

---

## Safe-fix candidates for Batch 1
These are good first targets because they are bounded and low-risk.

1. Restore reliable typecheck
- investigate `.next/types` include strategy
- remove generated artifact fragility from `tsc --noEmit`

2. Repair middleware test drift
- determine intended current behavior
- align tests and/or logic only after contract review

3. Eliminate current lint hard errors
- prefer-const fixes
- no-unused-expressions fixes

4. Preserve build success throughout
- no risky auth/tenant rewrites in Batch 1

---

## Risk register (initial)

### Critical risks
1. Unreliable type gate
2. Failing middleware regression tests
3. Unverified auth/tenant assumptions beyond middleware

### High risks
4. Large dashboard maintainability hotspot
5. React hook dependency backlog causing hidden runtime bugs
6. Security-sensitive logic drifting faster than tests

### Medium risks
7. Sentry config deprecations becoming future maintenance pain
8. Image optimization/a11y backlog affecting UX quality
9. Build/lint split allowing health drift

---

## Suggested execution order

### Batch 1 — Safe stabilization
- typecheck fix
- middleware test stabilization
- lint hard errors only
- rerun build/type/test/lint

### Batch 2 — Security baseline
- middleware behavior contract review
- tenant/auth route audit
- critical API route review
- risk register expansion

### Batch 3 — Maintainability cleanup
- cluster and reduce hook dependency warnings in hotspot modules
- begin bounded refactors in dashboard/mobile/admin areas

---

## Definition of done for baseline recovery
The system reaches baseline recovery when:
- `npm run build` passes
- `npm run typecheck` passes reliably
- `npm test` passes reliably
- `npm run lint` has no hard errors
- middleware/auth/tenant critical paths are documented for deeper review

---

## Recommended next step
Start Agent Run 01 with this exact scope:
1. fix TypeScript gate reliability
2. resolve middleware test drift safely
3. clear current lint hard errors
4. rerun all four quality gates

No auth redesign, tenant rewrites, billing logic changes, or schema migration work should happen in this first batch.

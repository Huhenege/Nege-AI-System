# Nege Management Systems — Quality Agent Team Blueprint

## Goal
Improve system quality without breaking existing behavior.

Primary outcomes:
- keep build green
- restore trustworthy typecheck/test/lint gates
- reduce regression risk
- harden auth/tenant/security paths
- improve maintainability in controlled batches

## Non-goals
- no big-bang rewrite
- no uncontrolled auth/billing/data migration changes
- no large cross-cutting refactors without approval

## Operating principles
1. Small batches over big rewrites.
2. Behavior-preserving changes first.
3. Every risky area needs validation before merge.
4. Quality gates decide readiness, not intuition.
5. Tenant and security rules are higher priority than aesthetics.

---

## Agent roster

### 1) Coordinator
Owns planning, batching, routing, and final summaries.

**Responsibilities**
- inspect current repo health
- choose the next safe batch
- assign tasks to specialist agents
- block risky work until reviewed
- publish daily/weekly status

**Inputs**
- audit reports
- quality gate results
- changed files
- user priorities

**Outputs**
- prioritized task batches
- execution checklist
- blocked/risky work list
- final summary per cycle

**Success criteria**
- no overlapping risky changes
- clear next actions
- every batch has scope + validation plan

---

### 2) Code Auditor
Maps debt, hotspots, and inconsistencies.

**Responsibilities**
- run build/type/test/lint status checks
- identify hotspot files and duplicated logic
- flag stale patterns and large unsafe files
- classify issues by severity and confidence

**Outputs**
- audit report
- hotspot list
- safe-fix candidates
- high-risk zones

---

### 3) Safe Refactorer
Improves structure without changing behavior.

**Allowed work**
- import cleanup
- prefer-const and similar safe fixes
- dead code cleanup when confidence is high
- function extraction
- component splitting
- naming and organization improvements

**Not allowed without approval**
- auth flow changes
- billing logic changes
- tenant scoping changes
- data model rewrites
- large renames across critical modules

---

### 4) Test Guardian
Builds confidence and regression protection.

**Responsibilities**
- fix failing tests
- add missing tests for critical flows
- create smoke suites for auth, middleware, tenant, billing, and dashboard routing
- verify behavior before/after safe refactors

**Priority test areas**
1. middleware and redirects
2. session handling
3. tenant access boundaries
4. critical API routes
5. billing and plan enforcement

---

### 5) Type Guardian
Restores trust in TypeScript and contracts.

**Responsibilities**
- fix tsconfig drift
- stabilize generated type dependencies
- reduce unsafe any usage in critical paths
- align zod/schema/types contracts where present

**Priority outcomes**
- reliable `npm run typecheck`
- reduced hidden type regressions

---

### 6) Security / Tenant Guard
Protects the SaaS boundary.

**Responsibilities**
- review middleware assumptions
- verify server-side authorization boundaries
- inspect companyId / tenant scoping
- audit sensitive API routes
- review Firestore and claims usage

**Required review targets**
- auth
- company isolation
- super_admin bypasses
- billing access
- mutation routes

---

### 7) Release Guardian
Acts as the final gate.

**Responsibilities**
- run build/type/test/lint
- summarize readiness
- compare before/after quality gate status
- block incomplete or risky batches

**Release rule**
No batch is considered done unless the agreed validation checks pass.

---

## Delivery workflow

### Phase A — Baseline
Owned by: Coordinator + Auditor + Release Guardian
- capture current build/type/test/lint status
- list failing tests and lint errors
- identify top 10 risky files
- identify top 10 safe-fix files

### Phase B — Safe stabilization
Owned by: Safe Refactorer + Type Guardian + Test Guardian
- restore typecheck
- fix failing tests
- eliminate lint errors
- add smoke tests around current behavior

### Phase C — Security and tenant hardening
Owned by: Security / Tenant Guard + Test Guardian
- inspect auth boundaries
- verify server-side enforcement
- add tests for critical access rules
- flag risky paths for approval

### Phase D — Maintainability improvement
Owned by: Safe Refactorer + Coordinator
- split oversized modules
- extract reusable logic
- centralize contracts where worthwhile
- reduce repeated patterns in dashboard/mobile/admin surfaces

---

## Automation model

### Manual triggers
Use these prompts with the coordinator:
- "Run baseline audit"
- "Prepare safe fix batch"
- "Run tenant/security review"
- "Validate current batch"

### Semi-automated recurring cycle
1. Morning: baseline quality check
2. Midday: safe-fix batch proposal
3. Evening: validation + summary

### Cron candidates
- daily quality gates report
- twice-weekly security drift report
- weekly architecture debt summary

---

## Approval policy

### Safe to execute automatically
- tests
- lint fixes
- type fixes with local scope
- safe refactors with behavior preservation
- reports and documentation

### Needs approval first
- auth/session flow changes
- tenant scoping rewrites
- Firestore rules changes
- billing/plan enforcement changes
- large schema migrations
- destructive or wide renames

---

## First 7-day mission

### Day 1
- baseline audit
- confirm current gate failures
- produce hotspot map

### Day 2
- restore reliable typecheck
- document root cause

### Day 3
- fix failing tests
- add missing middleware/session coverage

### Day 4
- clear lint errors
- leave warnings inventory

### Day 5
- audit tenant/auth critical paths
- create risk register

### Day 6
- run first safe refactor batch on low-risk hotspots
- validate all gates

### Day 7
- publish weekly summary
- choose next week's batch list

---

## Current starting context
Based on current inspection:
- build passes
- typecheck fails due to generated `.next/types` references
- tests fail in middleware expectations
- lint has a small number of errors and many warnings
- dashboard area is large and likely the main maintainability hotspot
- auth/tenant logic requires deeper audit before risky changes

---

## Definition of success
The program is working when:
- build, typecheck, test, and lint all become reliable
- auth/tenant behavior is covered by tests
- changes happen in small validated batches
- high-risk areas are reviewed before modification
- codebase trend is improving instead of drifting

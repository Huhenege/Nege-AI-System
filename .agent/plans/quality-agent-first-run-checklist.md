# Quality Agent Team — First Run Checklist

## Objective
Start the quality-improvement program safely.

## Step 1 — Baseline
- [ ] Run build
- [ ] Run typecheck
- [ ] Run tests
- [ ] Run lint
- [ ] Save results snapshot

## Step 2 — Triage
- [ ] List current hard failures
- [ ] Separate safe fixes from risky fixes
- [ ] Identify auth/tenant-sensitive files
- [ ] Identify top 10 maintainability hotspots

## Step 3 — Safe Batch 1
Target only:
- [ ] typecheck root cause
- [ ] failing middleware tests
- [ ] lint errors only (not all warnings)

Validation:
- [ ] build green
- [ ] typecheck green
- [ ] tests green
- [ ] lint green or reduced to warnings-only per agreed scope

## Step 4 — Security Baseline
- [ ] Review middleware assumptions
- [ ] Review server-side session verification points
- [ ] Review tenant/company scoping on critical routes
- [ ] Create risk register

## Step 5 — Weekly Rhythm
Daily:
- [ ] baseline check
- [ ] one safe batch
- [ ] one validation pass

Weekly:
- [ ] debt summary
- [ ] risky areas summary
- [ ] next-week priority list

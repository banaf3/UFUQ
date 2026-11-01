# ADR-007: Layered testing and independent validation

- **Status:** Independently reviewed; awaiting owner approval
- **Classification:** CONFIRMED/CLARIFIED; numerical tolerances remain MANUAL DOMAIN DECISION AST-006
- **Date:** 2026-07-20

## Context

UFUQ makes scientific, software, performance, usability, adaptive-model, and learning claims. Tests that reuse production formulas can reproduce the same bug; screenshots cannot prove coordinates; BKT arithmetic cannot prove learning; browser mocks cannot prove InnoDB atomicity.

## Decision

Adopt the layers and configured gates in `../governance/TEST_STRATEGY.md`: pure-domain
units/properties; catalogue schemas; independently authored/reviewed pinned
Astropy/USNO/domain fixtures and error budgets; BKT oracles/sensitivity; real-SYS-001
MySQL API/transaction/concurrency tests; deterministic raycast and approved browser
E2E; focused scientific/scaffold visual regression; accessibility; performance;
security/privacy; backup/restore; evidence manifests; and a separately approved human
evaluation. Missing tolerances or baseline configuration fail rather than using invented
constants.

Keep reference fixture generation structurally independent from runtime TypeScript astronomy. Every fixture and result records software/data/policy/tolerance version. Missing tolerance fails validation. Coverage is diagnostic; pure decision/formula modules target complete branches but reference agreement is the correctness oracle.

For the Phase 1 technical spike, a comparison may report measured differences and
limitations before an acceptance tolerance is approved, as specified in
`../TEST_PLAN.md`. Such a run is exploratory evidence, not a scientific acceptance
pass. This distinction does not relax Phase 2 acceptance or invent a default tolerance.

## Scaffold suite implementation clarification (2026-11-01)

The unit/tooling, reference, and integration Vitest configs have disjoint include
patterns. Synthetic tests in isolated temporary repositories prove discovery and
failure propagation for each config; reference/integration may still honestly have
no applicable domain tests in Phase 0. Tooling regressions also verify source-import
boundaries and the no-data gate. These changes do not select scientific tolerances,
provide an independent astronomy oracle, or establish MySQL transaction evidence.

Colocated unit tests use `.test.ts`/`.test.tsx` and are excluded from workspace production
compilation, with separate root test compilation. Contract test imports are permitted
without permitting imports in contract implementation files. Tooling probes check these
distinctions and public-export exclusions; none changes domain acceptance criteria.

## Consequences

- Results are defensible and traceable to distinct claims.
- CI/local environments need real MySQL and pinned browsers; astronomy fixture generation may use a separate approved Python/Astropy environment outside production.
- Visual/performance baselines require frozen environment metadata and reviewed updates.
- Human evaluation cannot start before ethics/privacy/protocol approval.

## Alternatives rejected

- Runtime-vs-copy-of-runtime formula comparison.
- SQLite for transaction/locking evidence.
- Single-browser manual testing.
- Automated accessibility scan as a full conformance claim.
- Mastery threshold or SUS as evidence of mathematical/learning correctness.

## Validation

An independent reviewer can reproduce the data hash, reference error table, BKT sequences, concurrency results, critical browser journey, performance run, accessibility/security checklists, and approved study analysis from recorded manifests.

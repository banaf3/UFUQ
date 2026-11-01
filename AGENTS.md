# UFUQ agent instructions

## Default implementation reading path

For ordinary scaffolding and implementation work, read only this baseline first:

1. `AGENTS.md`
2. `docs/IMPLEMENTATION_BRIEF.md`
3. `docs/ARCHITECTURE.md`
4. `docs/IMPLEMENTATION_DECISIONS.md`
5. `docs/PHASES.md`
6. `docs/TEST_PLAN.md`
7. `docs/STATUS.md`

Then read only the domain specification and ADR relevant to the current phase. Do not
load `docs/governance/` by default.

Read the relevant governance files only when the task concerns:

- formal scientific approval or a thesis-grade science claim;
- Arabic/Islamic cultural-content validation;
- participant research, instruments, ethics, consent, or analysis;
- privacy/security release assessment or production learner accounts;
- deployment, operations, backup/restore, or public release;
- report deviations, thesis traceability, or final evidence reconciliation.

The repository scaffold and replaceable technical spikes do not require meeting
frequency, reviewer availability, expected response dates, or a personal weekly
schedule. Use `.agent/PLANS.md` only when the current work meets its planning trigger.

## Restricted material

`local-reference/` is private and Git-ignored. The owner's report
`local-reference/CB23011_FYP_REPORTv2.pdf` is the system's founding document and may be
extended. When the owner requests report-based research, comparison, or extension,
agents may read the relevant pages as task context. This authorization includes the
model processing those pages; it does not make the report public or authorize uploading
it to search engines, third-party converters, repositories, or sharing tools. Ordinary
coding tasks use the approved paraphrased requirements instead.

Keep the source PDF unchanged. Keep new report-derived notes, excerpts, page images,
and source fingerprints under ignored `local-reference/.workbench/`; do not put them in
tracked files, agent memory, issues, fixtures, application logs, or build artifacts.
Tracked documentation may retain neutral section anchors and already approved
paraphrases. Propose newly derived requirements privately for owner review before
promoting them. Public-source research and generic workflow/tooling may be tracked. Do
not put private report text into web queries. See `docs/REPORT_REFERENCE_WORKFLOW.md`.

The private source library is `local-reference/cultural-astronomy/` (start with its
`AGENTS.md` and `SOURCE_CATALOG.md`) plus the standards/catalogue folders indexed by
`local-reference/REFERENCE_INVENTORY.local.md`. Its files are the owner's purchased or
downloaded originals and cannot be restored from Git.

## Destructive-command safety

Every Git-ignored path may hold irreplaceable private data (`local-reference/`,
`data/raw/`, `.workbench/`, Python environments). Never run `git clean -x`/`-X` (with
or without pathspecs), `git reset --hard`, `git checkout -- .`, `git stash drop`, or a
recursive delete of a parent directory. Remove generated output only by listing it
first and deleting explicitly named build folders such as `packages/<name>/dist`.
Before any deletion or overwrite, look at the target and confirm it is generated.

## Dependency rules

- `astronomy-core`, `assessment-core`, and `tutoring-core` are pure TypeScript. The
  logical BKT, observation-semantics, and adaptive-policy boundaries live under
  `tutoring-core/src/`; they remain separate modules without separate npm workspaces.
  Pure packages may not import React, Three.js, React Three Fiber, Express, MySQL
  clients, browser globals, Node I/O, or persistence code.
- `contracts` contains versioned serialized DTOs and may contain framework-free runtime
  validators. `catalogue-schema` similarly owns framework-free catalogue, content, and
  artifact schemas/validators. Neither package owns domain entities, database rows,
  React props, or application services.
- Adapters depend inward on pure domains; pure domains never depend on adapters or applications. `apps/web` and `apps/api` communicate through versioned contracts.
- Runtime applications and packages never import `tools/`. `tools/catalogue` may depend
  on `catalogue-schema`. The Python/Astropy reference tool is not an npm workspace and
  must not depend on production astronomy code.
- The API is authoritative for scenario validity, correctness, BKT transitions, and the next scaffold state. The client submits raw answer evidence, never authoritative correctness or mastery.
- One accepted assessment submission, its attempt record, mastery update, and scaffold transition are one idempotent database transaction.
- Celestial lesson flow is data-driven through versioned `SkyPattern`,
  `GuidanceRelationship`, and `LessonRoute` records. Do not hardcode Banat Na'sh—or any
  other named pattern—as the universal route entry point.

## Never invent

Do not invent catalogue identifiers or coordinates, Arabic names/transliterations,
asterism membership or line segments, Kaaba coordinates, astronomical
reference-frame/time policies, tolerances, BKT parameters or threshold, scaffold
meaning, research protocol, privacy retention, or accessibility equivalence. An
unresolved value blocks only its affected behavior: scaffold the interface or use a
clearly synthetic technical fixture where `IMPLEMENTATION_DECISIONS.md` permits it.
Formal answers remain recorded in `docs/governance/OPEN_QUESTIONS.md`, the owning
specification, and an ADR.

Exact helper patterns and cultural mappings remain provisional. Synthetic route records
may test generic schemas and selection logic, but must be visibly non-production and
must not reuse invented cultural claims.

## Commands

Before the Phase 0 toolchain exists, use `git status --short`, `git diff --check`, and
targeted `rg` checks. Once package scripts exist, use the applicable gates defined in
`docs/TEST_PLAN.md`. Phase 0 runs `npm ci`, `npm run check`, `npm run test`,
`npm run build`, `npm run exports:check`, and `npm run test:e2e`.
`test:reference` becomes mandatory when Phase 1 introduces the first
production/reference comparison, and `test:integration` becomes mandatory when Phase 4
introduces the first API/persistence integration test. Before activation they are
omitted from CI and intentionally fail when invoked without tests. Do not use
`passWithNoTests` for an expected active scientific or integration suite, and do not
weaken a gate to make a change pass.

## Documentation and scope

Keep `IMPLEMENTATION_DECISIONS.md`, `PHASES.md`, `TEST_PLAN.md`, ADRs, and
`docs/STATUS.md` synchronized with implemented behavior. Update governance
traceability/registers only when a task triggers that context. Preserve MVP/optional
separation. Do not substitute an iframe, Stellarium/external planetarium engine, native
app, mobile-only app, or manually copied star coordinates.

## Domain reference skills

For engineering-quality, astronomy-validation, catalogue-provenance, Qibla-geodesy, or
Najdi/Arabian-sky evidence work, identify the affected domain and read the corresponding
`.agents/skills/<name>/SKILL.md`. Consult
`docs/references/UFUQ_SOURCE_REGISTER.md`, and distinguish source-supported facts,
project decisions, provisional choices, and unresolved questions. Load only the
matching skill; combine skills only when the task genuinely crosses their boundaries.
Claude Code discovers the same skills through thin wrappers in `.claude/skills/`; the
`.agents/skills/` files remain canonical.

## Session workflow

Follow `docs/AGENT_WORKFLOW.md` for the session protocol, owner standing instructions,
Git checkpoint rules, and handoff. Read `docs/HANDOFF.md` first; it states the current
phase, the last completed increment, and the next justified step.

## Definition of done

A change is done when the applicable phase outcome and tests pass, implementation
decisions/documentation match behavior, no restricted material or secret is tracked,
and no unresolved value was guessed. Scientific/cultural approval, atomic/retry proof,
participant evidence, privacy/security release, deployment, and thesis traceability are
required only when the change makes the corresponding claim or crosses that gate.

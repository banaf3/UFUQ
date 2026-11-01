# UFUQ — Claude Code project guide

@AGENTS.md

The imported `AGENTS.md` is the shared source of repository rules. Keep common rules
there; this file adds Claude's project orientation, verified commands, and scaffold
pitfalls. Follow its baseline reading order before implementation; read domain specs
and ADRs only for the task being performed.

## Product and implementation state

UFUQ is a browser-based 3D astronomy tutor for celestial guidance: reviewed sky-pattern
routes lead toward Al-Jady/Polaris, then True North and Qibla. Lessons are composed from
versioned `SkyPattern`, `GuidanceRelationship`, and `LessonRoute` data, with API-owned
validity, scoring, mastery, and scaffold decisions.

Read `docs/STATUS.md` at the start of a task for current phase and readiness. At this
file's creation, Phase 0 is delivered: the web app displays scaffold health, the API
exposes only `GET /health`, and domain/tool packages are empty or type placeholders.
There is no astronomy pipeline, interactive sky, scoring, BKT behavior, database,
authentication, or production catalogue. Installed Three.js/R3F dependencies do not
mean a 3D lesson exists.

The next phase permits a replaceable astronomy/data spike, not approved learner
content. The validated slice depends on IMP-008, IMP-009, IMP-011, and IMP-012 in
`docs/IMPLEMENTATION_DECISIONS.md`. Keep provisional/synthetic work visibly separate
from approved behavior. Later study, account, and deployment decisions block only the
work or claims that actually need them.

## Context to open for the task

After the baseline documents listed in `AGENTS.md`, use these focused references:

| Task                                           | Additional context                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Astronomy/data spike or scientific calculation | `docs/ASTRONOMY_SPEC.md`, `docs/DATA_STRATEGY.md`, ADR-003/004/007 under `docs/adr/`               |
| Browser scene or interaction                   | Astronomy spec, `docs/adr/002-frontend-3d-integration.md`                                          |
| Assessment, BKT, or adaptive scaffolding       | `docs/TUTORING_BKT_SPEC.md`, astronomy assessment sections, `docs/adr/005-bkt-runtime-boundary.md` |
| Persistence or submission retries              | Architecture transaction sections, `docs/adr/006-persistence-and-transactions.md`                  |
| New or changed dependencies                    | Root/workspace manifests, `docs/DEPENDENCIES.md`, `scripts/check-boundaries.mjs`                   |

Do not bulk-load `docs/governance/`. Its triggers are defined in `AGENTS.md`.
Use `.agent/PLANS.md` when work changes cross-package architecture, introduces a
migration, selects scientific policy, changes security-sensitive behavior, spans
multiple sessions, or explicitly calls for an ExecPlan. Ordinary documentation edits
do not require an ExecPlan.

## Repository boundaries and traps

- `apps/web`: React/Vite UI and future R3F/Three.js scene adapter.
- `apps/api`: Express HTTP adapter and future application/composition/persistence work.
- `packages/astronomy-core`, `assessment-core`, `bkt-core`, `adaptive-policy`, and
  `tutoring-core`: pure TypeScript domains/facade; no environment I/O or framework code.
- `packages/contracts`, `star-data`, and `catalogue-schema`: currently **type-only**.
  Runtime validators or executable schema statements require a deliberate phase change
  with matching boundary checks and documentation, not an incidental addition.
- `tools/catalogue` is the catalogue entry boundary; `tools/catalogue-pipeline` is the
  transformation boundary; `tools/astronomy-reference` is reserved for reference tooling.
  Their scaffold presence does not prove acquisition or independent validation exists.
- `scripts/check-boundaries.mjs` enforces the current dependency allowlist and acyclic
  graph. The architecture describes later permitted relationships that are not all
  enabled in today's manifests. Add a justified edge with corresponding checks when
  implementing it; do not disable the gate.
- Follow existing strict TypeScript/ESM configuration, `import type`, package public
  exports, and NodeNext `.js` relative imports in Node-targeted TypeScript. Change
  compiler/lint policy deliberately, not to suppress a domain or boundary error.
- Keep astronomy vectors separate from Three.js objects. The approved scene mapping
  is ENU to `(x, y, z) = (east, up, -north)`. Polaris and terrestrial True North are
  distinct targets. Consult the astronomy spec before adding calculations.
- Reference generators must be independent of runtime formulas; do not treat an
  allowed package dependency as permission to reuse runtime calculations as an oracle.
- Generated catalogue output is never hand-edited. The browser and API must eventually
  consume the same validated version/hash; source acquisition and curation remain
  separate. No catalogue source, scientific tolerance, or cultural mapping is approved
  merely because its interface exists.

## Commands

Run from the repository root. Use the Node/npm versions pinned by `.nvmrc` and
`package.json` (currently Node 22.16.0 and npm 10.9.2). Keep dependency versions exact
and the lockfile synchronized. Reassess runtime support at phase start rather than
silently upgrading the project.

Commands below use `npm`/`npx`; in Windows PowerShell use `npm.cmd`/`npx.cmd` if script
execution policy blocks the `.ps1` wrappers.

| Purpose                                  | Command                                        |
| ---------------------------------------- | ---------------------------------------------- |
| Clean dependency installation            | `npm ci`                                       |
| Formatting, lint, types, boundaries      | `npm run check`                                |
| Data gate                                | `npm run data:verify`                          |
| Unit/contract suite                      | `npm run test`                                 |
| One current unit test                    | `npm run test -- apps/api/src/app.test.ts`     |
| Reference harness                        | `npm run test:reference`                       |
| Integration harness                      | `npm run test:integration`                     |
| Build all TS projects and web bundle     | `npm run build`                                |
| Install Chromium when absent             | `npx --no-install playwright install chromium` |
| Browser smoke/journeys, including build  | `npm run test:e2e`                             |
| Run web dev server                       | `npm run dev -w @ufuq/web`                     |
| Run API after build, in another terminal | `npm run start -w @ufuq/api`                   |
| Check just this guide's formatting       | `npx --no-install prettier --check CLAUDE.md`  |

There is no root `dev` script. The API currently binds to `127.0.0.1`, default port 4174. The E2E runner owns the API and Vite preview servers (4174/4173) and their cleanup;
use the repository script to preserve its Windows teardown handling.

## Validation and completion

Use applicable gates in `docs/TEST_PLAN.md` and the CI workflow. For implementation
changes, run `check`, `data:verify`, `test`, and `build`, plus the reference, integration,
and browser suites relevant to changed behavior. Use `npm ci` for clean-install or
dependency reproducibility checks. For this guide alone, targeted formatting, path and
command verification, and `git diff --check` are sufficient.

Interpret results against the implementation, not future suite names:

- `data:verify` permits README placeholders and the known empty curation folders only;
  it rejects data files, including files inside those folders. It does not yet check
  catalogue schemas, provenance, or hashes. Introduce replacement checks with the
  relevant data phase rather than simply removing the empty-data guard.
- Reference and integration scripts currently allow no tests; they prove no scientific
  agreement or MySQL transaction behavior. Unit tests cover health and repository
  tooling regressions; E2E currently covers health only. Each Vitest suite has a
  dedicated config; preserve discovery when adding reference/integration cases.
- `check` currently enforces scaffold tooling and boundaries; it does not establish
  scientific correctness or a complete future browser-bundle exclusion proof.

Inspect `git status --short` before editing and preserve unrelated staged/untracked
user work. Keep searches scoped to relevant tracked/source paths and exclude
`local-reference/` from ordinary coding searches. For requested report research, use
the scoped access rules in `AGENTS.md` and the workflow below; do not save report
content in auto memory, tracked output, or application logs.
Keep secrets and participant/production learner data out of fixtures and prompts.

Keep implementation decisions, phase/test docs, applicable ADRs, and status aligned
when behavior changes. Report files changed, checks actually run, and remaining
blockers; distinguish today's results from historical validation. Do not infer study,
science, accessibility, security, or deployment approval from passing scaffold checks.

## Starting or resuming implementation

The reusable starting task is in `docs/CLAUDE_START_PROMPT.md`. Reassess the actual
implementation and phase evidence each time; it does not prescribe a library,
catalogue, cultural route, or first code change. Check that the pinned Node/npm are
available in the terminal inherited by Claude before running repository commands.
Ordinary development does not require the optional report-research session settings
file. Use skills when relevant to the task; a settings profile does not invoke a skill.

## Cultural source research

When the selected task needs historical or cultural evidence, start with
`local-reference/cultural-astronomy/AGENTS.md` and `SOURCE_CATALOG.md` there. Follow
its `EVIDENCE_PROTOCOL.md` and `RIGHTS_AND_LICENSES.md`, then read only relevant
sources. This private library contains originals and search derivatives, not approved
production records. Preserve its historical distinctions; named examples in technical
specifications describe structural capabilities, not approved cultural identifications.
Do not bulk-import the corpus into instructions, memory, application data, or prompts.

## Research using the local report

For report questions, reference checking, or proposed extensions, use the project
skill `/ufuq-reference <topic>` and `docs/REPORT_REFERENCE_WORKFLOW.md`. Read focused
PDF page ranges rather than importing the report into this file. Private navigation
and review notes belong in `local-reference/.workbench/`. The report establishes project
intent; catalogue metadata, reviewed cultural sources, and independent reference
calculations establish the corresponding domain evidence. Research does not approve
new scientific/cultural values or change readiness gates.

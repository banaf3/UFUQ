# Implementation status

**Latest local assessment:** 2026-11-01. The initial Phase 0 assessment and its
historical validation table below are dated 2026-07-22.

The Phase 0 repository scaffold is complete. It contains health-only web and API
applications, empty or type-only domain boundaries, pinned tooling, boundary checks,
tests, and CI. It contains no astronomy calculation, catalogue/cultural record, BKT
formula, persistence/authentication behavior, dashboard, or deployment configuration.
Scientific, cultural, learning-policy, participant, privacy/security release, and
deployment decisions remain assessed at the gate they actually affect.

## Phase progress at the latest local assessment

| Phase | Observed state | Remaining outcome |
|---|---|---|
| 0 — repository scaffold | Complete; current local checks pass | Maintain the scaffold when concrete defects arise; do not recreate it. |
| 1 — astronomy/data technical spike | In progress (first increment 2026-11-01: typed horizontal-coordinate flow + formulation-level cross-check) | Catalogue-source adapter, schema/manifest/checksum experiments, sidereal-time/space-motion/apparent-place candidates, pinned Astropy/USNO oracle, and an evaluated implementation path. |
| 2 — validated guidance slice | Not implemented; entry decisions unresolved | Approved minimal data/content/scenario, astronomy, interactive scene, raw answer submission, server scoring, and independent/browser evidence. |
| 3 — assessment and BKT | Not implemented | Approved task/model/cue policy, pure assessment/BKT/adaptation behavior, and deterministic traces. |
| 4 — persistence and authentication | Not implemented | MySQL migrations and atomic/retry behavior, identity/session/authorization, and real database evidence. |
| 5 — complete lessons and hardening | Not implemented | Approved lessons/views, accessibility/performance/security work, and reproducible evidence. |
| 6 — participant evaluation and deployment | Not started; separate readiness gates remain NO | Approved study and deployment prerequisites, then only the activities actually authorized. |

The private cultural astronomy library and report-reference workflow are prepared
research infrastructure. They do not complete Phase 1, approve a production catalogue,
or resolve cultural/scientific acceptance decisions. This table is an observation of
the current files; future sessions must reassess it against implementation and tests.

## Independent readiness gates

| Gate | Result | Basis |
|---|---|---|
| Repository scaffolding | YES | The TypeScript npm-workspace monorepo, apps/packages/tools layout, React/R3F/Three.js web stack, Node/Express API, pure-package boundaries, strict compiler configuration, test tooling, lockfile, and CI are implemented and validated. No unresolved value affects the scaffold. |
| Validated celestial-guidance vertical slice | NO | The generic route/content model is settled, but the exact catalogue/subset, production astronomy pipeline/error budget, reviewed pattern/relationship content for one route, scenario, and scoring tolerances are unresolved. A replaceable astronomy/data spike may proceed first. |
| Participant study | NO | Participant protocol, ethics applicability/approval, instruments, recruitment, privacy, consent, data handling, and study-ready software remain unresolved or unimplemented. |
| Deployment | NO | Hosting/operations target, production account policy, security/privacy release profile, performance/accessibility baselines, monitoring, and backup/restore evidence remain unresolved or unimplemented. |

READY_FOR_SCAFFOLDING: YES

READY_FOR_VERTICAL_SLICE: NO

READY_FOR_PARTICIPANT_STUDY: NO

READY_FOR_DEPLOYMENT: NO

## Phase 0 scaffold delivered

- npm workspaces cover `apps/*`, `packages/*`, and `tools/*`; all external versions are
  exact in the manifests and root lockfile.
- `apps/web` is a React/Vite health screen. `apps/api` is an Express service with only
  `GET /health` and a separately startable server.
- Pure boundaries exist for astronomy, assessment, BKT, adaptive policy, tutoring,
  contracts, catalogue schema, and star/route data. Tool boundaries exist for the
  astronomy reference harness and catalogue pipeline.
- `SkyPattern`, `GuidanceRelationship`, and `LessonRoute` are generic type placeholders;
  there are no concrete stars, patterns, cultural mappings, or lesson routes.
- Strict TypeScript, ESLint, Prettier, Vitest, Playwright, package-boundary validation,
  the empty-data guard, and GitHub Actions CI are configured.
- Every production dependency is explained in `DEPENDENCIES.md`. No database,
  authentication, astronomy, catalogue-client, BKT, analytics, or deployment library
  was added.

## Phase 0 validation evidence

| Command/check | Exact result on 2026-07-22 |
|---|---|
| `npm.cmd install` | PASS; 311 packages added, 325 packages audited, 0 vulnerabilities. |
| `npm.cmd run format:check` | PASS; all matched files use Prettier style. |
| `npm.cmd run lint` | PASS; ESLint reported no error. |
| `npm.cmd run typecheck` | PASS; project references and test configuration compile in no-emit mode. |
| `npm.cmd run boundaries` | PASS; 13 workspaces checked, allowed edges enforced, type-only packages checked, and dependency graph acyclic. |
| `npm.cmd run data:verify` | PASS; data directories contain README placeholders only. |
| `npm.cmd run test` | PASS; 1 test file and 1 API health test passed. |
| `npm.cmd run test:reference` | PASS with no tests, as explicitly allowed for the empty Phase 0 reference harness. |
| `npm.cmd run test:integration` | PASS with no tests, as explicitly allowed for the empty Phase 0 integration harness. |
| `npm.cmd run build` | PASS; TypeScript build passed and Vite built 16 modules. |
| `npm.cmd run test:e2e` | PASS; the Chromium web/API health smoke test passed (1/1). |

The first two browser-smoke attempts passed their assertion but exposed a Windows
Playwright web-server teardown hang. The runner was changed to own and terminate both
health servers explicitly; the final command exited successfully. Git ignore/tracking
checks found no tracked restricted PDF or environment file, `.env.example` contains no
secret, the secret-pattern scan returned no match, and targeted scans found no concrete
cultural route or real astronomy/BKT implementation.

## Local reference workflow added 2026-11-01

The owner's requested report-research workflow is documented in
`REPORT_REFERENCE_WORKFLOW.md` and available through the Claude Code project skill
`/ufuq-reference`. A read-only Python/pypdf helper provides identity inspection,
text-free page search, and bounded page-text reads. Private navigation notes remain
under ignored `local-reference/.workbench/`; the PDF is unchanged and untracked.

Targeted checks passed for source identity, invocation outside the repository working
directory, bounded reads/search results, invalid-input rejection, session-settings
JSON, Markdown/JSON formatting, and unchanged source bytes. These checks are not
application, astronomy-reference, MySQL, or browser evidence. No production values or
new report-derived requirements were approved; phase and readiness gates are unchanged.

## Scaffold tooling correction — 2026-11-01

Test scripts now use dedicated unit/tooling, reference, and integration Vitest configs.
The data guard permits the known empty curation folders but still rejects records
inside them. AST-based import validation covers actual workspace imports, public entry
paths, undeclared dependencies, Node imports in pure implementation code, literal
dynamic imports, and the browser dependency closure. Non-literal module loads fail
explicitly. Package names, public exports and project-reference paths are preserved.

Nineteen generated TypeScript files were removed from Git tracking while preserving
their local contents. Build caches, declarations and Python environments/caches are
ignored; source-quality tools exclude the reference tool's Python virtual environment.
Text line endings are defined for Windows/CI consistency.

Validation on Node 22.16.0/npm 10.9.2: clean `npm ci`, `npm run check`, `data:verify`,
`test` (27 tests in two files), the build, and `test:e2e` (1 Chromium health test) passed.
The reference and integration
commands honestly report no applicable tests. Isolated synthetic failures prove their
discovery and nonzero failure behavior; these are tooling checks, not science/MySQL
evidence. The initial local build needed one forced rebuild of old incremental caches
whose emitted files were missing. No dependency version or domain policy was changed.
The first E2E run found the pinned browser absent; installing Playwright's required
Chromium resolved that environment failure, and the final command exited successfully.

The clean install reported 23 dependency advisories (16 moderate, 6 high, 1 critical).
These are package-audit findings, not proof of application exploitability; dependency
remediation remains a separate review. The historical zero-advisory install result
above describes the 2026-07-22 run only.

## Independent structure re-review — 2026-11-01

The architecture-review skill and an independent read-only agent found the current
tree suitable for the Phase 1 spike. Findings and current primary-source comparisons
are recorded in `SCAFFOLD_AUDIT.md`. No package name, export, dependency edge, or
TypeScript reference path changed.

The review corrected missing-root/private-wildcard export checks, the contract-test
lint restriction, and production compiler inclusion of colocated unit tests. On the
pinned toolchain, `check`, the build and E2E (1 Chromium test), and 35 tests passed.
Data verification passed; reference/integration suites remain empty. Public-entry
import probes passed for 12 importable workspaces. The architecture tree now reflects
the existing directories. The changes remain local pending a Git checkpoint; no hosted
CI or new clean-install claim is made. Dependency advisories and readiness gates are
unchanged.

## Phase 1 spike increment 1 — 2026-11-01

Added to `astronomy-core` (replaceable spike code): branded angle types, provisional
wrap helpers, hour angle from a caller-supplied LST, the ASTRONOMY_SPEC east/north/up
transformation, an explicit zenith/nadir azimuth-singular result, robust vector/bearing
separation, and the approved ENU to Three.js axis mapping as plain numbers. No time scale,
sidereal-time, catalogue, space-motion, apparent-place, refraction, Kaaba or tolerance
logic exists; those remain AST-001/003/004/005/006.

Evidence in this session: `astronomy-core` unit tests (hand-derived cases: pole altitude =
latitude, meridian transit, equator rise/set, wrap, singularity, input rejection, scene
fixture h=30/A=45/r=100); `tests/reference/horizontal-crosscheck.test.ts` compares the
runtime route with an independently written spherical-trigonometry route
(`tools/astronomy-reference`, no runtime import) on a 924-case synthetic grid:
worst difference 2.8e-14 deg altitude, 2.3e-13 deg azimuth. **Limits:** this is a
formulation-level diagnostic, not the pinned Astropy/USNO oracle (Python/Astropy are not
installed here), and its 1e-9 deg bound is a named spike diagnostic, not an AST-006
tolerance. Wrap representatives ([0,360), [-180,180)) are provisional. Gates `check`,
`test` (50 tests), `test:reference` (1 test), `data:verify` and `build` pass; E2E,
integration and a clean `npm ci` were not re-run. Readiness gates are unchanged.

## Authorized next work

Phase 0 is complete; do not restart its scaffold. Repair a concrete blocking defect if
one is found. Phase 1 may run a technical astronomy/data spike using synthetic
or clearly labelled candidate fixtures behind replaceable interfaces. It cannot promote
candidate values into learner-facing content or scientific evidence.

## Claude Code handoff review — 2026-11-01

Inspection confirmed health-only web/API behavior, empty calculation/tool boundaries,
and generic type placeholders. The implementation brief, data strategy, and ADR-003/004/007
now distinguish permitted Phase 1 exploration from the unchanged approval gates for
the validated Phase 2 slice. No production source, algorithm, tolerance, or cultural
content was selected. `../CLAUDE.md` points to the private cultural-library instructions
when source research is relevant. `CLAUDE_START_PROMPT.md` asks the next session to
assess evidence and choose its own justified increment within the approved scope.

Current local validation used Node 22.16.0/npm 10.9.2 and the existing installed
dependencies:

| Check | Result in this review |
|---|---|
| Workspace dependency tree | PASS; all 13 workspaces resolved. |
| `npm run check` | PASS; formatting, lint, TypeScript, and boundaries. |
| `npm run data:verify` | PASS; placeholders/known empty folders only, no runtime data. |
| `npm run test` | PASS; 35 tests in two files, covering health and tooling. |
| `npm run test:reference` | No tests; permitted empty scaffold harness, no astronomy evidence. |
| `npm run test:integration` | No tests; permitted empty scaffold harness, no MySQL evidence. |
| `npm run test:e2e` | PASS; includes the TypeScript/Vite build and one Chromium health smoke test. |
| Claude Code CLI | Native 2.1.316; authentication status reported logged in; `claude doctor` reported no installation issues. |

The current terminal did not resolve Node/npm from PATH. The existing pinned runtime
was found at `%LOCALAPPDATA%/Temp/ufuq-toolchain-node-22.16.0/node-v22.16.0-win-x64`
and added to the verification process's PATH only. Launch Claude from a terminal with
the pinned runtime available so its child tools inherit it. This temporary install may
be removed by OS cleanup; if absent, use a persistent installation matching `.nvmrc`
and the npm pin. No system/user PATH, Claude settings, or auto-memory preference was
changed. The optional `reference-session.json` is unnecessary for ordinary development.

This was an existing-worktree check, not a fresh `npm ci`, hosted CI run, dependency
audit, or production assessment. The earlier dependency advisories remain pending
review. Existing staged/unstaged/untracked work was preserved; no Git checkpoint was
created. Application source code and source-reference bytes were unchanged by this handoff.

## Decisions that genuinely block the validated vertical slice

- **IMP-008 / AST-001:** exact catalogue source/version, permitted access/licence,
  required fields, subset, and quality rules.
- **IMP-009 / AST-003 and AST-006:** production coordinate/time pipeline,
  implement-or-omit effects, supported range, failure policy, independent oracle, error
  budget, and tolerances.
- **IMP-011 / AST-002:** approved `SkyPattern` and `GuidanceRelationship` records for
  one complete route to Al-Jady, including stable catalogue IDs, names/labels,
  membership, segments, instructional geometry/explanation, and review/verification
  status. The exact helper pattern and whether the first route uses Banat Na'sh or Dhat
  al-Kursi remain provisional.
- **IMP-012 / AST-007 and AST-006:** one sourced observer/time scenario, expected
  result, answer representation, and justified learner/scientific tolerance.

BKT parameters/cues do not block the Phase 2 minimal slice because adaptation begins in
Phase 3. Persistence, authentication, participant, privacy/security release, and
deployment decisions belong to Phases 4–6 and do not block Phases 0–2.

**IMP-018 is approved:** generic `SkyPattern`, `GuidanceRelationship`, and
`LessonRoute` schemas plus scenario-availability filtering can be scaffolded without
selecting any cultural record. This clarification does not change scaffolding readiness.

## Default implementation documents

1. `../AGENTS.md`
2. `IMPLEMENTATION_BRIEF.md`
3. `ARCHITECTURE.md`
4. `IMPLEMENTATION_DECISIONS.md`
5. `PHASES.md`
6. `TEST_PLAN.md`
7. `STATUS.md`

Technical domain specs and ADRs are loaded by phase. `governance/` is conditional
context and retains the complete independent review, original single-gate verdict,
report deviations, open decisions, research/release governance, risks, and
traceability.

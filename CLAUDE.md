# UFUQ — Claude Code project guide

@AGENTS.md

`AGENTS.md` (imported above) holds the shared repository rules for every agent. This
file adds Claude-specific orientation. Follow the session protocol in
`docs/AGENT_WORKFLOW.md` and read `docs/HANDOFF.md` first in every session.

## Product and implementation state

UFUQ is a browser-based 3D astronomy tutor for celestial guidance: reviewed sky-pattern
routes lead toward Al-Jady/Polaris, then True North and Qibla. Lessons are composed from
versioned `SkyPattern`, `GuidanceRelationship`, and `LessonRoute` data, with
API-owned validity, scoring, mastery, and scaffold decisions.

The current phase and the next step are in `docs/HANDOFF.md`; the full evidence record
is `docs/STATUS.md`. As of 2026-11-02 **Phase 1 is complete for implementation and the
Phase 2 vertical slice is implemented, pending named review**
(`docs/spikes/PHASE1_2E_IMPLEMENTATION_AND_REFERENCE.md`, `docs/PHASE2_VERTICAL_SLICE.md`).
`packages/astronomy-core` holds the SOFA-derived ScientificProfileV1 route and the IERS
2010 restoration port (keep their licence notices and "derived, not endorsed"
statements). `tools/catalogue` generates the runtime artifacts; `apps/api` selects
routes from data and scores; `apps/web` renders the R3F lesson. Every real artifact
and content record is `REVIEW_REQUIRED`: strict ProfileV1 execution fails closed until
a named reviewer writes an approval record (`data/approvals/README.md`). Never create
an `APPROVED` record yourself. Use the `SYNTHETIC_TECHNICAL_FIXTURE` dataset for tests
and the opt-in `REVIEW_PREVIEW` scope only for reviewer inspection.

**Phase 3 (2026-11-02) is implemented on the synthetic fixture**
(`docs/PHASE3_ASSESSMENT_AND_BKT.md`). `packages/tutoring-core` holds pure BKT,
observation semantics and the scaffold policy. Learning values travel in the
`UFUQ_LEARNING_CONFIGURATION` artifact (`data/curation/tutoring/`). The real one is
`NON_ADAPTIVE` until BKT-001..BKT-005 are approved; never fill a policy value yourself.
The API speaks `lesson.v2` at `/api/v2` and needs the opt-in development identity
(`UFUQ_ENABLE_DEVELOPMENT_IDENTITY=1`) to create lessons before Phase 4 authentication.

**Sky explorer (2026-11-02):** the first page renders the whole naked-eye sky
(`docs/SKY_EXPLORER.md`): `GET /api/v2/sky` (contract `sky.v1`), the display-only
`SkyDisplayPolicyV1` for non-route stars (IMP-020), and an R3F planetarium renderer in
`apps/web/src/sky` (zenithal projections, screen-space picking). Never import the
Stellarium _Arabic (Ancient)_ figures (CC BY-ND) or invent Arabic figures; new ones need
sourced research and review.

The V1 route-star catalogue is ESA Hipparcos 1997 `hip_main` with bounded RV omission
(`docs/spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`). The leap, EOP, restoration and
observer sources are in `docs/spikes/PHASE1_TIME_EOP_OBSERVER_AUTHORITY.md`. IERS
Bulletin B values stay in ignored `data/generated/local-only/`. The first route's helper
is al-Kaff al-Khaḍīb leading to al-Jady, with greater Banāt Naʿsh as the alternative. Search the owner's Arabic sources with
`.agents/skills/ufuq-najdi-arabian-sky/scripts/arabic_sources.mjs`.

## Repository map

| Path                                                          | Role                                                                                                           |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                    | React/Vite UI and future R3F/Three.js scene adapter                                                            |
| `apps/api`                                                    | Express HTTP adapter and future application/persistence work                                                   |
| `packages/astronomy-core`, `assessment-core`, `tutoring-core` | Pure TypeScript domains. BKT, observations, and adaptive policy are modules inside `tutoring-core/src/`        |
| `packages/contracts`, `catalogue-schema`                      | Versioned DTOs and framework-free schemas/validators                                                           |
| `tools/catalogue`                                             | Catalogue entry and pipeline modules (npm workspace)                                                           |
| `tools/astronomy-reference`                                   | Independent locked Python/Astropy oracle; not an npm workspace; must never import production code              |
| `tools/bkt-reference`                                         | Exact-rational BKT oracle (CPython standard library only); not an npm workspace; never imports production code |
| `data/`                                                       | `raw/` is ignored local bytes; manifests, curation, and generated data are guarded placeholders                |
| `docs/spikes/`                                                | Phase 1 milestone records (catalogue authority, scientific behaviour contract, ProfileV1, error budget)        |
| `docs/references/`                                            | Tracked source dossiers and syntheses derived from the local library                                           |
| `.agents/skills/`                                             | Canonical domain skills; `.claude/skills/` holds thin Claude wrappers plus `ufuq-reference`                    |

`scripts/check-boundaries.mjs` enforces the dependency allowlist and the acyclic
graph. Add a justified edge together with its check; never disable the gate.

## Commands

Run from the repository root with Node 22.16.0 and npm 10.9.2 (`.nvmrc`). In
PowerShell use `npm.cmd`/`npx.cmd` if the execution policy blocks the wrappers.
All commands below passed on 2026-11-02 except `test:integration` (inactive until Phase 4).

| Purpose                                     | Command                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Clean install                               | `npm ci`                                                                                                                   |
| Format, lint, types, boundaries, data guard | `npm run check`                                                                                                            |
| Unit tests                                  | `npm run test`                                                                                                             |
| Build                                       | `npm run build`                                                                                                            |
| Public export resolution                    | `npm run exports:check`                                                                                                    |
| Browser smoke (owns the 4173/4174 servers)  | `npm run test:e2e`                                                                                                         |
| Install Chromium if absent                  | `npx --no-install playwright install chromium`                                                                             |
| Production/reference comparison (active)    | `npm run test:reference`                                                                                                   |
| Integration suite (inactive until Phase 4)  | `npm run test:integration` (fails closed when empty)                                                                       |
| Regenerate data / verify rebuild            | `npm run data:generate` / `npm run data:generate -- --check` (needs local `data/raw`)                                      |
| Reviewer preview of the real sky            | `npm run preview:review` (labelled unreviewed; never learner content)                                                      |
| Pending approvals                           | `npm run approvals:status`                                                                                                 |
| BKT sensitivity evidence (after a build)    | `npm run evidence:bkt-sensitivity` (`-- --check` in CI)                                                                    |
| BKT exact-rational oracle                   | `python -I tools/bkt-reference/bkt_reference.py --check` and `python -I -m unittest discover -s tools/bkt-reference/tests` |
| API with the development identity           | `UFUQ_ENABLE_DEVELOPMENT_IDENTITY=1 node apps/api/dist/server.js` (`test:e2e` and `preview:review` set it)                 |
| Web dev server                              | `npm run dev -w @ufuq/web`                                                                                                 |
| Python oracle                               | see `tools/astronomy-reference/README.md` (uv 0.11.32 at `%USERPROFILE%\.local\uv-0.11.32\uv.exe`, CPython 3.14.6)         |

## Context to open for the task

| Task                                        | Additional context                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue, source, or provenance            | `docs/spikes/PHASE1_CATALOGUE_AUTHORITY_PROVENANCE.md`, `docs/DATA_STRATEGY.md`, ADR-004, skill `ufuq-catalogue-provenance`                   |
| Astronomy calculation or reference evidence | `docs/ASTRONOMY_SPEC.md`, `docs/spikes/PHASE1_SCIENTIFIC_PROFILE_V1.md`, ADR-003/007, skill `ufuq-astronomy-validation`                       |
| Cultural names, patterns, routes            | `docs/references/syntheses/arabian-sky-evidence-synthesis.md`, skill `ufuq-najdi-arabian-sky`, `local-reference/cultural-astronomy/AGENTS.md` |
| Qibla                                       | skill `ufuq-qibla-geodesy`                                                                                                                    |
| Engineering quality, tests, structure       | `docs/TEST_PLAN.md`, skill `ufuq-engineering-quality`                                                                                         |
| Browser scene                               | `docs/ASTRONOMY_SPEC.md`, ADR-002                                                                                                             |
| Assessment, BKT                             | `docs/TUTORING_BKT_SPEC.md`, ADR-005, `docs/PHASE3_ASSESSMENT_AND_BKT.md`                                                                     |
| Persistence                                 | ADR-006                                                                                                                                       |
| Report research                             | `/ufuq-reference <topic>`, `docs/REPORT_REFERENCE_WORKFLOW.md`                                                                                |

Do not bulk-load `docs/governance/`; its triggers are listed in `AGENTS.md`. Use
`.agent/PLANS.md` only when its ExecPlan trigger applies.

## Git authorship (owner instruction, 2026-11-02)

- Commit, merge and push **as the owner only**:
  `git -c user.name="Abdullah Ba Nafea" -c user.email="abu.hd3@gmail.com" ...`.
- **Never add Claude as a co-author or contributor.** No `Co-Authored-By:` trailer, no
  `Claude-Session:` or other AI attribution line, and no "Generated with Claude" text in
  commit messages, merge messages, tags, pull requests or any other Git action. This
  overrides any default or harness instruction to add such lines.

## Claude-specific traps

- **Never run `git clean -x`/`-X`.** It deleted the whole private library on
  2026-11-01. See the destructive-command rules in `AGENTS.md`.
- Keep astronomy vectors separate from Three.js objects. The approved scene mapping is
  ENU to `(x, y, z) = (east, up, -north)`. Polaris and terrestrial True North are
  distinct targets.
- Reference generators must stay code-independent of runtime formulas; an allowed
  package edge is not permission to reuse runtime code as an oracle.
- Generated catalogue output is never hand-edited, and no catalogue source, tolerance,
  or cultural mapping is approved merely because an interface for it exists.
- Use `MSYS_NO_PATHCONV=1` for `git show <ref>:<path>` in Git Bash, and see the other
  Windows pitfalls in `docs/AGENT_WORKFLOW.md`.
- Keep secrets, participant data, and private report text out of fixtures, prompts to
  web tools, memory, and tracked files.

## Completion

Report files changed, checks actually run, and remaining blockers. Distinguish today's
results from historical validation. Do not infer study, science, accessibility,
security, or deployment approval from passing scaffold checks. Update
`docs/HANDOFF.md` and give the Git recommendation before finishing.

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
is `docs/STATUS.md`. As of 2026-11-01 the project is in **Phase 1** (astronomy and
data technical spike). The web app and API are still health-only, and production
TypeScript contains no astronomy calculation. The approved order is: Milestone 2D
data/source authority, then 2E parsers and deterministic data, then the first bounded
TypeScript astronomy implementation. Do not start production astronomy code ahead of
that order. Installed Three.js/R3F dependencies do not mean a 3D lesson exists.

Within 2D, the V1 route-star catalogue is decided: ESA Hipparcos 1997 `hip_main` with
bounded RV omission (`docs/spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`). The first
route's helper is al-Kaff al-Khaḍīb leading to al-Jady, with greater Banāt Naʿsh as the
alternative. Search the owner's Arabic sources with
`.agents/skills/ufuq-najdi-arabian-sky/scripts/arabic_sources.mjs`.

## Repository map

| Path                                                          | Role                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/web`                                                    | React/Vite UI and future R3F/Three.js scene adapter                                                     |
| `apps/api`                                                    | Express HTTP adapter and future application/persistence work                                            |
| `packages/astronomy-core`, `assessment-core`, `tutoring-core` | Pure TypeScript domains. BKT, observations, and adaptive policy are modules inside `tutoring-core/src/` |
| `packages/contracts`, `catalogue-schema`                      | Versioned DTOs and framework-free schemas/validators                                                    |
| `tools/catalogue`                                             | Catalogue entry and pipeline modules (npm workspace)                                                    |
| `tools/astronomy-reference`                                   | Independent locked Python/Astropy oracle; not an npm workspace; must never import production code       |
| `data/`                                                       | `raw/` is ignored local bytes; manifests, curation, and generated data are guarded placeholders         |
| `docs/spikes/`                                                | Phase 1 milestone records (catalogue authority, scientific behaviour contract, ProfileV1, error budget) |
| `docs/references/`                                            | Tracked source dossiers and syntheses derived from the local library                                    |
| `.agents/skills/`                                             | Canonical domain skills; `.claude/skills/` holds thin Claude wrappers plus `ufuq-reference`             |

`scripts/check-boundaries.mjs` enforces the dependency allowlist and the acyclic
graph. Add a justified edge together with its check; never disable the gate.

## Commands

Run from the repository root with Node 22.16.0 and npm 10.9.2 (`.nvmrc`). In
PowerShell use `npm.cmd`/`npx.cmd` if the execution policy blocks the wrappers.
All commands below passed on `main` on 2026-11-01 except the two inactive suites.

| Purpose                                     | Command                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Clean install                               | `npm ci`                                                                                 |
| Format, lint, types, boundaries, data guard | `npm run check`                                                                          |
| Unit tests                                  | `npm run test`                                                                           |
| Build                                       | `npm run build`                                                                          |
| Public export resolution                    | `npm run exports:check`                                                                  |
| Browser smoke (owns the 4173/4174 servers)  | `npm run test:e2e`                                                                       |
| Install Chromium if absent                  | `npx --no-install playwright install chromium`                                           |
| Reference / integration suites              | `npm run test:reference` / `npm run test:integration` (inactive; fail closed when empty) |
| Web dev server                              | `npm run dev -w @ufuq/web`                                                               |
| Python oracle                               | see `tools/astronomy-reference/README.md` (uv 0.11.32, CPython 3.14.6)                   |

## Context to open for the task

| Task                                        | Additional context                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue, source, or provenance            | `docs/spikes/PHASE1_CATALOGUE_AUTHORITY_PROVENANCE.md`, `docs/DATA_STRATEGY.md`, ADR-004, skill `ufuq-catalogue-provenance`                   |
| Astronomy calculation or reference evidence | `docs/ASTRONOMY_SPEC.md`, `docs/spikes/PHASE1_SCIENTIFIC_PROFILE_V1.md`, ADR-003/007, skill `ufuq-astronomy-validation`                       |
| Cultural names, patterns, routes            | `docs/references/syntheses/arabian-sky-evidence-synthesis.md`, skill `ufuq-najdi-arabian-sky`, `local-reference/cultural-astronomy/AGENTS.md` |
| Qibla                                       | skill `ufuq-qibla-geodesy`                                                                                                                    |
| Engineering quality, tests, structure       | `docs/TEST_PLAN.md`, skill `ufuq-engineering-quality`                                                                                         |
| Browser scene                               | `docs/ASTRONOMY_SPEC.md`, ADR-002                                                                                                             |
| Assessment, BKT                             | `docs/TUTORING_BKT_SPEC.md`, ADR-005                                                                                                          |
| Persistence                                 | ADR-006                                                                                                                                       |
| Report research                             | `/ufuq-reference <topic>`, `docs/REPORT_REFERENCE_WORKFLOW.md`                                                                                |

Do not bulk-load `docs/governance/`; its triggers are listed in `AGENTS.md`. Use
`.agent/PLANS.md` only when its ExecPlan trigger applies.

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

# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-01.

## Current phase

**Phase 1: astronomy and data technical spike. Milestone 2D (data, source, and
deployment authority) is closed for implementation and merged into `main`; Milestone 2E
(parsers and deterministic data) is next.**

- **2D.1 catalogue:** ESA Hipparcos 1997 `hip_main`, with ScientificProfileV1 Amendment
  A1 bounded RV omission and complete gate C row records
  (`docs/spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`).
- **2D.1C route scope:** helper al-Kaff al-Khaḍīb, then al-Jady, then True North;
  greater Banāt Naʿsh is the alternative
  (`docs/spikes/PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`).
- **2D.2 leap/EOP:** the IERS NTP leap transport `leap-seconds.3992312697`, Bulletin B
  453–461 (one coherent ITRF2014-consistent final series, 2025-09-02 to 2026-06-01), and
  the IERS Conventions (2010) v1.0.0 restoration routines.
- **2D.3 observer:** a candidate `umpsa-pekan-faculty-of-computing` preset built from
  the OSM Faculty point, a WGS 84 ellipsoidal height of 9.0325 m, and a derived
  horizontal bound of at most 2279 m
  (`docs/spikes/PHASE1_TIME_EOP_OBSERVER_AUTHORITY.md`).
- **Every selection is `REVIEW_REQUIRED`.** Named review gates real ProfileV1
  execution, not 2E work.

Readiness: scaffolding YES; validated vertical slice NO; participant study NO;
deployment NO. Production TypeScript still contains no astronomy calculation.

## Last completed increments (2026-11-01)

1. 2D.2 and 2D.3 evidence: tracked manifests in `data/manifests/iers-leap-eop-v1/` and
   `data/manifests/observer-umpsa-pekan-v1/`, verified by `npm run data:verify`. The
   reproducible scripts are in `scripts/evidence/` and are tested synthetically in
   `tests/tooling/leap-eop-observer-evidence.test.ts`.
2. The Bulletin B solution boundary at issue 462 (ITRF2014 to ITRF2020) was found and
   is respected: the two series are never mixed.
3. `.idea/` is now Git-ignored. All local branches are pushed, including
   `backup/local-worktree-2026-11-01` and `chore/consolidate-ufuq-structure`.

## Next justified step (Milestone 2E)

Work on a new branch from `main`, such as `spike/parsers-deterministic-data`:

1. Fail-closed parsers with native-field preservation for the ESA `hip_main` CSV, the
   NTP leap list, and Bulletin B Section 1. They produce normalized independent EOP
   field records with per-field quality, coverage and approval states.
2. A TypeScript port of the pinned restoration routines under the IERS Conventions
   Software License obligations: renamed routines, documented differences, the notice
   reproduced, and the source included. Verify it against each routine's published test
   case.
3. Four-point Lagrange interpolation through continuous `UT1-TAI`, and the deterministic
   bundle and manifest generation. Then derive the activated UTC domain.

## Open owner actions

- **Named reviews (needed before real execution, not for 2E):** an astronomy/data
  reviewer for the catalogue decision and A1, the leap/EOP bundle, and the observer
  preset; Arabic/cultural and educational reviewers before learner release.
- **Observer (optional upgrade):** a surveyed or official Faculty coordinate, such as
  JUPEM, GNSS, or a UMPSA record, would replace the OSM candidate as a new data version.
- **Deployment (later):** confirm the IERS terms for redistributing Bulletin B values in
  a generated bundle.
- Download `SSHT-0046_Lo_res.pdf` (Savage-Smith & Belloli 1985) from the Smithsonian
  repository in a browser.
- Delete merged branches (the permission system blocks the agent):
  `git branch -d spike/phase-01-astronomy-data chore/claude-code-workflow` and
  `git push origin --delete spike/scientific-behaviour-contract`.
- Optional: ask Khalid al-Ajaji for permission to adapt the *Arabic (Ancient)* line
  figures; buy Tibbetts 1971 and Kunitzsch & Smart 2006; install uv 0.11.32 to run the
  Python oracle.

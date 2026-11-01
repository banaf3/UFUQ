# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-01.

## Current phase

**Phase 1: astronomy and data technical spike, Milestone 2D (data, source, and deployment
authority).** The work is on branch `spike/source-data-deployment-authority`, which is
pushed and merges into `main` when 2D closes.

- **2D.1 catalogue authority:** decided for the V1 route stars. ESA Hipparcos 1997
  `hip_main` is the single astrometric source, with ScientificProfileV1 Amendment A1
  bounded RV omission (`docs/spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`).
- **2D.1C route scope:** helper al-Kaff al-Khaḍīb, then al-Jady, then True North;
  alternative route greater Banāt Naʿsh (`docs/spikes/PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`).
- **2D.1E gate C:** row records are complete for implementation; both component
  solutions refer to component A.
- **Still open in 2D:** the UMPSA Pekan observer record, the final IERS leap/EOP
  artifacts, and named scientific review.

Readiness: scaffolding YES; validated vertical slice NO; participant study NO;
deployment NO. Production TypeScript still contains no astronomy calculation.

## Last completed increments (2026-11-01)

1. The agent workflow layer was merged into `main` (`CLAUDE.md`,
   `docs/AGENT_WORKFLOW.md`, skills, guard test).
2. 2D.1C route scope, and 2D.1D catalogue decision with hash-bound ESA TAP evidence in
   `data/manifests/hipparcos-esa-1997-hip-screen-v1/`, enforced by `npm run data:verify`.
3. The Stellarium *Arabic (Ancient)* compilation is now the primary navigation
   compilation for the old-Arabian layer. Its memberships match all 13 route
   candidates.
4. The Arabic source search tool
   `.agents/skills/ufuq-najdi-arabian-sky/scripts/arabic_sources.mjs` searches the four
   Arabic texts with Arabic-aware normalization. It is tested synthetically in
   `tests/tooling/`.
5. Private library: 23 of 24 checksums verify; the owner's new Ibn ʿĀṣim text is filed.

## Next justified step

1. **Leap/EOP artifacts (agent can do next):** select and hash the exact final IERS
   products under the 2C.6 policy (final-only `UT1-UTC`, `xp`, `yp`; a leap-second file
   consistent with Bulletin C), with a manifest and a `data:verify` check, following
   the 2D.1B/2D.1D evidence pattern.
2. **Observer record:** needs the owner (see below). Then close 2D, merge it into
   `main`, and start 2E (the `hip_main` parser, EOP/leap parsers, deterministic
   artifacts).

## Open owner actions

- **Observer coordinates (critical for real ProfileV1 execution):** provide an
  authoritative latitude, longitude, height, and datum for the UMPSA Pekan Faculty of
  Computing reference point, for example from a GNSS survey, a JUPEM record, or an
  official university source.
- Download `SSHT-0046_Lo_res.pdf` (Savage-Smith & Belloli 1985) from the Smithsonian
  repository in a browser.
- Delete the merged branches (the permission system blocks the agent):
  `git branch -d spike/phase-01-astronomy-data chore/claude-code-workflow` and
  `git push origin --delete spike/scientific-behaviour-contract`.
- Optional: ask Khalid al-Ajaji (contact in the Stellarium description) for permission
  to adapt the *Arabic (Ancient)* line figures; buy Tibbetts 1971 and Kunitzsch & Smart
  2006; install uv 0.11.32 to run the Python oracle.

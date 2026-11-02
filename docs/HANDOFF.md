# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-02.

## Current phase

**Phase 1 is complete for implementation and Phase 2 (the minimal celestial-guidance
vertical slice) is implemented, pending named review.** Both wait only on human
approvals and an approved learner direction tolerance.

- **2E:** fail-closed parsers and byte-reproducible artifacts (`npm run data:generate --
  --check`). The activated domain is `2025-09-03T00:00:00Z` inclusive to
  `2026-05-31T00:00:00Z` exclusive.
- **Implementation:** the pure-TypeScript ScientificProfileV1 route, derived from SOFA
  2023-10-11 with the IERS 2010 restoration, in `packages/astronomy-core`.
- **Reference:** `test:reference` is active and in CI. 104 cases match PyERFA to
  8.9e-16 rad (shared lineage; implementation fidelity, not acceptance).
- **Phase 2:** data-driven route selection, server scoring, an R3F scene with keyboard
  controls, and a Playwright journey. Records: `docs/spikes/PHASE1_2E_IMPLEMENTATION_AND_REFERENCE.md`
  and `docs/PHASE2_VERTICAL_SLICE.md`.

Readiness: scaffolding YES; vertical slice implemented, NOT yet validated (approvals
pending); participant study NO; deployment NO.

## How to run it

| Purpose | Command |
| --- | --- |
| All gates | `npm run check && npm run test && npm run test:reference && npm run build && npm run exports:check && npm run test:e2e` |
| Real sky for reviewers (unreviewed data, labelled) | `npm run preview:review`, then open http://127.0.0.1:4173 and choose "Review preview" |
| Regenerate data (needs local raw evidence) | `npm run data:generate` (verify with `-- --check`) |
| Pending approvals | `npm run approvals:status` |
| Python oracle | `tools/astronomy-reference`, with uv 0.11.32 (installed locally at `%USERPROFILE%\.local\uv-0.11.32\uv.exe`, not on PATH) |

## Last completed increments (2026-11-02)

Branch `spike/parsers-deterministic-data`:

1. `b2a2e7e` astronomy-core route.
2. `cade065` 2E parsers and artifacts.
3. `04cf80e` Phase 2 slice (CI green).
4. `281e29f` reference comparison.
5. Follow-up commits with review tooling and these documents.

## Next justified step

1. **Owner actions (critical: they unlock real learner use):**
   - name an astronomy/data reviewer and Arabic/cultural/educational reviewers;
   - have them record approvals (`data/approvals/README.md`);
   - approve a learner direction tolerance (IMP-012).
2. **Agent, no approval needed:** Phase 3 (assessment types, pure BKT, adaptive policy)
   on the synthetic fixture, with BKT parameters kept as unresolved inputs (IMP-014).
3. **Later:** AST-006 tolerance work and stronger independent validation (NOVAS); IERS
   redistribution terms before deploying the EOP bundle.

## Open owner actions

- **Reviews:** approval records for `route-stars-hipparcos1997-v1`,
  `leap-seconds-iers-v1`, `eop-bulletinb-453-461-v1` (per field),
  `observer-umpsa-pekan-v1`, `time-domain-profile-v1`; content review of the records
  listed by `npm run approvals:status`.
- **IMP-012:** decide the learner tolerance for the True North step (it is measured, not
  graded, until then).
- **Deployment (later):** confirm the IERS terms for redistributing Bulletin B values.
- **Optional:** a surveyed or official Faculty coordinate; download
  `SSHT-0046_Lo_res.pdf`; buy Tibbetts 1971 and Kunitzsch & Smart 2006; ask Khalid
  al-Ajaji about adapting the *Arabic (Ancient)* figures.
- **Housekeeping:** delete merged branches. The permission system blocks the agent.

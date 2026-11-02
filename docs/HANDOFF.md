# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-02.

## Current phase

**Phases 1 and 2 are implemented, pending named review, and Phase 3 (assessments and BKT
adaptation) is implemented on the synthetic fixture, pending approval of the learning
decisions.** No technical exit criterion is open; every remaining gate is a human
approval.

- **Phase 1/2:** the SOFA-derived ScientificProfileV1 route, 2E artifacts, the PyERFA
  comparison, data-driven routes and the R3F lesson
  (`spikes/PHASE1_2E_IMPLEMENTATION_AND_REFERENCE.md`, `PHASE2_VERTICAL_SLICE.md`).
- **Phase 3:** pure BKT, observation semantics, the scaffold policy, server-issued cue
  snapshots, the select-every-member task, `lesson.v2` at `/api/v2`, the opt-in
  development identity, the exact-rational BKT oracle and sensitivity evidence
  (`PHASE3_ASSESSMENT_AND_BKT.md`). The real learning configuration is `NON_ADAPTIVE`
  (explicit no-op decisions) until BKT-001..BKT-005, EDU-002 and IMP-012 are approved.

Readiness: scaffolding YES; vertical slice and adaptive tutoring implemented but NOT
validated (approvals pending); participant study NO; deployment NO.

## How to run it

| Purpose | Command |
| --- | --- |
| All gates | `npm run check && npm run test && npm run test:reference && npm run evidence:bkt-sensitivity -- --check && npm run build && npm run exports:check && npm run test:e2e` |
| E2E beside a running preview | `UFUQ_E2E_WEB_PORT=4183 UFUQ_E2E_API_PORT=4184 npm run test:e2e` (the runner refuses ports it does not own) |
| Real sky for reviewers (labelled unreviewed) | `npm run preview:review`, open http://127.0.0.1:4173, choose "Review preview" |
| Regenerate data (needs local raw evidence) | `npm run data:generate` (verify with `-- --check`) |
| Pending approvals | `npm run approvals:status` |
| BKT oracle (uv CPython 3.14.6) | `python -I tools/bkt-reference/bkt_reference.py --check`; `python -I -m unittest discover -s tools/bkt-reference/tests` |
| Astronomy oracle | `tools/astronomy-reference` with uv 0.11.32 at `%USERPROFILE%\.local\uv-0.11.32\uv.exe` |

## Last completed increment (2026-11-02)

Branch `feat/phase-03-assessment-bkt` was merged into `main`. It added Phase 3 (see
`PHASE3_ASSESSMENT_AND_BKT.md`), learner-modelling sources in the source register, and
e2e port isolation.

## Next justified step

1. **Owner actions (critical: they unlock real learner use):**
   - name the astronomy/data, Arabic/cultural and educational reviewers;
   - record approvals (`data/approvals/README.md`);
   - decide BKT-001..BKT-005 and EDU-002 (`PHASE3_ASSESSMENT_AND_BKT.md`, "What a
     reviewer approves");
   - approve a learner direction tolerance (IMP-012).
2. **Agent, no approval needed to start:** Phase 4 (persistence and authentication).
   First freeze the exact MySQL/InnoDB profile (IMP-015); the migrations, idempotent
   attempt transaction, retry reconciliation and the integration suite follow. Account
   policy (IMP-017) stays unresolved, so only ports and the development identity remain.
3. **Later:** AST-006 tolerances and NOVAS validation; IERS redistribution terms before
   deployment; Qibla (KC-05) after the Qibla geodesy decisions.

## Open owner actions

- **Reviews:** approval records for `route-stars-hipparcos1997-v1`,
  `leap-seconds-iers-v1`, `eop-bulletinb-453-461-v1` (per field),
  `observer-umpsa-pekan-v1`, `time-domain-profile-v1`, `lesson-content-v1` and
  `learning-configuration-v1`, plus the content records listed by
  `npm run approvals:status`.
- **Learning decisions:** BKT-001 (assisted evidence and response handling), BKT-002
  (parameters), BKT-003 (threshold and independent confirmation), BKT-004 (scaffold rules
  and cues, including whether the accessible star list counts as a cue), BKT-005
  (evaluation sessions), EDU-002 (the proposed step-to-KC mapping).
- **IMP-012:** the learner tolerance for the True North step.
- **Deployment (later):** IERS terms for redistributing Bulletin B values.
- **Optional:** a surveyed Faculty coordinate; `SSHT-0046_Lo_res.pdf`; Tibbetts 1971 and
  Kunitzsch & Smart 2006; the full texts of Corbett & Anderson 1995 and Baker et al. 2008
  to verify the 0.95 criterion and the degeneracy bounds; Khalid al-Ajaji on the
  *Arabic (Ancient)* figures.
- **Housekeeping:** delete merged branches. The permission system blocks the agent.

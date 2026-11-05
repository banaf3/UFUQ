# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-05.

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
- **Sky explorer (owner request, 2026-11-02):** the first page is the whole naked-eye
  sky (8,875 Hipparcos stars) with IAU figures, curated Arabic patterns, IAU star names
  (Arabic-origin names with Arabic script), five projections and mouse navigation;
  **Start lesson** is in the top bar and lessons run over the same sky
  (`SKY_EXPLORER.md`, IMP-020). New real artifacts `sky-field-hipparcos1997-v1` and
  `sky-culture-iau-v1` are `REVIEW_REQUIRED`.

- **Arabic sky culture (owner request, 2026-11-05):** the explorer now teaches only the
  anwāʾ sky (`ARABIC_SKY_CULTURE.md`, IMP-021, contract `sky.v2`).
  - 114 figures and 123 star names, in Arabic with the transliteration under them.
  - Cited notes from Ibn Qutayba, al-Marzūqī and Ibn ʿĀṣim, and recorded identification
    conflicts.
  - Lines follow `UFUQ_TREE_V1`, and figure cards open from labels.
  - The IAU figures are removed; IAU names remain only as origin information.
  - 26 navigation relationships are recorded for the tutorials
    (`references/syntheses/anwa-navigation-relationships.md`).
  - The new artifact `sky-culture-arabic-anwa-v1` is `REVIEW_REQUIRED`.

Readiness: scaffolding YES; vertical slice and adaptive tutoring implemented but NOT
validated (approvals pending); participant study NO; deployment NO.

## How to run it

| Purpose | Command |
| --- | --- |
| All gates | `npm run check && npm run test && npm run test:reference && npm run evidence:bkt-sensitivity -- --check && npm run build && npm run exports:check && npm run test:e2e` |
| E2E beside a running preview | `UFUQ_E2E_WEB_PORT=4183 UFUQ_E2E_API_PORT=4184 npm run test:e2e` (the runner refuses ports it does not own) |
| Re-acquire sky sources (network) | `node scripts/evidence/acquire-sky-catalogue-v1.mjs` (new evidence directory; then regenerate) |
| Real sky for reviewers (labelled unreviewed) | `npm run preview:review`, open http://127.0.0.1:4173, choose "Review preview" |
| "API server is older than this web app" / HTTP 404 on `/api/v2/sky` | A preview started before a rebuild keeps the old API in memory while Vite serves the new web files. Stop it (Ctrl+C) and run `npm run preview:review` again |
| Regenerate data (needs local raw evidence) | `npm run data:generate` (verify with `-- --check`) |
| Pending approvals | `npm run approvals:status` |
| BKT oracle (uv CPython 3.14.6) | `python -I tools/bkt-reference/bkt_reference.py --check`; `python -I -m unittest discover -s tools/bkt-reference/tests` |
| Astronomy oracle | `tools/astronomy-reference` with uv 0.11.32 at `%USERPROFILE%\.local\uv-0.11.32\uv.exe` |

## Last completed increment (2026-11-05)

Branch `feat/anwa-sky-culture` added the Arabic sky culture:

- the curation `data/curation/sky-culture/arabic-anwa.v1.json`;
- the generator `tools/catalogue/src/generate/arabic-sky.ts` and its tests;
- `sky.v2` in the contracts, API and web;
- the new star and figure cards;
- the docs `ARABIC_SKY_CULTURE.md` and the relationship synthesis.

The private research notes and authoring scripts are in
`local-reference/cultural-astronomy/derived/research-notes/`.

Earlier (2026-11-02):

Branch `feat/sky-explorer` was merged into `main`. It added the sky explorer: sky source
acquisition and artifacts, `SkyDisplayPolicyV1`, `/api/v2/sky`, the R3F planetarium
renderer and explorer page, and lessons over the full sky (`SKY_EXPLORER.md`). Before
that, `feat/phase-03-assessment-bkt` added Phase 3.

## Next justified step

0. **Arabic sky (agent, no approval needed to start):**
   - read the passages behind the 27 `PRIMARY_TEXT_POINTER` records;
   - look for sources for the 52 `COMPILATION_ONLY` records (al-Bīrūnī and al-Ṣūfī
     editions are public domain; see `ARABIC_SKY_CULTURE.md`, "Further sources");
   - turn the cited Cassiopeia-to-al-Jady chain (§174–178) into proposed
     `GuidanceRelationship` steps for the Phase 2 route.

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

- **Arabic sky review:**
  - cultural, Arabic-language, identification and educational review of
    `sky-culture-arabic-anwa-v1`;
  - decide the recorded conflicts (al-Ṭarf, the two forearms, al-Zirr/al-Maysān,
    Ḥaḍār/al-Wazn, Kabid al-Asad, al-Nājidh);
  - check the vocalization of al-Hulba, al-Laʿṭ and al-Maʿqil.
- **Local skill wrapper:** the untracked `.agents/skills/ufuq-reference/` folder (dated
  2026-11-02, not created in this session) makes the
  `tests/tooling/agent-instructions.test.ts` wrapper check fail locally (CI is
  unaffected). Either track it as a canonical skill with a thin `.claude` wrapper, or
  remove it.
- **Sky explorer reviews:** `sky-field-hipparcos1997-v1` and `sky-culture-iau-v1`; an
  atmosphere decision (refraction, extinction) before any near-horizon "as seen" claim;
  sourced Arabic figures (for example the anwāʾ lunar mansions) for the curated layer.

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

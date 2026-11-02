# Phase 2: minimal celestial-guidance vertical slice

- **Date:** 2026-11-02
- **Outcome:** `VERTICAL_SLICE_IMPLEMENTED_PENDING_REVIEW`. The journey runs end to end.
  Learner release waits for named scientific, cultural, Arabic-language and educational
  approvals, and for an approved direction tolerance.

## 1. The journey

1. The learner picks a dataset, a scenario (an approved instant at the UMPSA Pekan
   preset), and an execution scope.
2. The API evaluates every route star with ScientificProfileV1 and selects the route.
3. **Step 1, find the helper pattern.** The learner selects any member star of
   al-Kaff al-Khaḍīb (or Banāt Naʿsh al-Kubrā on the alternative route). The server
   checks exact membership and then reveals the pattern outline and the guide line.
4. **Step 2, find al-Jady.** The learner follows the guide line and selects al-Jady.
   The server checks exact identity and then reveals al-Jady's label and the
   vertical-to-horizon cue.
5. **Step 3, face True North.** Compass labels and the heading readout are hidden. The
   learner turns the view and confirms. The server measures the wrapped azimuth
   difference from True North and reports it with al-Jady's own azimuth. The result is
   `MEASURED_NO_TOLERANCE`, because no learner tolerance is approved (IMP-012).

## 2. Architecture as built

| Layer | Implementation |
| --- | --- |
| Content (IMP-011, IMP-018) | `data/curation/{patterns,relationships,routes,scenarios,stars}`, generated into `lesson-content-v1` and validated by `catalogue-schema` `validateLessonContent` (referential integrity, ordered steps, alternatives, layer rules, 2D.1C negative guards) |
| Route selection | `apps/api/src/lesson/lesson-service.ts` `evaluateRouteEligibility`. A route is eligible when its records are accepted for the scope and every required star has a valid direction that is not below the geometric horizon. The lowest `selectionPriority` wins. No pattern is special-cased |
| Scoring (IMP-004) | `assessment-core`: exact star identity; wrapped azimuth difference; classification only against an explicitly approved policy (none exists) |
| Contracts | `contracts` `lesson.v1` DTOs and request validators. Answers are raw evidence; the client never sends correctness |
| API | `GET /api/v1/datasets`, `POST /api/v1/lessons`, `POST /api/v1/lessons/:id/steps/:step/responses`. In-memory sessions (persistence is Phase 4); opaque per-lesson star handles |
| Web (IMP-010) | R3F scene; ENU to `+X east, +Y up, -Z north`; ground hemisphere hides stars below the geometric horizon; pattern outlines, guide arcs, vertical cue; star list and keyboard controls (arrows, `[`/`]`, Enter) |

## 3. Content as curated (`REVIEW_REQUIRED`)

| Record | Layer and source |
| --- | --- |
| `pattern-al-kaff-al-khadib` (الكف الخضيب), stars `ufuq-star-001` to `005` | `OLD_ARABIAN`: Kunitzsch 1961 entries 136a–c; Ibn Qutaybah and al-Marzūqī locators. Membership from the Stellarium *Arabic (Ancient)* compilation, cited, with no line figures imported. Secondary label *Dhāt al-Kursī* is `GRECO_ARABIC_SCHOLARLY` (Hafez 2010); its Arabic script is not recorded because no local text verifies it |
| `pattern-banat-nash-al-kubra` (بنات نعش الكبرى), stars `ufuq-star-007` to `013` | `OLD_ARABIAN`: Ibn Qutaybah, al-Marzūqī and Ibn ʿĀṣim locators; membership as compiled |
| `pattern-al-jady` (الجدي), `ufuq-star-006` | `OLD_ARABIAN`: Kunitzsch 107a; Ibn Qutaybah §31, §§52–53 |
| Line figures | `MODERN_PEDAGOGICAL` UFUQ teaching aids (W chain; box-and-tail) |
| `guide-kaff-to-jady`, `guide-banat-to-jady` | `MODERN_PEDAGOGICAL` (decision D-4). Modern published methods disagree on the Cassiopeia geometry, so the guide is a declared UFUQ construction |
| `guide-jady-to-true-north` | `MODERN_ASTRONOMICAL`, with al-Jady's attested direction-finding use as `HISTORICAL_CONTEXT_ONLY` |
| Scenarios | 2025-11-15 21:00 MYT and 2026-01-10 20:00 MYT select the hand route; 2026-04-15 22:00 MYT selects the Banāt Naʿsh alternative (the server decides) |

## 4. Execution scopes

| Scope | Data | Behaviour |
| --- | --- | --- |
| `SCIENTIFIC_PROFILE_V1` | Real | Fails closed until every artifact and content record is `APPROVED`. Today it returns `REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED` |
| `REVIEW_PREVIEW` | Real | Only with `UFUQ_ENABLE_REVIEW_PREVIEW=1` (`npm run preview:review`). Banner: unreviewed, not learner content |
| `SYNTHETIC_TECHNICAL_FIXTURE` | Synthetic | Invented stars, EOP and text, used by CI and browser tests. Banner: not the real sky |

## 5. Evidence (2026-11-02)

- **Unit tests:** scoring; mapping, camera and raycast (IMP-010); API journey,
  stale-step, malformed-evidence, alternative-route, missing-row and integrity-failure
  cases (IMP-004, IMP-018).
- **Browser (`npm run test:e2e`, 4 passing):** the full keyboard journey on the synthetic
  fixture; alternative-route selection; the real ProfileV1 data failing closed.
- **Build guard:** `scripts/check-web-bundle.mjs` proves the bundle has no scoring,
  tolerance, eligibility or astronomy-evaluation code.
- **Reproducibility:** `npm run data:generate -- --check` is byte-identical;
  `data/generated/MANIFEST.v1.json` records every artifact hash.
- **Review preview:** checked visually on the real sky for 2025-11-15. The W of the
  hand is outlined and the guide line runs to al-Jady just above the northern horizon.

## 6. Exit gate status

| Exit criterion (`PHASES.md`) | State |
| --- | --- |
| A clean local run reproduces data and route hashes | Met (`data:generate -- --check`; MANIFEST) |
| Postimplementation pinned-reference results for the route | Met for implementation fidelity (`test:reference`, 104 cases) |
| Removing a required star makes the route ineligible | Met (API tests) |
| The browser never owns eligibility, target, tolerance or correctness | Met (contracts, opaque handles, bundle guard) |
| Boundary and raycast tests pass | Met |
| Reviewed operation-specific acceptance; approved content | **Open: owner and reviewers** (see `docs/HANDOFF.md`) |
| Approved learner direction tolerance | **Open: IMP-012** |

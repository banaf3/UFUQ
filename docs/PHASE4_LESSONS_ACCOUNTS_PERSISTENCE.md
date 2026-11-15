# Phase 4: navigation lessons, report-based BKT, accounts and persistence

**Outcome (2026-11-15):** `IMPLEMENTED_PENDING_REVIEW`. The owner asked for lessons that
teach every figure a learner can see, trace from one figure to the next with lines and
smooth camera moves until al-Jady, True North and the Qibla. Assessments should use lines
without names, then no lines once Bayesian Knowledge Tracing (BKT) says the skill is good,
as the founding report states. This record also covers accounts, the progress dashboard and
analytics, on MySQL. The plan is `.agent/execplans/phase-04-navigation-lessons-accounts.md`.

Nothing here is approved. Every real record stays `REVIEW_REQUIRED`: strict
ScientificProfileV1 lessons still fail closed, and the review preview runs them.

## What the learner does

1. **Sign in or register** (UC-101). Without a database the in-memory development learner
   (IMP-016) is used instead.
2. **Start lesson** on the sky. The server picks the route from data (IMP-018): Dhāt
   al-Kursī when it is up, else Banāt Naʿsh.
3. **Walkthrough** (report storyboard figure 3-5). Frame by frame, the camera flies to
   the next figure, its lines are traced and named, and the side panel shows UFUQ's
   instruction with the figure's cited card text:
   - Dhāt al-Kursī route: Dhāt al-Kursī → Kawkabā al-Firq (al-Abyaḍ, §178) → guide line
     → al-Jady → True North → the Qibla.
   - Banāt Naʿsh route: Banāt Naʿsh al-Kubrā → pointer guide (modern, labelled) →
     al-Farqadān (§170) → al-Jady → True North → the Qibla.
   - A frame whose figure is below the horizon is left out.
4. **Assessment** (four steps, one skill each, EDU-002 proposal): find Dhāt al-Kursī
   (KC-02) or Banāt Naʿsh (KC-01); find al-Jady (KC-03); face True North (KC-04); face
   the Qibla (KC-05). The two find-it steps are answered by dragging the sky until the
   circle in the middle of the view is on the answer and confirming; the server checks the
   circle's place (IMP-025, circle radius 4% of the field of view). There is no list or
   multiple choice.
5. **Support follows mastery** per skill (report Table 2-5, below).
6. **My progress** (UC-104) shows the estimated mastery, the support level and every
   answer; **Analytics** (UC-105) shows administrators read-only aggregates and the system
   log.

## Learning configuration (report values, owner instruction)

`data/curation/tutoring/learning-configuration.v1.json`, version 2, mode `ADAPTIVE`:

| Item | Value | Report source |
|---|---|---|
| P(L0), P(T), P(G), P(S) | 0.20, 0.10, 0.20, 0.10 | Table 3-14 |
| Mastery threshold | 0.85, equal to or greater than | §2.5.4 |
| Model update | every scored attempt, correct or incorrect | §2.5.4 steps 1-8 |
| Independent confirmation | 2 consecutive correct answers without support | Table 2-5, last row: repeated unaided correct answers (read as two) |
| Initial support | lines only (FADING) | storyboard figure 3-6: a low initial mastery keeps hints on, shown as figure lines without names |

Support levels map the storyboard: **GUIDED** = lines, names, guide and compass
(figure 3-5); **FADING** = all figure lines, no names (figure 3-6); **INDEPENDENT** = no
lines, no names (figure 3-7). The rules, after each answer, using the updated mastery:

| From | To | When | Report |
|---|---|---|---|
| FADING | INDEPENDENT | first-try correct and mastery ≥ 0.85 | Table 2-5 row 2 |
| FADING | GUIDED | incorrect and mastery < 0.85 | Table 2-5 row 3; UC-103 A1 step 3 |
| GUIDED | FADING | first-try correct and mastery ≥ 0.85 | Table 2-5 row 2 |
| INDEPENDENT | FADING | incorrect and mastery < 0.85 | Table 2-5 row 4 |
| any | same | otherwise | rows 1, 3 (still ≥ 0.85) and 5 |

With these values two correct first answers move a new learner from 0.20 to 0.576 to
0.8726, so the third lesson is "from memory". The browser run of 2026-11-15 showed
exactly this for all four skills.

New cues (`tutoring-core`, one fixed classification each): `FIGURE_LINES` (orientation),
`FIGURE_NAMES`, `CARDINAL_MARKS` and `QIBLA_ARC_FULL` (direct reveal, GUIDED only), and
`QIBLA_BEARING_TEXT` (orientation). The compass letters and the facing readout are hidden
unless `CARDINAL_MARKS` is issued.

**Implementer readings for review (BKT-001 to BKT-004):** the level mapping; "repeated"
read as two; restore to GUIDED on an incorrect answer below the threshold; history window
of one attempt (each decision uses the latest answer, as Table 2-5 does).

## The Qibla (KC-05, IMP-023)

- **Model:** the spherical initial great-circle bearing, clockwise from True North (report
  NFR-2: True North and the Qibla by the spherical trigonometry of Ilm al-Falak). Code: `packages/astronomy-core/src/qibla/spherical-bearing.ts`, with explicit
  undefined results for coincident, antipodal, polar and invalid input.
- **Destination (AST-005 candidate, `REVIEW_REQUIRED`):** the Kaaba as OpenStreetMap way
  103914569, Nominatim centroid 21.4225079° N, 39.8261890° E (WGS 84; footprint about
  8 m), accessed 2026-11-15, ODbL. Cross-checks: Wikipedia's "Kaaba" (21°25′21″ N,
  39°49′34″ E, about 2 m away); the Federal Territory Mufti's falak FAQ (Malaysian Qibla
  azimuths lie between 291° and 293°). Moving the point by its footprint changes the Pekan
  bearing by under 0.3″.
- **Result:** UMPSA Pekan, Faculty of Computing → 292° 07′ 15″ (report storyboard: 292°).
  A third-party JAKIM-zone listing gives 292° 24′ 36″ for zone PHG02; its reference point
  is not stated, so it is noted, not used.
- **Independent oracle:** `tools/qibla-reference` (CPython standard library, unit vectors
  and the local east/north frame in 50-digit decimals; it imports no production code).
  Ten cases, Malaysia and both hemispheres, in `test:reference` with a 2e-12° bound
  (fixture rounding plus binary64 arithmetic; not a learner tolerance).
- **Learner tolerance (IMP-012):** 15°, the owner's decision of 2026-11-15, for both True
  North and the Qibla (`decidedBy: PROJECT_OWNER`).

## Smooth camera moves and tracing

`apps/web/src/sky/fly-to.ts` follows van Wijk and Nuij, "Smooth and efficient zooming and
panning" (IEEE InfoVis 2003), the method of d3's `interpolateZoom`:

- the camera zooms out on a long move and back in on arrival;
- the pan distance is the angle between the view centres, along the great circle;
- ρ = √2, the paper's recommended trade-off and d3's default;
- the duration is proportional to the path length (0.7 to 4 s);
- easing is cubic in-out;
- any user drag or zoom ends a flight.

Lines are drawn progressively once the camera arrives (`SkyLine.drawFrom`/`drawMs`).
Earlier figures stay drawn in a dimmer blue, so the trace from figure to figure stays
visible. A walkthrough has its own random star handles, so nothing it shows identifies a
star in the assessment that follows.

## Persistence (IMP-015) and accounts (IMP-017)

- **Database:** MySQL 8.4.9 LTS (installed with winget on 2026-11-15, owner approved), InnoDB, utf8mb4, UTC.
  The local server is a user process on 127.0.0.1:3307 with its data outside the
  repository (`npm run db:local -- init|start|stop|status|url`).
- **Schema** (`apps/api/src/persistence/migrations.ts`, migration 1): the report's tables
  3-7 to 3-12 as `app_user`, `cognitive_skill`, `bkt_mastery_state`, `assessment_session`,
  `assessment_attempt` and `system_log`, plus `auth_session` and `schema_migration`.
  Probabilities are DOUBLE, not FLOAT, to keep the BKT reference precision.
- **Attempt transaction:** one READ COMMITTED transaction locks the skill's mastery row
  (`SELECT … FOR UPDATE`), checks its revision, updates it and inserts the attempt. A
  stale revision writes nothing; of two concurrent commits on one revision exactly one
  wins (integration test).
- **Accounts:**
  - registration creates a learner;
  - administrators are created only from the command line
    (`npm run admin:create`, password from `UFUQ_ADMIN_PASSWORD`);
  - scrypt at the OWASP minimum (N = 2^17, r = 8, p = 1);
  - passwords of 8 to 64 characters with no composition rules (OWASP ASVS 5.0 V6.2);
  - five consecutive failures lock the account for 15 minutes (report UC-101 E1 asks for
    a temporary lock; the numbers are a provisional choice for owner review);
  - 256-bit session tokens in an HttpOnly, SameSite=Strict cookie, stored as SHA-256 and
    valid for 8 hours;
  - unknown emails take the same time as wrong passwords.
- **Ownership:** an account's lessons are created and answered only by that signed-in
  account. Progress shows only the learner's own rows; analytics are read-only and for
  administrators.
- **System log:** registrations, logins, failures, locks, logouts and refused access.

## Evidence (2026-11-15)

| Check | Result |
|---|---|
| `npm run check` | passed |
| Unit tests | 303 of 304; the one failure is the untracked `ufuq-reference` skill folder (pre-existing, local only) |
| `test:reference` | 157 of 157 (adds the ten Qibla oracle cases) |
| `test:integration` (real MySQL 8.4.9, now active) | 7 of 7: migrations, accounts and lockout, provisioning and restart, stale rejection, concurrent commits, the HTTP journey with the dashboard, analytics |
| Qibla oracle | `--check` byte-identical; 5 self-tests pass |
| e2e (`run-e2e`, spare ports) | 9 of 9, including the walkthrough and the Qibla step |
| Data | `data:generate -- --check` byte-identical (21 artifacts); BKT sensitivity byte-identical |
| Browser, real sky, review preview, MySQL | three lessons as one learner: lines only, then from memory after two correct answers per skill; the dashboard and analytics were checked on screenshots |

## Not done, and why

- **Idempotent retries** (IMP-015 "matching retries return one result"): a repeated
  submission is answered as a new attempt; the request-fingerprint table is not built.
- **Evaluation sessions** (pre-test, post-test, recall; BKT-005) stay disabled.
- **Accessible star list:** it still shows altitude and azimuth in every support level (a
  Phase 3 limitation for BKT-004 review).
- **Account policy:** password-reset, MFA and a common-password list (ASVS) are not
  built; the lockout numbers need owner approval (IMP-017).
- **Approvals:** every value above needs its named reviewer.

## Update 2026-11-15 (second owner request): pointing, no review labels, demo accounts

- **Pointing:** see IMP-025 above.
- **No "unreviewed" wording:** the learner and explorer screens no longer show review-state
  banners, badges or approval lists for the real sky, and the preview data is the default.
  The synthetic technical fixture keeps its own label because it is invented data. The
  records themselves are still `REVIEW_REQUIRED`: no approval record was written, so strict
  mode still fails closed and the preview scope is still what serves the real sky.
- **Sign-in:** a signed-out visitor sees a welcome card with Sign in / Register and a
  Sign in / Register button in the top bar; Start lesson opens the sign-in dialog. Lessons
  belong to the signed-in account whenever a database is present.
- **Demo accounts** (`npm run db:seed-demo`, also run by `npm run preview:review`): admin1,
  admin2, user1 and user2 at `@ufuq.test`, all with the password `1234567`. The password is
  deliberately weak and public, so the command refuses `NODE_ENV=production` and
  `UFUQ_SECURE_COOKIES=1`. Self-registration still needs 8 to 64 characters.

## Update 2026-11-15 (third owner request): assessment shows lines, never names

Assessment never shows names or the yellow target outline, which gave the answer away. For
the find-it steps (KC-01 to KC-03) a learner who is still learning the skill (guided or
lines-only) sees the ordinary blue figure lines; a learner who has mastered it (mastery at
least 0.85) sees no lines. Names, outlines and shape hints are only in the walkthrough.
The direction steps keep their compass, vertical guide and Qibla arc while the skill is
being learned. Cue configuration version 2; this replaces the earlier GUIDED description
(names, outline) above.

## Update 2026-11-15 (fourth owner request): the compass ring

A compass ring is drawn on the horizon in the sky's own 3D projection
(`apps/web/src/lesson/compass-ring.ts`): degree ticks every 10°, numbers every 30° counted
clockwise from True North (0 = 360), a bright marker reading "You face N°", and the Qibla
marked when the place has one. It appears:

- in the walkthrough's True North and Qibla frames, with the Qibla marked, so the learner
  sees the turn from north as degrees;
- in the Qibla assessment step, always (that task is the turn from north, so north is
  given), without the Qibla mark; the side panel also reads "Facing N° from True North";
- in the True North step only while the compass cue is issued (guided), because the ring
  would otherwise reveal north.

The contract gains `LessonStepPromptV2.compassRing` and `WalkthroughFrameV2.compassRing`.

## Update 2026-11-15 (fifth owner request): no Qibla arc or place name in assessment

The orange Qibla arc and its "القبلة Qibla 292°" marker are shown only in the walkthrough.
No assessment support level draws them (cue configuration version 3), and the guided hint
no longer names the place: "The Qibla here is 292° 07′ clockwise from True North". The
compass ring in the Qibla step shows the facing bearing only.

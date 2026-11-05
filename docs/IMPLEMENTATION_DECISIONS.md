# Implementation decisions

This register contains only choices that affect code structure, runtime behavior, or
tests. **Approved** choices may be implemented. **Provisional** choices may be used
behind a replaceable boundary and must be pinned when introduced. **Unresolved**
choices block only the affected behavior; they do not block unrelated scaffolding.
Historical report/deviation/authority status remains in `governance/`.

## IMP-001 — Repository form

- **Decision:** Repository and application shape.
- **Current choice:** TypeScript modular monorepo with `apps/web`, `apps/api`, pure
  domain packages, shared contracts/schema packages, and a catalogue tool.
- **Status:** approved
- **What code it affects:** Root workspace, package folders, TypeScript references,
  import boundaries, build graph.
- **Validation required:** A clean checkout discovers every workspace; forbidden-import
  checks prove dependencies point inward and pure packages compile without app/runtime
  dependencies.

## IMP-002 — Runtime stack

- **Decision:** Primary application technologies.
- **Current choice:** React with React Three Fiber/Three.js in the browser,
  Node.js/Express in the API, and MySQL/InnoDB for durable persistence.
- **Status:** approved
- **What code it affects:** Web/API entry points, adapter packages, database adapter,
  dependency manifest.
- **Validation required:** Minimal build/type checks for both apps and an adapter smoke
  test; real MySQL validation begins when persistence is introduced.

## IMP-003 — Dependency direction

- **Decision:** Separation of domain, application, and adapter code.
- **Current choice:** `astronomy-core`, `assessment-core`, and `tutoring-core` are pure;
  BKT, observation semantics, and adaptive policy are logically separate modules inside
  `tutoring-core`; application use cases own ports; adapters depend inward.
- **Status:** approved
- **What code it affects:** Package public APIs, project references, lint/import rules,
  composition roots.
- **Validation required:** Automated forbidden-import and browser-bundle tests plus
  isolated compilation/unit tests for pure packages.

## IMP-004 — Server authority and contracts

- **Decision:** Location of authoritative assessment/adaptation behavior.
- **Current choice:** Versioned API contracts carry raw learner evidence; the API owns
  scenario validity, scoring, model decisions, revisions, and next scaffold state.
- **Status:** approved
- **What code it affects:** Contracts, web API client, API use cases, scenario and
  assessment interfaces.
- **Validation required:** Contract tests and a build check proving authoritative
  scorer/target/tolerance entry points are absent from the browser bundle.

## IMP-005 — Workspace and build tooling

- **Decision:** Concrete monorepo/build configuration.
- **Current choice:** npm workspaces, pinned supported Node.js and TypeScript versions,
  TypeScript project references, and Vite for the web application.
- **Status:** provisional
- **What code it affects:** Root/package manifests, lockfile, `tsconfig` hierarchy,
  web build configuration, scripts.
- **Validation required:** Pin exact versions in Phase 0; verify clean `npm ci`, build,
  type-check, and workspace script execution before adding behavior.

## IMP-006 — Automated test tooling

- **Decision:** Test runners used by the implementation workflow.
- **Current choice:** Separate fail-closed Vitest configurations for unit, reference,
  and integration tests, plus Playwright for browser tests. Inactive later-phase suites
  are omitted from Phase 0 CI rather than reported as passing; real MySQL tests activate
  the integration suite when persistence appears.
- **Status:** provisional
- **What code it affects:** Test configuration, package scripts, fixtures, CI jobs.
- **Validation required:** Phase 0 self-tests prove test discovery, deterministic seed
  reporting, failure exit codes, and separation of unit, reference, integration, and E2E
  suites.

## IMP-007 — Repository package layout

- **Decision:** Initial folders and package names.
- **Current choice:** Use exactly eight npm workspaces: `apps/web`, `apps/api`,
  `packages/astronomy-core`, `packages/assessment-core`, `packages/tutoring-core`,
  `packages/contracts`, `packages/catalogue-schema`, and `tools/catalogue`. Keep
  `tools/astronomy-reference` as a separate non-npm Python/Astropy fixture producer.
- **Status:** approved
- **What code it affects:** Folder creation, explicit workspace list, dependency graph,
  public entry points, code-independent reference environment with lineage disclosure.
- **Validation required:** No unresolved scientific, cultural, BKT, participant,
  security, or deployment value changes these folder/package boundaries.

## IMP-008 — Catalogue source and runtime subset

- **Decision:** Exact catalogue/table/version, licence/access route, subset, fields,
  quality rules, and canonical runtime artifact.
- **Current choice:** The corrected 2008-09-16 CDS/VizieR I/311 `hip2.dat` table,
  supplements, and 19-HIP allowlist define only the bounded local Phase 1 parser spike.
  That spike preserves every source field and solution/multiplicity/quality record,
  fails on missing/duplicate/invalid rows or supplements, maps its source-supported
  `pmRA` directly to the starred-alpha normalized field, and keeps all raw/derived rows
  local while rights remain unresolved. Milestone 2D.1 now prefers fixed ESA Gaia DR3
  version 1.1 `gaiadr3.gaia_source` as the single-source-first production candidate.
  It is not active or row-approved. Milestone 2D.1B retains exact fixed-release ADQL,
  service/table identities, ignored response bytes, acquisition metadata, per-file
  hashes, schema metadata, and a query manifest. Those bytes verify 8/19 technical HIP
  matches, five rows with both RV/error fields, and no `HIP 11767` match. Named
  reviewers must still establish physical components, positive-parallax/systematics,
  applicable five-/six-parameter covariance, separate RV uncertainty, the explicit
  `UNKNOWN_NOT_PROVIDED` astrometry-RV cross-covariance omission, finite suitable RV,
  source quality, and immutable provenance. Milestone 2D.1A approves the analytic
  `GAIA_DR3_TCB_TO_TDB_COMPATIBLE_V1` adapter: native and normalized states remain
  distinct; the same epoch event is converted with IAU B3; proper motions, parallax,
  uncertainties and covariance receive the pinned compatible-system mapping; and the
  spectroscopic-RV measure is preserved without scaling pending a component-specific
  propagation-proxy approval. Gaia derived-output deployment and public Git tracking
  remain `RIGHTS_INTERPRETATION_REQUIRED`; local analysis with attribution may
  continue while raw/query-derived material stays ignored and local. ESA Hipparcos
  1997 is only a
  possible bright-star astrometry fallback and
  supplies no general RV; Polaris additionally needs one approved primary systemic-RV
  authority. No blanket Gaia/Hipparcos/PCRV/XHIP merge is approved. Cultural records
  reference `starId`, never copied coordinates or a permanently coupled external
  identifier; crossmatch and per-field authorities remain distinct.
  **Milestone 2D.1D (2026-11-01, owner-delegated) supersedes the Gaia-first preference for
  the V1 route stars.** ESA Hipparcos 1997 `hipparcos1.hip_main` (epoch J1991.25(TT),
  CC BY-NC 3.0 IGO, "Credit: ESA") is the single astrometric source for the 13 route
  stars. Hash-bound ESA TAP evidence shows complete five-parameter astrometry,
  correlations, and positive parallax for all 19 candidates. Radial velocity uses the
  ScientificProfileV1 Amendment A1 bounded-omission state (worst 0.081 mas per km/s to
  2040), so no RV catalogue is merged. Noncommercial academic derived artifacts may be
  tracked and deployed with credit. Gaia DR3 and DR4 serve only as cross-checks, and
  I/311 stays the parser spike. Row component/quality records and scientific review
  remain open. See `spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`.
  **2E (2026-11-02):** `data/generated/route-stars-hipparcos1997-v1.json` is the
  generated runtime artifact (13 rows, native fields, covariance, A1 bounds, stable
  `starId` crosswalk in `data/curation/stars/`), `REVIEW_REQUIRED`.
- **Status:** `CATALOGUE_AUTHORITY_BLOCKED` (Gaia DR3 is the preferred candidate;
  adapter A and immutable query gate B are closed; I/311 remains a local
  non-redistributing spike; production row authority/minimal allowlist, Polaris authority, and
  derived-artifact rights remain open under Milestone 2D.1)
- **What code it affects:** Catalogue acquisition adapter, transform/schema fields,
  generated artifact, scientific fixtures.
- **Validation required:** For the source selected by 2D: transport/hash verification,
  source-specific parse/join rules, schema/range/quality reporting, sorted unique
  selection, byte-identical rebuild, provenance/licence manifest, crosswalk integrity,
  and scientific row review. The existing fixed-width/supplement/HIP checks apply only
  if 2D retains I/311. Falak/cultural review remains separate before learner-facing use.
  For Gaia DR3, retain both official Hipparcos-2 crossmatch tables and all required
  `gaia_source` scientific, covariance, RV, variability/non-single-star and quality
  evidence plus applicable linked NSS/variability/RV records; reject an ambiguous or
  component-mismatched row, preserve 64-bit source IDs as strings, and never replace
  missing RV or covariance with zero. Verify the compatible adapter's exact constants,
  epoch-event conversion, field/Jacobian maps, one-time application, fail-closed
  evidence, and native/normalized provenance before it can generate an active row.

## IMP-009 — Astronomy transformation pipeline

- **Decision:** Exact reference-frame/time/Earth-orientation/observer transformation
  algorithm, supported range, effects, failure modes, and error budget.
- **Current choice:** The Milestone 2C evidence audit confirms the typed state
  boundaries, I/311 ICRS input/frame label, starred-alpha `pmRA`, UTC/TAI/TT/UT1 roles,
  fixed sign/horizontal conventions, structured-outcome requirement, and the
  code-independent comparison protocol with explicit lineage. Milestone 2C.1 records
  ESA Gaia DR1's direct I/311-specific
  `J1991.25` usage as source support for the Julian representation. It does not find an
  I/311 time scale. Preserve the label/representation and make source-derived
  propagation unavailable until exact authority or named astronomy-review approval
  supplies the scale. Milestone 2C.2 first proposed a componentized SOFA
  `2023-10-11` CIO-family route; the focused 2C.6 route audit now makes its bounded
  production mapping normative. Production implements a UFUQ-owned pure-TypeScript
  subset derived from exact lower-level SOFA C semantics: strict `pmsafe`-derived full
  space motion to the J2000.0 TDB epoch interface, pinned `epv00` Earth/Sun state,
  `pnm06a`/CIO model orientation, declared-ellipsoid observer construction, an
  `apco`/`apcs`-derived context, `atciq`-derived ICRS-to-CIRS, and only the geometric
  part of the `atioq`-derived local transformation. It requires approved epoch and
  derivative scales, `mu_alpha_star`, Dec motion, positive parallax/equivalent
  distance, finite radial velocity, leap data, `UT1-UTC`, `xp`, `yp`, and an approved
  observer. It includes frame bias, IAU 2006 precession with IAU 2000A nutation,
  annual aberration, solar deflection, Earth rotation, polar motion and diurnal
  aberration. Observer velocity carries the diurnal term through the `apcs`/`atciq`-
  derived context and the later local `diurab` term is disabled as redundant, matching
  SOFA `apco`. Observed `dX`,`dY`, extra-body deflection and refraction are explicitly
  outside V1 and remain unbounded rather than zero. Missing or unapproved required
  row/operational inputs fail closed.
  Astropy `8.0.1` remains a reference path independent of production code/dependencies,
  not a scientifically lineage-independent oracle; the SOFA-derived production subset
  and Astropy/PyERFA/ERFA share scientific lineage, and composed ERFA `atco13` remains
  only a same-family consistency check. Current official package/repository/licence
  evidence finds no third-party TypeScript package that matches the V1 model, EOP,
  warning/status and offline boundary. ERFA or official SOFA C compiled to WebAssembly
  is a reviewed fallback if the owned subset proves unmaintainable, not the selected
  implementation or a stronger oracle. The ScientificProfileV1 time audit makes normative
  a whole-second Z-only restricted subset of RFC 3339 at the UTC astronomy input;
  conditional exact-date leap validation; typed UTC quasi-JD, TAI, TT, and UT1 states;
  a versioned `SupportedTimeDomain` with explicit endpoints and complete required-field
  coverage; no local/current-time or unlabeled-JD fallback; explicit geodetic observer
  provenance and uncertainty;
  immutable hash-addressed offline EOP/leap bundles; separately reviewed atomic
  updates with prior-bundle replay; separate source-quality, artifact integrity,
  field-coverage/interpolation support, publisher-validity, acquisition-lifecycle and
  scientific-approval states for every required EOP field; a
  supported-domain intersection rule; and explicit non-result/result outcome families.
  The final leap/EOP audit accepts only independently approved final Bulletin B/final-
  derived `UT1-UTC`,`xp`,`yp`, selects Gazette 13's four-point example with complete
  support, interpolates UT1 through continuous `UT1-TAI`, restores the IERS Conventions
  2010 ocean-tide and applicable libration terms exactly once after interpolation, and keeps Bulletin C as
  leap-event authority with a separately selected official IERS/IANA machine transport.
  It forbids request-time download/cache fallback, zero/nearest/extrapolated EOP,
  estimate/preliminary/prediction fallback, expired-for-request leap data, and every
  unapproved field quality or degraded execution. No production artifact/hash, exact
  restoration source/configuration, update cadence, observer datum/range, concrete date
  endpoint, prediction horizon, degraded bound, or wire serialization is approved.
  Concrete date values are activation data derived in 2D/2E from the approved domain
  intersection; their absence does not block generic implementation. The semantic-
  scope and leap/EOP audits make core deterministic failure precedence and field-
  specific fail-closed dispositions normative, while stable wire codes remain under
  review. ScientificProfileV1 normatively emits
  geometric-only output, requests no refraction or atmosphere, supplies no default
  atmosphere, keeps geometric, refracted-apparent, physical-dip, terrain, renderer,
  and learner horizon meanings distinct, emits no aggregate visibility, and retains
  earlier valid scientific states through later classifications, including all
  geometric coordinates, provenance, warnings, and statuses. SOFA/Astropy input/
  default/low-altitude behavior is evidence, not UFUQ policy. The model, input ranges/provenance,
  near/below-horizon domain, warnings, physical dip, terrain, photometric/daylight,
  extinction/transparency, cloud/weather, light-pollution, renderer, and learner-
  eligibility policies remain unresolved. No approved or warning-bearing refracted
  result is reachable before the model/input/domain/warning/tolerance/operating-domain
  gates and named astronomy review are complete. Milestone 2C.5A freezes a separate
  24-record scientific experiment protocol and machine registry. It classifies 17
  synthetic-only records as runnable for bounded measurement/invariant evidence, five
  as project-decision blocked, one as required-data blocked, and one as deferred until
  production exists. It adds no numerical body/result, source-derived input,
  production selection, or tolerance. Same-family Astropy/PyERFA/ERFA agreement is
  explicitly non-independent, and all numerical measurements remain without
  acceptance until AST-006 approves bounded terms and an operation-specific
  threshold; the 2C.5C review-draft ledger supplies neither. Milestone 2C.5B then
  completes 9/9 reviewed Batch 01 synthetic scopes inside the non-production
  Python tool. It promotes the unchanged locked PyERFA release to a direct tool
  dependency, passes 24 exact guard/status/replay checks with no failures, and has six
  measurement-only checks covering 27 measurement records, all
  `MEASURED_NO_ACCEPTANCE`. It adds no production implementation, source-derived
  propagation, independent scientific validation, or policy/tolerance approval.
  Milestone 2C.5C interprets those frozen results in a separate 49-term AST-006
  ledger: 45 terms retain an unbounded numerical-bound state and four aggregate
  ledger terms are exact non-numerical guards, distinct from the 24 Batch checks. It
  separates source, model, Earth-orientation/time, observer, atmosphere,
  implementation, scene, and learner layers; keeps scene and learner budgets outside
  astronomy accuracy; defines boundary-specific metrics and candidate conservative/
  covariance/RSS rules; and ranks the remaining runnable synthetic experiments.
  Every required numerical term remains unbounded, RSS remains prohibited without
  justified independence, all six tolerance classes are blocked, and the review
  recommendation is `FINAL_TOLERANCE_NOT_JUSTIFIED`. No hashed Batch input changed.
  Milestone 2C.6 defines `ScientificProfileV1` and separates lifecycle
  gates. V1 is one-preset, one-bounded-UTC-domain, source-neutral, offline,
  fail-closed, geometric-only, refraction-disabled, and without aggregate visibility.
  Its generic `ObserverPreset` contract and the UMPSA Pekan Faculty site identity are
  preimplementation semantics; exact coordinates, Earth model, typed height, accuracy,
  provenance and immutable observer artifact move to 2D. I/311 source authority also
  moves to 2D if retained. Production/reference residuals,
  any stronger independent validation required by the claimed release boundary,
  numerical error-budget population, and tolerance approval follow implementation and
  do not precede it. The semantic-scope audit makes the profile boundary, geometric-
  only/refraction-disabled/no-visibility scope, and outcome/precedence/singularity/
  warning/pending-validation contracts normative. `GEOMETRIC_RESULT_PENDING_VALIDATION`
  is executable after the remaining gates; `APPROVED_GEOMETRIC_RESULT` remains
  unreachable until postimplementation scientific acceptance. The route/effect/
  production mapping and final-only leap/EOP semantic policy are resolved for
  implementation entry. Exact production EOP/leap artifacts, field evidence,
  interpolation/restoration configuration, concrete observer record and actual
  supported-time bounds are 2D/2E activation data, not additional 2C blockers.
- **Status:** approved for bounded ScientificProfileV1 implementation entry; real-data
  execution and scientific acceptance remain gated
- **What code it affects:** Astronomy-core transformations, scenario inputs,
  reference fixtures, errors, and scientific tolerances.
- **Validation required:**
  - **PRE_IMPLEMENTATION:** implement the now normative pure-TypeScript route/effect/
    final-only leap/EOP mapping and typed
    UTC/time-domain boundary, exclusions, fail-closed precedence, warnings/statuses,
    and pending-validation outcome without promoting it to scientific acceptance.
    Review Batch 01 only for its bounded synthetic claims.
  - **2D/2E ACTIVATION:** select and approve exact official EOP/leap bytes, Bulletin C
    consistency, per-field final support, exact IERS interpolation/restoration source
    configuration, bundle hashes, observer/source artifacts and supported-time bounds
    before any real ProfileV1 execution. **2D.2 (2026-11-01)** has selected the sources:
    the IERS NTP leap transport `leap-seconds.3992312697`, the coherent
    ITRF2014-consistent Bulletin B 453–461 final series, and the IERS Conventions (2010)
    v1.0.0 restoration routines, with hash-bound evidence
    (`spikes/PHASE1_TIME_EOP_OBSERVER_AUTHORITY.md`). Named review of the bundle and
    the 2E activation of the supported-time bounds remain.
  - **IMPLEMENTED (2026-11-02):** `packages/astronomy-core` implements the route; 2E
    derived the domain `2025-09-03T00:00:00Z` (inclusive) to `2026-05-31T00:00:00Z`
    (exclusive). Implementation decisions: `CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1`,
    `TT_RATE_EQUALS_TDB_RATE_IAU2006_B3`, restoration evaluated at the TT MJD, the
    opt-in `REVIEW_PREVIEW` scope, and the `SYNTHETIC_TECHNICAL_FIXTURE` scope. See
    `spikes/PHASE1_2E_IMPLEMENTATION_AND_REFERENCE.md`.
  - **POST_IMPLEMENTATION:** compare the TypeScript implementation with pinned
    reference fixtures across the approved domain, record residuals and statuses,
    populate `F-001`/`F-005` and other applicable ledger evidence, activate
    `test:reference`, and seek operation-specific tolerance approval before scientific
    acceptance. **2026-11-02:** `test:reference` is active; 104 cases match PyERFA to
    8.9e-16 rad against the SOFA 1e-12 rad implementation-fidelity bound. F-001/F-005
    population and tolerance approval remain.
  - **STRONGER_INDEPENDENT_VALIDATION:** evaluate USNO NOVAS or another genuinely
    independent positional-astronomy path. Astropy/PyERFA/ERFA/SOFA shared lineage
    cannot satisfy this stage.

## IMP-010 — Scene coordinate adapter

- **Decision:** Mapping from horizontal astronomy coordinates to Three.js.
- **Current choice:** Domain ENU maps to Three.js `+X east`, `+Y up`, `-Z north`; scene
  code is an adapter and never the astronomy oracle. It consumes a labelled valid
  direction with its pending-or-approved validation state, never promotes that state,
  and does not apply refraction, horizon corrections, or scientific visibility policy.
- **Status:** approved
- **What code it affects:** Astronomy-to-scene adapter, camera orientation, raycasting,
  deterministic scene tests.
- **Validation required:** Cardinal-direction, horizon/zenith, camera, and raycast tests
  independent of screenshots. **2026-11-02:** implemented in
  `apps/web/src/scene/mapping.ts` with those tests in `mapping.test.ts`.
  **2026-11-02 (sky explorer):** the planetarium renderer projects ENU directions through
  a view frame equivalent to this mapping (camera at the origin) with five zenithal
  projections (Calabretta & Greisen 2002), and picks stars in screen space with the same
  projector, because a Raycaster cannot follow non-linear projections. Projection,
  orientation and scaling tests are in `apps/web/src/sky/sky-math.test.ts`
  (`docs/SKY_EXPLORER.md`).

## IMP-020 — Display-only background star field

- **Decision:** How stars other than the route stars are positioned for the sky explorer
  and as lesson backgrounds.
- **Current choice:** `SkyDisplayPolicyV1`: the ScientificProfileV1 stage-9 route inside
  the same gated evaluation, accepting SOFA's minimum-parallax override (status 1) for
  non-positive Hipparcos parallaxes and the coarse h/m/s position for stars without an
  astrometric solution, each flagged. Results are display only and never targets. The
  field is every Hipparcos star with V <= 6.5 plus the figure stars
  (`sky-field-hipparcos1997-v1`, `REVIEW_REQUIRED`).
- **Status:** provisional (owner/reviewer approval of the field artifact pending)
- **What code it affects:** `astronomy-core/src/profile/sky-display.ts`,
  `apps/api/src/sky`, lesson star fields, `tools/catalogue/src/generate/sky.ts`.
- **Validation required:** Equality with the ProfileV1 route for ordinary stars, the
  flagged cases, approval gating and byte-reproducible generation
  (`packages/astronomy-core/tests/sky-display.test.ts`, `docs/SKY_EXPLORER.md`).

## IMP-021 — Arabic (anwāʾ) sky culture in the explorer

- **Decision:** Which sky culture the explorer teaches, and how its names, figures and
  notes are sourced and drawn.
- **Current choice:** owner instruction of 2026-11-05.
  - The explorer shows only the Arabic sky of the anwāʾ (`sky-culture-arabic-anwa-v1`,
    from `data/curation/sky-culture/arabic-anwa.v1.json`): 114 figures and 123 star
    names, in Arabic script with an IJMES transliteration.
  - Names and memberships follow the owner's navigation compilation (Stellarium *Arabic
    (Ancient)*, cited per record, line arrays never used), checked against Ibn Qutayba,
    al-Marzūqī and Ibn ʿĀṣim.
  - Notes are cited UFUQ paraphrases; identification disagreements are recorded and
    shown, never resolved silently.
  - Lines follow `UFUQ_TREE_V1` (`MODERN_PEDAGOGICAL`).
  - The IAU figures and the culture selector are removed. IAU WGSN names remain only as
    origin information on the star card.
  - The contract is `sky.v2`.
- **Status:** implemented on `REVIEW_PREVIEW` and the synthetic fixture; cultural,
  Arabic-language, identification and educational review pending
  (`docs/ARABIC_SKY_CULTURE.md`).
- **What code it affects:**
  - `tools/catalogue/src/generate/arabic-sky.ts`;
  - `apps/api/src/sky` and `apps/api/src/data/artifacts.ts`;
  - `packages/contracts/src/sky.ts`;
  - `apps/web/src/explorer` and `apps/web/src/sky/SkyCanvas.tsx`.
- **Validation required:**
  - generator tests (tree rule, ring closure, parent detection, label policy, structural
    validation);
  - API and web unit tests, and the e2e star and figure cards;
  - a named reviewer's approval of the artifact before the strict scope shows it.
- **Linked phase:** sky explorer (after Phase 3). The navigation relationships
  (`docs/references/syntheses/anwa-navigation-relationships.md`) are Phase 2 route and
  tutorial candidates.
- **Superseded in part by IMP-022 (2026-11-05):** lines, card content and the
  transliteration shown to learners.

## IMP-022 — Compilation lines, learner cards and the explorer's look

- **Decision:** How the explorer draws the anwāʾ figures, what the information cards
  say, and how names are written and styled.
- **Current choice:** owner instruction of 2026-11-05 ("there is no line between HIP
  27989 and HIP 26727 and there are wrong lines"; review the Stellarium *Arabic
  (Ancient)* compilation).
  - **Lines.** Each figure's lines are the compilation's `lines` arrays, reproduced
    unmodified (`COMPILATION_LINES_UNMODIFIED`, layer `MODERN_COMPILATION`):
    - each polyline is read as its consecutive pairs;
    - one-star markers draw nothing;
    - UFUQ adds no segment.
    The arrays are copied verbatim into the curation; a check against the pinned copy
    found all 116 identical. Three al-Qidr segments are not drawn because two of its
    stars (HIP 102727, 102775) are outside the display field; they are recorded as
    `omittedSegmentsNotInField`. `UFUQ_TREE_V1` is retired.
  - **Licence basis.** CC BY-ND 4.0 §2(a)(1)(A) lets anyone reproduce and share the
    material "in whole or in part". §2(a)(4) allows changes of format and medium,
    which never produce Adapted Material. Redrawing the unchanged line list on UFUQ's
    star field, with attribution, is therefore permitted. Adding, moving or editing
    segments would be adaptation and stays forbidden. Attribution names the author, the
    work, the licence with its link, and says the lines are unchanged. This replaces the
    2026-11-01 reading that any import of the line arrays is a derivative. The owner may
    still ask the author for permission to adapt, for example to complete al-Qidr.
  - **Cards.** Each figure and star has `about`: an interesting fact in UFUQ's own words
    that combines the cited sources, in plain ASCII.
    - Positional descriptions (where to look, which star is beside which) are left out,
      because the learner sees the sky.
    - Statements that hold only in one place are left out: Iraq qibla rules, "low on the
      horizon", "rises together with". They stay in notes and relationships for the
      lessons.
    - Sources appear only in a References section at the end of the card.
    - Evidence states, conflict lists, "not recorded" messages and altitude/azimuth rows
      are no longer shown. They remain in the API and curation for reviewers.
    - The IAU WGSN origin is a collapsible "Modern name" row below the Arabic content.
  - **Transliteration shown.** `UFUQ_PLAIN_V1`, generated deterministically from the
    curated IJMES form:
    - macrons and dots are dropped;
    - ʿ becomes an apostrophe between two letters and is dropped at a word edge;
    - ʾ is dropped;
    - the first letter is capitalized.
    The IJMES form stays in the curation and as `transliterationScholarly` in the
    artifact. Search folds diacritics, apostrophes, hyphens and Arabic vowel marks.
  - **Look.**
    - Lines are blue (rgba 78, 116, 196) at 0.6 opacity (0.4 dashed for herds and
      areas, 0.85 when selected). The blues follow Stellarium's default constellation
      colours: lines 0.2, 0.2, 0.6 and names 0.4, 0.6, 0.9.
    - Each line stops short of its two stars by 1.25 × the star's drawn radius plus
      0.2° (at least 2 px), after Stellarium Web Engine's `line_truncate` (radius +
      0.2°), so lines never cover the stars.
    - Names (owner's choice, 2026-11-05): figures rgb 159, 194, 241 at 16 px for both
      lines; figures inside a larger one a little darker (rgb 135, 165, 205, 0.85 of each
      channel) at the star-name size; star names grey (rgb 168, 167, 165) at 12 px
      Arabic and 13 px transliteration.
    - Arabic and transliteration use Tajawal (SIL OFL 1.1, bundled via
      `@fontsource/tajawal` 5.3.0) at one weight, 500, so neither is bold. Lesson labels
      use the same font.
    - **Name placement (2026-11-05).** A figure's name sits on its own lines: at the
      point of its lines nearest the centre of its stars (its member star nearest that
      centre when it has no lines), not at the centre itself. The centre of a spread
      figure such as al-Thurayyā al-Ṣūra or al-Asad lies in empty sky, beside another
      figure. Compact figures are placed first because their name has one natural
      place (al-Thurayyā, al-Haqʿa). A name that would overlap one already drawn tries the
      mirror place across its anchor, then right and left of it, then the same places
      at the figure's other line points. If every place is taken it is not drawn.
      Collision boxes cover both lines of text with 8 px either side, so two names
      never read as one phrase. Stellarium Web Engine instead fades overlapping labels
      by priority (`labels.c`); the moving rule is UFUQ's.
  - **Evidence.** New state `SCHOLARLY_STUDY` (a modern study citing named historical
    sources, e.g. Kunitzsch 1961 on the sea pilots' names). After the second reading
    pass:
    - no record is left at `PRIMARY_TEXT_POINTER`;
    - 18 records (5 figures, 13 stars) remain `COMPILATION_ONLY`, down from 52.
- **Status:** implemented on `REVIEW_PREVIEW` and the synthetic fixture; the curation
  stays `REVIEW_REQUIRED`. The licence reading is UFUQ's and is not legal advice.
- **What code it affects:**
  - `tools/catalogue/src/generate/arabic-sky.ts` (schemaVersion 2, `lineSegments`,
    `plainTransliteration`, artifact version 2);
  - `apps/api/src/sky/sky-service.ts` (references, attribution);
  - `apps/api/src/data/artifacts.ts` (rejects other line rules);
  - `packages/contracts/src/sky.ts` (additive: `about`, `references`,
    `SCHOLARLY_STUDY`);
  - `apps/web/src/explorer`, `apps/web/src/sky` and `apps/web/src/styles.css`.
- **Validation required:**
  - generator tests (verbatim polylines, markers, omitted segments, plain
    transliteration, ASCII card text);
  - API reference tests, web layer tests and the e2e card checks;
  - the owner's review of the licence reading;
  - cultural and educational review of every card text.
- **Linked phase:** sky explorer. The general-knowledge items for the lessons are in
  `docs/references/syntheses/anwa-general-knowledge.md`.

## IMP-011 — Reviewed sky-pattern and guidance content

- **Decision:** Exact helper patterns, Arabic names/labels, memberships, line segments,
  guidance relationships, instructional geometry/explanations, and route content for
  learner-facing lessons.
- **Current choice:** No concrete helper pattern or learner-facing mapping is selected.
  The first reviewed route may use Banat Na'sh or Dhat al-Kursi to reach Al-Jady;
  synthetic IDs may exercise generic interfaces in a technical spike but cannot ship as
  content. **Owner preference (2026-11-01):** research first the Cassiopeia-region
  helper to al-Jady to True North, drawing star knowledge from the anwāʾ literature,
  with greater Banāt Naʿsh as the complementary alternative route for the season when
  Cassiopeia is below the horizon. This orders the research and approves no content.
  The evidence layers, Malaysian-latitude availability, and catalogue coverage are in
  `spikes/PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`. The owner-delegated implementation
  decisions there are: helper label al-Kaff al-Khaḍīb (`OLD_ARABIAN`), with
  *Dhāt al-Kursī* as the later scholarly name; greater Banāt Naʿsh as the alternative
  route; and the helper-to-al-Jady line as `MODERN_PEDAGOGICAL`. The Stellarium
  *Arabic (Ancient)* compilation is the primary navigation compilation for the
  `OLD_ARABIAN` layer, verified claim by claim against its cited primary texts. Its
  CC BY-ND 4.0 line figures may be shown only unmodified and attributed (IMP-022);
  lesson guide lines stay `MODERN_PEDAGOGICAL`. Cultural, Arabic, and educational review
  are still required before learner release.
  **2026-11-02:** candidate records exist in `data/curation/` (patterns, guidance,
  routes, scenarios), each `REVIEW_REQUIRED` with source locators. *Dhāt al-Kursī* has
  no Arabic script recorded because no local text verifies it; guide lines are
  `MODERN_PEDAGOGICAL`. See `PHASE2_VERTICAL_SLICE.md`.
- **Status:** unresolved
- **What code it affects:** Curated `SkyPattern`, `GuidanceRelationship`, and
  `LessonRoute` data; scene overlays; assessment targets; lesson/scaffold configuration;
  content fixtures.
- **Validation required:** Applicable cultural/scientific/educational source review,
  stable-ID and relationship integrity, conflict record, verification status, and
  explicit historical-versus-pedagogical classification.

## IMP-018 — Data-driven celestial guidance model

- **Decision:** How patterns, guidance edges, multi-step lessons, and alternative paths
  are represented and selected.
- **Current choice:** Versioned generic `SkyPattern`, `GuidanceRelationship`, and
  `LessonRoute` records form a content graph. Routes can compose helper pattern to Banat
  Na'sh or Dhat al-Kursi, either pattern to Al-Jady, Al-Jady to True North, and True
  North to Qibla. The server selects only routes whose resolved required stars are
  available in the approved scenario; no named pattern is hardcoded as the universal
  entry point.
- **Status:** approved
- **What code it affects:** Catalogue/curation schemas, generated runtime content,
  scenario route selection, lesson renderer, assessment-step orchestration, scaffold
  configuration references, contracts, and fixtures.
- **Validation required:** Schema/referential-integrity tests; ordered-step and
  alternative-path tests; missing-star route exclusion; applicable-scenario filtering;
  review-status enforcement; server-authority and no-special-case dependency tests.
  **2026-11-02:** implemented (`evaluateRouteEligibility`, content validator, API and
  browser tests).

## IMP-012 — Minimal scenario and scoring policy

- **Decision:** Observer/time scenario, eligible lesson route, required-star
  availability, target evidence, supported answer form, and learner/scientific
  tolerances for the first vertical slice.
- **Current choice:** The generic `ObserverPreset` contract selects only
  `umpsa-pekan-faculty-of-computing` for V1 and may be implemented without numerical
  coordinates. Milestone 2D owns its exact reference point, coordinates, Earth model,
  typed height, accuracy, provenance, version and approval artifact before real V1
  execution. **2D.3 (2026-11-01)** records the candidate: the OpenStreetMap Faculty point
  at 3.5466545° N, 103.4273953° E (WGS 84), with an ellipsoidal height of 9.0325 m from
  Copernicus DEM plus EGM2008. Its horizontal accuracy is a derived bound of at most
  2279 m, and its vertical accuracy is unknown. The owner's campus point is a
  cross-check. Approval is `REVIEW_REQUIRED`
  (`data/manifests/observer-umpsa-pekan-v1/`). No production scenario or numeric
  tolerance is selected. The observer/time
  input remains separate from learner-answer and scoring policy; a missing final
  scientific tolerance blocks later acceptance, not implementation start.
  **2026-11-02:** three scenario presets (`REVIEW_REQUIRED`) are curated; star-identity
  steps are scored exactly; the direction step is `MEASURED_NO_TOLERANCE` until a
  tolerance policy is approved and supplied to `measureDirectionAnswer`.
  **2026-11-02 (Phase 3):** a tolerance lives on the reviewed `DirectionTarget` record
  (`learnerTolerance`, inclusive boundary). It is null in real content, and the validator
  refuses a real tolerance without approved review. The synthetic fixture carries an
  invented 10° technical tolerance to exercise the graded path. Set answers
  (`SELECT_ALL_PATTERN_MEMBERS`) are scored by exact set equality, with no partial credit.
- **Status:** unresolved
- **What code it affects:** Scenario/route fixture, route-selection use case,
  assessment-core scoring, API validation, browser interaction, reference tests.
- **Validation required:** Approved sourced scenario and route, complete required-star
  availability, independent expected result, alternative/ineligible-route cases,
  boundary tests, and justified operation/task tolerances.

## IMP-013 — BKT arithmetic boundary

- **Decision:** Shape and update order of the learner model.
- **Current choice:** One standard binary BKT state per KC, observation posterior first
  and learning transition second, implemented in the pure `tutoring-core/src/bkt`
  module.
- **Status:** approved
- **What code it affects:** BKT value types, pure update function, replay records,
  parameter interface.
- **Validation required:** Independently calculated sequences, edge/property tests, and
  deterministic numeric behavior; production parameters are handled separately.
- **Implemented 2026-11-02:** `tutoring-core/src/bkt`. It is compared in
  `test:reference` with the exact-rational `tools/bkt-reference` oracle (136 cases,
  largest residual 6.47e-14) under a per-value first-order forward-error bound (12u per
  posterior, 8u per transition, u = 2^-53, propagated through the update derivative).
  The bound verifies the implementation; it is not a calibration or educational
  tolerance.

## IMP-014 — BKT parameters and adaptive cues

- **Decision:** Production parameters, observation eligibility, threshold, cue content,
  and GUIDED/FADING/INDEPENDENT transition policy.
- **Current choice:** Interfaces and typed decision states may be scaffolded; production
  values and cue semantics are unresolved. **2026-11-02:** the interfaces, validators
  and typed decisions are implemented. Production values travel in the versioned
  `UFUQ_LEARNING_CONFIGURATION` artifact (`data/curation/tutoring/`). It holds only the
  report example parameters (`REPORT_EXAMPLE_NOT_CALIBRATED`) and lists every null policy
  with its owning decision; real lessons therefore run `NON_ADAPTIVE`. The synthetic
  fixture's adaptive policies are invented technical values, not proposals.
- **Status:** unresolved
- **What code it affects:** BKT configuration, the `tutoring-core/src/adaptive-policy`
  module, lesson cues, mastery display, and model-policy tests.
- **Validation required:** Approved worked sequences, sensitivity results, complete
  observation decision table, and cue/state transition fixtures before Phase 3
  acceptance.

## IMP-015 — Persistence transaction model

- **Decision:** Atomic submission and retry architecture.
- **Current choice:** MySQL/InnoDB transaction with immutable scenario, request
  fingerprint, stored canonical result, attempt/model/scaffold record, monotonic per-KC
  revision, fixed lock order, and bounded recognized retries.
- **Status:** approved
- **What code it affects:** API use case, persistence ports/adapters, schema/migrations,
  integration tests.
- **Validation required:** Freeze the exact MySQL profile before Phase 4 acceptance and
  demonstrate rollback, duplicate, mismatch, cold-start, stale, deadlock, and concurrent
  ordering cases against that profile.

## IMP-016 — Development identity boundary

- **Decision:** How pre-authentication phases exercise API workflows.
- **Current choice:** A local fixture identity adapter may be used for non-production
  technical work and must be excluded fail-closed from production artifacts.
  **2026-11-02:** `apps/api/src/learners/development-learners.ts` is an in-memory
  register with no personal data. It is composed only with `enableDevelopmentIdentity`
  (`UFUQ_ENABLE_DEVELOPMENT_IDENTITY=1`, set by `test:e2e` and `preview:review`).
  Without it, lesson creation fails closed with `DEVELOPMENT_IDENTITY_DISABLED`.
- **Status:** provisional
- **What code it affects:** API composition root, development configuration, build
  guards, early E2E fixtures.
- **Validation required:** Production-mode build and route tests prove the adapter and
  bypass capability are absent before Phase 4/5 acceptance.

## IMP-017 — Production account policy

- **Decision:** Registration/enrollment, identifier, recovery, MFA, session lifetimes,
  revocation, and privileged capabilities.
- **Current choice:** Ports and capability types may be scaffolded; production policy is
  unresolved.
- **Status:** unresolved
- **What code it affects:** Authentication/session adapters, account schema, routes,
  authorization and security tests.
- **Validation required:** Approved policy plus threat-model, session, authorization,
  IDOR, recovery, rate-limit, and production fixture-exclusion tests before account or
  deployment readiness.

## IMP-019 — Runtime validation ownership

- **Decision:** Where untrusted serialized data and HTTP payloads are validated.
- **Current choice:** `catalogue-schema` may provide framework-free runtime schemas and
  validators from its `catalogue`, `content`, and `artifact` modules. `contracts` may
  provide framework-free validators beside versioned DTOs. Domain entities, database
  rows, React props, application services, and human curation source records remain in
  their owning layers. No validation library is selected until Phase 1 introduces a
  real validator and can justify its size, API, maintenance, and cross-runtime support.
- **Status:** approved
- **What code it affects:** Trust-boundary parsing, catalogue/content artifact loading,
  API request/response validation, package dependencies, and schema tests.
- **Validation required:** Invalid/unknown input tests, web/API agreement on serialized
  DTOs, framework-free package checks, and one documented dependency decision before a
  validator library is added. **2026-11-02:** hand-written framework-free validators
  (`validateArtifactEnvelope`, `validateLessonContent`, lesson request parsers); no
  validator library added. **2026-11-02:** `lesson.v2` parsers (learner, session purpose,
  set answers, bounded untrusted telemetry) and `tutoring-core`'s configuration
  validators, still without a library.

# Phase 1 Milestone 2E, first implementation, and reference comparison

- **Date:** 2026-11-02
- **Outcome:** `PHASE1_IMPLEMENTATION_COMPLETE_PENDING_SCIENTIFIC_ACCEPTANCE`
- **Scope:** Milestone 2E (parsers and deterministic data), the first bounded TypeScript
  ScientificProfileV1 implementation, and the production/reference comparison that
  activates `test:reference`
- **Not claimed:** scientific acceptance, `APPROVED_GEOMETRIC_RESULT`, an AST-006
  tolerance, named-review approval of any artifact, or learner release

## 1. Milestone 2E: parsers and deterministic data

`tools/catalogue` (Node workspace, may use I/O) parses the hash-verified 2D raw evidence
and writes canonical artifacts. Every raw file is checked against its 2D manifest
before parsing.

| Parser | Fail-closed behaviour |
| --- | --- |
| ESA Hipparcos 1997 `hip_main` CSV | Pinned 76-column header; all native columns kept as source text; strict decimals; duplicate HIP rejected; correlations within [-1, 1]; 5×5 covariance from H14–H28; gate C (`Ncomp`, `AstroRef`, `MultFlag`, `m_HIP`) must equal the 2D.1E record |
| IERS NTP leap list | Exactly one `#$`, `#@`, `#h`; publisher SHA-1 recomputed; 0h-UTC NTP instants only |
| Bulletin C | Positive/none announcement classified; a negative leap second stops generation |
| Bulletin B Section 1 | Header, units, series label and section structure required; civil date must equal MJD; finals contiguous; positive x/y/UT1 formal errors; preliminary rows kept separate |

`npm run data:generate` writes, and `npm run data:generate -- --check` confirms a
byte-identical rebuild of, these artifacts (canonical JSON per
`CATALOGUE_CANONICAL_SERIALIZATION_V1`, payload-hash-bound envelopes):

| Artifact | Content | Tracked |
| --- | --- | --- |
| `route-stars-hipparcos1997-v1` | 13 route stars, `starId` crosswalk, native rows, normalized astrometry, covariance, A1 bound per row (HIP 746: 0.0806 mas per km/s to J2040.0) | Yes (CC BY-NC 3.0 IGO, "Credit: ESA") |
| `leap-seconds-iers-v1` | 28 transitions, expiry MJD 61584 (2027-06-28), publisher SHA-1 `VERIFIED`, Bulletin C 52–72 `CONSISTENT` | Yes (public domain) |
| `observer-umpsa-pekan-v1` | The 2D.3 candidate as an `ObserverPreset` | Yes (single point, ODbL attribution) |
| `time-domain-profile-v1` | Activated `SupportedTimeDomain` | Yes (dates and identities only) |
| `lesson-content-v1` | Phase 2 content (see `docs/PHASE2_VERTICAL_SLICE.md`) | Yes |
| `eop-bulletinb-453-461-v1` | 273 final daily samples, per-field approvals | **No**: `data/generated/local-only/` is ignored because IERS redistribution terms are unconfirmed |
| `synthetic/*` | Visibly synthetic technical dataset for CI and browser tests | Yes |

**Activated domain (derived, `REVIEW_REQUIRED`):** `2025-09-03T00:00:00Z` inclusive to
`2026-05-31T00:00:00Z` exclusive. It is the intersection of four-point EOP support for
all three fields (the binding term), leap validity before 2027-06-28, the `epv00`
1900–2100 status range, and the A1 bound horizon J2040.0.

Approval records live in `data/approvals/` (see its README). A record binds to a
payload SHA-256 and needs a named reviewer, date and decision reference. A stale record
stops generation.

## 2. First bounded TypeScript implementation

`packages/astronomy-core` (pure, no I/O) implements the normative ProfileV1 route.

- **SOFA-derived subset** (`src/astrometry/`): `pmsafe`/`starpm`/`starpv`/`pvstar`,
  `epv00`, `pnm06a` (IAU 2006 precession plus IAU 2000A nutation, 678 + 687 terms),
  `s06`, `c2ixys`, `era00`, `sp00`, `pom00`, `gd2gce`, `pvtob` with an explicit
  ellipsoid, `apco`/`apcs`, `atciq` (`pmpx`, `ldsun`, `ab`), the geometric part of
  `atioq`, `dtdb`, `jd2cal` and `utctai`. Tables are extracted by
  `scripts/codegen/extract-sofa-tables.mjs` from the hash-pinned local SOFA 2023-10-11
  sources. Licence obligations and every difference are in
  `src/astrometry/SOFA_DERIVED_NOTICE.md`.
- **IERS Conventions 2010 restoration** (`src/eop/iers2010/`): `ORTHO_EOP`/`CNMTX`,
  `PMSDNUT2` (`IBAND = 1`), `UTLIBR`, `FUNDARG`, with the licence reproduced in
  `IERS_CONVENTIONS_DERIVED_NOTICE.md`.
- **Time:** the whole-second Z-only grammar; leap validation from the approved artifact;
  UTC quasi-JD, TAI (SOFA `utctai` semantics), TT, UT1 and TDB states in the pinned
  `MJD_ZERO_PLUS_OFFSET` split.
- **EOP:** final-only field states, four-point Lagrange support (i−1 to i+2, contiguous,
  one coherent series), interpolation of continuous UT1−TAI, and IERS 2010 subdaily
  restoration applied exactly once.
- **Evaluation:** the normative 12-stage precedence, per-star stage-6 eligibility,
  `GEOMETRIC_RESULT_PENDING_VALIDATION` output, below-horizon classification,
  undefined azimuth at exact zenith/nadir, and `REFRACTION_NOT_REQUESTED`.

### Implementation decisions made in this milestone

| Decision | Choice | Basis | State |
| --- | --- | --- | --- |
| Source-epoch adapter | `CATALOGUE_TT_EPOCH_TO_TDB_GEOCENTRIC_V1`: the same epoch event plus geocentric TDB−TT from the `dtdb`-derived model (u = v = 0) | SOFA `dtdb`; IAU 2006 B3 | Owner-delegated `PROJECT_DECISION`, `REVIEW_REQUIRED` |
| Derivative scale | Hipparcos rates per Julian year TT are used as per Julian year TDB (`TT_RATE_EQUALS_TDB_RATE_IAU2006_B3`): TDB has no secular rate relative to TT | IAU 2006 Resolution B3 | Same |
| Restoration time argument | TT MJD of the requested instant | `FUNDARG` states its argument is TT. Using UTC instead shifts a semidiurnal phase by at most 0.010 rad, which is below about 5 µas / 1 µs of the correction | Same |
| `REVIEW_PREVIEW` scope | Real ProfileV1 data with `REVIEW_REQUIRED` (never `NOT_APPROVED`) states, for reviewer inspection; labelled unreviewed; off unless `UFUQ_ENABLE_REVIEW_PREVIEW=1` | A reviewer must see outputs to review them | Owner-delegated `PROJECT_DECISION`; reversible |
| Synthetic technical scope | `SYNTHETIC_TECHNICAL_FIXTURE` approvals accept only `synthetic-` presets and synthetic records | IMP-011/IMP-012 permit visibly synthetic technical fixtures | Same |

### Verification

- **SOFA fidelity:** 18 checks reproduce `t_sofa_c.c` values within SOFA's own
  tolerances (`epv00`, `pnm06a`, `nut00a`/`nut06a`, `s06`, `c2ixys`, `pom00`, `era00`,
  `sp00`, `obl06`, `pfw06`, `dtdb`, `gd2gce`, `pvtob`, `starpv`, `pvstar`, `starpm`,
  `pmsafe`, `pmpx`, `ld`, `ldsun`, `ab`, `apco`, `atciq`).
- **IERS fidelity:** every published routine test case is reproduced to 1e-12
  relative.

### Findings

1. **FUNDARG header constants.** The header test values for `LP` and `D` correspond to
   the IERS 2003 constants (1287104.793048″, 1072260.703692″), while the executable code
   uses 1287104.79305″ and 1072260.70369″. Each header value differs by exactly
   0.000002″. The port follows the code, whose `PMSDNUT2` and `UTLIBR` test values
   pass. This is recorded in `packages/astronomy-core/tests/iers2010-restoration.test.ts`.
2. **Fortran default-REAL literals.** `PMSDNUT2`/`UTLIBR` coefficients without a `D`
   exponent are single precision. Reproducing the published test values to 1e-12 needs
   `Math.fround`.
3. **Time-split resolution.** The pinned `MJD_ZERO_PLUS_OFFSET` split resolves about
   0.6 µs at MJD 61000 (≈4e-11 rad of Earth rotation, ≈1e-5″). This is negligible for
   ProfileV1, but it is visible at the 1e-12 rad comparison level, so both comparison
   sides use the same split.

## 3. Production/reference comparison (`test:reference` active)

- **Reference:** `tools/astronomy-reference/reference_profile_v1.py` with PyERFA 2.0.1.5
  (ERFA 2.0.1, SOFA 20231011). It runs a decomposed path (`apco` with zero refraction
  constants, `atciq`, `atioq`) and the composed `atco13` with zero pressure. It is
  code-independent of production; the shared lineage is declared as
  `SHARED_SCIENTIFIC_LINEAGE_IMPLEMENTATION_VERIFICATION`.
- **Inputs:** the 13 Hipparcos route rows, the observer candidate, and 8 instants,
  including the 2016-12-31 leap second. Instantaneous UT1−UTC, xp and yp are explicitly
  synthetic, so no Bulletin B value is tracked. The output is hash-pinned and replays
  byte-identically (`tests/test_profile_v1_reference.py`).
- **Result:** all 104 cases agree to a maximum of 8.9e-16 rad in azimuth and zenith
  distance (UT1 bit-identical), against the 1e-12 rad bound. That bound is the published
  SOFA validation tolerance for `iauAtco13`/`iauAtioq` in `t_sofa_c.c`. It is an
  implementation-fidelity bound, not an AST-006 tolerance; residuals stay
  `MEASURED_NO_ACCEPTANCE` for scientific purposes.
- **Sanity:** in review preview, al-Jady (HIP 11767) sits 3.3–3.9° above the geometric
  horizon at Pekan, with azimuth within 0.6° of north. That matches a polar distance of
  about 0.63° at latitude 3.55°.

## 4. What remains for scientific acceptance

1. Named astronomy/data review and approval records for the five ProfileV1 artifacts
   and the EOP fields.
2. AST-006 error-budget population and operation-specific tolerance approval.
3. Stronger independent validation (USNO NOVAS or another non-SOFA path) if the claimed
   release boundary requires it.
4. Confirmation of IERS Bulletin B redistribution terms before any deployment of the EOP
   bundle.

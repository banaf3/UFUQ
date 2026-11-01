# Phase 1 Milestones 2D.2 and 2D.3: leap/EOP and observer data authority

- **Date:** 2026-11-01
- **Decisions:** `LEAP_EOP_SOURCES_SELECTED` (2D.2) and
  `OBSERVER_PRESET_CANDIDATE_RECORDED` (2D.3)
- **Authority:** owner-delegated `PROJECT_DECISION` under the normative 2C.6 leap/EOP
  policy and `ObserverPreset` contract in `PHASE1_SCIENTIFIC_PROFILE_V1.md`. Scientific
  approval of every selected record remains `REVIEW_REQUIRED`.
- **Evidence:** `data/manifests/iers-leap-eop-v1/` and
  `data/manifests/observer-umpsa-pekan-v1/`, enforced by `npm run data:verify`; raw bytes
  are ignored under `data/raw/iers-leap-eop/` and `data/raw/observer-umpsa-pekan/`
- **Reproduction:** `scripts/evidence/acquire-*.mjs` and `scripts/evidence/screen-*.mjs`;
  the screen parsers are tested synthetically in
  `tests/tooling/leap-eop-observer-evidence.test.ts`
- **Not performed:** no production parser, normalized record, interpolation, generated
  bundle, activated UTC domain, or runtime JSON. Those are Milestone 2E.

## 1. Leap-second transport (2D.2)

| Item | Result |
| --- | --- |
| Selected transport | IERS `ntp/leap-seconds.3992312697`, the versioned NTP-format file published by the IERS Earth Orientation Centre (Paris Observatory) |
| Publisher integrity | The file's own SHA-1 integrity code (`#h`) verifies against its update time, expiry and 28 transitions |
| Publisher validity | Updated 2026-07-06T07:44:57Z through Bulletin C 72; expires 2027-06-28 |
| Content | 28 entries: an initial TAI−UTC of 10 s at 1972-01-01, then 27 positive one-second steps to 37 s at 2017-01-01 |
| Concordance | The IANA tzdb 2026f `leap-seconds.list` is byte-identical; IERS `Leap_Second.dat` (updated through Bulletin C 72) has the identical 28 transitions and the same expiry |
| Bulletin C consistency | Bulletin C 52 (6 July 2016) announced the positive leap second at the end of December 2016 and UTC−TAI = −37 s from 2017 January 1. Every following issue, 53 through 72 (6 July 2026), announces no leap second and restates −37 s. The 21 issues are consecutive, so no announcement is missing. Result: `CONSISTENT` |
| Rights | The file states "This file is in the public domain." |

Bulletin C remains the event authority and the NTP file is the transport, as the policy
requires. SOFA's compiled table and ambient ERFA state are not used. The expiry is
publisher validity metadata: it limits the bundle's claim about future leap knowledge
and does not affect historical requests inside the approved scope.

## 2. Earth-orientation source (2D.2)

### 2.1 Product and acquisition

The source is IERS Bulletin B Section 1, the daily final values of `x`, `y`,
`UT1-UTC`, `dX`, `dY` with their formal errors, in mas and ms at 0 h UTC. The
"Final values" block maps to `FINAL`; the "Preliminary extension" block maps to
`PRELIMINARY` and is excluded. Issues 453 to 464 (1 November 2025 to 1 October 2026)
were acquired, together with the Bulletin B explanatory material.

Every issue screens cleanly. Its Section 1 has the final-then-preliminary structure,
the final rows are contiguous, every civil date agrees with its MJD, all ten numeric
fields are finite, and the `x`, `y` and `UT1` errors are positive. The final blocks tile
without gaps: each issue's first final day follows the previous issue's last.

### 2.2 Series boundary found in the evidence

The issues do not all carry the same solution label:

| Issues | Label in Section 1 | Final days |
| --- | --- | --- |
| 453–461 | "Upgraded solution from March 1 2017 - consistent with ITRF 2014." | 2025-09-02 to 2026-06-01 (MJD 60920–61192), 273 days |
| 462–464 | "Upgraded C04 solution - consistent with ITRF 2020." | 2026-06-02 to 2026-09-01 (MJD 61193–61284), 92 days |

The two blocks are contiguous in time but come from different solutions. ProfileV1
requires every interpolation contributor to belong to "one explicitly reviewed coherent
field series" and rejects an unrecorded source boundary. A four-point window must
therefore never straddle MJD 61192/61193.

### 2.3 Decision

- **V1 EOP series:** Bulletin B 453–461 final values, the ITRF2014-consistent solution,
  273 contiguous days. Each contributing issue is named in the manifest.
- **Why this series:** it is the longest coherent final series in the acquired
  evidence. Nine months of nights sweep every local sidereal time, so the route's
  configurations (Cassiopeia and the greater Banāt Naʿsh high or low) all occur at night
  inside the domain. The 92-day ITRF2020 block does not.
- **Successor:** the ITRF2020 block 462–464 is retained as evidence. A later bundle
  version can move to that series once it covers enough months. Moving would be a new
  reviewed activation; the two series are never mixed.
- **Four-point support preview:** `[2025-09-03T00:00:00Z, 2026-05-31T00:00:00Z)`. This
  is `PREVIEW_NOT_ACTIVATED`; 2E derives the activated interval from the full
  intersection.
- **Frame consistency:** the ITRF2014 versus ITRF2020 polar-motion difference is far
  below the learner's angular scale. Consistency is still enforced as policy, not
  waived.

### 2.4 Items carried to review and 2E

- Bulletin B labels the time column `UT1-UTC`, not `UT1R-UTC`. The 2E parser must
  confirm against the retained explanatory material that zonal tides are included, so
  that the subdaily restoration adds only the diurnal and semidiurnal terms.
- Uncertainty: the per-row formal errors are retained with their native meaning.
  Interpolation and implementation uncertainty stay unquantified, and no tolerance
  follows from this selection.
- Rights: no explicit IERS licence statement was found on the official pages
  consulted. A 2017 tz mailing-list report states that IERS allows copying and use of
  its EOP files with credit, but that is not an official statement. Raw bytes stay
  local. Deploying a generated bundle that contains Bulletin B values requires
  confirmation of the IERS terms, with credit to the IERS Earth Orientation Centre.

## 3. Subdaily restoration source configuration (2D.2)

### 3.1 Source

The IERS Conventions Centre's updated chapter pages say that the working copies
"should be considered under development and are not definitive nor officially approved
as a registered edition". They point to the packaged v1.0.0 as "the official release of
the IERS Conventions (2010)" (15 December 2010). The V1 restoration source is therefore
the routines inside `iersconventions_v1_0_0.tar.gz`. The working copies were acquired
only as a comparison.

The package contains 292 members; the routines sit under `conventions_v1_0_0/2010_official/`.

| Routine (v1.0.0 path) | Bytes | SHA-256 | Calls | Same bytes as working copy |
| --- | --- | --- | --- | --- |
| `chapter8/software/ORTHO_EOP.F` | 7471 | `dfd1524b…5022` | `CNMTX` | yes |
| `chapter8/software/CNMTX.F` | 14500 | `8a29c599…fc93` | — | yes |
| `chapter5/software/PMSDNUT2.F` | 14044 | `a959ccd8…77e8` | `FUNDARG` | **no:** executable code identical; comments differ |
| `chapter5/software/UTLIBR.F` | 11782 | `f523335d…2406` | `FUNDARG` | yes |
| `chapter5/software/FUNDARG.F` (the chapter 5 and 8 copies are identical) | 9041 | `18263cbb…ae78` | — | yes |

The full hashes are in the manifest. Every routine reproduces the IERS Conventions
Software License notice.

**`PMSDNUT2` header finding.** The executable statements of v1.0.0 and the working copy
are identical. The comments differ in three ways. The v1.0.0 header cites
"Section 5.x.x" and "Class 3"; the working copy cites "Section 5.5.1.1" and "Class 1".
The v1.0.0 test-case output (`24.65518398386097942`, `-14.11070254891893327` µas at
MJD 54335) is the pre-correction value. The working copy's 2011-10-13 revision records
that the header was corrected to match the routine's actual output
(`24.83144238273364834`, `-14.09240692041837661` µas). Because the code is unchanged,
2E must verify its port against the **corrected** values. Matching the v1.0.0 header
value would indicate a wrong port.

### 3.2 Configuration

| Routine family | Restores | Configuration recorded |
| --- | --- | --- |
| `ORTHO_EOP` + `CNMTX` (Chapter 8) | Diurnal and semidiurnal ocean-tide terms in `xp`, `yp` and UT1 (µas, µs) | Called as published |
| `PMSDNUT2` + `FUNDARG` (Chapter 5, Table 5.1a) | Diurnal libration in `xp`, `yp` (µas) | `IBAND = 1`: the quasi-diurnal terms only. The routine's own notice explains that the long-period terms and the linear trend are neglected, which matches the ProfileV1 rule not to re-add long-period polar-motion libration |
| `UTLIBR` + `FUNDARG` (Chapter 5, Table 5.1b) | Semidiurnal libration in UT1 (µs); `dLOD` unused by V1 | Called as published |

The policy names these families as the baseline. The historical Gazette 13 `RAY`
routine is not substituted.

### 3.3 Obligations and items carried to 2E

- **Licence:** the IERS Conventions Software License permits derived works, including
  commercial ones. A UFUQ TypeScript port must be identified as not IERS software, must
  describe how it differs, must rename every modified routine, must keep the origin
  attributed, must include the source and reproduce the notice for every routine it
  distributes, and must acknowledge the software in published results.
- **Time argument:** each routine takes a "Modified Julian Date" without naming its time
  scale. 2E must pin the scale it passes and record it in the bundle configuration. The
  effect on the µas-level corrections is negligible, but the choice must be explicit
  for deterministic replay.
- **Verification:** each routine header carries a published test case, for example
  `CNMTX` at MJD 54964.0. 2E verifies its port against those cases before any use, and
  for `PMSDNUT2` against the corrected values above.
- **Units:** returned values are µas and µs. 2E converts them to the ProfileV1 units,
  radians and seconds, exactly once.

## 4. Observer preset candidate (2D.3)

### 4.1 Inputs

On 2026-11-01 the owner supplied a campus point, "Kampus Pekan (Main/Pekan Campus)",
3.53959° N, 103.43148° E. No datum, height or source was stated. The contract rejects
an inferred WGS 84 and forbids relabelling a campus point as the Faculty point, so the
owner's point serves as an independent cross-check.

The candidate reference point is the OpenStreetMap feature "FK Fakulti Komputeran
UMPSA" (node 12825444378, version 3, changeset 181077159, 2026-04-09). Its website tag is
the official Faculty site. OpenStreetMap documents node coordinates in WGS 84 with seven
decimal places.

### 4.2 Candidate record

| Contract field | Candidate value |
| --- | --- |
| `presetId` | `umpsa-pekan-faculty-of-computing` |
| `referencePointDescription` | OSM Faculty point feature; contributor-mapped, not a surveyed monument and not the campus centroid |
| Latitude, longitude | 3.5466545° N, 103.4273953° E (geodetic, east-positive, no normalization) |
| `referenceSystem` | `GEODETIC_DATUM` WGS 84, realization not stated by the source; ellipsoid WGS 84 |
| `coordinateReferenceEpoch` | Not declared by the source; proposed `NOT_REQUIRED` pending review, because plate motion of centimetres per year is far below the horizontal bound |
| `height` | `ELLIPSOIDAL` 9.0325 m on WGS 84 |
| `heightConversion` | Orthometric 6.0 m from the Copernicus DEM GLO-90 (EGM2008 vertical datum) through the Open-Meteo elevation API, plus EGM2008 undulation N = 3.0325 m from GeographicLib GeoidEval 2.5.2; `h = H + N` |
| `coordinateAccuracy` | `DERIVED` horizontal: at most 2279 m, the farthest vertex of the OSM campus polygon (way 1147355347, version 3) from the point. This holds if the Faculty lies inside that polygon, which official UMPSA material supports. Vertical: `UNKNOWN_UNBOUNDED`, because the DEM is a surface model whose cell can include buildings |
| Provenance and licences | OSM API 0.6 responses (ODbL 1.0, "© OpenStreetMap contributors"), Open-Meteo/Copernicus DEM (doi:10.5270/ESA-c5d3d65), GeographicLib service; acquired 2026-11-01; raw bytes hashed |
| `scientificApproval` | `REVIEW_REQUIRED`; reviewer, date and reference absent |

### 4.3 Cross-checks and sensitivity

- The Faculty point and the owner's campus point both lie inside the campus polygon.
  They are 907 m apart, and the polygon's diameter is 2859 m.
- Moving the observer 1 km horizontally tilts the local vertical by 0.54 arcmin, so the
  worst case at the derived bound is 1.23 arcmin. A 100 m height change alters diurnal
  aberration by about 5 × 10⁻⁶ arcsec, because the geometric route places stars at
  infinite distance. These figures are sensitivity evidence for the reviewer, not a
  tolerance.
- No official UMPSA or JUPEM coordinate record for the Faculty was found on the public
  web on 2026-11-01. A surveyed point remains an optional upgrade: replacing the
  candidate would be a new data version, not a contract change.

## 5. Boundary of these decisions

They select sources, pin bytes, and record candidate values with explicit quality,
coverage, validity and approval states. They do not approve any scientific result, EOP
value, observer accuracy, activated domain or tolerance. Real ProfileV1 execution still
requires named approval of the leap/EOP bundle, the observer preset, the catalogue
decision, and Amendment A1. Generic types, parsers, validators and the 2E deterministic
pipeline do not wait for that approval.

## 6. Milestone 2D outcome

With 2D.1 (catalogue) and these two records, every Milestone 2D data selection exists
with hash-bound evidence:

- **Status:** `MILESTONE_2D_READY_TO_CLOSE_FOR_IMPLEMENTATION`.
- **Open for real execution:** named astronomy/data review of the catalogue decision
  and A1, of the leap/EOP bundle, and of the observer preset.
- **Open for deployment:** confirmation of the IERS EOP redistribution terms.
- **Next:** Milestone 2E. Build the fail-closed `hip_main`, NTP-leap and Bulletin B
  parsers and the normalized independent field records. Port the pinned restoration
  routines under the IERS licence obligations. Then generate the deterministic bundle
  and activate the derived UTC domain.

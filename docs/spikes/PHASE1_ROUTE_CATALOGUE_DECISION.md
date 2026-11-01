# Phase 1 Milestone 2D.1D: route-star catalogue decision

- **Date:** 2026-11-01
- **Decision:** `ROUTE_CATALOGUE_SOURCE_SELECTED` for the ScientificProfileV1 route stars:
  the ESA Hipparcos 1997 Main Catalogue (`hipparcos1.hip_main`) as the single
  astrometric source, with Amendment A1 bounded radial-velocity omission
- **Authority:** owner-delegated `PROJECT_DECISION`. On 2026-11-01 the owner asked the
  agent to select the catalogue from current evidence. Scientific acceptance still
  requires the named astronomy review.
- **Evidence:** `data/manifests/hipparcos-esa-1997-hip-screen-v1/`; the 2D.1B Gaia DR3
  evidence; `PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`; and the field-semantics study
  `docs/references/studies/hipparcos-esa-1997-field-semantics.study.md`
- **Not performed:** no row approval, normalization, parser, generated artifact, or
  runtime JSON

## 1. Requirement

The first learner route needs 13 bright stars: the Cassiopeia-region helper (5), al-Jady
(HIP 11767), and the complementary greater Banāt Naʿsh alternative (7). Every row needs
ICRS position, epoch and time scale, proper motion, positive parallax, uncertainty, and
identity under the fail-closed ScientificProfileV1. Learner tolerances are measured in
degrees, so mas-level precision is a large margin rather than a deciding factor. The
deciding factors are completeness for these stars, explicit epoch semantics, rights for
a noncommercial academic deployment, and single-source simplicity.

## 2. Options compared

| Option | Route coverage | Epoch/time scale | Rights | Assessment |
| --- | --- | --- | --- | --- |
| **ESA Hipparcos 1997 `hip_main`** | **19/19 candidates and 13/13 route rows; complete five-parameter astrometry, errors, and all ten correlations; positive parallax 19/19** (2D.1D evidence) | Explicit `J1991.25(TT)`, ESA SP-1200 §1.2.6 | **CC BY-NC 3.0 IGO, "Credit: ESA"**, stated on the official Hipparcos catalogue page | **Selected.** One source for every route star; Hipparcos is the reference astrometry for very bright stars |
| CDS I/311 (van Leeuwen 2007) | All present (2B) | `Ep=1991.25`, time scale not stated | Derived redistribution unresolved | Better formal precision, which is irrelevant here; the epoch scale and rights gaps remain. Kept as the 2B parser spike only |
| Gaia DR3 `gaia_source` | 2/6 primary and 2/7 alternative (2D.1B) | Explicit `J2016.0` TCB | Open with credit, plus a CC BY-NC 3.0 IGO DOI record | Cannot serve the route. About 20% of stars brighter than G≈3 lack a Gaia entry, and many bright Hipparcos stars lack Gaia matches ([Fabricius et al. 2021](https://arxiv.org/pdf/2012.06242); [Brandt 2021](https://arxiv.org/pdf/2105.11662)). Kept as a cross-check where matched |
| Gaia DR4 | Not released; ESA schedules it for [2 December 2026](https://www.cosmos.esa.int/web/gaia/news-2026) | — | — | Not an available authority; the bright limit is a property of the instrument. Re-screen after release as a cross-check |
| Hipparcos plus a separate RV catalogue (PCRV III/252 or XHIP) | Possible | Mixed sources | Two rights chains | Unnecessary once Amendment A1 bounds the RV omission; adds source mixing |
| Bright Star Catalogue or another compiled list | Present | Compiled | Varies | No covariance or formal astrometric model; rejected |

[CNS5](https://arxiv.org/pdf/2211.01449) similarly adds Hipparcos objects that are too
bright for Gaia, noting that for very bright objects Hipparcos usually provides
astrometry of higher quality than Gaia EDR3.

## 3. Decisions

1. **Source.** V1 route-star astrometry comes from ESA Hipparcos 1997 `hip_main`, keyed
   by numeric HIP with the native field semantics H1–H77. The internal `starId` to
   source-row crosswalk stays source-neutral, so a later release can replace a row
   without touching cultural records.
2. **Radial velocity.** Under ScientificProfileV1 Amendment A1, route rows carry
   `RADIAL_VELOCITY_OMITTED_WITH_BOUND`. The worst bound is 0.081 mas per km/s over
   J1991.25 to 2040.0 (HIP 746). That is below the catalogue's formal propagated
   uncertainty of 25–56 mas at 2040 for any realistic stellar RV. No RV catalogue is
   added.
3. **Rights.** CC BY-NC 3.0 IGO permits noncommercial adaptation and redistribution
   with attribution. UFUQ is a noncommercial academic final-year project. A derived,
   attributed route-star artifact may therefore be generated, tracked, and deployed
   for that use with the credit line "Credit: ESA" and the SP-1200 citation.
   Commercial use is not approved. Raw TAP responses stay ignored and local as
   evidence.
4. **Gaia's role.** Gaia DR3 (and DR4 after release) is an optional cross-check where an
   official crossmatch exists. Its rows never substitute for a missing or different
   physical component.
5. **I/311's role.** I/311 stays the bounded 2B parser spike and is not production.

## 4. Remaining row-review items (gate C)

| HIP | Item | Disposition required |
| --- | --- | --- |
| 54061, 65378 | `MultFlag=C`: component solutions in a double or multiple system | Record the component identifier (`m_HIP`, H62) and confirm that the bright component is the instructional object; for HIP 65378 this is Mizar A |
| 11767 | Polaris is a multiple system with a Cepheid primary; blank `MultFlag` (single-star solution) | The solution is the photocentre of the bright unresolved pair; record that Polaris B is a separate object and must never substitute |
| All 13 | Quality fields (`F1`, `F2`, `Qual`, `Source`) and variability flags | Record per row; variability does not affect geometric direction |
| 82080 | `MultFlag=V` | Not a route star; no action |

### 4a. Gate C row record (Milestone 2D.1E, 2026-11-01)

This record was read from the hash-verified local `hip-main-source.csv`. It contains
categorical identity and solution flags only, with no coordinates or measured values.
Data: ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200 (Credit: ESA;
CC BY-NC 3.0 IGO).

| Route set | HIP | Ncomp | MultFlag (H59) | AstroRef (H10) | m_HIP (H62) | CCDM historical flag (H56) | HvarType (H52) | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| al-Kaff al-Khaḍīb | 746 | 1 | — | — | — | I | P | Single-entry solution; use as published |
| al-Kaff al-Khaḍīb | 3179 | 1 | — | — | — | I | M | Single-entry solution; use as published |
| al-Kaff al-Khaḍīb | 4427 | 1 | — | — | — | I | U | Single-entry solution; variability does not affect direction |
| al-Kaff al-Khaḍīb | 6686 | 1 | — | — | — | I | — | Single-entry solution; use as published |
| al-Kaff al-Khaḍīb | 8886 | 1 | — | — | — | — | M | Single-entry solution; use as published |
| al-Jady | 11767 | 1 | — | — | — | I | P | Single-entry photocentre of the bright unresolved pair; Polaris B never substitutes |
| Banāt Naʿsh | 53910 | 1 | — | — | — | — | — | Single-entry solution; use as published |
| Banāt Naʿsh | 54061 | 2 | C | A | AB | I | D | Component solution; **astrometry refers to component A**, the naked-eye star. Another Hipparcos entry lies within 10″ (`Proxy=H`) and must never substitute |
| Banāt Naʿsh | 58001 | 1 | — | — | — | — | M | Single-entry solution; use as published |
| Banāt Naʿsh | 59774 | 1 | — | — | — | I | C | Single-entry solution; use as published |
| Banāt Naʿsh | 62956 | 1 | — | — | — | — | P | Single-entry solution; use as published |
| Banāt Naʿsh | 65378 | 2 | C | A | AC | I | D | Component solution; **astrometry refers to component A** (Mizar A); other components and Alcor are separate objects |
| Banāt Naʿsh | 67301 | 1 | — | — | — | — | M | Single-entry solution; use as published |

All 13 rows have the astrometric source flag (H60) blank and are Survey stars. Both
component solutions have solution quality `Qual=A`. No route row uses an acceleration,
orbital, variability-induced, or stochastic solution.

Disposition: `ROW_RECORDS_COMPLETE_FOR_IMPLEMENTATION`. The 2E parser must preserve H10,
H59, H62, and the CCDM fields, and must fail if a route row's `AstroRef` or `MultFlag`
differs from this record. Scientific row acceptance (fit statistics `F1`/`F2`, and the
component choice) remains with the named astronomy reviewer.

## 5. Consequences for Milestone 2E

- The parser targets the ESA `hip_main` CSV response, preserving all 76 columns
  natively, instead of I/311's fixed-width `hip2.dat`. The 2B field-contract principles
  apply unchanged: allowlist first, fail closed, preserve source fields, keep native and
  normalized values distinct.
- The normalized row records `J1991.25(TT)`, `mu_alpha_star` (H12, already multiplied
  by cos δ), the full 5×5 covariance built from H14–H28, positive parallax, and the A1
  RV state.
- A generated artifact carries the ESA credit line, the citation, the manifest
  identifier, and the raw-response hashes.

## 6. Still open for Milestone 2D

- The concrete UMPSA Pekan Faculty `ObserverPreset` record: coordinates, datum, height,
  accuracy, and provenance. This requires an authoritative survey or official record
  and is not invented here.
- The exact final IERS leap-second and EOP artifacts with hashes, and the activated UTC
  domain.
- Named astronomy review of this decision and of Amendment A1 for scientific
  acceptance.

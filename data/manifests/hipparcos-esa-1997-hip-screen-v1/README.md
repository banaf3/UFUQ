# ESA Hipparcos 1997 19-HIP query evidence

Milestone 2D.1D bounded query evidence for the original ESA Hipparcos Main Catalogue
(`hipparcos1.hip_main`, ESA SP-1200, epoch J1991.25(TT)), queried through the ESA ESASky
Legacy TAP service named on the official Hipparcos catalogue page.

Tracked here: the exact ADQL query bytes, their hashes, and a manifest of service
identity, acquisition time, raw-response hashes, column inventory, structural counts,
and the computed radial-velocity omission bound. No coordinate or measured value is
tracked. The raw responses are Git-ignored under `data/raw/hipparcos-esa-1997/` and are
the authority. A later re-query is equivalent only if every response hash matches; a
changed response is a new evidence version.

The data are licensed CC BY-NC 3.0 IGO and must carry the credit line "Credit: ESA".
This evidence approves no row, component, or quality decision. See
`docs/spikes/PHASE1_ROUTE_CATALOGUE_DECISION.md`.

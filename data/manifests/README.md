# Source manifests

Tracked provenance, licence, query, selection, and expected-hash manifests belong here.

`gaia-dr3-hip-screen-v1/` records the exact official Gaia DR3 query and ignored raw-
response hashes for the Milestone 2D.1B technical screen. It is query evidence only:
it selects no production row and grants no tracking or deployment right for Gaia rows.

`hipparcos-esa-1997-hip-screen-v1/` holds the ESA Hipparcos 1997 query evidence behind
the Milestone 2D.1D route-star catalogue decision. `iers-leap-eop-v1/` holds the 2D.2
leap transport, the Bulletin B EOP series, and the restoration-source evidence.
`observer-umpsa-pekan-v1/` holds the 2D.3 candidate observer preset. All are
`REVIEW_REQUIRED` and are verified by `npm run data:verify`.

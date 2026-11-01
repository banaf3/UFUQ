# IERS leap-second, EOP, and restoration source evidence

Milestone 2D.2 source evidence for the ScientificProfileV1 leap/EOP bundle. The manifest
records:

- the selected leap transport, its publisher integrity, its Bulletin C consistency, and
  its concordance with the IANA and `Leap_Second.dat` copies;
- the Bulletin B Section 1 issues, including the series boundary at issue 462, and the
  coherent 453–461 final series selected for V1;
- the pinned IERS Conventions (2010) v1.0.0 restoration routines;
- the hashes of all 45 ignored raw files under `data/raw/iers-leap-eop/`.

No EOP value is tracked. The leap file is in the public domain. No explicit IERS
licence was found for Bulletin B, so deploying a generated EOP bundle needs the IERS
terms confirmed, with credit to the IERS Earth Orientation Centre (Paris Observatory).
The restoration routines are under the IERS Conventions Software License, whose
derived-work conditions apply to the 2E port.

Reproduce with `node scripts/evidence/acquire-iers-leap-eop-v1.mjs`, then
`node scripts/evidence/screen-iers-leap-eop-v1.mjs <evidence-directory>`. A new
acquisition is a new evidence version. Scientific approval is `REVIEW_REQUIRED`. See
`docs/spikes/PHASE1_TIME_EOP_OBSERVER_AUTHORITY.md`.

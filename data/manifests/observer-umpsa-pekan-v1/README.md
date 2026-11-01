# UMPSA Pekan observer-preset candidate evidence

Milestone 2D.3 candidate record for the single ScientificProfileV1 observer preset
`umpsa-pekan-faculty-of-computing`. The manifest holds the candidate preset fields,
the derivation of the ellipsoidal height, the derived horizontal bound, the owner's
campus-point cross-check, sensitivity figures, and the hashes of the ignored raw
responses under `data/raw/observer-umpsa-pekan/`.

The reference point is the OpenStreetMap Faculty feature (node 12825444378, version 3).
Map data © OpenStreetMap contributors, available under the Open Database Licence 1.0.
The orthometric height comes from the Copernicus DEM GLO-90 through the Open-Meteo
elevation API (doi:10.5270/ESA-c5d3d65), and the EGM2008 undulation from GeographicLib
GeoidEval. OpenStreetMap contributor user names are not tracked.

Reproduce with `node scripts/evidence/acquire-observer-umpsa-pekan-v1.mjs`, then
`node scripts/evidence/screen-observer-umpsa-pekan-v1.mjs <evidence-directory>`. Live
services can change, so a new acquisition is a new evidence version. Scientific approval
is `REVIEW_REQUIRED`. See `docs/spikes/PHASE1_TIME_EOP_OBSERVER_AUTHORITY.md`.

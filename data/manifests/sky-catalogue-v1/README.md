# Sky-explorer source evidence (sky-catalogue-v1)

Acquired on 2026-11-02 by `node scripts/evidence/acquire-sky-catalogue-v1.mjs`. The raw
bytes live in ignored `data/raw/sky-catalogue-v1/<evidenceId>/`; this directory holds the
tracked queries and `acquisition-manifest.v1.json` with every file's URL, HTTP status,
size and SHA-256.

| Source | Use | Licence or terms |
|---|---|---|
| ESA Hipparcos 1997 `hip_main` (ESASky Legacy TAP), Vmag <= 6.5 plus fainter figure stars | Display-only background field (SkyDisplayPolicyV1) | ESA, CC BY-NC 3.0 IGO with credit |
| Bright Star Catalogue, CDS V/50 `ReadMe` and `catalog.gz` (CDS mirror at CfA) | HR-to-HD cross-reference for the figures | CDS catalogue, cited |
| M. van der Sluys, ConstellationLines v1.4 (pinned commit) | 88 IAU constellation stick figures | CC BY 4.0 |
| NAOJ "Constellations" table | The 88 IAU constellation names and abbreviations | Institutional reference |
| IAU WGSN Catalog of Star Names (exopla.net) | Star names, origin language, etymology | Names are not subject to copyright; etymology texts CC BY (IAU WGSN) |

Nothing here approves a row, a figure or a name. The generated artifacts
`sky-field-hipparcos1997-v1` and `sky-culture-iau-v1` are `REVIEW_REQUIRED`.

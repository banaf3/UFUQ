# Sky explorer and planetarium renderer

**State (2026-11-02):** implemented and tested; every real artifact is `REVIEW_REQUIRED`.
The first page of the web app is now the whole naked-eye sky for a scenario or a chosen
instant, with constellation figures and names, mouse/touch/keyboard navigation and five
projections. A lesson starts only from the top bar and runs over the same full sky.
This follows the founding report's celestial-environment use case (UC-102: open the
simulator, choose location and time, rotate, pan and zoom; the assessment is started by
the learner) and its storyboard layout (full-screen sky, slim top bar, start button).

## What the learner sees

| Element | Behaviour |
|---|---|
| Sky | Every Hipparcos star with V <= 6.5 (8,874) plus the one fainter figure star: 8,875 stars, about half above the horizon at any time. Computed by the server for the chosen instant. |
| Top bar | Data and scope, scenario (or a custom UTC instant inside the activated domain), sky culture, find a star or figure, scope badge, **Start lesson**. |
| Bottom left | Transparent toggles: **Lines** (figures), **Names** (figure and star names), **Ground**. |
| Bottom right | Projection, zoom out/in, azimuth/altitude/field-of-view readout. |
| Navigation | Drag to look around ("grab the sky", with inertia); wheel or pinch to zoom; double-click to centre; arrow keys pan, + and - zoom. Selecting a star opens a card (name, Arabic script, magnitude, B-V, altitude/azimuth, figures, etymology). |
| Sky culture (since 2026-11-05) | Only the Arabic sky of the anwāʾ (`docs/ARABIC_SKY_CULTURE.md`, IMP-021, contract `sky.v2`): Arabic figure and star names with their transliteration under them, cited notes on the cards, IAU WGSN names only as origin information. The rows below describe the original 2026-11-02 release. |
| Sky cultures (2026-11-02, superseded) | Arabic patterns (UFUQ curated) + IAU constellations (default), Arabic only, or IAU only. Arabic views label IAU stars whose WGSN origin is Arabic (215 names), with the Arabic script where the WGSN etymology quotes it. |

## How it is computed

- **Route stars** keep the full ScientificProfileV1 path (`executeStar`).
- **Every other star** goes through `SkyDisplayPolicyV1` (`packages/astronomy-core/src/profile/sky-display.ts`). It uses the same stage-9 route and context, inside the same gated `evaluateProfile` call (`includeDisplayField`), and accepts two documented cases that ScientificProfileV1 rejects, flagging each result:
  - a non-positive Hipparcos parallax (59 stars): SOFA `iauStarpv` substitutes its minimum parallax and reports status 1, which this policy accepts;
  - no astrometric solution (4 stars): the catalogue's coarse ICRS h/m/s position at J1991.25 is used, with zero proper motion.
- **Display only:** these results are never assessed and never targets. The display field has its own approval and is gated per scope like every artifact.
- **Results are geometric:** no refraction and no atmospheric dimming. Both remain unapproved atmosphere decisions (AST policy). Polaris at Pekan (about 3.9° altitude) is drawn at its catalogue brightness.
- **Lessons:**
  - A lesson's star field is the same sky behind opaque per-lesson handles, so no catalogue identity reaches the browser.
  - The accessible star list shows only stars of V <= 3.5 above the horizon. Every route star is brighter.
- **Performance (measured 2026-11-02):** the full real sky takes about 170–230 ms server-side, then is cached per dataset, scope and instant. It is about 650 KB of JSON.

## Renderer (ADR-002: React Three Fiber host)

- **Projections** are zenithal about the view centre, with the radial functions of Calabretta & Greisen (2002), Sect. 5.1:

  | Projection | FITS code | R(ρ) |
  |---|---|---|
  | Perspective | TAN | tan ρ |
  | Stereographic (default, as in Stellarium) | STG | 2 tan(ρ/2) |
  | Fisheye | ARC | ρ |
  | Equal area | ZEA | 2 sin(ρ/2) |
  | Orthographic | SIN | sin ρ |

  Field-of-view limits are Stellarium's (120°, 235°, 360°, 360°, 180°). The field of view spans the smaller viewport side.
- **Background:** a full-screen shader inverse-projects every pixel, so sky, ground and horizon are exact in every projection.
- **Stars:** one point buffer. The vertex shader applies the forward projection and the brightness rule; blending is additive.
- **Lines and labels:** a 2D overlay canvas drawn in the same frame. Text stays crisp, Arabic shaping is correct, lines have real widths, and figure lines stop 6 px short of their stars.
- **Picking:** in screen space with the same projector. Three's `Raycaster` cannot follow non-linear projections.
- **View state:** lives in `ViewController` (per-frame, outside React state).
- **Brightness:**
  - Pogson flux 10^(−0.4 Δm), compressed by Stevens' point-source exponent 0.5.
  - The disc area follows that perceived brightness, so the radius grows by 10^0.1 per magnitude.
  - The faintest 2.5 magnitudes fade in opacity, down to 35 % at the catalogue limit. A screen cannot show the eye's dynamic range; this is a display compromise, not a visibility model.
- **Colour:**
  - B−V gives temperature through Ballesteros (2012) Eq. 14.
  - The Planck spectrum is integrated against the CIE 1931 colour-matching functions, using the multi-lobe fit of Wyman, Sloan & Shirley (2013).
  - The result goes to sRGB (IEC 61966-2-1) with the brightest channel normalised.

## Data and licences

Acquired on 2026-11-02 by `node scripts/evidence/acquire-sky-catalogue-v1.mjs`. The
manifest and query files are in `data/manifests/sky-catalogue-v1/`; the raw bytes are
ignored and local only. The artifacts are generated by `npm run data:generate`:
`sky-field-hipparcos1997-v1` and `sky-culture-iau-v1`, plus synthetic twins for tests.

| Source | Use | Terms |
|---|---|---|
| ESA Hipparcos 1997 `hip_main` (ESASky Legacy TAP) | Star field | ESA, CC BY-NC 3.0 IGO, credited |
| Bright Star Catalogue V/50 (CDS mirror at CfA; the Strasbourg hosts were unreachable) | HR-to-HD cross-reference | CDS, cited |
| M. van der Sluys, ConstellationLines v1.4, DOI 10.5281/zenodo.10397192 | 88 IAU figures (750 segments) | CC BY 4.0, credited |
| NAOJ constellation table | The 88 IAU names and abbreviations | Institutional reference |
| IAU WGSN Catalog of Star Names | 496 star names, origin language, etymology | Names not subject to copyright; etymology CC BY (IAU WGSN), credited in the card |

Line stars map from HR to HD to HIP. Ten double stars, where Hipparcos carries a
neighbouring HD number, are matched by a recorded position match (at most 42.8″); none
is unmatched. A Hipparcos-numbered IAU stick-figure file (dcf21) was rejected: its
README says CC BY 4.0 while its file header says GPL-3.0, an unclear licence. The
Stellarium *Arabic (Ancient)* lines are reproduced unmodified with attribution (IMP-022);
UFUQ never edits them, because the licence is CC BY-ND.

## Tests (2026-11-02)

- **Projections:** the C&G values (STG R(90°)=2, TAN R(45°)=1, ARC R(90°)=π/2, ZEA R(180°)=2, SIN R(90°)=1), inverses, round trips, orientation (east right, zenith up when facing north) and field-of-view scaling.
- **Appearance:** Ballesteros temperatures, the colour ordering and the brightness rule.
- **Layers:** the culture filters, the name policy, and the lines and names toggles.
- **Trimming:** figure lines stop short of their stars.
- **Display policy:** it equals the ProfileV1 route for an ordinary star; the override and coarse flags; gating by approval; and it runs only on request.
- **Parsers:** HIP rows (full and coarse), BSC byte layout, Crux continuation lines, NAOJ split tables, WGSN rows and Arabic-script extraction.
- **API:** the sky endpoint (shape, cultures, domain refusals with the normative stage order, parameter validation, strict and preview fail-closed), the supported domain in the dataset list, and lessons carrying the full sky behind opaque handles.
- **Browser:** the explorer is the first page with a safe fallback; the toggles; mouse drag, zoom and projection; find and the star card; a custom instant; and lessons started from the top bar.

## Open items (owner and reviewers)

- Approve `sky-field-hipparcos1997-v1` (astronomy/data) and `sky-culture-iau-v1` (cultural and educational, including the WGSN-derived Arabic scripts) through `data/approvals/`.
- An atmosphere decision (refraction, extinction and a site extinction coefficient) before any "as seen through the atmosphere" brightness or position near the horizon.
- The anwāʾ culture (IMP-021, IMP-022) replaced the IAU figures on 2026-11-05. Changing any of its lines needs the author's permission, because they are CC BY-ND; completing al-Qidr needs two fainter stars added to the display field.

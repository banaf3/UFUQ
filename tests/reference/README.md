# Reference tests

Discovery is owned by `vitest.reference.config.ts`; run `npm run test:reference` after a
build (`tsc -b`), because cases import workspace packages through their built entry points.

Current content (Phase 1 spike): `horizontal-crosscheck.test.ts` compares the runtime
east/north/up route with the independently written spherical-trigonometry route in
`tools/astronomy-reference` on synthetic inputs. It is a formulation-level diagnostic, not
the pinned Astropy/USNO oracle, and asserts no scientific tolerance. No BKT cases exist.

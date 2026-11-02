# ADR-002: React and Three.js integration

- **Status:** Independently reviewed; awaiting owner approval
- **Classification:** CLARIFIED
- **Date:** 2026-07-20

## Context

The report specifies React and Three.js. The UI needs accessible semantic controls and normal application state while the sky scene needs high-frequency transforms, efficient star rendering, and deterministic raycasting. Letting either React components or Three objects absorb astronomy/business rules would make validation and performance difficult.

## Decision

Use React Three Fiber as the adapter that hosts the Three.js scene within React. Use direct Three.js types/APIs inside the adapter for buffers, vectors, camera, layers, and `Raycaster`. Keep catalogue-to-horizontal calculations and scoring in pure packages.

React owns semantic state such as route, scenario status, feedback, assistance state, pending retry, and progress. Per-frame camera/render state stays in Three/R3F refs or scene-local stores and does not trigger ordinary React rerenders. Render the small catalogue using buffer geometry or instancing selected by measurement.

Raycasting returns typed raw evidence keyed by stable catalogue/task ID. Hidden or non-assessable objects are excluded. Labels, cues, and line segments must not silently change target hit areas. A non-pointer answer control is supplied according to ACC-001.

## Consequences

- The scene fits React lifecycle/composition while preserving low-level performance access.
- A narrow coordinate adapter enforces `+X east`, `+Y up`, `-Z north`.
- R3F becomes an additional dependency and needs pinned browser/visual tests.
- DOM accessibility cannot be delegated to a canvas; the surrounding interface and equivalent control require deliberate implementation.

## Alternatives rejected

- Imperative Three scene embedded ad hoc in a React effect: possible, but encourages lifecycle/state leakage and larger custom integration.
- Store frame-loop values in React component state: excessive rerender risk.
- CSS/2D-only sky or external viewer: does not satisfy the 3D interaction contribution.

## Implementation note (2026-11-02, sky explorer)

R3F still hosts the scene. The planetarium renderer uses custom shaders on an R3F
canvas: a full-screen background shader that inverse-projects every pixel, and one
point buffer with the forward projection. Lines and labels are drawn on a 2D overlay
canvas in the same frame, for correct Arabic text shaping. Picking is screen space with
the same projector, because Three's `Raycaster` cannot follow the non-linear zenithal
projections. Per-frame view state lives in a `ViewController` object, outside React state.
See `docs/SKY_EXPLORER.md`.

## Validation

Fixed-camera raycast tests, deterministic scientific/scaffold screenshots, exact primary
study-browser E2E plus only the additional engine coverage claimed under
PERF-001/SCOPE-002, manual accessibility checks, and the configured PERF-001
frame/raycast benchmark.

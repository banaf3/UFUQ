// IMP-010 validation: cardinal directions, horizon/zenith, camera and raycast tests,
// independent of screenshots.
import { Mesh, MeshBasicMaterial, Raycaster, Scene, SphereGeometry, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  describeEnu,
  enuToScene,
  greatCirclePoints,
  horizonPointBelow,
  normalizeHeading,
  SKY_RADIUS,
  viewDirection,
} from './mapping.js';

describe('ENU to Three.js mapping', () => {
  it('maps the cardinal directions to +X east, +Y up, -Z north', () => {
    expect(enuToScene([1, 0, 0], 1)).toEqual([1, 0, -0]);
    expect(enuToScene([0, 1, 0], 1)).toEqual([0, 0, -1]);
    expect(enuToScene([0, 0, 1], 1)).toEqual([0, 1, -0]);
  });

  it('points the camera north at heading 0 and east at heading 90 degrees', () => {
    const north = viewDirection(0, 0);
    expect(north[2]).toBeCloseTo(-1, 12);
    const east = viewDirection(Math.PI / 2, 0);
    expect(east[0]).toBeCloseTo(1, 12);
    const zenith = viewDirection(0, Math.PI / 2);
    expect(zenith[1]).toBeCloseTo(1, 12);
  });

  it('describes horizon, zenith and wrapped azimuths for display', () => {
    expect(describeEnu([0, 1, 0])).toEqual({ altitudeDegrees: 0, azimuthDegrees: 0 });
    expect(describeEnu([0, 0, 1]).azimuthDegrees).toBeNull();
    expect(describeEnu([-1, 0, 0]).azimuthDegrees).toBeCloseTo(270, 12);
    expect(normalizeHeading(-0.5)).toBeCloseTo(2 * Math.PI - 0.5, 12);
  });

  it('places the horizon point below a star at its azimuth', () => {
    const below = horizonPointBelow([0.6, 0.6, 0.5291502622129181]);
    expect(below[2]).toBe(0);
    expect(Math.hypot(below[0], below[1])).toBeCloseTo(1, 12);
  });

  it('builds great-circle guide arcs that stay on the unit sphere', () => {
    const points = greatCirclePoints([1, 0, 0], [0, 1, 0], 8);
    expect(points).toHaveLength(9);
    for (const p of points) expect(Math.hypot(...p)).toBeCloseTo(1, 12);
  });
});

describe('raycasting', () => {
  it('hits the star placed in the view direction', () => {
    const scene = new Scene();
    const target = new Mesh(new SphereGeometry(1.5), new MeshBasicMaterial());
    target.position.set(...enuToScene([0, 0.999, 0.0447]));
    target.name = 'target';
    const decoy = new Mesh(new SphereGeometry(1.5), new MeshBasicMaterial());
    decoy.position.set(...enuToScene([1, 0, 0]));
    decoy.name = 'decoy';
    scene.add(target, decoy);
    scene.updateMatrixWorld(true);
    const raycaster = new Raycaster(
      new Vector3(0, 0, 0),
      new Vector3(...viewDirection(0, 0.0447)).normalize(),
      0,
      SKY_RADIUS * 2,
    );
    const hits = raycaster.intersectObjects(scene.children);
    expect(hits[0]?.object.name).toBe('target');
  });
});

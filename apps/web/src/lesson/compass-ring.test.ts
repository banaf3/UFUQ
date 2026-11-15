import { describe, expect, it } from 'vitest';

import { altAz } from '../sky/projection.js';
import { compassRingLayers } from './compass-ring.js';

const DEG = Math.PI / 180;

describe('the compass ring on the horizon', () => {
  it('draws the ring, 36 ticks and 12 numbers counted from True North', () => {
    const { lines, labels } = compassRingLayers({
      headingAzimuth: null,
      qiblaAzimuth: null,
      numbered: true,
    });
    expect(lines).toHaveLength(1 + 36);
    expect(labels.map((l) => l.text)).toEqual(Array.from({ length: 12 }, (_, i) => `${i * 30}`));
    // The "0" sits at True North, just above the horizon.
    const north = labels[0] as { direction: readonly [number, number, number] };
    expect(altAz(north.direction).azimuth).toBeCloseTo(0, 9);
    expect(altAz(north.direction).altitude).toBeGreaterThan(0);
  });

  it('marks the facing bearing and the Qibla when given', () => {
    const { lines, labels } = compassRingLayers({
      headingAzimuth: 123.4 * DEG,
      qiblaAzimuth: 292.12 * DEG,
      numbered: true,
    });
    expect(labels.find((l) => l.text === 'You face 123°')).toBeDefined();
    const qibla = labels.find((l) => l.text === 'القبلة');
    expect(qibla?.secondary).toBe('Qibla 292°');
    expect(lines).toHaveLength(1 + 36 + 2);
  });

  it('draws ticks and the marker without any degree text when not numbered', () => {
    const { lines, labels } = compassRingLayers({
      headingAzimuth: 1,
      qiblaAzimuth: null,
      numbered: false,
    });
    expect(lines).toHaveLength(1 + 36 + 1);
    expect(labels).toEqual([]);
  });

  it('wraps 360 to 0 in the readout', () => {
    const { labels } = compassRingLayers({
      headingAzimuth: 2 * Math.PI - 1e-9,
      qiblaAzimuth: null,
      numbered: true,
    });
    expect(labels.at(-1)?.text).toBe('You face 0°');
  });
});

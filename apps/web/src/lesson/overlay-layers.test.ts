import { describe, expect, it } from 'vitest';

import type { SkyOverlayV2 } from '@ufuq/contracts';

import { altAz, type Vec3 } from '../sky/projection.js';
import { guideTexts, overlayLayers } from './overlay-layers.js';

const DEG = Math.PI / 180;
const stars: Record<string, Vec3> = {
  a: [0, 1, 0],
  b: [Math.sin(10 * DEG), Math.cos(10 * DEG), 0],
  c: [0, Math.cos(30 * DEG), Math.sin(30 * DEG)],
};
const enuOf = (handle: string) => stars[handle];

describe('issued overlays on the lesson sky', () => {
  it('draws figure lines without any name (lines-only support)', () => {
    const layers = overlayLayers([{ kind: 'FIGURE_LINES', segments: [['a', 'b']] }], enuOf);
    expect(layers.lines).toHaveLength(1);
    expect(layers.labels).toEqual([]);
  });

  it('names figures and the guidance target only when names are issued', () => {
    const names: SkyOverlayV2 = {
      kind: 'FIGURE_NAMES',
      figures: [
        {
          memberHandles: ['a', 'b'],
          arabic: 'ذات الكرسي',
          transliteration: 'Dhat al-Kursi',
          child: false,
        },
      ],
      stars: [{ handle: 'c', arabic: 'الجدي', transliteration: 'Al-Jady', guidanceTarget: true }],
    };
    const layers = overlayLayers([names], enuOf);
    expect(layers.labels.map((l) => l.secondary)).toEqual(['Dhat al-Kursi', 'Al-Jady']);
    expect(layers.labels[1]?.font).toMatch(/^700 /); // al-Jady in bold
  });

  it('draws the Qibla turn the short way, west of north, and labels its bearing', () => {
    const qibla = 292.12 * DEG;
    const layers = overlayLayers(
      [
        {
          kind: 'HORIZON_ARC',
          relationshipId: 'guide-north-to-qibla',
          fromAzimuthRadians: 0,
          toAzimuthRadians: qibla,
          label: 'Qibla 292° 07′',
          explanation: 'Turn from True North.',
        },
      ],
      enuOf,
    );
    const azimuths = (layers.lines[0]?.points ?? []).map((p) => altAz(p).azimuth);
    const span = (360 - 292.12) * DEG;
    // Every point lies between the Qibla bearing and north, through north-west.
    for (const azimuth of azimuths) {
      const fromQibla = (((azimuth - qibla) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(fromQibla).toBeLessThanOrEqual(span + 1e-9);
    }
    expect(layers.labels[0]?.secondary).toBe('Qibla 292° 07′');
    expect(guideTexts([{ kind: 'FIGURE_LINES', segments: [] }])).toEqual([]);
  });

  it('times progressive drawing only when asked', () => {
    const timed = overlayLayers([{ kind: 'FIGURE_LINES', segments: [['a', 'b']] }], enuOf, {
      drawFrom: 1000,
      drawMs: 500,
    });
    expect(timed.lines[0]).toMatchObject({ drawFrom: 1000, drawMs: 500 });
    const still = overlayLayers([{ kind: 'FIGURE_LINES', segments: [['a', 'b']] }], enuOf);
    expect(still.lines[0]?.drawFrom).toBeUndefined();
  });
});

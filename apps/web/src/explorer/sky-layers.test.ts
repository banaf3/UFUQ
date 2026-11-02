import { describe, expect, it } from 'vitest';

import type { SkyViewV1 } from '@ufuq/contracts';

import { nameFovLimit, skyLayers, skyStars, starDetails, starNameShown } from './sky-layers.js';

const DEG = Math.PI / 180;

const sky: SkyViewV1 = {
  contractVersion: 'sky.v1',
  datasetId: 'synthetic-technical',
  executionScope: 'SYNTHETIC_TECHNICAL_FIXTURE',
  utc: '2026-11-15T13:00:00Z',
  scenarioId: null,
  observer: { label: 'test', latitudeDegrees: 3.5, longitudeDegrees: 103.4 },
  stars: {
    count: 3,
    ids: ['hip-1', 'hip-2', 'route-star'],
    enu: [0, 1, 0, 0.1, 0.99, 0.1, 0, 0.9, 0.43],
    visualMagnitudes: [0.5, 3.0, 2.0],
    colorIndices: [0.6, null, 1.2],
  },
  cultures: [
    {
      cultureId: 'arabic-ufuq',
      title: 'Arabic star patterns (UFUQ curated)',
      layer: 'OLD_ARABIAN',
      reviewState: 'REVIEW_REQUIRED',
      attribution: 'test',
      figures: [
        {
          figureId: 'pattern',
          name: 'al-Test',
          labels: [
            {
              languageTag: 'ar',
              script: 'اختبار',
              transliteration: 'al-Test',
              gloss: null,
              layer: 'OLD_ARABIAN',
            },
          ],
          segments: [[0, 2]],
          memberIndices: [0, 2],
        },
      ],
    },
    {
      cultureId: 'iau-modern',
      title: 'Modern IAU constellations',
      layer: 'MODERN_ASTRONOMICAL',
      reviewState: 'REVIEW_REQUIRED',
      attribution: 'test',
      figures: [
        {
          figureId: 'iau-Tst',
          name: 'Testa',
          labels: [],
          segments: [
            [0, 1],
            [1, 2],
          ],
          memberIndices: [0, 1, 2],
        },
      ],
    },
  ],
  starNames: [
    {
      starIndex: 0,
      name: 'Alfa',
      designation: 'a Tst',
      language: 'Arabic',
      arabicScript: 'ألف',
      origin: 'test',
    },
    {
      starIndex: 1,
      name: 'Beta',
      designation: 'b Tst',
      language: 'Chinese',
      arabicScript: null,
      origin: 'test',
    },
  ],
  provenance: {
    profileId: 'test',
    displayPolicyId: 'SKY_DISPLAY_POLICY_V1',
    scientificValidationState: 'GEOMETRIC_RESULT_PENDING_VALIDATION',
    artifacts: [],
    omittedStarCount: 0,
    notices: [],
    attributions: [],
  },
};

describe('sky layers', () => {
  const stars = skyStars(sky);

  it('unpacks the compact star arrays', () => {
    expect(stars).toHaveLength(3);
    expect(stars[1]).toEqual({ enu: [0.1, 0.99, 0.1], magnitude: 3, colorIndexBV: null });
  });

  it('draws both cultures by default and filters by culture', () => {
    const both = skyLayers(sky, stars, {
      mode: 'ARABIC_AND_IAU',
      showLines: true,
      showNames: true,
    });
    expect(both.lines).toHaveLength(3);
    const arabic = skyLayers(sky, stars, { mode: 'ARABIC', showLines: true, showNames: true });
    expect(arabic.lines).toHaveLength(1);
    expect(arabic.labels.map((label) => label.text)).toEqual(['اختبار', 'Alfa']);
    const iau = skyLayers(sky, stars, { mode: 'IAU', showLines: true, showNames: true });
    expect(iau.lines).toHaveLength(2);
    expect(iau.labels.map((label) => label.text).sort()).toEqual(['Alfa', 'Beta', 'TESTA']);
  });

  it('hides lines and names independently', () => {
    const noLines = skyLayers(sky, stars, {
      mode: 'ARABIC_AND_IAU',
      showLines: false,
      showNames: true,
    });
    expect(noLines.lines).toHaveLength(0);
    expect(noLines.labels.length).toBeGreaterThan(0);
    const noNames = skyLayers(sky, stars, {
      mode: 'ARABIC_AND_IAU',
      showLines: true,
      showNames: false,
    });
    expect(noNames.labels).toHaveLength(0);
    expect(noNames.lines.length).toBeGreaterThan(0);
  });

  it('keeps Arabic-origin names in Arabic views and shows a script line', () => {
    expect(starNameShown('Arabic', 4, 'ARABIC')).toBe(true);
    expect(starNameShown('Chinese', 0.5, 'ARABIC')).toBe(false);
    expect(starNameShown('Latin', 0.5, 'ARABIC_AND_IAU')).toBe(true);
    expect(starNameShown('Chinese', 3, 'ARABIC_AND_IAU')).toBe(false);
    expect(starNameShown('Chinese', 3, 'IAU')).toBe(true);
    const labels = skyLayers(sky, stars, {
      mode: 'ARABIC',
      showLines: false,
      showNames: true,
    }).labels;
    expect(labels.find((label) => label.text === 'Alfa')?.secondary).toBe('ألف');
  });

  it('reveals fainter star names as the view narrows', () => {
    expect(nameFovLimit(1.0)).toBe(360 * DEG);
    expect(nameFovLimit(4.0)).toBeCloseTo(60 * DEG, 10);
    expect(nameFovLimit(6.5)).toBeCloseTo(30 * DEG, 10);
  });

  it('collects the facts of a picked star', () => {
    const details = starDetails(sky, 0);
    expect(details.hip).toBe('1');
    expect(details.names.map((name) => name.name)).toEqual(['Alfa']);
    expect(details.figures.map((figure) => figure.name)).toEqual(['al-Test', 'Testa']);
  });
});

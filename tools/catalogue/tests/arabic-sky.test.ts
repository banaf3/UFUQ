import { describe, expect, it } from 'vitest';

import {
  type ArabicSkyCuration,
  buildArabicSkyCulture,
  type CuratedFigure,
  type FieldStarPosition,
  LINE_RULE_ID,
  lineSegments,
  plainTransliteration,
  validateArabicSkyCuration,
} from '../src/generate/arabic-sky.js';

const DEG = Math.PI / 180;
const source = { sourceId: 'SYNTHETIC', locator: 'test' };
const base = {
  vocalization: 'FROM_SOURCE_FORM' as const,
  alternativeNames: [],
  evidence: 'PRIMARY_TEXT_READ' as const,
  attestation: [],
  notes: [{ text: 'note', ...source }],
  conflicts: [],
  compilationEntry: 'TEST',
  about: 'A plain card text.',
  aboutSources: [source],
};
const figure = (
  figureId: string,
  hips: number[],
  extra: Partial<CuratedFigure> = {},
): CuratedFigure => ({
  ...base,
  figureId,
  arabic: 'نجم',
  transliteration: 'Najm',
  style: 'FIGURE' as const,
  members: hips.map((hip) => ({ hip, designation: `HIP ${hip}` })),
  membershipCitations: [source],
  lines: [hips],
  ...extra,
});
const field: FieldStarPosition[] = [1, 2, 3, 4, 11, 12, 13, 14].map((hip) => ({
  hip,
  raRad: hip * DEG,
  decRad: 0,
}));
const curation = (figures: ArabicSkyCuration['figures'], stars: ArabicSkyCuration['stars'] = []) =>
  ({
    curationType: 'UFUQ_ARABIC_SKY_CULTURE_CURATION',
    schemaVersion: 2,
    cultureId: 'test',
    title: 'test',
    layer: 'OLD_ARABIAN',
    note: 'test',
    transliteration: { system: 'test' },
    lineRule: { ruleId: LINE_RULE_ID, layer: 'MODERN_COMPILATION', description: 'test' },
    sources: [{ sourceId: 'SYNTHETIC', role: 'test' }],
    figures,
    stars,
    guidanceTarget: null,
    relationships: [],
    review: { state: 'REVIEW_REQUIRED' },
  }) satisfies ArabicSkyCuration;
const build = (c: ArabicSkyCuration) =>
  buildArabicSkyCulture(c, field, { artifactId: 'field', payloadSha256: 'f' }, 'c');

describe('compilation lines, reproduced unmodified', () => {
  const all = () => true;

  it('reads each polyline as its consecutive pairs, in order', () => {
    expect(
      lineSegments(
        [
          [1, 2, 3],
          [3, 4],
        ],
        all,
      ).segments,
    ).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it('draws nothing for one-star markers and keeps a repeated pair once', () => {
    expect(
      lineSegments(
        [
          [5, 5],
          [1, 2],
          [2, 1],
        ],
        all,
      ).segments,
    ).toEqual([[1, 2]]);
  });

  it('closes a ring only when the compilation closes it', () => {
    expect(lineSegments([[11, 12, 13, 14, 11]], all).segments).toHaveLength(4);
    expect(lineSegments([[11, 12, 13, 14]], all).segments).toHaveLength(3);
  });

  it('reports pairs with a star outside the field instead of re-routing them', () => {
    const inField = (hip: number) => hip !== 99;
    expect(lineSegments([[1, 99, 2]], inField)).toEqual({
      segments: [],
      omitted: [
        [1, 99],
        [99, 2],
      ],
    });
  });
});

describe('plain transliteration (UFUQ_PLAIN_V1)', () => {
  it.each([
    ['al-Jady', 'Al-Jady'],
    ['Banāt Naʿsh al-Kubrā', "Banat Na'sh al-Kubra"],
    ['al-Shiʿrā al-ʿAbūr', "Al-Shi'ra al-Abur"],
    ['al-Jawzāʾ', 'Al-Jawza'],
    ['Saʿd Bulaʿ', "Sa'd Bula"],
    ['al-Ẓalīmān', 'Al-Zaliman'],
    ['Faʾs al-Raḥā', 'Fas al-Raha'],
    ['al-Fargh al-Muʾakhkhar', 'Al-Fargh al-Muakhkhar'],
  ])('%s -> %s', (ijmes, plain) => {
    expect(plainTransliteration(ijmes)).toBe(plain);
  });
});

describe('Arabic sky culture payload', () => {
  it('finds the parent figure and keeps each figure to its own lines', () => {
    const payload = build(
      curation([
        figure('anwa-big', [1, 2, 3, 4]),
        figure('anwa-small', [1, 3], { lines: [[1, 3]] }),
      ]),
    );
    const small = payload.figures.find((f) => f.figureId === 'anwa-small');
    const big = payload.figures.find((f) => f.figureId === 'anwa-big');
    expect(small?.parentId).toBe('anwa-big');
    expect(big?.parentId).toBeNull();
    expect(big?.segments).not.toContainEqual([1, 3]);
    expect(small?.segments).toEqual([[1, 3]]);
  });

  it('records members outside the field and skips figures left with one star', () => {
    const payload = build(curation([figure('anwa-a', [1, 2, 99]), figure('anwa-b', [3, 98])]));
    expect(payload.figures.map((f) => f.figureId)).toEqual(['anwa-a']);
    expect(payload.figures[0]?.omittedMembersNotInField).toEqual([99]);
    expect(payload.figures[0]?.omittedSegmentsNotInField).toEqual([[2, 99]]);
    expect(payload.singleMemberFiguresNotDrawn).toEqual(['anwa-b']);
  });

  it('labels only unique star names that are not their own figure name', () => {
    const star = (hip: number, arabic: string) => ({
      ...base,
      hip,
      arabic,
      transliteration: 'Najm',
      designation: `HIP ${hip}`,
    });
    const payload = build(
      curation(
        [figure('anwa-pair', [1, 2], { arabic: 'الفرقدان' })],
        [star(1, 'الفرقدان'), star(2, 'الفرقدان'), star(3, 'القلب'), star(4, 'نجم')],
      ),
    );
    const label = new Map(payload.stars.map((s) => [s.hip, s.labelOnSky]));
    expect(label.get(1)).toBe(false); // shared pair name
    expect(label.get(3)).toBe(true);
    expect(label.get(4)).toBe(true);
  });

  it('shows plain transliterations and keeps the scholarly form', () => {
    const payload = build(curation([figure('anwa-a', [1, 2], { transliteration: 'al-Ḥūt' })]));
    expect(payload.figures[0]?.transliteration).toBe('Al-Hut');
    expect(payload.figures[0]?.transliterationScholarly).toBe('al-Ḥūt');
  });
});

describe('curation validation (structure only, never cultural approval)', () => {
  it('accepts a well-formed record', () => {
    expect(validateArabicSkyCuration(curation([figure('anwa-a', [1, 2])]))).toEqual([]);
  });

  it('rejects Latin script, missing citations, unknown sources and self-approval', () => {
    const bad = curation([
      figure('anwa-a', [1, 2], { arabic: 'Najm' }),
      figure('anwa-b', [1, 2], { membershipCitations: [] }),
      figure('anwa-c', [1, 2], { notes: [{ text: 'x', sourceId: 'NOPE', locator: 'y' }] }),
    ]);
    const errors = validateArabicSkyCuration({
      ...bad,
      review: { state: 'APPROVED', reviewer: null },
    });
    expect(errors).toEqual(
      expect.arrayContaining([
        'figure anwa-a: arabic must be Arabic script.',
        'figure anwa-b: membership uncited.',
        'figure anwa-c: unknown source NOPE.',
        'An APPROVED curation needs a named reviewer.',
      ]),
    );
  });

  it('rejects card text with diacritics or without sources', () => {
    const errors = validateArabicSkyCuration(
      curation([
        figure('anwa-a', [1, 2], { about: 'al-Ḥūt is a fish.' }),
        figure('anwa-b', [1, 2], { aboutSources: [] }),
      ]),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        'figure anwa-a: about must be plain ASCII text.',
        'figure anwa-b: about uncited.',
      ]),
    );
  });

  it('rejects a line through a non-member and any other line rule', () => {
    expect(
      validateArabicSkyCuration(curation([figure('anwa-a', [1, 2], { lines: [[1, 2, 3]] })])),
    ).toContain('figure anwa-a: a line joins a star that is not a member.');
    const errors = validateArabicSkyCuration({
      ...curation([figure('anwa-a', [1, 2])]),
      lineRule: { ruleId: 'UFUQ_TREE_V1', layer: 'x', description: 'x' },
    });
    expect(errors).toContain(`lineRule must be ${LINE_RULE_ID}.`);
  });

  it('checks the guidance target: a curated star with a cited statement', () => {
    const star = { ...base, hip: 1, arabic: 'نجم', transliteration: 'Najm', designation: 'HIP 1' };
    const withTarget = (hip: number, sourceId = 'SYNTHETIC'): ArabicSkyCuration => ({
      ...curation([figure('anwa-a', [1, 2])], [star]),
      guidanceTarget: { hip, statement: 'Leads the way.', sourceId, locator: 'test' },
    });
    expect(validateArabicSkyCuration(withTarget(1))).toEqual([]);
    expect(build(withTarget(1)).guidanceTarget?.hip).toBe(1);
    expect(validateArabicSkyCuration(withTarget(2))).toContain(
      'guidanceTarget: HIP 2 is not a curated star.',
    );
    expect(validateArabicSkyCuration(withTarget(1, 'NOPE'))).toContain(
      'guidanceTarget: unknown source NOPE.',
    );
  });
});

import { describe, expect, it } from 'vitest';

import {
  type ArabicSkyCuration,
  buildArabicSkyCulture,
  type CuratedFigure,
  type FieldStarPosition,
  treeSegments,
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
};
const figure = (figureId: string, hips: number[], extra: Partial<CuratedFigure> = {}) => ({
  ...base,
  figureId,
  arabic: 'نجم',
  transliteration: 'Najm',
  style: 'FIGURE' as const,
  shape: 'TREE' as const,
  members: hips.map((hip) => ({ hip, designation: `HIP ${hip}` })),
  membershipCitations: [source],
  ...extra,
});
// Stars on the equator 1 degree apart, plus a square of four stars further along.
const field: FieldStarPosition[] = [
  { hip: 1, raRad: 0, decRad: 0 },
  { hip: 2, raRad: 1 * DEG, decRad: 0 },
  { hip: 3, raRad: 2 * DEG, decRad: 0 },
  { hip: 4, raRad: 3.5 * DEG, decRad: 0 },
  { hip: 11, raRad: 20 * DEG, decRad: 0 },
  { hip: 12, raRad: 22 * DEG, decRad: 0 },
  { hip: 13, raRad: 22 * DEG, decRad: 2 * DEG },
  { hip: 14, raRad: 20 * DEG, decRad: 2 * DEG },
];
const curation = (figures: ArabicSkyCuration['figures'], stars: ArabicSkyCuration['stars'] = []) =>
  ({
    curationType: 'UFUQ_ARABIC_SKY_CULTURE_CURATION',
    schemaVersion: 1,
    cultureId: 'test',
    title: 'test',
    layer: 'OLD_ARABIAN',
    note: 'test',
    transliteration: { system: 'test' },
    lineRule: { ruleId: 'UFUQ_TREE_V1', layer: 'MODERN_PEDAGOGICAL', description: 'test' },
    sources: [{ sourceId: 'SYNTHETIC', role: 'test' }],
    figures,
    stars,
    relationships: [],
    review: { state: 'REVIEW_REQUIRED' },
  }) satisfies ArabicSkyCuration;
const build = (c: ArabicSkyCuration) =>
  buildArabicSkyCulture(c, field, { artifactId: 'field', payloadSha256: 'f' }, 'c');

describe('UFUQ_TREE_V1 figure lines', () => {
  const position = new Map(
    field.map((s) => [
      s.hip,
      [
        Math.cos(s.decRad) * Math.cos(s.raRad),
        Math.cos(s.decRad) * Math.sin(s.raRad),
        Math.sin(s.decRad),
      ] as [number, number, number],
    ]),
  );

  it('joins members by the shortest spanning tree', () => {
    expect(treeSegments([1, 2, 3, 4], position, [], false)).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });

  it('keeps seeded segments of a smaller figure', () => {
    expect(treeSegments([1, 2, 3], position, [[1, 3]], false)).toEqual([
      [1, 2],
      [1, 3],
    ]);
  });

  it('closes a RING figure whose tree is a simple path (a square)', () => {
    const segments = treeSegments([11, 12, 13, 14], position, [], true);
    expect(segments).toHaveLength(4);
    const degrees = new Map<number, number>();
    for (const [a, b] of segments) {
      degrees.set(a, (degrees.get(a) ?? 0) + 1);
      degrees.set(b, (degrees.get(b) ?? 0) + 1);
    }
    expect([...degrees.values()]).toEqual([2, 2, 2, 2]);
  });
});

describe('Arabic sky culture payload', () => {
  it('finds the parent figure and reuses its child segments', () => {
    const payload = build(
      curation([figure('anwa-big', [1, 2, 3, 4]), figure('anwa-small', [1, 3])]),
    );
    const small = payload.figures.find((f) => f.figureId === 'anwa-small');
    const big = payload.figures.find((f) => f.figureId === 'anwa-big');
    expect(small?.parentId).toBe('anwa-big');
    expect(big?.parentId).toBeNull();
    expect(big?.segments).toContainEqual([1, 3]);
  });

  it('records members outside the field and skips figures left with one star', () => {
    const payload = build(curation([figure('anwa-a', [1, 2, 99]), figure('anwa-b', [3, 98])]));
    expect(payload.figures.map((f) => f.figureId)).toEqual(['anwa-a']);
    expect(payload.figures[0]?.omittedMembersNotInField).toEqual([99]);
    expect(payload.singleMemberFiguresNotDrawn).toEqual(['anwa-b']);
  });

  it('labels only unique star names that are not their own figure name', () => {
    const star = (hip: number, arabic: string) => ({
      ...base,
      hip,
      arabic,
      transliteration: arabic,
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

  it('rejects any line rule other than UFUQ_TREE_V1', () => {
    const errors = validateArabicSkyCuration({
      ...curation([figure('anwa-a', [1, 2])]),
      lineRule: { ruleId: 'COPIED_LINES', layer: 'x', description: 'x' },
    });
    expect(errors).toContain('lineRule must be UFUQ_TREE_V1.');
  });
});

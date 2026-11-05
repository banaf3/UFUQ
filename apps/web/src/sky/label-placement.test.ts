import { describe, expect, it } from 'vitest';

import { LABEL_FADE_MS, type LabelState, placeLabels } from './label-placement.js';
import type { Vec3 } from './projection.js';
import type { SkyLabel } from './sky-types.js';

// A flat test screen: the direction's first two numbers are its screen position.
const toScreen = (d: Vec3) => [d[0], d[1]] as const;
const measure = (_font: string, text: string) => text.length * 8;
const frame = 1 / 60;

const label = (id: string, x: number, y: number, priority: number): SkyLabel => ({
  id,
  direction: [x, y, 1],
  text: id,
  color: 'white',
  font: '500 16px Test',
  priority,
  offset: 22,
});

function place(labels: readonly SkyLabel[], states: Map<string, LabelState>, dt = frame, fov = 1) {
  return placeLabels({ labels, fov, width: 800, height: 600, toScreen, measure, states, dt });
}
const yOf = (result: ReturnType<typeof place>, id: string) =>
  result.drawn.find((d) => d.label.id === id && d.opacity > 0 && d.opacity === 1)?.y;

describe('steady label placement', () => {
  it('shows every label at once on the first frame, above its anchor', () => {
    const states = new Map<string, LabelState>();
    const result = place([label('a', 100, 100, 0)], states);
    expect(result.drawn).toHaveLength(1);
    expect(result.drawn[0]).toMatchObject({ x: 100, y: 78, opacity: 1 });
    expect(result.fading).toBe(false);
    expect(result.hits.map((h) => h.id)).toEqual(['a']);
  });

  it('moves a colliding label across its anchor instead of hiding it', () => {
    const states = new Map<string, LabelState>();
    const result = place([label('first', 100, 100, 0), label('second', 100, 104, 1)], states);
    expect(yOf(result, 'first')).toBe(78);
    expect(yOf(result, 'second')).toBeGreaterThan(104); // below its own anchor
  });

  it('keeps every name where it is when a selection ranks one first', () => {
    const states = new Map<string, LabelState>();
    const before = place([label('big', 100, 100, 0), label('small', 100, 104, 1)], states);
    const bigY = yOf(before, 'big');
    const smallY = yOf(before, 'small');
    // Selecting "small" ranks it first; both places still fit, so neither name moves.
    const after = place([label('big', 100, 100, 0), label('small', 100, 104, -1)], states);
    expect(yOf(after, 'big')).toBe(bigY);
    expect(yOf(after, 'small')).toBe(smallY);
    expect(after.fading).toBe(false);
  });

  it('does not flip a label back when the label that pushed it leaves', () => {
    const states = new Map<string, LabelState>();
    place([label('first', 100, 100, 0), label('second', 100, 104, 1)], states);
    const alone = place([label('second', 100, 104, 1)], states);
    expect(yOf(alone, 'second')).toBeGreaterThan(104);
  });

  it('fades a newly placed label in over the fade time, asking for frames meanwhile', () => {
    const states = new Map<string, LabelState>();
    const near = label('star', 100, 100, 2);
    place([{ ...near, maxFov: 0.5 }], states, frame, 1); // hidden: the view is too wide
    const step = place([{ ...near, maxFov: 0.5 }], states, 0.1, 0.4); // zoomed in
    expect(step.drawn[0]?.opacity).toBeCloseTo(100 / LABEL_FADE_MS, 10);
    expect(step.fading).toBe(true);
    let result = step;
    for (let i = 0; i < 10; i += 1) result = place([{ ...near, maxFov: 0.5 }], states, 0.1, 0.4);
    expect(result.drawn[0]?.opacity).toBe(1);
    expect(result.fading).toBe(false);
  });

  it('fades a hidden label out where it was, without making it clickable', () => {
    const states = new Map<string, LabelState>();
    const near = { ...label('star', 100, 100, 2), maxFov: 0.5 };
    place([near], states, frame, 0.4);
    const out = place([near], states, 0.1, 1); // zoomed out past its limit
    expect(out.drawn[0]).toMatchObject({ y: 78 });
    expect(out.drawn[0]?.opacity).toBeCloseTo(1 - 100 / LABEL_FADE_MS, 10);
    expect(out.hits).toEqual([]);
    expect(out.fading).toBe(true);
  });

  it('cross-fades a label that must move: out at the old place, in at the new one', () => {
    const states = new Map<string, LabelState>();
    place([label('mover', 100, 100, 1)], states);
    // A higher-ranked label now takes the place above the mover's anchor.
    const result = place([label('mover', 100, 100, 1), label('blocker', 100, 96, 0)], states);
    const mover = result.drawn.filter((d) => d.label.id === 'mover');
    expect(mover).toHaveLength(2);
    const [entering, leaving] = [...mover].sort((a, b) => a.opacity - b.opacity);
    expect(entering?.y).toBeGreaterThan(100);
    expect(leaving?.y).toBe(78);
    expect(result.fading).toBe(true);
  });

  it('centres a figure name on the middle of its stars, then tries the usual places', () => {
    const states = new Map<string, LabelState>();
    const middle = { ...label('fig', 300, 300, 1), centred: true };
    const alone = place([middle], states);
    // One line of 16 px text: centred, its middle sits on the anchor.
    expect(alone.drawn[0]).toMatchObject({ x: 300, y: 300 });
    const taken = place([middle, { ...label('first', 300, 300, 0), offset: 0 }], new Map());
    expect(taken.drawn.find((d) => d.label.id === 'fig')).toMatchObject({ x: 300, y: 278 });
  });

  it('keeps names clear of the compass letters', () => {
    const states = new Map<string, LabelState>();
    const star = { ...label('jady', 400, 300, 0), offset: -14 }; // named below the star
    const result = placeLabels({
      labels: [star],
      fov: 1,
      width: 800,
      height: 600,
      toScreen,
      measure,
      states,
      dt: frame,
      obstacles: [[390, 305, 410, 325]], // the "N" just under it
    });
    expect(result.drawn[0]?.y).toBeLessThan(300); // moved above the star
  });

  it('lets a name scroll off the screen instead of hopping to a place still on it', () => {
    const states = new Map<string, LabelState>();
    place([label('edge', 700, 100, 0)], states);
    // Its place above the anchor is now past the right edge, while the place left of the
    // anchor would still be on the screen: the name leaves with the sky.
    const leaving = place([label('edge', 830, 100, 0)], states);
    expect(leaving.drawn).toEqual([]);
    expect(leaving.hits).toEqual([]);
    // Coming back, it is at the same place (above its anchor), fully shown.
    const back = place([label('edge', 700, 100, 0)], states);
    expect(back.drawn[0]).toMatchObject({ x: 700, y: 78, opacity: 1 });
  });

  it('shows a label coming in from off the screen at once', () => {
    const states = new Map<string, LabelState>();
    place([label('edge', -400, 100, 0), label('anchor', 400, 300, 0)], states);
    const result = place([label('edge', 100, 100, 0), label('anchor', 400, 300, 0)], states);
    expect(result.drawn.find((d) => d.label.id === 'edge')?.opacity).toBe(1);
  });

  it('tries the alternative anchors when every place around the first is taken', () => {
    const states = new Map<string, LabelState>();
    const blockers = [0, 1, 2, 3, 4].map((i) => ({
      ...label(`b${i}`, 100, 100, 0),
      direction: [100, 100, 1] as Vec3,
      text: 'x'.repeat(40),
      offset: [22, -22, 0, 0, 0][i] ?? 0,
    }));
    const moving = { ...label('fig', 100, 100, 1), alternatives: [[500, 400, 1] as Vec3] };
    const result = place([...blockers, moving], states);
    expect(result.drawn.find((d) => d.label.id === 'fig')).toMatchObject({ x: 500, y: 378 });
  });
});

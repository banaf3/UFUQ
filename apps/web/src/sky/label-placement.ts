/**
 * Places the sky's name labels each frame without collisions, and keeps them steady.
 *
 * Steadiness follows MapLibre GL JS's symbol placement (`src/symbol/placement.ts`):
 * - a label first tries the place it had in the previous frame, and searches for another
 *   only when that place is taken or off the screen;
 * - labels fade in and out instead of popping, and a label that has to move fades out at
 *   its old place while it fades in at the new one (MapLibre's `fadeDuration`, 300 ms);
 * - labels entering from outside the screen, and every label on the first frame, appear
 *   at once.
 * Two further steadying rules are UFUQ's:
 * - a kept place may overlap another label by up to 8 px (Stellarium Web Engine's label
 *   `max_overlap`), so names sliding past each other do not flip;
 * - a name whose place leaves the screen scrolls away with the sky and comes back to the
 *   same place, instead of hopping to a place still on the screen.
 * So choosing a figure, which ranks its name first, moves no name that still fits, and a
 * name moves only when another name really takes its place.
 *
 * The places around an anchor are: the label's offset (above a figure, below a star), the
 * mirror place across the anchor, then right and left of it; then the same around each
 * alternative anchor. Pure: the canvas passes in projection and text measurement.
 */
import type { Vec3 } from './projection.js';
import { fontPixels, type SkyLabel } from './sky-types.js';

/** MapLibre GL JS's default label fade (`fadeDuration`, milliseconds). */
export const LABEL_FADE_MS = 300;
/** Pixels between an anchor (a star or a point of a figure) and a label placed beside it. */
const SIDE_GAP = 12;
/** Empty pixels kept left and right of a label, so two names never read as one phrase. */
const PADDING = 8;
/** The secondary line's font when a label does not give one. */
export const SECONDARY_FONT = '11px Inter, ui-sans-serif, system-ui, sans-serif';

export type Box = [number, number, number, number];

/** What the placement remembers about one label between frames. */
export interface LabelState {
  /** Anchor index (0 is `direction`, then the alternatives) and place index around it. */
  anchor: number;
  spot: number;
  placed: boolean;
  opacity: number;
  /** Whether the label's own anchor was on the screen. */
  onScreen: boolean;
  /** The old place of a label that moved, fading out. */
  ghost: { anchor: number; spot: number; opacity: number } | null;
}

export interface DrawnLabel {
  readonly label: SkyLabel;
  readonly x: number;
  readonly y: number;
  /** Pixels from the first line's middle to the second line's. */
  readonly gap: number;
  readonly opacity: number;
}

export interface PlacementInput {
  readonly labels: readonly SkyLabel[];
  readonly fov: number;
  readonly width: number;
  readonly height: number;
  readonly toScreen: (direction: Vec3) => readonly [number, number] | null;
  /** The drawn width of the text in the font (CSS px). */
  readonly measure: (font: string, text: string) => number;
  /** Kept between frames by the caller; an empty map is the first frame. */
  readonly states: Map<string, LabelState>;
  /** Seconds since the previous frame. */
  readonly dt: number;
}

export interface PlacementResult {
  readonly drawn: readonly DrawnLabel[];
  readonly hits: readonly { readonly id: string; readonly box: Box }[];
  /** True while some label is still fading: the caller should draw another frame. */
  readonly fading: boolean;
}

/**
 * How far two boxes overlap: the smaller side of their intersection (0 when apart), as
 * Stellarium Web Engine measures it (`test_label_overlaps` in `labels.c`).
 */
const overlap = (a: Box, b: Box) =>
  Math.max(
    0,
    Math.min(
      Math.min(a[2], b[2]) - Math.max(a[0], b[0]),
      Math.min(a[3], b[3]) - Math.max(a[1], b[1]),
    ),
  );
/**
 * A label keeps its place while it overlaps another by at most this many pixels; a new
 * place must be clear. Stellarium Web Engine shows labels overlapping by up to 8 px
 * (`max_overlap`); here it only damps flips while names slide past each other, and the
 * padding keeps the text itself apart.
 */
export const KEEP_OVERLAP = 8;

export function labelKey(label: SkyLabel): string {
  return label.id ?? `${label.text}\n${label.secondary ?? ''}`;
}

export function placeLabels(input: PlacementInput): PlacementResult {
  const { width, height, states } = input;
  const first = states.size === 0;
  const step = (input.dt * 1000) / LABEL_FADE_MS;
  const placedBoxes: Box[] = [];
  const drawn: DrawnLabel[] = [];
  const hits: { id: string; box: Box }[] = [];
  const seen = new Set<string>();
  let fading = false;
  const onScreen = (box: Box) => box[2] >= 0 && box[3] >= 0 && box[0] <= width && box[1] <= height;

  const sorted = [...input.labels].sort((a, b) => a.priority - b.priority);
  for (const label of sorted) {
    const key = labelKey(label);
    seen.add(key);
    const previous = states.get(key);
    const secondaryFont = label.secondaryFont ?? SECONDARY_FONT;
    const size = fontPixels(label.font);
    const secondarySize = label.secondary ? fontPixels(secondaryFont) : 0;
    // The second line sits one half-height of each font below the first.
    const gap = label.secondary ? Math.round((size + secondarySize) / 2) + 1 : 0;
    let textWidth = input.measure(label.font, label.text);
    if (label.secondary)
      textWidth = Math.max(textWidth, input.measure(secondaryFont, label.secondary));
    // The block spans `above` over the first line's middle and `below` under it.
    const above = size * 0.6;
    const below = gap + (label.secondary ? secondarySize : size) * 0.6;
    const half = textWidth / 2 + PADDING;
    const anchors = [label.direction, ...(label.alternatives ?? [])];
    const spotCount = label.offset ? 4 : 1;
    const screens = new Map<number, readonly [number, number] | null>();
    const screenOf = (anchor: number) => {
      if (!screens.has(anchor)) {
        const direction = anchors[anchor];
        screens.set(anchor, direction ? input.toScreen(direction) : null);
      }
      return screens.get(anchor) ?? null;
    };
    /** The text position and box of one place, or null if its anchor is not projected. */
    const at = (anchor: number, spot: number): { x: number; y: number; box: Box } | null => {
      const screen = screenOf(anchor);
      if (!screen) return null;
      const [sx, sy] = screen;
      const preferred = sy - (label.offset ?? 0);
      const middle = sy - (below - above) / 2;
      const beside = textWidth / 2 + SIDE_GAP;
      const [x, y] =
        spot === 0
          ? [sx, preferred]
          : spot === 1
            ? [sx, 2 * sy - preferred - below + above]
            : [spot === 2 ? sx + beside : sx - beside, middle];
      return { x, y, box: [x - half, y - above, x + half, y + below] };
    };
    const free = (anchor: number, spot: number, allowed = 0) => {
      const place = at(anchor, spot);
      return place &&
        onScreen(place.box) &&
        !placedBoxes.some((b) => overlap(place.box, b) > allowed)
        ? place
        : null;
    };

    const anchorScreen = screenOf(0);
    const anchorOnScreen =
      anchorScreen !== null &&
      anchorScreen[0] >= 0 &&
      anchorScreen[0] <= width &&
      anchorScreen[1] >= 0 &&
      anchorScreen[1] <= height;
    const shown = label.maxFov === undefined || input.fov <= label.maxFov;
    let choice: { anchor: number; spot: number; x: number; y: number; box: Box } | null = null;
    // A placed label whose place has left the screen (or gone below the ground) keeps that
    // place and scrolls away with the sky, instead of hopping to a place still on screen.
    let away = false;
    if (shown) {
      // Stay where the label was, if that place is still (nearly) free.
      if (previous && (previous.placed || previous.opacity > 0)) {
        const place = at(previous.anchor, previous.spot);
        if (previous.placed && (!place || !onScreen(place.box))) away = true;
        else {
          const kept = free(previous.anchor, previous.spot, previous.placed ? KEEP_OVERLAP : 0);
          if (kept) choice = { anchor: previous.anchor, spot: previous.spot, ...kept };
        }
      }
      for (let anchor = 0; !choice && !away && anchor < anchors.length; anchor += 1)
        for (let spot = 0; !choice && spot < spotCount; spot += 1) {
          const place = free(anchor, spot);
          if (place) choice = { anchor, spot, ...place };
        }
    }

    // No fade on the first frame, or for a label coming in from outside the screen.
    const instant = first || !previous || (!previous.onScreen && anchorOnScreen);
    const state: LabelState = previous ?? {
      anchor: 0,
      spot: 0,
      placed: false,
      opacity: 0,
      onScreen: anchorOnScreen,
      ghost: null,
    };
    if (choice) {
      const moved = state.placed && (state.anchor !== choice.anchor || state.spot !== choice.spot);
      if (moved && state.opacity > 0)
        state.ghost = { anchor: state.anchor, spot: state.spot, opacity: state.opacity };
      state.opacity = instant ? 1 : moved ? 0 : state.opacity;
      state.opacity = Math.min(1, state.opacity + (instant ? 1 : step));
      state.anchor = choice.anchor;
      state.spot = choice.spot;
      state.placed = true;
      placedBoxes.push(choice.box);
      if (label.id) hits.push({ id: label.id, box: choice.box });
      drawn.push({ label, x: choice.x, y: choice.y, gap, opacity: state.opacity });
    } else if (away) {
      // Off the screen: nothing to draw; it comes back to the same place, fully shown.
      state.opacity = 1;
    } else {
      state.placed = false;
      state.opacity = !anchorOnScreen || first ? 0 : Math.max(0, state.opacity - step);
      // A label that lost its place fades out where it was.
      const place = state.opacity > 0 ? at(state.anchor, state.spot) : null;
      if (place) drawn.push({ label, x: place.x, y: place.y, gap, opacity: state.opacity });
    }
    if (state.ghost) {
      state.ghost.opacity = Math.max(0, state.ghost.opacity - step);
      const place = state.ghost.opacity > 0 ? at(state.ghost.anchor, state.ghost.spot) : null;
      if (place) drawn.push({ label, x: place.x, y: place.y, gap, opacity: state.ghost.opacity });
      if (state.ghost.opacity === 0) state.ghost = null;
    }
    state.onScreen = anchorOnScreen;
    if ((state.opacity > 0 && state.opacity < 1) || state.ghost) fading = true;
    states.set(key, state);
  }
  for (const key of [...states.keys()]) if (!seen.has(key)) states.delete(key);
  return { drawn, hits, fading };
}

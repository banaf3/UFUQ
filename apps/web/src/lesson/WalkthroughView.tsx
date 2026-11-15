import { useEffect, useMemo, useRef, useState } from 'react';

import type { WalkthroughV2 } from '@ufuq/contracts';

import { frameDirections } from '../explorer/sky-layers.js';
import { altAz, greatCircle, meanDirection, type Vec3, type ViewState } from '../sky/projection.js';
import {
  SkyCanvas,
  type SkyCanvasHandle,
  type SkyCanvasStar,
  type SkyLine,
} from '../sky/SkyCanvas.js';
import { LESSON_COLOURS, overlayLayers } from './overlay-layers.js';

const DEG = Math.PI / 180;
const INITIAL_VIEW: ViewState = {
  azimuth: 0,
  altitude: 30 * DEG,
  fov: 100 * DEG,
  projection: 'STEREOGRAPHIC',
};
/** Lines start drawing once the camera has mostly arrived, then take this long. */
const DRAW_DELAY_MS = 700;
const DRAW_MS = 1400;

/**
 * The taught walkthrough (report storyboard figure 3-5): the camera flies from figure to
 * figure (van Wijk and Nuij flights, fly-to.ts), each figure's lines and names are traced
 * as it arrives, earlier figures stay on the sky, and the panel shows the instruction with
 * the cited card text. Nothing here is scored; the assessment follows.
 */
export function WalkthroughView({
  walkthrough,
  starting,
  onStartAssessment,
  onExit,
}: {
  walkthrough: WalkthroughV2;
  starting: boolean;
  onStartAssessment: () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [drawFrom, setDrawFrom] = useState(() => performance.now() + DRAW_DELAY_MS);
  const canvas = useRef<SkyCanvasHandle>(null);
  const frames = walkthrough.frames;
  const frame = frames[index];
  const enuByHandle = useMemo(
    () => new Map(walkthrough.stars.map((star) => [star.handle, star.enu as Vec3])),
    [walkthrough.stars],
  );
  const canvasStars = useMemo<SkyCanvasStar[]>(
    () =>
      walkthrough.stars.map((star) => ({
        enu: star.enu,
        magnitude: star.visualMagnitude ?? 6.5,
        colorIndexBV: star.colorIndexBV,
      })),
    [walkthrough.stars],
  );
  const focusOf = (i: number): Vec3[] => {
    const f = frames[i];
    if (!f) return [];
    return [
      ...f.focusHandles.map((h) => enuByHandle.get(h)).filter((d): d is Vec3 => d !== undefined),
      ...f.focusEnu.map((d) => d as Vec3),
    ];
  };

  // Fly to each frame when it opens; its lines are traced as the camera arrives.
  useEffect(() => {
    // Keep the previous figure in view too, so the learner sees the trace between them.
    const starFrame = (frames[index]?.focusHandles.length ?? 0) > 0;
    const directions =
      starFrame && index > 0 ? [...focusOf(index - 1), ...focusOf(index)] : focusOf(index);
    const target = frameDirections(directions, canvas.current?.getView().fov ?? INITIAL_VIEW.fov);
    if (!target) return;
    const { altitude, azimuth } = altAz(target.centre);
    // Directions on the horizon: look a little above it so the ground and sky both show.
    const onHorizon = frames[index]?.focusHandles.length === 0;
    // The side panel covers the right of the sky: shift the view so the focus sits in the
    // middle of the open part (about a fifth of the field to the left).
    const fov = onHorizon ? Math.max(target.fov, 70 * DEG) : target.fov;
    const shift = (0.2 * fov) / Math.max(Math.cos(altitude), 0.3);
    canvas.current?.flyTo({
      azimuth: azimuth + shift,
      altitude: onHorizon ? Math.max(altitude, 14 * DEG) : altitude,
      fov,
    });
    setDrawFrom(performance.now() + DRAW_DELAY_MS);
    // focusOf reads the frame list, which does not change during a walkthrough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const layers = useMemo(() => {
    const lines: SkyLine[] = [];
    const labels = [];
    // Faint context: every figure line of the sky culture.
    for (const [a, b] of walkthrough.figureLines) {
      const from = enuByHandle.get(a);
      const to = enuByHandle.get(b);
      if (from && to)
        lines.push({
          points: greatCircle(from, to),
          color: 'rgba(78, 116, 196, 0.28)',
          width: 1,
          trim: 6,
        });
    }
    for (let i = 0; i <= index; i += 1) {
      const current = i === index;
      const layer = overlayLayers(
        frames[i]?.overlays ?? [],
        (handle) => enuByHandle.get(handle),
        current ? { drawFrom, drawMs: DRAW_MS } : { past: true },
      );
      lines.push(
        ...layer.lines.map((line) =>
          current || line.color !== LESSON_COLOURS.figureLine
            ? line
            : { ...line, color: LESSON_COLOURS.pastLine },
        ),
      );
      labels.push(...layer.labels);
      // The trace from the previous figure to this one (a UFUQ teaching aid).
      if (i > 0 && (frames[i]?.focusHandles.length ?? 0) > 0) {
        const from = meanDirection(focusOf(i - 1));
        const to = meanDirection(focusOf(i));
        if (from && to)
          lines.push({
            points: greatCircle(from, to),
            color: 'rgba(255, 255, 255, 0.35)',
            width: 1.2,
            dash: [2, 6],
            ...(current ? { drawFrom: drawFrom - DRAW_DELAY_MS, drawMs: DRAW_DELAY_MS + 300 } : {}),
          });
      }
    }
    // A name already on the sky (from an earlier frame) is not drawn twice.
    const seen = new Set<string>();
    const unique = labels.filter((label) => {
      if (seen.has(label.text)) return false;
      seen.add(label.text);
      return true;
    });
    return { lines, labels: unique };
    // focusOf reads the frame list and handles above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, drawFrom, frames, walkthrough.figureLines, enuByHandle]);

  const last = index === frames.length - 1;
  return (
    <div className="lesson walkthrough">
      <div className="sky-stage" tabIndex={0} aria-label="Walkthrough sky view">
        <SkyCanvas
          ref={canvas}
          stars={canvasStars}
          lines={layers.lines}
          labels={layers.labels}
          initialView={INITIAL_VIEW}
          showGround
          showCardinals
          ariaLabel="Walkthrough sky"
        />
      </div>

      <header className="top-bar lesson-bar">
        <span className="brand">UFUQ</span>
        <div className="lesson-title">
          <p className="eyebrow">Learn the route</p>
          <h1>{walkthrough.routeTitle}</h1>
        </div>
        <span className="chip">{walkthrough.scenario.label}</span>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={onExit}>
          Back to the sky
        </button>
      </header>

      <aside className="lesson-panel" aria-live="polite">
        {walkthrough.provenance.executionScope === 'SYNTHETIC_TECHNICAL_FIXTURE' && (
          <div className="notice" role="note">
            {walkthrough.provenance.notices[0]}
          </div>
        )}
        {frame ? (
          <section aria-labelledby="frame-title">
            <p className="eyebrow">
              Step {index + 1} of {frames.length}
            </p>
            <h2 id="frame-title" className="name-title">
              {frame.title.text}
              {frame.title.arabic && (
                <span className="arabic" lang="ar">
                  {' '}
                  {frame.title.arabic}
                </span>
              )}
            </h2>
            <p className="instruction">{frame.instruction}</p>
            {frame.about && <p className="about">{frame.about}</p>}
            {frame.layerNote && <p className="hint">{frame.layerNote}</p>}
            {frame.references.length > 0 && (
              <details className="references">
                <summary>References ({frame.references.length})</summary>
                <ul>
                  {frame.references.map((reference) => (
                    <li key={`${reference.title}-${reference.detail}`}>
                      {reference.title}
                      {reference.detail ? `, ${reference.detail}` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ) : (
          <p>No figure of this route is above the horizon in this scenario.</p>
        )}
        <div className="walkthrough-buttons">
          <button
            type="button"
            className="secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            ← Previous
          </button>
          {!last && frames.length > 0 ? (
            <button
              type="button"
              className="primary"
              onClick={() => setIndex((i) => Math.min(frames.length - 1, i + 1))}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              disabled={starting}
              onClick={onStartAssessment}
            >
              {starting ? 'Preparing…' : 'Start the assessment'}
            </button>
          )}
        </div>
        {!last && (
          <button type="button" className="link" disabled={starting} onClick={onStartAssessment}>
            Skip to the assessment
          </button>
        )}
        {walkthrough.skippedFrameIds.length > 0 && (
          <p className="hint">
            {walkthrough.skippedFrameIds.length} step(s) of this route are below the horizon in this
            scenario and are left out.
          </p>
        )}
      </aside>
    </div>
  );
}

import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

import { POINT_CIRCLE_RADIUS_SHARE } from '@ufuq/contracts';
import type {
  LessonSessionV2,
  LessonStepPromptV2,
  SkyOverlayV2,
  StepAnswerV2,
  StepFeedbackV2,
} from '@ufuq/contracts';

import { ApiError, submitAnswer } from '../api.js';
import { describeEnu, normalizeHeading } from '../scene/mapping.js';
import type { ViewState } from '../sky/projection.js';
import { SkyCanvas, type SkyCanvasHandle, type SkyCanvasStar } from '../sky/SkyCanvas.js';
import { compassRingLayers } from './compass-ring.js';
import { guideTexts, overlayLayers } from './overlay-layers.js';

const DEG = Math.PI / 180;
const STEP = 2 * DEG;
const toDegrees = (radians: number) => radians / DEG;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassPoint = (degrees: number) => COMPASS[Math.round(degrees / 45) % 8];
/** The accessible list holds stars this bright or brighter (the route stars are all brighter). */
const LIST_MAGNITUDE_LIMIT = 3.5;
const INITIAL_VIEW: ViewState = {
  azimuth: 90 * DEG,
  altitude: 12 * DEG,
  fov: 100 * DEG,
  projection: 'STEREOGRAPHIC',
};

/** The report's three presentation levels (storyboard figures 3-5 to 3-7). */
const SUPPORT_TEXT = {
  GUIDED: 'Guided: the figure lines are shown (you are still learning this skill).',
  FADING: 'Lines only: the figure lines are shown without names.',
  INDEPENDENT: 'From memory: no lines and no names.',
} as const;

function supportText(step: LessonStepPromptV2): string {
  if (step.support.mode === 'NON_ADAPTIVE')
    return 'Fixed presentation: adaptive support is not configured yet (BKT-004 pending).';
  const state = step.support.scaffoldState;
  return state ? SUPPORT_TEXT[state] : 'Support level: none.';
}

export function LessonView({ lesson, onExit }: { lesson: LessonSessionV2; onExit: () => void }) {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [step, setStep] = useState(lesson.currentStep);
  const [summary, setSummary] = useState<readonly SkyOverlayV2[]>([]);
  const [feedback, setFeedback] = useState<StepFeedbackV2[]>([]);
  /** The latest result, shown as a card; a correct one waits for Next. */
  const [latest, setLatest] = useState<StepFeedbackV2 | null>(null);
  const [awaiting, setAwaiting] = useState<StepFeedbackV2 | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<SkyCanvasHandle>(null);

  const directionStep = step?.taskKind === 'INDICATE_DIRECTION';
  const selectAllStep = step?.taskKind === 'SELECT_ALL_PATTERN_MEMBERS';
  // Find-it tasks: the learner drags the sky until the circle is on the answer.
  const pointStep =
    step?.taskKind === 'IDENTIFY_PATTERN_MEMBER' || step?.taskKind === 'IDENTIFY_TARGET_STAR';
  const synthetic = lesson.provenance.executionScope === 'SYNTHETIC_TECHNICAL_FIXTURE';
  // The scene shows only what the server issued for the current step.
  // While a correct answer waits for Next, its result overlays (the Qibla line) show too.
  const overlays = useMemo(
    () => (step ? [...step.overlays, ...(awaiting?.overlays ?? [])] : summary),
    [step, awaiting, summary],
  );
  const indexOf = useMemo(
    () => new Map(lesson.stars.map((star, index) => [star.handle, index])),
    [lesson.stars],
  );
  const canvasStars = useMemo<SkyCanvasStar[]>(
    () =>
      lesson.stars.map((star) => ({
        enu: star.enu,
        magnitude: star.visualMagnitude ?? 6.5,
        colorIndexBV: star.colorIndexBV,
      })),
    [lesson.stars],
  );
  const ringOn = step?.compassRing ?? false;
  const layers = useMemo(() => {
    const base = overlayLayers(overlays, (handle) => lesson.stars[indexOf.get(handle) ?? -1]?.enu);
    if (!ringOn) return base;
    // The ring shows the facing bearing; the Qibla itself is never marked in an assessment.
    const ring = compassRingLayers({
      headingAzimuth: normalizeHeading(view.azimuth),
      qiblaAzimuth: null,
      numbered: false,
    });
    return { lines: [...ring.lines, ...base.lines], labels: [...base.labels, ...ring.labels] };
  }, [overlays, lesson.stars, indexOf, ringOn, view.azimuth]);
  const highlighted = useMemo(
    () =>
      [...selected, ...(focused ? [focused] : [])]
        .map((handle) => indexOf.get(handle))
        .filter((index): index is number => index !== undefined),
    [selected, focused, indexOf],
  );
  const visibleStars = useMemo(
    () =>
      lesson.stars
        .filter(
          (star) =>
            !star.belowGeometricHorizon && (star.visualMagnitude ?? 99) <= LIST_MAGNITUDE_LIMIT,
        )
        .map((star) => ({ star, ...describeEnu(star.enu) }))
        .sort((a, b) => (a.azimuthDegrees ?? 0) - (b.azimuthDegrees ?? 0)),
    [lesson.stars],
  );
  const labelFor = useCallback(
    (handle: string) => {
      for (const overlay of overlays) {
        if (overlay.kind === 'STAR_LABEL' && overlay.handle === handle) {
          const label = overlay.labels[0];
          return label?.transliteration ?? label?.script ?? null;
        }
        if (overlay.kind === 'PATTERN_OUTLINE' && overlay.memberHandles.includes(handle)) {
          return overlay.labels[0]?.transliteration ?? overlay.labels[0]?.script ?? null;
        }
      }
      return null;
    },
    [overlays],
  );

  const send = useCallback(
    async (answer: StepAnswerV2) => {
      if (!step || busy) return;
      setBusy(true);
      setError(null);
      try {
        const result = await submitAnswer(lesson.lessonId, step.stepId, answer);
        setFeedback((previous) => [result, ...previous]);
        setLatest(result);
        if (result.result === 'INCORRECT') {
          // Same step again, possibly with more support; the learner tries again.
          setStep(result.nextStep);
        } else {
          // Correct: show the result and wait for Next.
          setAwaiting(result);
          if (result.completed) setSummary(result.overlays);
        }
      } catch (caught) {
        if (
          caught instanceof ApiError &&
          caught.body?.error === 'STALE_MASTERY_REVISION' &&
          caught.body.reissuedStep
        ) {
          setStep(caught.body.reissuedStep);
          setSelected([]);
          setError('Your progress changed in another lesson, so this task was reissued.');
        } else {
          setError(caught instanceof ApiError ? caught.message : 'The answer could not be sent.');
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, lesson.lessonId, step],
  );

  const goNext = () => {
    if (!awaiting) return;
    setStep(awaiting.nextStep);
    setSelected([]);
    setAwaiting(null);
    setLatest(null);
  };
  const cycle = (delta: number) => {
    if (visibleStars.length === 0) return;
    const index = visibleStars.findIndex((entry) => entry.star.handle === focused);
    const next = (index + delta + visibleStars.length) % visibleStars.length;
    setFocused(visibleStars[next]?.star.handle ?? null);
  };
  const selectStar = (handle: string) => {
    if (!step || !selectAllStep) return;
    setSelected((previous) =>
      previous.includes(handle) ? previous.filter((h) => h !== handle) : [...previous, handle],
    );
  };
  // The answer is where the circle (the view centre) is, at the field of view shown.
  const confirmPoint = () => {
    const aim = canvas.current?.getView() ?? view;
    void send({
      kind: 'SKY_POINT',
      azimuthRadians: normalizeHeading(aim.azimuth),
      altitudeRadians: aim.altitude,
      fovRadians: aim.fov,
    });
  };
  const submitSelection = () => {
    if (selected.length > 0) void send({ kind: 'STAR_SET_SELECTION', starHandles: selected });
  };
  // The answer is the azimuth of the view centre (the reticle).
  const confirmDirection = () =>
    void send({
      kind: 'DIRECTION',
      azimuthRadians: normalizeHeading(canvas.current?.getTarget().azimuth ?? view.azimuth),
    });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => canvas.current?.panBy(-STEP, 0),
      ArrowRight: () => canvas.current?.panBy(STEP, 0),
      ArrowUp: () => canvas.current?.panBy(0, STEP),
      ArrowDown: () => canvas.current?.panBy(0, -STEP),
      '+': () => canvas.current?.zoomBy(0.8),
      '=': () => canvas.current?.zoomBy(0.8),
      '-': () => canvas.current?.zoomBy(1.25),
      ']': () => cycle(1),
      '[': () => cycle(-1),
      Enter: () =>
        awaiting
          ? goNext()
          : directionStep
            ? confirmDirection()
            : pointStep
              ? confirmPoint()
              : focused && selectStar(focused),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };
  const focusedEntry = visibleStars.find((entry) => entry.star.handle === focused);
  const headingDegrees = toDegrees(normalizeHeading(view.azimuth));
  const traces = feedback.flatMap((entry) => (entry.trace ? [{ entry, trace: entry.trace }] : []));

  return (
    <div className="lesson">
      <div
        className="sky-stage"
        tabIndex={0}
        role="application"
        aria-label="Sky view. Drag to move the sky under the circle, or use the arrow keys. Scroll, or plus and minus, zoom. Enter confirms where the circle is, or your facing direction."
        onKeyDown={onKeyDown}
      >
        <SkyCanvas
          ref={canvas}
          stars={canvasStars}
          lines={layers.lines}
          labels={layers.labels}
          initialView={INITIAL_VIEW}
          showGround
          showCardinals={!step?.hideCardinalLabels}
          highlighted={highlighted}
          onPick={(index) => {
            const handle = index === null ? null : lesson.stars[index]?.handle;
            if (handle) selectStar(handle);
          }}
          onViewChange={setView}
          ariaLabel="Lesson sky"
        />
        <div
          className="reticle"
          aria-hidden="true"
          style={
            { '--reticle-diameter': `${200 * POINT_CIRCLE_RADIUS_SHARE}cqmin` } as CSSProperties
          }
        />
        {pointStep ? (
          <div className="heading-readout" aria-live="polite">
            Circle at azimuth {headingDegrees.toFixed(0)}° · altitude{' '}
            {toDegrees(view.altitude).toFixed(0)}°
          </div>
        ) : (
          !directionStep &&
          !step?.hideCardinalLabels && (
            <div className="heading-readout" aria-live="polite">
              Facing {headingDegrees.toFixed(0)}° ({compassPoint(headingDegrees)})
            </div>
          )
        )}
      </div>

      <header className="top-bar lesson-bar">
        <span className="brand">UFUQ</span>
        <div className="lesson-title">
          <p className="eyebrow">
            {synthetic ? lesson.provenance.profileId : lesson.observerLabel}
          </p>
          <h1>{lesson.routeTitle}</h1>
        </div>
        <span className="chip">
          {lesson.scenario.label} · <code>{lesson.scenario.utc}</code>
        </span>
        <span className="spacer" />
        <button type="button" className="secondary" onClick={onExit}>
          Back to the sky
        </button>
      </header>

      <aside className="lesson-panel">
        {synthetic && (
          <div
            className={`notice notice-${lesson.provenance.executionScope.toLowerCase()}`}
            role="note"
          >
            {lesson.provenance.notices[0]}
          </div>
        )}
        {step ? (
          <section aria-labelledby="step-title">
            <p className="eyebrow">
              Step {step.stepNumber} of {step.stepCount}
            </p>
            <h2 id="step-title">{step.prompt}</h2>
            <p className="support" data-testid="support-level">
              {supportText(step)}
            </p>
            {step.hints.map((hint) => (
              <p key={hint} className="hint">
                Hint: {hint}
              </p>
            ))}
          </section>
        ) : (
          <section>
            <h2>Lesson complete</h2>
            <p>
              You traced from the figure to al-Jady, then to True North and the Qibla. Your progress
              for each skill is saved and shapes the support of your next lesson.
            </p>
          </section>
        )}

        {pointStep && !awaiting && (
          <section aria-label="Put the circle on the answer">
            <p className="hint">
              Drag the sky (or use the arrow keys) until the circle is on the answer. Zoom in for a
              smaller circle and a more exact answer.
            </p>
            <button type="button" className="primary" disabled={busy} onClick={confirmPoint}>
              Confirm: the circle is on it
            </button>
          </section>
        )}

        {step && selectAllStep && !awaiting && (
          <section className="star-list" aria-labelledby="star-list-title">
            <h3 id="star-list-title">Bright stars above the horizon</h3>
            <p className="hint">Select every star of the pattern, then submit the selection.</p>
            <ol>
              {visibleStars.map(({ star, altitudeDegrees, azimuthDegrees }, index) => {
                const label = labelFor(star.handle);
                const chosen = selected.includes(star.handle);
                return (
                  <li key={star.handle}>
                    <button
                      type="button"
                      className={`${focused === star.handle ? 'focused' : ''}${chosen ? ' chosen' : ''}`}
                      disabled={busy}
                      aria-pressed={selectAllStep ? chosen : undefined}
                      onFocus={() => setFocused(star.handle)}
                      onClick={() => selectStar(star.handle)}
                      aria-label={`Star ${index + 1}${label ? `, ${label}` : ''}: magnitude ${star.visualMagnitude?.toFixed(1) ?? 'unknown'}, altitude ${altitudeDegrees.toFixed(0)} degrees, azimuth ${azimuthDegrees?.toFixed(0) ?? 'undefined'} degrees`}
                    >
                      Star {index + 1}
                      {label ? ` · ${label}` : ''} · alt {altitudeDegrees.toFixed(0)}° · az{' '}
                      {azimuthDegrees?.toFixed(0) ?? '—'}°
                    </button>
                  </li>
                );
              })}
            </ol>
            {selectAllStep && (
              <button
                type="button"
                className="primary"
                disabled={busy || selected.length === 0}
                onClick={submitSelection}
              >
                Submit selection ({selected.length} stars)
              </button>
            )}
            {focusedEntry && (
              <p className="hint" aria-live="polite">
                Focused: altitude {focusedEntry.altitudeDegrees.toFixed(0)}°, azimuth{' '}
                {focusedEntry.azimuthDegrees?.toFixed(0) ?? '—'}°
              </p>
            )}
          </section>
        )}

        {directionStep && !awaiting && (
          <section>
            <p className="hint">
              {step?.knowledgeComponentId === 'KC-05'
                ? 'You found True North, so you know where east, south and west are. Turn to where the Qibla is from here, then confirm.'
                : 'Turn the view until the centre marker is on the horizon below al-Jady.'}
            </p>
            <button type="button" className="primary" disabled={busy} onClick={confirmDirection}>
              {step?.knowledgeComponentId === 'KC-05'
                ? 'Confirm: I am facing the Qibla'
                : 'Confirm: I am facing True North'}
            </button>
          </section>
        )}

        <section className="feedback" aria-live="polite" aria-label="Feedback">
          {error && <p className="error">{error}</p>}
          {latest && (
            <div className={`result-card result-${latest.result.toLowerCase()}`}>
              <h3>
                {latest.result === 'CORRECT'
                  ? 'Correct'
                  : latest.result === 'MEASURED_NO_TOLERANCE'
                    ? 'Measured'
                    : 'Try again'}
              </h3>
              <p>{latest.feedback}</p>
              {awaiting && (
                <button type="button" className="primary" onClick={goNext}>
                  {awaiting.completed ? 'Finish' : 'Next →'}
                </button>
              )}
            </div>
          )}
          {guideTexts(overlays).map((guide) => (
            <p key={guide.key} className="guide">
              {guide.text}
            </p>
          ))}
        </section>

        <details className="provenance">
          <summary>Data and validation details</summary>
          <ul>
            <li>Profile: {lesson.provenance.profileId}</li>
            <li>Algorithm: {lesson.provenance.algorithmId}</li>
            {synthetic && <li>Content review state: {lesson.provenance.contentReviewState}</li>}
            <li>
              Learning configuration: {lesson.provenance.learningConfiguration.artifactId} (
              {lesson.provenance.learningConfiguration.mode})
            </li>
            {lesson.provenance.notices.slice(synthetic ? 1 : 0).map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </details>

        <details className="provenance" data-testid="model-trace">
          <summary>Technical model trace (for developers; not learner feedback)</summary>
          <ol>
            {traces.map(({ entry, trace }) => (
              <li key={`${entry.stepId}-${entry.attempt}`}>
                {trace.knowledgeComponentId} · {trace.responseStatus} · {trace.attemptKind}:{' '}
                {trace.modelDecision} ({trace.modelReasonCode}), mastery{' '}
                {trace.masteryBefore.toFixed(4)} → {trace.masteryAfter.toFixed(4)}; scaffold{' '}
                {trace.scaffoldDecision}
                {trace.scaffoldFrom ? ` ${trace.scaffoldFrom} → ${trace.scaffoldTo}` : ''} (
                {trace.scaffoldReasonCode}); threshold {trace.masteryThresholdStatus};{' '}
                {trace.independentConfirmationStatus}
              </li>
            ))}
          </ol>
        </details>
      </aside>
    </div>
  );
}

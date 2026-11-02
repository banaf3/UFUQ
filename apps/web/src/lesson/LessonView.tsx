import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';

import type {
  LessonSessionV2,
  LessonStepPromptV2,
  SkyOverlayV2,
  StepAnswerV2,
  StepFeedbackV2,
} from '@ufuq/contracts';

import { ApiError, submitAnswer } from '../api.js';
import { describeEnu, normalizeHeading } from '../scene/mapping.js';
import { SkyScene } from '../scene/SkyScene.js';

const STEP = (2 * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compassPoint = (degrees: number) => COMPASS[Math.round(degrees / 45) % 8];

function supportText(step: LessonStepPromptV2): string {
  if (step.support.mode === 'NON_ADAPTIVE')
    return 'Fixed presentation: adaptive support is not configured yet (BKT-004 pending).';
  return `Support level: ${step.support.scaffoldState ?? 'none'} (issued by the server).`;
}

function guideTexts(overlays: readonly SkyOverlayV2[]): { key: string; text: string }[] {
  return overlays.flatMap((overlay) => {
    if (overlay.kind === 'GUIDE_ARC' || overlay.kind === 'GUIDE_ARC_PARTIAL')
      return [{ key: overlay.relationshipId, text: overlay.explanation }];
    if (overlay.kind === 'VERTICAL_TO_HORIZON') {
      const history = overlay.historicalContext ? ` History: ${overlay.historicalContext}` : '';
      return [{ key: overlay.relationshipId, text: `${overlay.explanation}${history}` }];
    }
    return [];
  });
}

export function LessonView({ lesson, onExit }: { lesson: LessonSessionV2; onExit: () => void }) {
  const [heading, setHeading] = useState(Math.PI / 2);
  const [pitch, setPitch] = useState((12 * Math.PI) / 180);
  const [step, setStep] = useState(lesson.currentStep);
  const [summary, setSummary] = useState<readonly SkyOverlayV2[]>([]);
  const [feedback, setFeedback] = useState<StepFeedbackV2[]>([]);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const directionStep = step?.taskKind === 'INDICATE_DIRECTION';
  const selectAllStep = step?.taskKind === 'SELECT_ALL_PATTERN_MEMBERS';
  // The scene shows only what the server issued for the current step.
  const overlays = step ? step.overlays : summary;
  const visibleStars = useMemo(
    () =>
      lesson.stars
        .filter((star) => !star.belowGeometricHorizon)
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
        if (result.nextStep?.stepId !== step.stepId) setSelected([]);
        if (result.completed) setSummary(result.overlays);
        setStep(result.nextStep);
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

  const cycle = (delta: number) => {
    if (visibleStars.length === 0) return;
    const index = visibleStars.findIndex((entry) => entry.star.handle === focused);
    const next = (index + delta + visibleStars.length) % visibleStars.length;
    setFocused(visibleStars[next]?.star.handle ?? null);
  };
  const turn = (delta: number) => setHeading((value) => normalizeHeading(value + delta));
  const tilt = (delta: number) =>
    setPitch((value) =>
      Math.min((85 * Math.PI) / 180, Math.max((-5 * Math.PI) / 180, value + delta)),
    );
  const selectStar = (handle: string) => {
    if (!step || directionStep) return;
    if (selectAllStep) {
      setSelected((previous) =>
        previous.includes(handle) ? previous.filter((h) => h !== handle) : [...previous, handle],
      );
      return;
    }
    void send({ kind: 'STAR_SELECTION', starHandle: handle });
  };
  const submitSelection = () => {
    if (selected.length > 0) void send({ kind: 'STAR_SET_SELECTION', starHandles: selected });
  };
  const confirmDirection = () => void send({ kind: 'DIRECTION', azimuthRadians: heading });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => turn(-STEP),
      ArrowRight: () => turn(STEP),
      ArrowUp: () => tilt(STEP),
      ArrowDown: () => tilt(-STEP),
      ']': () => cycle(1),
      '[': () => cycle(-1),
      Enter: () => (directionStep ? confirmDirection() : focused && selectStar(focused)),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };
  const focusedEntry = visibleStars.find((entry) => entry.star.handle === focused);
  const headingDegrees = toDegrees(heading);
  const traces = feedback.flatMap((entry) => (entry.trace ? [{ entry, trace: entry.trace }] : []));

  return (
    <div className="lesson">
      <header className="lesson-header">
        <div>
          <p className="eyebrow">{lesson.provenance.profileId}</p>
          <h1>{lesson.routeTitle}</h1>
          <p className="scenario">
            {lesson.scenario.label} · <code>{lesson.scenario.utc}</code> · {lesson.observerLabel}
          </p>
        </div>
        <button type="button" className="secondary" onClick={onExit}>
          Choose another scenario
        </button>
      </header>

      <div
        className={`notice notice-${lesson.provenance.executionScope.toLowerCase()}`}
        role="note"
      >
        {lesson.provenance.notices[0]}
        <span className="state"> Result state: {lesson.provenance.scientificValidationState}.</span>
      </div>

      <div className="lesson-body">
        <div
          className="sky"
          tabIndex={0}
          role="application"
          aria-label="Sky view. Arrow keys turn and tilt the view. Square brackets move between stars. Enter selects the focused star, or confirms your facing direction in the direction step."
          onKeyDown={onKeyDown}
        >
          <SkyScene
            stars={lesson.stars}
            overlays={overlays}
            headingRadians={heading}
            pitchRadians={pitch}
            focusedHandle={focused}
            selectedHandles={selected}
            showCardinalLabels={!step?.hideCardinalLabels}
            onSelectStar={selectStar}
          />
          <div className="reticle" aria-hidden="true" />
          {!directionStep && (
            <div className="heading-readout" aria-live="polite">
              Facing {headingDegrees.toFixed(0)}° ({compassPoint(headingDegrees)})
            </div>
          )}
        </div>

        <aside className="panel">
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
              <p>You moved from the helper pattern to al-Jady and then to True North.</p>
            </section>
          )}

          <div className="controls" role="group" aria-label="View controls">
            <button type="button" onClick={() => turn(-STEP * 5)} aria-label="Turn left 10 degrees">
              ⟲ Left
            </button>
            <button type="button" onClick={() => turn(STEP * 5)} aria-label="Turn right 10 degrees">
              Right ⟳
            </button>
            <button type="button" onClick={() => tilt(STEP * 2.5)} aria-label="Look up 5 degrees">
              Up
            </button>
            <button
              type="button"
              onClick={() => tilt(-STEP * 2.5)}
              aria-label="Look down 5 degrees"
            >
              Down
            </button>
          </div>

          {step && !directionStep && (
            <section className="star-list" aria-labelledby="star-list-title">
              <h3 id="star-list-title">Stars above the horizon</h3>
              <p className="hint">
                {selectAllStep
                  ? 'Select every star of the pattern, then submit the selection.'
                  : 'Select a star in the sky, or use this list (keyboard and screen-reader friendly).'}
              </p>
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

          {directionStep && (
            <section>
              <p className="hint">
                Compass labels are hidden for this step. Turn the view until the centre marker is on
                the horizon below al-Jady.
              </p>
              <button type="button" className="primary" disabled={busy} onClick={confirmDirection}>
                Confirm: I am facing True North
              </button>
            </section>
          )}

          <section className="feedback" aria-live="polite" aria-label="Feedback">
            {error && <p className="error">{error}</p>}
            {feedback.map((entry) => (
              <p
                key={`${entry.stepId}-${entry.attempt}`}
                className={`result result-${entry.result.toLowerCase()}`}
              >
                <strong>
                  {entry.result === 'MEASURED_NO_TOLERANCE'
                    ? 'Measured'
                    : entry.result === 'CORRECT'
                      ? 'Correct'
                      : 'Try again'}
                  :
                </strong>{' '}
                {entry.feedback}
              </p>
            ))}
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
              <li>Content review state: {lesson.provenance.contentReviewState}</li>
              <li>
                Learning configuration: {lesson.provenance.learningConfiguration.artifactId} (
                {lesson.provenance.learningConfiguration.approvalState},{' '}
                {lesson.provenance.learningConfiguration.mode})
              </li>
              {lesson.provenance.notices.slice(1).map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </details>

          <details className="provenance" data-testid="model-trace">
            <summary>
              Technical model trace (developers and reviewers; not learner feedback)
            </summary>
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
    </div>
  );
}

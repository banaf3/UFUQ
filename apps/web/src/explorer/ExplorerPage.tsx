/**
 * Sky explorer, the first page (report UC-102 and storyboard): the whole naked-eye sky
 * for a scenario or a chosen instant, navigated with the mouse, touch or keyboard. A
 * lesson starts only from the top bar.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import type {
  DatasetSummaryV2,
  LessonExecutionScope,
  LessonSessionV2,
  SkyCitedTextV2,
  SkyViewV2,
} from '@ufuq/contracts';

import { ApiError, createLesson, getSky, listDatasets } from '../api.js';
import { altAz, PROJECTIONS, type ProjectionId, type ViewState } from '../sky/projection.js';
import { SkyCanvas, type SkyCanvasHandle } from '../sky/SkyCanvas.js';
import {
  EVIDENCE_TEXT,
  FIGURE_LABEL_ID,
  type FigureDetails,
  figureDetails,
  findOptions as buildFindOptions,
  matchFind,
  STAR_LABEL_ID,
  type StarDetails,
  skyLayers,
  skyStars,
  starDetails,
} from './sky-layers.js';

const DEG = Math.PI / 180;
const CUSTOM = '__custom__';
const SCOPE_PREFERENCE: readonly LessonExecutionScope[] = [
  'REVIEW_PREVIEW',
  'SCIENTIFIC_PROFILE_V1',
  'SYNTHETIC_TECHNICAL_FIXTURE',
];
const SCOPE_BADGE: Record<LessonExecutionScope, string> = {
  SCIENTIFIC_PROFILE_V1: 'ScientificProfileV1',
  REVIEW_PREVIEW: 'Review preview: unreviewed data',
  SYNTHETIC_TECHNICAL_FIXTURE: 'Synthetic fixture: not the real sky',
};
const INITIAL_VIEW: ViewState = {
  azimuth: 0,
  altitude: 25 * DEG,
  fov: 110 * DEG,
  projection: 'STEREOGRAPHIC',
};

interface Selection {
  readonly datasetId: string;
  readonly scope: LessonExecutionScope;
  readonly scenarioId: string;
  readonly customUtc: string;
}

/** A 404 without a JSON body means the running API predates this web build. */
const STALE_API_MESSAGE =
  'The running API server is older than this web app (it has no sky endpoint). Stop the preview (Ctrl+C in its terminal) and start it again with npm run preview:review.';

const describeError = (caught: unknown) => {
  if (caught instanceof ApiError && caught.status === 404 && caught.body === null) {
    return STALE_API_MESSAGE;
  }
  return caught instanceof ApiError
    ? `${caught.body?.outcome ?? caught.body?.error ?? 'Error'}: ${caught.message}`
    : 'The sky could not be loaded.';
};

/** "YYYY-MM-DDTHH:mm" (datetime-local, read as UTC) to canonical whole-second UTC. */
const canonicalUtc = (value: string) => `${value}:00Z`;

export function ExplorerPage({
  learnerId,
  identityEnabled,
  onLessonStarted,
}: {
  readonly learnerId: string | null;
  readonly identityEnabled: boolean;
  readonly onLessonStarted: (lesson: LessonSessionV2) => void;
}) {
  const [datasets, setDatasets] = useState<readonly DatasetSummaryV2[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sky, setSky] = useState<SkyViewV2 | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLines, setShowLines] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [showGround, setShowGround] = useState(true);
  const [projection, setProjection] = useState<ProjectionId>(INITIAL_VIEW.projection);
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [picked, setPicked] = useState<number | null>(null);
  const [pickedFigure, setPickedFigure] = useState<string | null>(null);
  const [findText, setFindText] = useState('');
  const [starting, setStarting] = useState(false);
  const canvas = useRef<SkyCanvasHandle>(null);

  const load = useCallback(async (next: Selection) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSky(
        next.datasetId,
        next.scope,
        next.scenarioId === CUSTOM
          ? { utc: canonicalUtc(next.customUtc) }
          : { scenarioId: next.scenarioId },
      );
      setSky(result);
      setSelection(next);
      setPicked(null);
      setPickedFigure(null);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  // First load: the best available dataset and scope, falling back in order.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await listDatasets();
        if (cancelled) return;
        setDatasets(response.datasets);
        const failures: string[] = [];
        for (const dataset of response.datasets) {
          for (const scope of SCOPE_PREFERENCE.filter((s) => dataset.executionScopes.includes(s))) {
            const scenario = dataset.scenarios[0];
            if (!scenario) continue;
            try {
              const result = await getSky(dataset.datasetId, scope, {
                scenarioId: scenario.scenarioId,
              });
              if (cancelled) return;
              setSky(result);
              setSelection({
                datasetId: dataset.datasetId,
                scope,
                scenarioId: scenario.scenarioId,
                customUtc: scenario.utc.slice(0, 16),
              });
              if (failures.length > 0) setNotice(`Showing ${dataset.title}. ${failures.join(' ')}`);
              return;
            } catch (caught) {
              // An outdated API cannot serve any dataset: say so once, plainly.
              if (describeError(caught) === STALE_API_MESSAGE) {
                setError(STALE_API_MESSAGE);
                return;
              }
              failures.push(
                `${dataset.title} (${scope}) is unavailable: ${describeError(caught)}.`,
              );
            }
          }
        }
        setError(failures.join(' ') || 'No dataset can be shown.');
      } catch {
        if (!cancelled) setError('The UFUQ API is not reachable.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stars = useMemo(() => (sky ? skyStars(sky) : []), [sky]);
  const layers = useMemo(
    () =>
      sky
        ? skyLayers(sky, stars, { showLines, showNames, selectedFigureId: pickedFigure })
        : { lines: [], labels: [] },
    [sky, stars, showLines, showNames, pickedFigure],
  );
  const dataset = datasets.find((d) => d.datasetId === selection?.datasetId);
  const details = sky && picked !== null ? starDetails(sky, picked) : null;
  const figureCard = sky && pickedFigure !== null ? figureDetails(sky, pickedFigure) : null;
  const pickStar = useCallback((index: number | null) => {
    setPicked(index);
    setPickedFigure(null);
  }, []);
  const pickFigure = useCallback((figureId: string) => {
    setPickedFigure(figureId);
    setPicked(null);
  }, []);
  const pickLabel = useCallback(
    (id: string) => {
      if (id.startsWith(FIGURE_LABEL_ID)) pickFigure(id.slice(FIGURE_LABEL_ID.length));
      else if (id.startsWith(STAR_LABEL_ID)) pickStar(Number(id.slice(STAR_LABEL_ID.length)));
      else return false;
      return true;
    },
    [pickFigure, pickStar],
  );
  const highlighted = useMemo(() => (picked === null ? [] : [picked]), [picked]);

  const findOptions = useMemo(() => (sky ? buildFindOptions(sky) : []), [sky]);

  const find = () => {
    const option = matchFind(findOptions, findText);
    if (!option || !sky) return;
    const members = option.indices.map((i) => stars[i]?.enu).filter((d) => d !== undefined);
    if (members.length === 0) return;
    const sum = members.reduce((a, d) => [a[0] + d[0], a[1] + d[1], a[2] + d[2]], [0, 0, 0]);
    const { altitude, azimuth } = altAz(sum as [number, number, number]);
    // Below the horizon (with the ground shown): face its direction and say so.
    const hidden = showGround && altitude < 0;
    canvas.current?.setView({
      altitude: hidden ? 15 * DEG : altitude,
      azimuth,
      fov: Math.min(view.fov, 70 * DEG),
    });
    setNotice(
      hidden
        ? `${option.label} is below the horizon now (towards azimuth ${Math.round(azimuth / DEG)}°). Turn the ground off or choose another time to see it.`
        : null,
    );
    if (option.figureId) pickFigure(option.figureId);
    else if (option.indices.length === 1) pickStar(option.indices[0] ?? null);
  };

  const startLesson = async () => {
    if (!selection || !learnerId || selection.scenarioId === CUSTOM) return;
    setStarting(true);
    setError(null);
    try {
      onLessonStarted(
        await createLesson(selection.datasetId, selection.scenarioId, selection.scope, learnerId),
      );
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setStarting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = Math.max(view.fov / 30, 0.2 * DEG);
    const actions: Record<string, () => void> = {
      ArrowLeft: () => canvas.current?.panBy(-step, 0),
      ArrowRight: () => canvas.current?.panBy(step, 0),
      ArrowUp: () => canvas.current?.panBy(0, step),
      ArrowDown: () => canvas.current?.panBy(0, -step),
      '+': () => canvas.current?.zoomBy(0.8),
      '=': () => canvas.current?.zoomBy(0.8),
      '-': () => canvas.current?.zoomBy(1.25),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const lessonBlocked = !identityEnabled
    ? 'Lessons need a learner identity (start the API with UFUQ_ENABLE_DEVELOPMENT_IDENTITY=1).'
    : selection?.scenarioId === CUSTOM
      ? 'Lessons run on reviewed scenarios: choose a scenario first.'
      : null;
  const facing = (((view.azimuth / DEG) % 360) + 360) % 360;

  return (
    <div className="explorer">
      <div
        className="sky-stage"
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label="Sky map. Drag to look around, scroll or pinch to zoom, double-click to centre. Arrow keys pan, plus and minus zoom."
      >
        {sky && (
          <SkyCanvas
            ref={canvas}
            stars={stars}
            lines={layers.lines}
            labels={layers.labels}
            initialView={INITIAL_VIEW}
            showGround={showGround}
            showCardinals
            highlighted={highlighted}
            onPick={pickStar}
            onPickLabel={pickLabel}
            onViewChange={setView}
            ariaLabel={`Night sky over ${sky.observer.label} at ${sky.utc}: ${sky.stars.count} stars.`}
          />
        )}
      </div>

      <header className="top-bar" role="banner">
        <span className="brand">UFUQ</span>
        {sky && (
          <span className="chip" title="Observer">
            ⌖ {sky.observer.label}
          </span>
        )}
        {selection && (
          <>
            <label className="field">
              <span>Data</span>
              <select
                value={`${selection.datasetId}|${selection.scope}`}
                onChange={(event) => {
                  const [datasetId, scope] = event.target.value.split('|') as [
                    string,
                    LessonExecutionScope,
                  ];
                  const next = datasets.find((d) => d.datasetId === datasetId);
                  const scenario = next?.scenarios[0];
                  if (!scenario) return;
                  void load({
                    datasetId,
                    scope,
                    scenarioId: scenario.scenarioId,
                    customUtc: scenario.utc.slice(0, 16),
                  });
                }}
              >
                {datasets.flatMap((d) =>
                  d.executionScopes.map((scope) => (
                    <option key={`${d.datasetId}|${scope}`} value={`${d.datasetId}|${scope}`}>
                      {d.title} · {SCOPE_BADGE[scope]}
                    </option>
                  )),
                )}
              </select>
            </label>
            <label className="field">
              <span>Scenario</span>
              <select
                value={selection.scenarioId}
                onChange={(event) => {
                  const scenarioId = event.target.value;
                  if (scenarioId === CUSTOM) setSelection({ ...selection, scenarioId });
                  else void load({ ...selection, scenarioId });
                }}
              >
                {dataset?.scenarios.map((s) => (
                  <option key={s.scenarioId} value={s.scenarioId}>
                    {s.label}
                  </option>
                ))}
                <option value={CUSTOM}>Custom date and time (UTC)…</option>
              </select>
            </label>
            {selection.scenarioId === CUSTOM && (
              <form
                className="field"
                onSubmit={(event) => {
                  event.preventDefault();
                  void load(selection);
                }}
              >
                <span>UTC</span>
                <input
                  type="datetime-local"
                  aria-label="Date and time (UTC)"
                  value={selection.customUtc}
                  min={dataset?.supportedDomain?.earliest.slice(0, 16)}
                  max={dataset?.supportedDomain?.latest.slice(0, 16)}
                  onChange={(event) =>
                    setSelection({ ...selection, customUtc: event.target.value })
                  }
                />
                <button type="submit">Show</button>
              </form>
            )}
            <form
              className="field find"
              onSubmit={(event) => {
                event.preventDefault();
                find();
              }}
            >
              <input
                list="sky-find"
                placeholder="Find a star or figure (Arabic or transliteration)"
                aria-label="Find a star or figure"
                value={findText}
                onChange={(event) => setFindText(event.target.value)}
              />
              <datalist id="sky-find">
                {findOptions.map((option) => (
                  <option key={`${option.label}-${option.indices[0]}`} value={option.label} />
                ))}
              </datalist>
            </form>
          </>
        )}
        <span className="spacer" />
        {selection && (
          <span className={`badge badge-${selection.scope.toLowerCase()}`}>
            {SCOPE_BADGE[selection.scope]}
          </span>
        )}
        <button
          type="button"
          className="primary"
          disabled={!selection || !!lessonBlocked || starting || !learnerId}
          title={lessonBlocked ?? 'Start the guided lesson for this scenario'}
          onClick={() => void startLesson()}
        >
          {starting ? 'Preparing…' : 'Start lesson'}
        </button>
      </header>

      <div className="toggle-group" role="group" aria-label="Sky layers">
        <button
          type="button"
          className="ghost"
          aria-pressed={showLines}
          onClick={() => setShowLines((v) => !v)}
        >
          <span aria-hidden="true">✶</span> Lines
        </button>
        <button
          type="button"
          className="ghost"
          aria-pressed={showNames}
          onClick={() => setShowNames((v) => !v)}
        >
          <span aria-hidden="true">Aa</span> Names
        </button>
        <button
          type="button"
          className="ghost"
          aria-pressed={showGround}
          onClick={() => setShowGround((v) => !v)}
        >
          <span aria-hidden="true">▁</span> Ground
        </button>
      </div>

      <div className="view-controls" role="group" aria-label="View">
        <label className="field">
          <span>Projection</span>
          <select
            value={projection}
            onChange={(event) => {
              const next = event.target.value as ProjectionId;
              setProjection(next);
              canvas.current?.setView({
                projection: next,
                fov: Math.min(view.fov, PROJECTIONS[next].maxFov),
              });
            }}
          >
            {Object.values(PROJECTIONS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="ghost"
          aria-label="Zoom out"
          onClick={() => canvas.current?.zoomBy(1.25)}
        >
          −
        </button>
        <button
          type="button"
          className="ghost"
          aria-label="Zoom in"
          onClick={() => canvas.current?.zoomBy(0.8)}
        >
          +
        </button>
        <span className="readout" aria-live="off">
          Az {facing.toFixed(0)}° · Alt {(view.altitude / DEG).toFixed(0)}° · FOV{' '}
          {(view.fov / DEG).toFixed(0)}°
        </span>
      </div>

      {details && sky && (
        <StarCard details={details} onClose={() => pickStar(null)} onFigure={pickFigure} />
      )}
      {figureCard && (
        <FigureCard
          details={figureCard}
          sky={sky}
          onClose={() => setPickedFigure(null)}
          onFigure={pickFigure}
          onStar={pickStar}
        />
      )}

      <footer className="sky-notice" role="note">
        {loading && <span className="loading">Computing the sky…</span>}
        {error && (
          <span className="error" role="alert">
            {error}
          </span>
        )}
        {notice && !error && <span>{notice}</span>}
        {sky && (
          <details>
            <summary>
              {sky.utc} · {sky.stars.count} stars · {sky.provenance.profileId}
            </summary>
            <ul>
              {sky.provenance.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
              <li>
                Positions: geometric (no refraction or atmospheric dimming); background stars use
                the display-only policy {sky.provenance.displayPolicyId}.
              </li>
              {sky.provenance.artifacts.map((a) => (
                <li key={a.artifactId}>
                  {a.artifactId}: {a.approvalState}
                </li>
              ))}
              {sky.provenance.attributions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </footer>
    </div>
  );
}

function ArabicTitle({
  arabic,
  transliteration,
}: {
  readonly arabic: string;
  readonly transliteration: string;
}) {
  return (
    <hgroup className="arabic-title">
      <h2 lang="ar" dir="rtl">
        {arabic}
      </h2>
      <p className="transliteration">{transliteration}</p>
    </hgroup>
  );
}

function CitedList({
  title,
  items,
  className,
}: {
  readonly title: string;
  readonly items: readonly SkyCitedTextV2[];
  readonly className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={`${item.source}-${item.text}`}>
            {item.text} <cite>({item.source})</cite>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlternativeNames({
  names,
}: {
  readonly names: readonly { readonly arabic: string; readonly transliteration: string | null }[];
}) {
  if (names.length === 0) return null;
  return (
    <p className="alt-names">
      Also:{' '}
      {names.map((name, i) => (
        <span key={name.arabic}>
          {i > 0 && ' · '}
          <span lang="ar" dir="rtl">
            {name.arabic}
          </span>
          {name.transliteration && ` (${name.transliteration})`}
        </span>
      ))}
    </p>
  );
}

/** Star card: the Arabic tradition first, then the modern origin, then the catalogue facts. */
function StarCard({
  details,
  onClose,
  onFigure,
}: {
  readonly details: StarDetails;
  readonly onClose: () => void;
  readonly onFigure: (figureId: string) => void;
}) {
  const { arabic, modern } = details;
  const position = altAz(details.enu);
  return (
    <aside className="info-card" aria-label="Selected star">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      {arabic ? (
        <ArabicTitle arabic={arabic.arabic} transliteration={arabic.transliteration} />
      ) : (
        <h2>{modern?.name ?? (details.hip ? `HIP ${details.hip}` : details.id)}</h2>
      )}
      {arabic && (
        <section className="tradition" aria-label="Arabic tradition">
          <AlternativeNames names={arabic.alternativeNames} />
          <CitedList title="In the anwāʾ texts" items={arabic.notes} />
          <CitedList title="Disputed or uncertain" items={arabic.conflicts} className="conflicts" />
          <p className="evidence">{EVIDENCE_TEXT[arabic.evidence]}</p>
        </section>
      )}
      {details.figures.length > 0 && (
        <section className="figures">
          <h3>Part of</h3>
          <ul>
            {details.figures.map((figure) => (
              <li key={figure.figureId}>
                <button type="button" className="link" onClick={() => onFigure(figure.figureId)}>
                  <span lang="ar" dir="rtl">
                    {figure.arabic}
                  </span>{' '}
                  <span className="transliteration">{figure.transliteration}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!arabic && (
        <p className="evidence">No name of the anwāʾ tradition is recorded for this star.</p>
      )}
      {modern && (
        <p className="etymology">
          <strong>
            Modern name {modern.name} ({modern.language} origin).
          </strong>{' '}
          {modern.origin} <span className="credit">(IAU WGSN, CC BY)</span>
        </p>
      )}
      <dl>
        {details.hip && (
          <>
            <dt>Hipparcos</dt>
            <dd>HIP {details.hip}</dd>
          </>
        )}
        <dt>Magnitude (V)</dt>
        <dd>{details.magnitude?.toFixed(2)}</dd>
        {details.colorIndex !== null && (
          <>
            <dt>Colour (B−V)</dt>
            <dd>{details.colorIndex.toFixed(2)}</dd>
          </>
        )}
        <dt>Altitude / azimuth</dt>
        <dd>
          {(position.altitude / DEG).toFixed(1)}° / {(position.azimuth / DEG).toFixed(1)}°
        </dd>
      </dl>
      {arabic && arabic.sources.length > 0 && (
        <details className="sources">
          <summary>Sources</summary>
          <ul>
            {arabic.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

/** Figure card: names, notes, disputes, its larger and smaller figures and its stars. */
function FigureCard({
  details,
  sky,
  onClose,
  onFigure,
  onStar,
}: {
  readonly details: FigureDetails;
  readonly sky: SkyViewV2 | null;
  readonly onClose: () => void;
  readonly onFigure: (figureId: string) => void;
  readonly onStar: (index: number) => void;
}) {
  const { figure, parent, children, members } = details;
  return (
    <aside className="info-card" aria-label="Selected figure">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <ArabicTitle arabic={figure.arabic} transliteration={figure.transliteration} />
      <section className="tradition" aria-label="Arabic tradition">
        <AlternativeNames names={figure.alternativeNames} />
        <CitedList title="In the anwāʾ texts" items={figure.notes} />
        <CitedList title="Disputed or uncertain" items={figure.conflicts} className="conflicts" />
        <p className="evidence">{EVIDENCE_TEXT[figure.evidence]}</p>
      </section>
      {(parent || children.length > 0) && (
        <section className="figures">
          {parent && (
            <>
              <h3>Part of</h3>
              <button type="button" className="link" onClick={() => onFigure(parent.figureId)}>
                <span lang="ar" dir="rtl">
                  {parent.arabic}
                </span>{' '}
                <span className="transliteration">{parent.transliteration}</span>
              </button>
            </>
          )}
          {children.length > 0 && (
            <>
              <h3>Contains</h3>
              <ul>
                {children.map((child) => (
                  <li key={child.figureId}>
                    <button type="button" className="link" onClick={() => onFigure(child.figureId)}>
                      <span lang="ar" dir="rtl">
                        {child.arabic}
                      </span>{' '}
                      <span className="transliteration">{child.transliteration}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
      <section className="figures">
        <h3>
          Stars ({members.length}){figure.style === 'GROUP' ? ' · a group of stars' : ''}
        </h3>
        <ul className="members">
          {members.map(({ index, name }) => (
            <li key={index}>
              <button type="button" className="link" onClick={() => onStar(index)}>
                {name ? (
                  <>
                    <span lang="ar" dir="rtl">
                      {name.arabic}
                    </span>{' '}
                    <span className="transliteration">{name.transliteration}</span>
                  </>
                ) : (
                  (sky?.stars.ids[index] ?? '').replace('hip-', 'HIP ')
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p className="credit">
        Lines are UFUQ teaching aids ({sky?.culture?.lineRule}), not historical drawings.
      </p>
      {figure.sources.length > 0 && (
        <details className="sources">
          <summary>Sources</summary>
          <ul>
            {figure.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

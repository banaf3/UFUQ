import { useEffect, useState } from 'react';

import type { DatasetSummaryV2, LessonExecutionScope, LessonSessionV2 } from '@ufuq/contracts';

import { ApiError, createDevelopmentLearner, createLesson, listDatasets } from './api.js';
import { LessonView } from './lesson/LessonView.js';

const SCOPE_LABEL: Record<LessonExecutionScope, string> = {
  SCIENTIFIC_PROFILE_V1: 'ScientificProfileV1 (approved data only)',
  REVIEW_PREVIEW: 'Review preview (unreviewed data, reviewers only)',
  SYNTHETIC_TECHNICAL_FIXTURE: 'Synthetic technical fixture (not the real sky)',
};

export function App() {
  const [datasets, setDatasets] = useState<readonly DatasetSummaryV2[]>([]);
  // IMP-016: one in-memory development learner per tab, so support adapts across lessons.
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [identityEnabled, setIdentityEnabled] = useState(true);
  const [datasetId, setDatasetId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [scope, setScope] = useState<LessonExecutionScope | ''>('');
  const [lesson, setLesson] = useState<LessonSessionV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDatasets()
      .then((response) => {
        setDatasets(response.datasets);
        setIdentityEnabled(response.developmentIdentityEnabled);
        if (response.developmentIdentityEnabled) {
          createDevelopmentLearner()
            .then((learner) => setLearnerId(learner.learnerId))
            .catch(() => setError('A development learner could not be created.'));
        }
        const first = response.datasets[0];
        if (first) {
          setDatasetId(first.datasetId);
          setScenarioId(first.scenarios[0]?.scenarioId ?? '');
          setScope(first.executionScopes[first.executionScopes.length - 1] ?? '');
        }
      })
      .catch(() => setError('The UFUQ API is not reachable.'));
  }, []);

  const dataset = datasets.find((d) => d.datasetId === datasetId);
  const chooseDataset = (id: string) => {
    const next = datasets.find((d) => d.datasetId === id);
    setDatasetId(id);
    setScenarioId(next?.scenarios[0]?.scenarioId ?? '');
    setScope(next?.executionScopes[next.executionScopes.length - 1] ?? '');
  };

  const start = async () => {
    if (!dataset || !scenarioId || !scope || !learnerId) return;
    setLoading(true);
    setError(null);
    try {
      setLesson(await createLesson(dataset.datasetId, scenarioId, scope, learnerId));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? `${caught.body?.outcome ?? caught.body?.error ?? 'Error'}: ${caught.message}`
          : 'The lesson could not be created.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (lesson) return <LessonView lesson={lesson} onExit={() => setLesson(null)} />;

  return (
    <main className="start-shell">
      <section className="start-card" aria-labelledby="start-title">
        <p className="eyebrow">UFUQ · Celestial guidance</p>
        <h1 id="start-title">Find True North from the stars</h1>
        <p>
          A guided sky lesson: find a helper star pattern, follow it to al-Jady (the polar star),
          then face True North. The server computes the sky and checks your answers.
        </p>
        <label>
          Dataset
          <select value={datasetId} onChange={(event) => chooseDataset(event.target.value)}>
            {datasets.map((d) => (
              <option key={d.datasetId} value={d.datasetId}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        {dataset && (
          <>
            <label>
              Scenario
              <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
                {dataset.scenarios.map((s) => (
                  <option key={s.scenarioId} value={s.scenarioId}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Execution scope
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as LessonExecutionScope)}
              >
                {dataset.executionScopes.map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="notice" role="note">
              {dataset.notice}
            </p>
            <p className="hint">
              Learning mode: <strong>{dataset.learningMode}</strong>
              {dataset.learningMode === 'NON_ADAPTIVE'
                ? ' (fixed presentation until BKT-001..BKT-005 are approved)'
                : ''}
            </p>
            <details>
              <summary>Data approval states</summary>
              <ul>
                {dataset.approvalSummary.map((a) => (
                  <li key={a.artifactId}>
                    {a.artifactId}: <strong>{a.state}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        <button
          type="button"
          className="primary"
          disabled={!dataset || loading || !learnerId}
          onClick={() => void start()}
        >
          {loading ? 'Computing the sky…' : 'Start lesson'}
        </button>
        {!identityEnabled && (
          <p className="notice" role="note">
            Lessons need a learner identity. Accounts arrive in Phase 4; for local work start the
            API with UFUQ_ENABLE_DEVELOPMENT_IDENTITY=1 (development fixture identity, IMP-016).
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

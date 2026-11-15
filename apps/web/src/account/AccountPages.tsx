import { useEffect, useState, type FormEvent } from 'react';

import type { AccountUserV1, AnalyticsV1, ProgressV1 } from '@ufuq/contracts';

import { ApiError, getAnalytics, getProgress, login, register } from '../api.js';

const SCAFFOLD_TEXT = {
  GUIDED: 'Guided (lines and names)',
  FADING: 'Lines only',
  INDEPENDENT: 'From memory',
} as const;

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
const message = (caught: unknown) =>
  caught instanceof ApiError ? caught.message : 'The server could not be reached.';

/** Sign in or register (report UC-101). */
export function SignInDialog({
  onSignedIn,
  onClose,
}: {
  onSignedIn: (user: AccountUserV1) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(
        mode === 'login' ? await login(email, password) : await register(name, email, password),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="account-title">{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
        {mode === 'register' && (
          <label className="form-field">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
              maxLength={100}
            />
          </label>
        )}
        <label className="form-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            maxLength={100}
          />
        </label>
        <label className="form-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 8 : 1}
            maxLength={64}
          />
          {mode === 'register' && <small>8 to 64 characters.</small>}
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-buttons">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

/** The learner's own progress (report UC-104). */
export function ProgressPage({
  onStartLesson,
  onBack,
}: {
  onStartLesson: () => void;
  onBack: () => void;
}) {
  const [progress, setProgress] = useState<ProgressV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getProgress().then(setProgress, (caught: unknown) => setError(message(caught)));
  }, []);
  const empty = progress !== null && progress.attempts.length === 0;
  return (
    <main className="account-page" aria-labelledby="progress-title">
      <header className="account-header">
        <h1 id="progress-title">My progress</h1>
        <button type="button" className="secondary" onClick={onBack}>
          Back to the sky
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error} Refresh the page or try again later.
        </p>
      )}
      {!progress && !error && <p>Loading…</p>}
      {empty && (
        <section className="empty">
          <p>No data available yet.</p>
          <button type="button" className="primary" onClick={onStartLesson}>
            Start your first lesson
          </button>
        </section>
      )}
      {progress && (
        <>
          <p className="hint">
            Mastery is the tutor’s estimate that you have learned a skill (Bayesian Knowledge
            Tracing), not a grade.
            {progress.masteryThreshold !== null &&
              ` At ${percent(progress.masteryThreshold)} or more, the lines are removed for that skill.`}
          </p>
          <table className="data-table" aria-label="Skills">
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Estimated mastery</th>
                <th scope="col">Support now</th>
                <th scope="col">Answers (correct)</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {progress.skills.map((skill) => (
                <tr key={skill.knowledgeComponentId}>
                  <th scope="row">{skill.name}</th>
                  <td>
                    <span className="meter" aria-hidden="true">
                      <span style={{ width: percent(skill.masteryProbability ?? 0) }} />
                    </span>{' '}
                    {percent(skill.masteryProbability)}
                  </td>
                  <td>{skill.scaffoldState ? SCAFFOLD_TEXT[skill.scaffoldState] : '—'}</td>
                  <td>
                    {skill.attempts} ({skill.correct})
                  </td>
                  <td>{when(skill.lastUpdated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {progress.attempts.length > 0 && (
            <>
              <h2>Recent answers</h2>
              <table className="data-table" aria-label="Recent answers">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Skill</th>
                    <th scope="col">Result</th>
                    <th scope="col">Support</th>
                    <th scope="col">Mastery before → after</th>
                    <th scope="col">Seconds</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.attempts.map((attempt) => (
                    <tr key={`${attempt.time}-${attempt.stepId}`}>
                      <td>{when(attempt.time)}</td>
                      <td>{attempt.knowledgeComponentId}</td>
                      <td>
                        {attempt.responseStatus === 'SCORED_CORRECT'
                          ? 'Correct'
                          : attempt.responseStatus === 'SCORED_INCORRECT'
                            ? 'Incorrect'
                            : 'Measured'}
                      </td>
                      <td>
                        {attempt.scaffoldState
                          ? SCAFFOLD_TEXT[attempt.scaffoldState as keyof typeof SCAFFOLD_TEXT]
                          : attempt.hintsShown
                            ? 'Hints'
                            : 'None'}
                      </td>
                      <td>
                        {percent(attempt.masteryBefore)} → {percent(attempt.masteryAfter)}
                      </td>
                      <td>{attempt.timeTakenSeconds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </main>
  );
}

/** Read-only aggregate analytics for administrators (report UC-105). */
export function AnalyticsPage({ onBack }: { onBack: () => void }) {
  const [analytics, setAnalytics] = useState<AnalyticsV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getAnalytics().then(setAnalytics, (caught: unknown) => setError(message(caught)));
  }, []);
  const totals = analytics?.totals;
  const busiest = Math.max(1, ...(analytics?.attemptsByDay.map((d) => d.attempts) ?? [1]));
  return (
    <main className="account-page" aria-labelledby="analytics-title">
      <header className="account-header">
        <h1 id="analytics-title">System analytics</h1>
        <button type="button" className="secondary" onClick={onBack}>
          Back to the sky
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!analytics && !error && <p>Loading…</p>}
      {totals && analytics && (
        <>
          {totals.attempts === 0 && <p>No activity recorded yet.</p>}
          <dl className="stat-tiles">
            {[
              ['Learners', totals.learners],
              ['Administrators', totals.administrators],
              ['Lessons started', totals.sessions],
              ['Lessons completed', totals.completedSessions],
              ['Answers', totals.attempts],
              [
                'Correct answers',
                `${totals.correctAttempts}${totals.attempts > 0 ? ` (${percent(totals.correctAttempts / totals.attempts)})` : ''}`,
              ],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <h2>Skills</h2>
          <table className="data-table" aria-label="Skills across learners">
            <thead>
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Learners</th>
                <th scope="col">Mean estimated mastery</th>
                <th scope="col">At the threshold</th>
                <th scope="col">Answers (correct)</th>
              </tr>
            </thead>
            <tbody>
              {analytics.skills.map((skill) => (
                <tr key={skill.knowledgeComponentId}>
                  <th scope="row">{skill.name}</th>
                  <td>{skill.learners}</td>
                  <td>{percent(skill.meanMastery)}</td>
                  <td>{skill.learnersAtThreshold}</td>
                  <td>
                    {skill.attempts} ({skill.correct})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Answers per day (last 14 days)</h2>
          {analytics.attemptsByDay.length === 0 ? (
            <p>No answers in the last 14 days.</p>
          ) : (
            <ul className="bars" aria-label="Answers per day">
              {analytics.attemptsByDay.map((day) => (
                <li key={day.day}>
                  <span className="bar-label">{day.day}</span>
                  <span className="bar" style={{ width: `${(100 * day.attempts) / busiest}%` }} />
                  <span>{day.attempts}</span>
                </li>
              ))}
            </ul>
          )}
          <h2>Recent system events</h2>
          <table className="data-table" aria-label="System log">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Event</th>
                <th scope="col">User</th>
                <th scope="col">Detail</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentLogs.map((log, i) => (
                <tr key={`${log.time}-${i}`}>
                  <td>{when(log.time)}</td>
                  <td>{log.eventType}</td>
                  <td>{log.userId ?? '—'}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">This view is read-only: no learner record can be changed here.</p>
        </>
      )}
    </main>
  );
}

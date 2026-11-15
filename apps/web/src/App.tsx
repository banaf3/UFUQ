import { useEffect, useState } from 'react';

import type {
  AccountUserV1,
  LessonExecutionScope,
  LessonSessionV2,
  WalkthroughV2,
} from '@ufuq/contracts';

import { AnalyticsPage, ProgressPage, SignInDialog } from './account/AccountPages.js';
import {
  ApiError,
  createDevelopmentLearner,
  createLesson,
  createWalkthrough,
  currentUser,
  listDatasets,
  logout,
} from './api.js';
import { ExplorerPage } from './explorer/ExplorerPage.js';
import { LessonView } from './lesson/LessonView.js';
import { WalkthroughView } from './lesson/WalkthroughView.js';

type Choice = {
  readonly datasetId: string;
  readonly scenarioId: string;
  readonly scope: LessonExecutionScope;
};
type Screen =
  | { readonly kind: 'SKY' }
  | { readonly kind: 'WALKTHROUGH'; readonly walkthrough: WalkthroughV2; readonly choice: Choice }
  | { readonly kind: 'LESSON'; readonly lesson: LessonSessionV2 }
  | { readonly kind: 'PROGRESS' }
  | { readonly kind: 'ANALYTICS' };

/**
 * The sky explorer is the first page (report UC-102). A lesson opens from its top bar:
 * first the taught walkthrough, then the assessment, whose support follows the learner's
 * BKT mastery (report section 2.5.4). A signed-in account (UC-101) keeps its mastery in
 * the database; without accounts, an in-memory development learner (IMP-016) is used.
 */
export function App() {
  const [user, setUser] = useState<AccountUserV1 | null>(null);
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [developmentLearner, setDevelopmentLearner] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'SKY' });
  const [signingIn, setSigningIn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lastChoice, setLastChoice] = useState<Choice | null>(null);

  useEffect(() => {
    void currentUser().then((me) => {
      setAccountsAvailable(me !== 'UNAVAILABLE');
      setUser(me === 'UNAVAILABLE' ? null : me);
    });
    listDatasets()
      .then((response) => {
        if (!response.developmentIdentityEnabled) return undefined;
        return createDevelopmentLearner().then((learner) =>
          setDevelopmentLearner(learner.learnerId),
        );
      })
      .catch(() => undefined);
  }, []);

  // A signed-in account always takes precedence over the development learner.
  const learnerId = user?.learnerId ?? developmentLearner;

  const startLesson = async (choice: Choice) => {
    setLastChoice(choice);
    const walkthrough = await createWalkthrough(choice.datasetId, choice.scenarioId, choice.scope);
    setScreen({ kind: 'WALKTHROUGH', walkthrough, choice });
  };

  const startAssessment = async (choice: Choice) => {
    if (!learnerId) return;
    setStarting(true);
    try {
      const lesson = await createLesson(
        choice.datasetId,
        choice.scenarioId,
        choice.scope,
        learnerId,
      );
      setScreen({ kind: 'LESSON', lesson });
    } catch (caught) {
      window.alert(caught instanceof ApiError ? caught.message : 'The lesson could not start.');
    } finally {
      setStarting(false);
    }
  };

  const accountSlot = accountsAvailable ? (
    user ? (
      <div className="account-menu" role="group" aria-label="Account">
        <span className="chip" title={user.email}>
          {user.name}
          {user.role === 'ADMIN' ? ' · Admin' : ''}
        </span>
        <button type="button" className="secondary" onClick={() => setScreen({ kind: 'PROGRESS' })}>
          My progress
        </button>
        {user.role === 'ADMIN' && (
          <button
            type="button"
            className="secondary"
            onClick={() => setScreen({ kind: 'ANALYTICS' })}
          >
            Analytics
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() => {
            void logout().then(() => setUser(null));
          }}
        >
          Sign out
        </button>
      </div>
    ) : (
      <button type="button" className="secondary" onClick={() => setSigningIn(true)}>
        Sign in
      </button>
    )
  ) : null;

  return (
    <>
      <div hidden={screen.kind !== 'SKY'} className="page">
        <ExplorerPage
          learnerId={learnerId}
          identityEnabled={learnerId !== null}
          onStartLesson={startLesson}
          accountSlot={accountSlot}
        />
      </div>
      {screen.kind === 'WALKTHROUGH' && (
        <WalkthroughView
          walkthrough={screen.walkthrough}
          starting={starting || !learnerId}
          onStartAssessment={() => void startAssessment(screen.choice)}
          onExit={() => setScreen({ kind: 'SKY' })}
        />
      )}
      {screen.kind === 'LESSON' && (
        <LessonView lesson={screen.lesson} onExit={() => setScreen({ kind: 'SKY' })} />
      )}
      {screen.kind === 'PROGRESS' && (
        <ProgressPage
          onBack={() => setScreen({ kind: 'SKY' })}
          onStartLesson={() =>
            lastChoice ? void startLesson(lastChoice) : setScreen({ kind: 'SKY' })
          }
        />
      )}
      {screen.kind === 'ANALYTICS' && <AnalyticsPage onBack={() => setScreen({ kind: 'SKY' })} />}
      {signingIn && (
        <SignInDialog
          onClose={() => setSigningIn(false)}
          onSignedIn={(signedIn) => {
            setUser(signedIn);
            setSigningIn(false);
          }}
        />
      )}
    </>
  );
}

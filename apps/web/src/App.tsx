import { useEffect, useState } from 'react';

import type { LessonSessionV2 } from '@ufuq/contracts';

import { createDevelopmentLearner, listDatasets } from './api.js';
import { ExplorerPage } from './explorer/ExplorerPage.js';
import { LessonView } from './lesson/LessonView.js';

/**
 * The sky explorer is the first page (report UC-102); a lesson opens only from its top bar
 * and returns to the same sky. One in-memory development learner per tab (IMP-016) keeps
 * adaptive support across lessons.
 */
export function App() {
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [identityEnabled, setIdentityEnabled] = useState(true);
  const [lesson, setLesson] = useState<LessonSessionV2 | null>(null);

  useEffect(() => {
    listDatasets()
      .then((response) => {
        setIdentityEnabled(response.developmentIdentityEnabled);
        if (!response.developmentIdentityEnabled) return undefined;
        return createDevelopmentLearner().then((learner) => setLearnerId(learner.learnerId));
      })
      .catch(() => setIdentityEnabled(false));
  }, []);

  return (
    <>
      <div hidden={lesson !== null} className="page">
        <ExplorerPage
          learnerId={learnerId}
          identityEnabled={identityEnabled}
          onLessonStarted={setLesson}
        />
      </div>
      {lesson && <LessonView lesson={lesson} onExit={() => setLesson(null)} />}
    </>
  );
}

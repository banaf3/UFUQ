# Phase 3B/4: navigation lessons, report-based BKT, Qibla, MySQL accounts and dashboards

## Purpose and user-visible outcome

The owner asked (2026-11-15) for lessons that teach each figure a learner can see in the
scenario, tracing from one figure to the next with lines and smooth camera moves until
al-Jady, True North and the Qibla. Assessment then asks the learner to find each target
with figure lines but no names, and without lines once the learner's Bayesian Knowledge
Tracing (BKT) mastery is high, as the founding report describes (storyboard figures 3-5
to 3-7, Table 2-5). Each learner has an account and a stored mastery state per skill,
a progress dashboard, and administrators see read-only analytics (use cases UC-101 to
UC-105). The work also prepares the PSM 2 Evaluation 1 rubric (70 % of the proposed
design implemented).

Demonstrable: register, log in, open a lesson, watch the walkthrough, answer the
assessment, see the support level change, see the dashboard change; an administrator
sees aggregate analytics. Everything runs on the real anwāʾ sky in the review preview.

## Classification and authority

- Owner decisions of 2026-11-15 (chat): MySQL 8.4 for persistence; learner direction
  tolerance 15° for True North and the Qibla (IMP-012); build UC-101, UC-104 and UC-105;
  use the report's BKT values and rules ("as the report stated").
- Report values used, unchanged: P(L0) 0.20, P(T) 0.10, P(G) 0.20, P(S) 0.10 (Table 3-14);
  threshold 0.85, "equal to or greater than" (§2.5.4); the adaptive responses of
  Table 2-5; update after every assessment attempt (§2.5.4 steps 1-8); five KCs (§2.5);
  spherical-trigonometry Qibla (NFR-2).
- Interpretations by the implementer, flagged for review: the mapping of the report's
  three presentation levels to GUIDED / FADING / INDEPENDENT; "repeated correct responses
  without hints" read as two; FADING restored to GUIDED on an incorrect answer below the
  threshold (UC-103 A1 step 3).
- Nothing becomes APPROVED. Every real record stays REVIEW_REQUIRED, so strict
  ScientificProfileV1 lessons still fail closed and the review preview runs them.

## Progress

- [x] 2026-11-15 Read the report (§2.5, §3.3-3.8), the rubric and the current code.
- [x] 2026-11-15 MySQL 8.4.9 installed with winget (owner approved).
- [x] 2026-11-15 Report-based adaptive learning configuration and figure-line cues.
- [x] 2026-11-15 Qibla direction (Kaaba record, spherical bearing, independent oracle).
- [x] 2026-11-15 Walkthrough frames and the lesson flow on the anwāʾ sky.
- [x] 2026-11-15 MySQL schema, migrations, persistence adapters, integration suite.
- [x] 2026-11-15 Accounts (UC-101), dashboard (UC-104), analytics (UC-105), system log.
- [x] 2026-11-15 Tests, e2e, documentation, PSM 2 readiness map.
- [ ] Replay of matching retries (request fingerprints), IMP-015.

## Surprises and discoveries

- The MSI installs no Windows service; the development server is a user process
  (`scripts/dev/mysql-local.mjs`), data outside the repository.

## Decision log

See `docs/IMPLEMENTATION_DECISIONS.md` (IMP-012, IMP-014, IMP-015, IMP-017, IMP-023).

## Outcomes and retrospective

Delivered 2026-11-15; evidence in `docs/PHASE4_LESSONS_ACCOUNTS_PERSISTENCE.md`. A
browser run on the real sky showed the report's progression: lines only for two lessons,
then from memory, for all four assessed skills. Remaining: retry replay, evaluation
sessions (BKT-005), and every named approval.

## Context and orientation

- `packages/tutoring-core`: BKT, observation rules, scaffold policy, cue vocabulary.
- `data/curation/tutoring/learning-configuration.v1.json`: the real configuration.
- `data/curation/{patterns,relationships,routes}`: lesson content; `tools/catalogue`
  generates `lesson-content-v1`.
- `apps/api/src/lesson/lesson-service.ts`: lessons, cue snapshots, scoring.
- `apps/web/src/lesson/LessonView.tsx`: the lesson screen over the shared sky renderer.

## Dependencies and manual inputs

- MySQL 8.4 running locally (`node scripts/dev/mysql-local.mjs start`).
- Named reviewers for every approval remain owner actions.

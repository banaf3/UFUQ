# Lesson-route curation

`routes.v1.json` holds the reviewed-source `LessonRoute` records (all `REVIEW_REQUIRED`).
The server selects the first eligible route by `selectionPriority`; no pattern is
hard-coded as the entry point (IMP-018). Each step names one primary knowledge component
(`knowledgeComponentId`); that mapping is a proposal for EDU-002 review, recorded in the
file's `knowledgeComponentMappingNote`.

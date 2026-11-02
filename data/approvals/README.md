# Approval records

This directory holds named-reviewer decisions for generated ScientificProfileV1
artifacts. It is empty until a reviewer decides. No agent or script may create an
`APPROVED` record on its own: approval is a human decision with a named reviewer, a
date, and a decision reference.

## Why approvals gate execution

ScientificProfileV1 fails closed: real execution needs every leap, EOP, observer,
star, and time-domain artifact to be `APPROVED` for `SCIENTIFIC_PROFILE_V1`, and every
lesson content record used by a route to be `APPROVED`. Until then, the API returns
`REQUIRED_STATE_NOT_SCIENTIFICALLY_APPROVED` (or the time/EOP equivalent), and a
reviewer can inspect the real outputs only through the explicit local
`REVIEW_PREVIEW` scope (`UFUQ_ENABLE_REVIEW_PREVIEW=1`).

## Procedure

1. See what is pending: `node scripts/approvals/status.mjs`.
2. The reviewer reads the evidence for the artifact (the decision records in
   `docs/spikes/`, the manifests in `data/manifests/`, and the generated artifact), and
   inspects the real sky in `REVIEW_PREVIEW`.
3. Print a template: `node scripts/approvals/status.mjs --template <artifactId>`.
4. Save it as `data/approvals/<artifactId>.approval.v1.json` and fill in the decision:

   ```json
   {
     "approvalType": "UFUQ_SCIENTIFIC_APPROVAL_RECORD",
     "schemaVersion": 1,
     "artifactId": "observer-umpsa-pekan-v1",
     "payloadSha256": "<copied by the template; binds the decision to these exact bytes>",
     "approval": {
       "state": "APPROVED",
       "scope": "SCIENTIFIC_PROFILE_V1",
       "reviewer": "<name, role>",
       "decisionDate": "YYYY-MM-DD",
       "decisionReference": "<minutes, email, or document reference>"
     }
   }
   ```

   `state` may also be `NOT_APPROVED`. The EOP bundle takes separate `fieldApprovals`
   for `UT1_MINUS_UTC`, `XP`, and `YP`, because one field never promotes another.
5. The learning configuration (`learning-configuration-v1`) is approved like any other
   artifact once BKT-001..BKT-005 are decided: edit
   `data/curation/tutoring/learning-configuration.v1.json`, regenerate, then record the
   approval for the new payload hash (see `docs/PHASE3_ASSESSMENT_AND_BKT.md`). The
   proposed step-to-KC mapping is reviewed with each route (EDU-002).
6. Content records (patterns, relationships, routes, scenarios) carry their own `review`
   blocks in `data/curation/`. The cultural, Arabic-language, and educational reviewers
   update those blocks.
7. Run `npm run data:generate` (needs the local raw evidence), then `npm run check`.
   The generator refuses a stale record whose `payloadSha256` no longer matches.

A changed artifact or content record produces a new payload hash, so an earlier
approval never silently carries over to different bytes.

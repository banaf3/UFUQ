---
name: ufuq-historical-arabic-sky-evidence
description: Research and review evidence for historical Arabic and Arabian star names, asterisms, constellations, directional relationships, and seasonal sky concepts. Use only when explicitly invoked for historical or cultural evidence work; separate source attestation, interpretation, geographical scope, modern star identification, and lesson approval. Do not use for numerical astronomy, catalogue parsing, or neutral rendering.
---

# UFUQ historical Arabic sky evidence

This skill is an evidence-review procedure. It does not supply a predetermined list of
patterns, prove regional use from general Arabic material, or approve lesson content.

## Invocation policy and trigger conditions

Invoke this skill explicitly as `$ufuq-historical-arabic-sky-evidence` when the task
asks for source-led research or review of:

- historical Arabic or Arabian star names, expressions, groupings, asterisms, or
  constellations;
- claimed historical membership, line drawings, directional relationships, seasonal
  markers, or anwāʾ concepts;
- source-language text, transliteration, translation, source tradition, period,
  geography, aliases, competing interpretations, or human review;
- whether an evidence-backed cultural claim may proceed to lesson-approval review.

The metadata policy disables implicit invocation. Nearby tasks that must not activate
this skill include:

- Hipparcos acquisition, parsing, normalized numerical fields, or artifact provenance;
  use `ufuq-catalogue-provenance`;
- proper motion, Astropy comparison, coordinate transformation, scene-coordinate
  validation, or star visibility; use `ufuq-astronomy-validation`;
- modern Qibla geodesy; use `ufuq-qibla-geodesy`;
- neutral star rendering, generic pattern-line rendering, or synthetic route-schema
  tests that make no historical or cultural claim.

## Required project files

Read `AGENTS.md`, `docs/DATA_STRATEGY.md`, `docs/IMPLEMENTATION_DECISIONS.md`,
`docs/PHASES.md`, the cultural-content sections of `docs/ARCHITECTURE.md`,
`docs/references/UFUQ_SOURCE_REGISTER.md`, `docs/references/SOURCE_GAPS.md`,
`docs/references/syntheses/arabian-sky-evidence-synthesis.md`, and this skill's four
operational reference files plus `references/traceability.md`. Read
`docs/governance/OPEN_QUESTIONS.md` only when formal approval is in scope. Open only
the study dossiers and exact local source pages linked for the affected claim.

## Source authority order

Authority is claim-specific:

1. A verified primary source controls what its own text attests, within the limits of
   its edition, witness, date, and scope.
2. Claim-specific scholarly analysis controls only the interpretation or crosswalk it
   argues; it does not become wording in the primary source.
3. The source register and dossiers control UFUQ's recorded limits and citation
   status.
4. Qualified language, historical, cultural, and educational reviewers control their
   recorded review decisions.
5. Project decisions control UFUQ's evidence-management process and pedagogy, not
   historical truth.

Ibn Qutaybah, Kunitzsch, Hafez/al-Ṣūfī, and King have different roles described in
`references/source-notes.md`; none acquires broader geographical authority merely
because it uses Arabic or discusses Arabia or Islam.

## Evidence dimensions

Record these project evidence-management dimensions separately. They are not source
vocabulary and no value in one dimension supplies a value in another.

- Attestation: `ATTESTED`, `UNVERIFIED`, `NOT_FOUND_IN_REVIEWED_SCOPE`.
- Referent type: `STAR`, `STAR_PAIR`, `ASTERISM`, `CONSTELLATION`,
  `DIRECTIONAL_RELATIONSHIP`, `SEASONAL_MARKER`, `ANWA_CONCEPT`, `OTHER`,
  `UNRESOLVED`.
- Modern identification: `EXPLICIT_IN_SOURCE`, `SCHOLARLY_PROPOSED`,
  `MODERN_CROSSWALK`, `DISPUTED`, `UNRESOLVED`.
- Geographic basis: `EXPLICIT_IN_SOURCE`, `SCHOLARLY_INFERENCE`,
  `PROJECT_HYPOTHESIS`, `UNKNOWN`.
- Review: `NOT_REVIEWED`, `LANGUAGE_REVIEWED`, `HISTORICALLY_REVIEWED`,
  `APPROVED_FOR_LESSON`, `NOT_APPROVED_FOR_LESSON`.

`NOT_FOUND_IN_REVIEWED_SCOPE` means only that the bounded review did not find the
claim. It is not evidence that the claim is historically false.

## Mandatory workflow

1. Start from the source material relevant to the research question. State one atomic
   claim facet; do not search for confirmation of a student-supplied or project example
   list.
2. Separate verbatim/source-text meaning, later scholarly interpretation, Codex
   inference, and project decision. Never attribute one layer to another.
3. Record the canonical source ID, edition or witness status, exact page/section/
   verse/folio/table when available, period, source tradition, and any text-layer or
   translation limitation. Never fabricate a location.
4. Assign attestation, referent type, modern-identification status, geographic basis,
   and review status independently using the values above.
5. Answer independently whether the source contains the expression; what it denotes;
   its tradition; explicit geography; any scholarly modern identification and proposed
   objects; exact membership; line drawing; directional use; and lesson approval.
   Evidence for one answer does not establish another.
6. Link a proposed modern identification only through stable catalogue IDs and its own
   evidence argument. Keep numerical coordinates in catalogue artifacts, never in the
   historical evidence record.
7. Preserve exact source forms already recorded, aliases, transliteration and
   translation uncertainty, competing identifications, and genuine source conflicts.
8. Use `NOT_FOUND_IN_REVIEWED_SCOPE`, `UNKNOWN`, or `UNRESOLVED` when evidence is
   absent or inadequate. Record a contradiction only when a cited source or scholarly
   analysis actually contradicts the exact claim.
9. Record language, historical, cultural, and lesson-review roles and outcomes
   separately. Codex cannot set `APPROVED_FOR_LESSON`.
10. Check every conclusion against `references/traceability.md` and report with
    `references/output-template.md`. Unresolved facets remain excluded from
    learner-facing content without being declared historically false.

## Required evidence

- Canonical source ID and a verified exact location when the source permits one.
- Exact source-language text already verified for the claim, transliteration system
  and output, translation source, period, tradition, and geographic basis.
- Separate evidence for name attestation, referent, membership, geometry, direction,
  modern catalogue identification, and lesson approval.
- Alternate readings, conflicts, uncertainty, text-layer/edition limits, and named
  human-review role/date/status.
- Clear labels for `SOURCE_SUPPORTED_FACT`, `PROJECT_DECISION`,
  `PROVISIONAL_CHOICE`, and `UNRESOLVED_QUESTION`.

## Stop conditions

Stop the affected conclusion when its source, location, edition/witness, text,
translation, referent, geography, identification argument, conflict treatment, or
required human review cannot be verified. Mark only that facet `UNVERIFIED`, `UNKNOWN`,
or `UNRESOLVED`. Missing or unusable local material must produce a gap, never a
reconstructed claim. Stop learner-facing use unless an authorized human decision
explicitly records `APPROVED_FOR_LESSON`.

## Prohibited assumptions

Do not begin from a predetermined set of “Najdi constellations.” An Arabic name is not
automatically ancient Arabian, indigenous Arabian, Bedouin, or Najdi. General Arabian
evidence does not establish use in Najd. A name does not establish exact members; a
member identification does not establish a canonical line; a modern crosswalk is not
historical-source wording; historical attestation is not lesson approval. Do not
invent Arabic, translations, catalogue IDs, pattern geometry, directions, or cultural
meaning, and do not treat absence in a bounded review as disproof.

## Required output

Use `references/output-template.md`. Report each evidence dimension, the independent
claim-facet answers, exact source pointers, source/interpretation/project layers,
conflicts, allowed use, follow-up, and stop condition.

## Relevant validation commands

For documentation-only work:

```text
$env:PYTHONUTF8='1'
python <skill-creator>/scripts/quick_validate.py .agents/skills/ufuq-historical-arabic-sky-evidence
npm run format:check
git diff --check
```

Also apply the citation-range, mandatory-rule traceability, activation-policy, and
restricted-file assertions recorded in `docs/references/SKILL_VALIDATION.md`. When real
curation records exist, run `npm run data:verify`, schema checks, and
referential-integrity checks. Technical validity never grants cultural approval.

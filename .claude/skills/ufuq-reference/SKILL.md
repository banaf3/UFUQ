---
name: ufuq-reference
description: Research a UFUQ project-report topic, verify its public references, or propose an evidenced extension. Use for requested report work, not ordinary implementation tasks.
argument-hint: '<topic or question>'
---

# UFUQ report reference research

Research the user's topic: $ARGUMENTS

Apply `AGENTS.md` and read `docs/REPORT_REFERENCE_WORKFLOW.md`. A request to use the
report, including invocation of this skill, authorizes focused report reading under
those rules. If the task is only ordinary implementation, use the approved specs;
do not open the private report just because it exists.

## Locate and inspect

- Check `docs/STATUS.md`, the owning technical spec/ADR, and existing
  `docs/governance/RESEARCH_NOTES.md`, `TRACEABILITY.md`, and `REPORT_DEVIATIONS.md`
  where the topic concerns report evidence. Preserve their authority classifications.
- The source is `local-reference/CB23011_FYP_REPORTv2.pdf`. Prefer the private
  `local-reference/.workbench/REPORT_MAP.md` if present; verify its source fingerprint
  before trusting page numbers. A new edition needs a fresh map.
- Read only relevant pages, including the original source citation and qualifications.
  Use the PDF viewer's 1-based page number; record the printed label separately.
  Inspect page images for equations, Arabic text, diagrams, and tables.
- Native Claude PDF reads accept `pages` ranges. If unavailable, use
  `scripts/report_reference.py` beside this skill with `inspect`, `search`, or `read`.
  Run it with an installed Python and pypdf; do not install application dependencies
  or use an online PDF converter. Extraction is not reliable visual proof.

## Verify and extend

- Follow cited public papers to their publisher/DOI and check what the full source
  actually supports. Distinguish abstract-only inspection from full-text review.
  Never use private excerpts as search queries or upload the report to a web tool.
- Classify findings as project intent, public-source evidence, an unresolved choice,
  a conflict, or a proposed extension. Label a source suggested by new research
  separately from one actually cited in the report.
- For stars, separate catalogue identity/astrometry, cultural labels and pattern
  membership, instructional geometry, route composition, and reference calculations.
  No inferred catalogue IDs, copied coordinates, guessed Arabic, or invented edges.
- For each useful extension, identify the existing requirement/decision IDs, missing
  evidence, owning package, applicable phase, test/oracle, and review needed. Keep
  candidate findings provisional; do not approve yourself or change readiness.

## Output and promotion

Keep new report-derived notes and proposals under `local-reference/.workbench/`.
Use the review-record fields in the guide. Do not save PDF contents in auto memory,
tracked documentation, public issues, test fixtures, or build output. User-facing
answers may explain findings without reproducing long report passages or personal data.

For a requested implementation, use only approved values and the applicable phase
workflow. New report-derived requirements need the user's approval of the exact
paraphrase before entering tracked specs; scientific/cultural approval is separate.
Public-source research/tooling can be tracked with citations and limitations.

Finish with the relevant report locators, sources actually inspected, gaps/conflicts,
proposed next action, and any human review still needed. Do not call an inaccessible
reference verified or claim educational effectiveness from BKT/visual tests.

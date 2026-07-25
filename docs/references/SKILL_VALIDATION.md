# UFUQ repository-skill validation

**Validation date:** 2026-07-25

## Method

The five repository-scoped skills are validated with the skill-creator validator,
directory/front-matter and required-file assertions, activation-policy assertions,
must-pass prompt-routing cases, mandatory-rule traceability assertions, and repository
scope/tracking scans.

The prompt cases below validate the declared metadata and explicit-invocation policy;
they do not claim that every Codex client supports dynamic project-skill discovery.
Historical evidence still requires source review after activation.

## Historical-skill migration record

On 2026-07-25, the project skill formerly named
`ufuq-najdi-arabian-sky` was renamed to
`ufuq-historical-arabic-sky-evidence`. The rename is a project organization decision,
not a historical classification. It removes region-first framing, requires source-led
research, separates evidence dimensions, and disables implicit invocation. This is
the only active historical Arabic/Arabian sky-evidence skill.

## Structural validation

| Skill | Front matter | Directory/name | Required references | Description/policy scope |
|---|---|---|---|---|
| `ufuq-engineering-quality` | PASS | PASS | PASS | Engineering architecture, boundaries, reproducibility, and test evidence only |
| `ufuq-astronomy-validation` | PASS | PASS | PASS | Celestial coordinate/time/observer and independent astronomy validation only |
| `ufuq-catalogue-provenance` | PASS | PASS | PASS | Catalogue acquisition-to-artifact provenance only |
| `ufuq-qibla-geodesy` | PASS | PASS | PASS | Modern Qibla geodesy and numerical reference cases only |
| `ufuq-historical-arabic-sky-evidence` | PASS | PASS | PASS | Explicit invocation only; historical Arabic/Arabian source evidence and review preparation |

“Required references” means `source-notes.md`, `review-checklist.md`,
`output-template.md`, and `traceability.md`.

The skill-creator check uses UTF-8 mode because source titles and transliterations
contain non-ASCII characters:

```powershell
$env:PYTHONUTF8='1'
python <skill-creator>/scripts/quick_validate.py <skill-directory>
```

## Historical-skill activation tests

Because `.agents/skills/ufuq-historical-arabic-sky-evidence/agents/openai.yaml` sets
`policy.allow_implicit_invocation: false`, only prompts that explicitly name the skill
activate it. The expected behavior is intentionally narrower than semantic relevance.

| # | Prompt case | Expected behavior | Result |
|---:|---|---|---|
| 1 | “Use `$ufuq-historical-arabic-sky-evidence` to investigate an existing historical Arabic star-name claim from the reviewed sources.” | Activate historical-evidence skill | PASS |
| 2 | “Use `$ufuq-historical-arabic-sky-evidence` to compare Ibn Qutaybah and Kunitzsch on an existing expression.” | Activate; separate primary attestation from secondary interpretation | PASS |
| 3 | “Use `$ufuq-historical-arabic-sky-evidence` to prepare the evidence for a lesson-content approval review.” | Activate; prepare record but do not grant approval | PASS |
| 4 | “Investigate whether this historical Arabic name is attested.” | Do not activate automatically; explicit invocation is required | PASS |
| 5 | “Compare two historical sources for a claimed asterism membership.” | Do not activate automatically; explicit invocation is required | PASS |
| 6 | “Parse Hipparcos I/311 fields and normalize `pmRA`.” | Do not activate; use catalogue provenance | PASS |
| 7 | “Compare propagated coordinates against independently configured Astropy.” | Do not activate; use astronomy validation | PASS |
| 8 | “Validate catalogue-to-scene coordinate conversion.” | Do not activate; use astronomy validation | PASS |
| 9 | “Render neutral HIP stars as points in React Three Fiber.” | Do not activate | PASS |
| 10 | “Render generic synthetic pattern-line segments with no cultural labels.” | Do not activate | PASS |
| 11 | “Check deterministic catalogue artifact hashes and provenance.” | Do not activate; use catalogue provenance | PASS |
| 12 | “Verify a modern ellipsoidal Qibla bearing.” | Do not activate; use Qibla geodesy | PASS |
| 13 | “Review a LessonRoute TypeScript interface containing only synthetic IDs.” | Do not activate | PASS |
| 14 | “Approve this historical name for a lesson.” | Do not activate automatically; even after explicit invocation, Codex cannot set `APPROVED_FOR_LESSON` | PASS |

The explicit cases prove the skill can be intentionally selected. Cases 4–14 prove
that semantic adjacency, including neutral rendering and technical astronomy, does not
override the disabled implicit policy.

## Other skill activation checks

| Skill | Prompt that should activate | Nearby prompt that should not activate |
|---|---|---|
| `ufuq-engineering-quality` | “Review whether splitting another UFUQ npm workspace improves maintainability and CI evidence.” | “Fix a typo in a React health-screen heading.” |
| `ufuq-astronomy-validation` | “Validate ICRS catalogue-epoch propagation to a UTC observer scenario against Astropy fixtures.” | “Decide how the acquisition manifest records SHA-256 and null normalization.” |
| `ufuq-catalogue-provenance` | “Check that two catalogue builds serialize identical UTF-8/LF bytes and provenance hashes.” | “Add a generic synthetic LessonRoute schema test with no cultural claim.” |
| `ufuq-qibla-geodesy` | “Verify an ellipsoidal Qibla bearing for approved observer and destination datums.” | “Summarize a historical qibla-map method without a modern calculation.” |

## Overlap rules

| Overlap | Resolution |
|---|---|
| Catalogue provenance and astronomy validation | Catalogue proves inputs, fields, and artifact provenance; astronomy proves transformations and scientific comparisons. |
| Astronomy validation and Qibla geodesy | Use both only when a task connects a terrestrial Qibla bearing to celestial guidance; keep coordinate pipelines separate. |
| Catalogue provenance and historical sky evidence | Catalogue proves numerical IDs and rows. The explicitly invoked historical skill reviews names, identifications, membership, geography, and lesson evidence. Neither implies the other. |
| Engineering quality with any domain skill | Engineering quality may audit reproducibility and boundaries but cannot supply scientific or cultural authority. |
| Historical Qibla and modern geodesy | The Qibla skill is modern numerical geodesy. Historical interpretation belongs to the historical-evidence skill only when explicitly invoked. |

No BKT/adaptive-scaffolding, 3D-interaction, security, persistence, or
participant-study skill exists because `SOURCE_GAPS.md` records inadequate source
support.

## Source-derivation validation

Each `SKILL.md` reads one matching synthesis and its
`references/traceability.md`. Traceability maps every numbered mandatory workflow rule
and important stop/prohibition rule to an exact dossier location, project decision,
experiment requirement, human-review requirement, or unresolved stop condition.

| Skill | Numbered workflow rules | Traceability rows for those rules | Unsupported rules |
|---|---:|---:|---:|
| `ufuq-engineering-quality` | 9 | 9 | 0 |
| `ufuq-astronomy-validation` | 9 | 9 | 0 |
| `ufuq-catalogue-provenance` | 8 | 8 | 0 |
| `ufuq-qibla-geodesy` | 9 | 9 | 0 |
| `ufuq-historical-arabic-sky-evidence` | 10 | 10 | 0 |

The historical skill's five evidence dimensions are project process terms. Source
locations support the underlying claim distinctions and limitations; they are not
represented as vocabulary used by a historical author.

## Source-absence and copyright checks

- Every skill consults `UFUQ_SOURCE_REGISTER.md` and the relevant gaps before making a
  source-dependent claim.
- Every skill consults its synthesis and traceability file before treating a mandatory
  rule as binding.
- Missing, unusable, or unverified evidence narrows or stops the affected facet; it
  does not cause invention or historical disproof.
- Local PDF paths are not required for ordinary activation.
- Skill/reference files contain concise original procedural notes, not copied
  passages.
- Tracked documents contain citations and location pointers, not restricted source
  text.

## Repository-scope result

- All referenced tracked project files exist.
- No application, package, catalogue-tool, astronomy-tool, rendering, API, or UI
  source file is changed by this refactor.
- No PDF, `local-reference` file, raw catalogue byte, secret, build output, or
  `*.tsbuildinfo` file belongs in the proposed tracked set.

SKILL_VALIDATION: PASS

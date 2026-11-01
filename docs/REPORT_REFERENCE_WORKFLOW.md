# Using the project report with Claude Code

This is a research workflow, not a new scientific specification. It implements the
owner's request to use the private report while preserving its Git exclusion and
the existing approval boundaries. It contains no new report-derived requirements.

## Start a focused reference session

From the UFUQ root, start your installed Claude Code with the provided settings:

```powershell
claude --settings .claude/skills/ufuq-reference/reference-session.json
```

This disables auto memory for that invocation. It does not disable normal session
transcripts or provider processing. Local files read into model context are sent to
the configured model service; Git ignore only controls Git. Review your account's
data settings before using private material. Do not share a report research session
through feedback/transcript-sharing features. See [Anthropic data usage](https://code.claude.com/docs/en/data-usage)
and [memory settings](https://code.claude.com/docs/en/memory).

Then run, for example:

```text
/ufuq-reference Check the catalogue-to-local-sky pipeline against the cited primary sources. Keep new report-derived notes private and identify gaps without choosing production values.
```

The repository skill is `.claude/skills/ufuq-reference/SKILL.md`. It can be selected
for relevant requests or invoked by name; it does not read the PDF automatically
at startup. If the command is missing, restart Claude Code from this repository and
check its skill list. [Claude Code skills](https://code.claude.com/docs/en/skills)
documents project skill discovery and slash-command invocation.

## Read the report without loading it into every task

Use `local-reference/.workbench/REPORT_MAP.md` for private page navigation if it is
available on this computer. Check its SHA-256 against the current PDF before relying
on it. The file and its contents are deliberately not available from a fresh clone.

Ask Claude to read only the relevant PDF pages and source citations. Use 1-based PDF
viewer page numbers; keep printed page labels and section numbers separately. Native
Claude Code reads PDFs over 10 pages in ranges of up to 20 pages and needs Poppler's
`pdftoppm` on PATH for that operation. On Windows, install a trusted Poppler build if
it is absent, then restart the terminal/IDE. [Read tool documentation](https://code.claude.com/docs/en/tools-reference#read-tool-behavior)
describes these requirements.

For text navigation, an optional read-only helper is included. It requires Python
3.11+ and the pinned pypdf dependency; it is not part of the application's runtime.
Use a research virtual environment, not npm dependencies. Example Windows setup:

```powershell
py -3 -m venv local-reference/.workbench/.venv
local-reference/.workbench/.venv/Scripts/python.exe -m pip install -r .claude/skills/ufuq-reference/scripts/requirements.txt
```

Use that Python executable in place of `python` below if Python is not on PATH:

```powershell
python .claude/skills/ufuq-reference/scripts/report_reference.py inspect
python .claude/skills/ufuq-reference/scripts/report_reference.py search --query "Astronomical Rendering"
python .claude/skills/ufuq-reference/scripts/report_reference.py read --pages 79-83
```

`inspect` prints identity metadata; keep its fingerprint private. `search` returns
only matching page numbers and counts. `read` sends selected text to the session.
The helper does not write files, access the network, or alter the source. It does
not OCR scanned pages or validate diagrams. Visually inspect equations, Arabic,
tables, and citations; extraction can drop signs, reorder columns, or garble text.
Do not redirect a full extraction into tracked folders or attach the PDF to a web tool.

## Use each source for the question it can answer

| Question                                                 | Evidence to use                                                     | What it does not establish                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| What is UFUQ intended to teach/build?                    | Report section plus approved requirements and traceability          | Scientific accuracy or current implementation              |
| Which astronomical object is intended?                   | Documented identifier cross-match, then selected catalogue metadata | Cultural membership or instructional geometry              |
| What coordinates and motion fields should be used?       | Approved catalogue/table/version and source metadata                | Automatic production approval or redistribution rights     |
| Is a cultural name, pattern, or guidance edge authentic? | Named source edition/location and competent cultural review         | An IAU name alone does not settle every cultural tradition |
| Is a local-sky calculation correct?                      | Independent pinned reference calculations with the same conventions | A plausible screenshot or copied runtime formula           |
| Does tutoring improve learning?                          | Approved educational evaluation                                     | BKT probabilities or software test results alone           |

Existing context is already organized in `docs/governance/TRACEABILITY.md`,
`REPORT_DEVIATIONS.md`, and `RESEARCH_NOTES.md`. Use their requirement and decision
IDs. Avoid creating a parallel requirements register or treating a pending deviation
as approved. If documents conflict, record the conflict and narrow the affected work;
do not silently rewrite the report's intent.

## Extend the astronomy references first

These are research candidates and checks, not catalogue or policy selections:

- **Object identity:** [SIMBAD](https://simbad.cds.unistra.fr/simbad/) supports queries
  by names/identifiers and exposes catalogue links. Use it to investigate ambiguous
  aliases, components, and cross-identifications; preserve the original identifier
  and provenance. Names are not coordinate keys.
- **Catalogue semantics:** investigate the candidate [I/239 metadata](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/I/239?format=html&tex=true)
  and its ESA documentation for frame, reference epoch, motion conventions, quality
  fields, photometric band, and redistribution. The current fetch timed out; this
  page was not revalidated in this research session. AST-001 remains unresolved.
- **Transformation conventions:** [USNO sidereal time](https://aa.usno.navy.mil/faq/GAST)
  distinguishes mean/apparent sidereal time and UT1/TT inputs. Audit the complete
  pipeline; adding an LST formula alone does not resolve frame/epoch/time consistency.
- **Independent checks:** [Astropy AltAz](https://docs.astropy.org/en/stable/api/astropy.coordinates.AltAz.html)
  documents frame inputs and near-horizon refraction limitations. Record exact
  versions, location/time/frame/EOP/pressure choices before comparing results.
- **Names and cultural content:** [IAU naming guidance](https://iauarchive.eso.org/public/themes/naming_stars/)
  provides naming context. Treat it as one evidence source, not a substitute for
  review of Arabic labels, memberships, line segments, or historical claims. Its
  search-index excerpt was checked; the full page could not be retrieved this session.
- **Polaris teaching context:** the [Akbar and Mustaqim paper](https://jurnal.ar-raniry.ac.id/index.php/islamfutura/article/view/9411)
  discusses Polaris as a north reference and difficulties near the equator. Its
  abstract was checked; full-text methodology and any numerical conclusions still
  need inspection. It does not by itself validate UFUQ's chosen scenario or tolerance.

For one candidate lesson, research the complete chain: source-backed pattern
membership, stable star IDs, instructional edge and its classification, eligible
scenario, local sky positions, distinct True North target, and Qibla convention.
Map findings to `SkyPattern`, `GuidanceRelationship`, and `LessonRoute`; do not
invent missing edges or assume one named pattern must always be first.

## Keep a private review record, then promote deliberately

For each finding, record these fields under `local-reference/.workbench/`:

- Topic and related existing FR/IMP/AST/BKT/EDU/DEV identifiers.
- Source edition/fingerprint; section, PDF page, printed label, figure/table if relevant.
- Classification: report intent, public evidence, unresolved choice, conflict, or extension.
- Short paraphrase; public source URL/DOI and precise locator; access date.
- Inspection status: full text, abstract only, metadata only, or inaccessible.
- Support and limits: whether the source entails the claim; assumptions and disagreements.
- Candidate implementation boundary, phase, independent test, and missing inputs.
- Review status, reviewer/authority, date, and exact proposed tracked paraphrase.

Private notes are proposals, not approvals. The user reviews the exact new paraphrase
before report-derived requirements enter tracked specs. Scientific/cultural decisions
also need the applicable domain authority. Then update the owning spec/ADR and
existing decision/traceability registers as relevant, preserving unresolved status
until evidence and approval actually exist. Do not move the report, copy its diagrams
into fixtures, or manufacture stars/coordinates to complete a record.

Public-source research can extend `RESEARCH_NOTES.md` with citations and limitations;
new implementation must still meet `docs/PHASES.md` and `docs/TEST_PLAN.md`.

## Useful next prompts

```text
/ufuq-reference Audit one proposed sky-pattern route: list source evidence needed for membership, identifiers, guidance geometry, and scenario availability. Keep gaps explicit.
```

```text
/ufuq-reference Follow the astronomy references and propose an independent comparison harness for Phase 1. Keep production choices unresolved and do not implement it yet.
```

```text
/ufuq-reference Compare one report requirement with its current spec and implementation. Record conflicts privately and propose the exact paraphrase for my review.
```

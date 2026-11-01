# Agent workflow

How any coding agent (Claude Code, Codex, or another) works on UFUQ, so the owner does
not need to repeat instructions each session. `AGENTS.md` holds the repository rules;
this file holds the session process. `docs/HANDOFF.md` is the short progress file read
first in every session.

## Owner standing instructions

Recorded from the owner on 2026-11-01. They apply to every session until the owner
changes them here.

1. **Continue the work.** Start from `docs/CLAUDE_START_PROMPT.md`: assess the real
   state, choose the next justified bounded increment, implement it, verify it, and
   document it. Do not stop between steps unless a Git checkpoint or a genuine owner
   or domain decision requires it.
2. **Git checkpoints.** At the start, at meaningful checkpoints, and at handoff,
   assess branch, commit, push, pull-request, and cleanup needs. When an action is
   justified, give the reason, exact names, and copyable commands. When none is
   needed, say so in one line and go straight to the next step.
3. **The report is the system document.** `local-reference/CB23011_FYP_REPORTv2.pdf`
   defines the system and may be extended. Use `docs/REPORT_REFERENCE_WORKFLOW.md`
   for report research and promotion of new requirements.
4. **Cultural direction.** The owner's intended first learner route uses the
   Cassiopeia-region chair pattern (Dhāt al-Kursī) as the helper that leads to al-Jady
   (Polaris) and then to True North, with star knowledge drawn from the anwāʾ
   literature the owner supplied. This is an owner preference. Every name, membership,
   line segment, relationship, and historical classification still needs source
   evidence and review under `IMP-011` (see `.agents/skills/ufuq-najdi-arabian-sky/`).
5. **References.** Use the local library in `local-reference/` first. When evidence is
   missing, research public sources. If the needed source is not freely and lawfully
   available, name the exact reference (author, title, edition, ISBN/DOI where known)
   so the owner can buy it. Workflows and skills may be derived from the references,
   but book contents are never copied into tracked files.
6. **Document everything.** Leave the repository so another developer or agent can
   continue: update `docs/HANDOFF.md` every session, and keep `STATUS.md`,
   `IMPLEMENTATION_DECISIONS.md`, `PHASES.md`, `TEST_PLAN.md`, and ADRs consistent
   with what was delivered.
7. **Clean up what is off the system** when it is clearly harmless: stale generated
   files, leftover folders from removed workspaces, and broken line endings. Follow
   the destructive-command rules in `AGENTS.md` without exception.
8. **Plans may change** when solid sources justify it. Record the evidence and the
   reason in the owning decision document; never change a plan silently.
9. **Finish with the current phase** written in `docs/HANDOFF.md` and in the final
   message.

## Git authority and conventions

| Action | Authority |
| --- | --- |
| Fetch, status, log, diff, read-only inspection | Always allowed |
| Local branch creation/switch and local commits | Only when the owner authorizes it for the session; otherwise propose the commands |
| Push, merge into `main`, pull request, branch deletion, history rewrite | Always needs explicit owner approval |

- Commit author: `Abdullah Ba Nafea <abu.hd3@gmail.com>`. No Git identity is configured
  on the development machine, so pass it per command:
  `git -c user.name="Abdullah Ba Nafea" -c user.email="abu.hd3@gmail.com" commit ...`.
  Do not change global Git configuration.
- Branch names in use: `spike/<milestone-topic>`, `chore/<topic>`, `backup/<what>-<date>`.
- Commit subjects follow Conventional Commits with a scope, for example
  `docs(astronomy): close ProfileV1 transformation route blocker`. Milestone branches
  are merged into `main` with merge commits named `Merge Milestone <id> <topic>`.
- Stage explicit paths only. Never stage `.idea/`, `local-reference/`, `data/raw/`,
  generated output, or secrets.
- Always `git fetch --prune` before judging branch state. Remote state can move between
  sessions (in 2026-11 the local `main` was 28 commits behind).

## Session protocol

This protocol follows the long-running-agent practice that Anthropic describes in
[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
(read the progress file and Git log first, check the system still works before
changing it, do one feature at a time, verify before claiming done, and end with a
descriptive commit and an updated progress note). It is combined with UFUQ's evidence
and approval rules.

1. **Orient.** Confirm the directory and branch. Run `git fetch --prune`,
   `git status --short`, `git log --oneline -15`, `git branch -vv`, and
   `git worktree list`. Read `docs/HANDOFF.md`, then the "Authorized next work" and
   blocker sections of `docs/STATUS.md`. Open the remaining baseline documents from
   `AGENTS.md` only as the chosen task needs them.
2. **Check the baseline before editing.** Use the pinned Node 22.16.0 and npm 10.9.2.
   Install with `npm ci` if `node_modules/` is missing. Run `npm run check` and
   `npm run test`. If a gate fails before any change, diagnose it first: an inherited
   failure must not be mistaken for one caused by new work.
3. **Choose one bounded increment.** Prefer the next step named in `docs/HANDOFF.md`
   and `docs/PHASES.md`. Compare alternatives briefly when the tradeoff matters. An
   unresolved decision blocks only the behavior that depends on it.
4. **Implement in small, verified steps.** Use approved values only. Synthetic or
   provisional work must be visibly labelled. Never invent catalogue IDs, coordinates,
   Arabic forms, memberships, tolerances, or policies.
5. **Verify.** Run the gates in the table below that apply, plus new tests for the new
   behavior. Report exact results. Distinguish checks run in this session from
   historical evidence. A gate that fails is reported, never weakened.
6. **Document.** Update the owning specification, decision register, phase/test plan,
   and `STATUS.md` when behavior or decisions change. Always update `docs/HANDOFF.md`.
7. **Checkpoint.** Give the Git recommendation (or "no Git action needed") and, when
   authorized, commit with explicit paths.
8. **Hand off.** End with: outcome, files changed, checks and results, remaining
   uncertainties, the Git recommendation with exact commands, the current phase, and
   the next justified step.

## Verification gates

| Gate | Command | When |
| --- | --- | --- |
| Format, lint, types, boundaries, data guard | `npm run check` | Every change |
| Unit tests | `npm run test` | Every change |
| Build | `npm run build` | Code or configuration change |
| Public exports | `npm run exports:check` | Package export or manifest change |
| Browser smoke | `npm run test:e2e` | App, build, or configuration change |
| Reference comparison | `npm run test:reference` | Inactive until the first production/reference comparison; it fails closed when empty |
| Integration | `npm run test:integration` | Inactive until Phase 4 persistence; it fails closed when empty |
| Python oracle | `uv sync --locked --managed-python`, then `uv run --locked --no-sync python -m unittest discover -s tests -v` in `tools/astronomy-reference/` | Oracle or experiment change; needs uv 0.11.32 and CPython 3.14.6 |
| Targeted formatting | `npx --no-install prettier --check <files>` | Markdown/config-only change |

## Windows and toolchain pitfalls

- In PowerShell use `npm.cmd` and `npx.cmd` if script execution policy blocks the
  `.ps1` wrappers.
- In Git Bash set `MSYS_NO_PATHCONV=1` for Git `ref:path` arguments
  (`git show origin/main:docs/STATUS.md`); otherwise the path is rewritten.
- Git Bash can garble non-ASCII arguments passed to native programs. Put Arabic text
  in a UTF-8 script file instead of on the command line.
- The machine-wide `core.autocrlf=true` can leave stale CRLF files after a branch
  switch even though `.gitattributes` requests LF. If Prettier flags files you did not
  edit, compare `git hash-object <file>` with `git rev-parse HEAD:<file>`; when they
  match, delete the file and `git checkout -- <file>` to restore LF.
- No system Python is installed. The project oracle needs uv 0.11.32 and CPython
  3.14.6. Do not substitute an unpinned interpreter for evidence-bearing runs.
- If a website refuses automated download, do not work around it. Give the owner the
  link to download manually.

## Incident record

- **2026-11-01:** a `git clean -fdX` with pathspecs deleted every Git-ignored file,
  including the private reference library. Most of it was rebuilt and hash-verified
  from a Recycle Bin snapshot, the owner's original files, public re-downloads, and
  the agent session logs. The private record is
  `local-reference/RECOVERY_2026-11-01.local.md`. The destructive-command rules in
  `AGENTS.md` exist because of this incident.

# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-01.

## Current phase

**Phase 1: astronomy and data technical spike.** Milestones 1, 2A, 2B, and the 2C
scientific behaviour contract are closed on `main`. **Milestone 2D (data, source, and
deployment authority) is in progress** on `spike/source-data-deployment-authority`
(three commits, not yet merged). Its 2D.1 decision is `CATALOGUE_AUTHORITY_BLOCKED`:
Gaia DR3 is the preferred catalogue candidate, Polaris (`HIP 11767`) has no Gaia
crossmatch, and row, component, RV, rights, and fallback reviews remain open.

Readiness: scaffolding YES; validated vertical slice NO; participant study NO;
deployment NO. Production TypeScript still contains no astronomy calculation.

## Last completed increment

2026-11-01, branch `chore/claude-code-workflow`:

- Realigned the stale local clone to `origin/main`. The old local worktree is kept on
  `backup/local-worktree-2026-11-01` (not for merge).
- Added the agent instruction layer: `CLAUDE.md`, `docs/AGENT_WORKFLOW.md` (owner
  standing instructions and session protocol), this file, `docs/CLAUDE_START_PROMPT.md`,
  `docs/REPORT_REFERENCE_WORKFLOW.md`, Claude wrappers for the five `.agents/skills`, the
  `ufuq-reference` report skill, and a guard test in `tests/tooling/`.
- Recorded the owner's report-research authorization and a destructive-command safety
  rule in `AGENTS.md`, after an agent-caused `git clean` incident. The private library
  was rebuilt; 22 of 24 source checksums verify (see
  `local-reference/RECOVERY_2026-11-01.local.md`).

## Next justified step

1. Scope the first learner route to the owner's choice (Dhāt al-Kursī helper to al-Jady
   to True North, with anwāʾ-literature names) and feed its minimal star set into the
   Milestone 2D.1 allowlist and row review. Evidence work follows
   `.agents/skills/ufuq-najdi-arabian-sky/SKILL.md`.
2. Continue Milestone 2D: approve or reject Gaia DR3 rows for that minimal set, decide
   the Polaris fallback, and acquire the UMPSA Pekan observer record and leap/EOP
   artifacts.

## Open owner actions

- Download `SSHT-0046_Lo_res.pdf` (Savage-Smith & Belloli 1985) from the Smithsonian
  repository in a browser; the path and expected hash are in the recovery record.
- Re-obtain the Ibn ʿĀṣim al-Thaqafī text (`KTB_0032650.txt`) or the printed edition.
- Install uv 0.11.32 to run the Python oracle on this machine.
- The Gaia DR3 TAP response bytes from Milestone 2D.1B were acquired on another machine
  and are not present here.
- Approve pushing `chore/claude-code-workflow` and opening its pull request.

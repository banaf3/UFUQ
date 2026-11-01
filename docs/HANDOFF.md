# Session handoff

Read this first. Keep it short and current: replace, do not append history (history
belongs in `docs/STATUS.md` and Git). Updated 2026-11-01.

## Current phase

**Phase 1: astronomy and data technical spike.** Milestones 1, 2A, 2B, and the 2C
scientific behaviour contract are closed on `main`. **Milestone 2D (data, source, and
deployment authority) is in progress** on branch `spike/source-data-deployment-authority`
(not yet merged). Its 2D.1 decision is `CATALOGUE_AUTHORITY_BLOCKED`.

Readiness: scaffolding YES; validated vertical slice NO; participant study NO;
deployment NO. Production TypeScript still contains no astronomy calculation.

## Last completed increments (2026-11-01)

1. Branch `chore/claude-code-workflow`: realigned the stale clone to `origin/main` and
   added the agent instruction layer (`CLAUDE.md`, `docs/AGENT_WORKFLOW.md`, this file,
   Claude skill wrappers, the report skill, and a guard test). The old worktree is kept
   on `backup/local-worktree-2026-11-01`, which is not for merge.
2. Branch `spike/source-data-deployment-authority`, commit "scope 2D.1 minimal route to
   owner Cassiopeia helper" (Milestone 2D.1C, record `PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`
   in `docs/spikes/` on that branch):
   - The anwāʾ layer attests al-Kaff al-Khaḍīb (the hand) and al-Jady's
     direction/Qibla use. *Dhāt al-Kursī* is the Greco-Arabic label.
   - In Malaysia, Cassiopeia and greater Banāt Naʿsh alternate across the pole, so the
     latter is the alternative route.
   - Gaia DR3 covers only 2 of the 6 primary route stars. A Hipparcos 1997 bright-star
     source with an RV authority is proposed for review.
3. The private library was rebuilt after an agent-caused `git clean` incident: 22 of 24
   source checksums verify (`local-reference/RECOVERY_2026-11-01.local.md`).

## Next justified step

Work continues on branch `spike/source-data-deployment-authority`; its
`docs/HANDOFF.md` is the current handoff (owner decisions D-1 to D-4, the catalogue
decision, and gate C were completed there on 2026-11-01). Check it out before starting.

## Superseded next steps (kept until Milestone 2D merges)


1. Owner decisions D-1 to D-4 from the 2D.1C record: pattern display label, the
   alternative route, the bright-star catalogue source or RV policy, and the modern
   guidance line.
2. Then continue 2D.1 gate C/D row review for the 13 route stars, acquire the UMPSA
   Pekan observer record and the leap/EOP artifacts, and close 2D before 2E parsers.

## Open owner actions

- Download `SSHT-0046_Lo_res.pdf` from the Smithsonian repository in a browser; the
  path and expected hash are in the recovery record.
- Re-obtain the Ibn ʿĀṣim al-Thaqafī text or its printed edition.
- Consider buying Tibbetts 1971 (Ibn Mājid translation) and Kunitzsch & Smart 2006; the
  full list is in §6 of the 2D.1C record.
- Install uv 0.11.32 to run the Python oracle on this machine.
- The Gaia DR3 response bytes from 2D.1B were acquired on another machine.
- Approve pushes and pull requests for both branches (see the last session's Git
  recommendation).

# Continue UFUQ development

Act as the implementation engineer for this repository. Determine its actual current
state, choose the next justified increment within its approved scope, and carry that
increment through implementation, verification, and documentation.

Start with `CLAUDE.md` and the baseline reading path in `AGENTS.md`. Inspect Git status
and preserve existing staged, unstaged, and untracked work. Compare the phase records
with the actual source code, dependency configuration, tests, and recorded evidence.
Distinguish completed behavior, placeholders, unfinished work, and unverified claims.
The code establishes what exists; approved project decisions define what may be built.
Report material conflicts instead of silently treating either as approval to change
the other.

At the start, at meaningful implementation checkpoints, and in the final handoff,
assess whether I should create or switch branches, make a commit, push, open a pull
request, or delete a finished branch. Inspect the current branch, configured remotes,
upstream, relevant history, worktrees, and staged/unstaged changes first. Do not assume
the default branch is `main`, the remote is `origin`, or cached remote information is
current. State when no Git action is needed; do not invent branch work for every step.

When an action is justified, tell me why it is appropriate now and provide the exact
proposed branch name, base branch, remote/target, commit message, and copyable commands
as applicable. Follow existing naming conventions, check name collisions, and derive
names from the actual work. Identify which changes belong in the checkpoint; preserve
unrelated staged work and use explicit file paths rather than blanket staging. Keep
private references and generated artifacts out of commits. If remote state or review
status cannot be verified, say so and identify the check needed before proceeding.

Recommend branch deletion only after verifying that its intended work is retained in
the appropriate target, no unique work would be lost, and no worktree still uses it.
Distinguish local deletion from remote deletion. Present Git changes as recommendations
for my approval; do not execute staging, commits, branch creation/switching/deletion,
history rewrites, merges, or pushes without explicit authorization. Continue useful
authorized implementation while a Git decision is pending when it is safe to do so.

Give a brief evidence-based assessment of completed and remaining work, then choose a
bounded next increment. Do not assume a particular phase is still current, a candidate
library or catalogue is already selected, a named sky pattern must come first, or an
earlier suggestion is necessarily the best solution. Compare alternatives where the
tradeoff matters and explain the choice using the requirements and evidence you find.
Use an ExecPlan only when `.agent/PLANS.md` requires one.

Proceed with the work after that short assessment. Make ordinary reversible technical
decisions autonomously. Preserve the approved architecture and phase boundaries; do
not restart completed scaffolding or expand the task without an observed need. An
unresolved decision blocks only the behavior that depends on it. Where permitted,
use clearly labelled synthetic or provisional experiments to investigate alternatives,
without presenting them as approved scientific or cultural content. Ask a focused
question only when a required user or domain decision prevents useful authorized
progress; continue independent work meanwhile.

Read additional specifications, ADRs, governance records, or source material only when
the chosen work needs them. For cultural evidence, consult the instructions and source
catalogue in `local-reference/cultural-astronomy/`, then its evidence and rights rules.
Respect the separate access restrictions for the private project report. Do not invent
missing values, claims, identifiers, memberships, tolerances, or approvals.

Use the pinned toolchain. Run the applicable checks in `docs/TEST_PLAN.md`, and add
meaningful tests for the behavior introduced. Never weaken a gate to hide a failure or
claim an empty suite validates unbuilt behavior. Reuse still-applicable evidence where
justified and distinguish it from checks performed in this session.

Keep status, implementation decisions, phase/test documentation, and relevant ADRs
consistent with what was actually delivered. Finish with the outcome, files changed,
checks and results, remaining uncertainties, the recommended Git checkpoint or cleanup
with exact commands (or why none is needed), and the next justified step. Do not mark
a phase complete without its exit evidence, or commit, push, publish, or deploy without
explicit authorization.

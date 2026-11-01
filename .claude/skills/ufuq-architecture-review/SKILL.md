---
name: ufuq-architecture-review
description: Review UFUQ repository structure, workspace boundaries, import paths, build configuration, and test discovery before extending or reorganizing the system. Use for architecture and tree audits, not ordinary feature implementation or report research.
---

# UFUQ architecture review

Evaluate whether the current repository can support the next implementation phase.
Separate observed defects, maintainability tradeoffs, and requirements that apply only
to future behavior. A passing scaffold check does not establish scientific correctness
or production readiness.

Read the baseline specified by root `AGENTS.md`, then `packages/README.md`,
`tools/README.md`, and relevant architecture/testing ADRs. Follow the root rules for
conditional governance context. This review does not need the private report or its
extracted notes; do not read or send `local-reference/` content to another agent.

## Evidence to inspect

- Inventory source/configuration paths excluding generated outputs, dependencies,
  private references, and local scratch material. Distinguish tracked, staged,
  untracked, and ignored files before judging clean-clone reproducibility.
- Compare workspace manifests, package exports, TypeScript references, actual imports,
  build scripts, and CI. Check both declared edges and actual callers; folder names
  alone do not establish an architectural boundary.
- Trace browser-to-API contracts and dependency direction through the pure domains.
  Inspect what boundary enforcement actually covers, including public subpaths,
  transitive browser dependencies, and intra-application limitations.
- Check unit/reference/integration/browser discovery against their actual commands.
  Distinguish meaningful assertions from empty suites and synthetic tooling probes.
- Distinguish source manifests, reviewed curation, generated data, independent reference
  tools, and runtime packages. Check that private inputs and build caches stay out of
  tracked source and are unnecessary for a clean scaffold build.
- Judge empty packages against their documented role and next phase. Do not prescribe
  a new framework, monorepo orchestrator, service, or folder hierarchy solely because
  it is popular. Identify migration cost and all callers before recommending a move.

For requests about current best practice, consult current primary documentation for
the actual stack (npm workspaces, TypeScript references, Node package exports,
React/Vite, Vitest, and R3F where relevant). Record the access date and links. Separate
what those sources document from the reviewer's judgment; no source certifies this
specific repository or guarantees freedom from future errors.

Run applicable existing checks using the pinned toolchain. Preserve user changes and
report environment failures separately from repository defects. Do not install or
upgrade dependencies merely to conduct a structural review. Reuse recent valid check
results only when the relevant inputs have not changed, and label them as prior evidence.

If independent agent review is requested or otherwise explicitly authorized, give the
reviewer this skill and the review scope without supplying the intended verdict. Keep
that pass read-only. Reconcile each finding against actual files and reproducible
evidence before presenting it as a defect.

## Review result

Lead with whether the existing structure is suitable for the next phase. Give findings
in severity order with file references, impact, and proportionate next actions. Show a
compact current tree when useful, clearly marking any proposed future directories.
List executed checks and limitations. Identify remaining dependency or release concerns
separately from layout quality. Do not rewrite historical evidence or mark readiness
gates complete merely because this review passed. Changes beyond a review follow the
user's scope and repository planning rules.

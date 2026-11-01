# UFUQ scaffold audit

## Structure re-review — 2026-11-01

**Verdict:** the current modular-monolith tree is suitable for the Phase 1 technical
spike. Keep the existing package names and boundaries. No framework replacement,
workspace merger, service split, or additional monorepo orchestrator is justified by
the inspected implementation.

The primary review and an independent read-only agent applied
`../.claude/skills/ufuq-architecture-review/SKILL.md`. The agent inspected actual source,
exports, dependency/reference graphs, compiler/lint/test configuration, CI, and Git
tracking, then independently checked the corrections. Private report material was not
needed or read for this review.

### Findings and disposition

- **Corrected, medium:** the import checker accepted a root omitted from a subpath-only
  export map and ignored more-specific private wildcard exports. Regression probes now
  cover omitted/empty root maps, wildcard priority independent of declaration order,
  suffix specificity, and a more-specific public exception. Existing exports were not
  changed. This checker remains a static guard, not a complete conditional-export resolver.
- **Corrected, medium:** the contracts import ban also rejected normal Vitest imports
  in colocated tests. It now applies to implementation files, with a regression proving
  both permitted test imports and retained production restrictions.
- **Corrected, low:** workspace production configurations admitted colocated unit tests.
  All 13 now exclude `.test.ts`/`.test.tsx`; a synthetic compiler-discovery probe proves
  those tests still enter the separate test compiler. `.spec.ts` remains the E2E naming
  convention. One initial probe used the same basename for TS and TSX; TypeScript's
  extension priority hid one input. Distinct probe names corrected the test itself.
- **Clarified:** `ARCHITECTURE.md` now shows all current package/tool boundaries and
  test partitions. Empty facades are modest maintenance overhead, not evidence that
  their intended behavior exists. Do not add more empty boundaries without a caller.

No current ambient Node/network-global leak was found: an independent in-memory
compiler probe rejected `process.env` and `fetch` in astronomy-core. Intra-API layer
enforcement, independent scientific oracles, runtime schema validation, and final
browser-bundle exclusions must be introduced with their owning implementation phases.
The empty reference harness does not yet establish scientific independence.

### Current primary-source comparison

Sources consulted on 2026-11-01 support the mechanisms used here, not a certification
of UFUQ or a universal folder hierarchy:

- [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces/): one root can
  manage and link local packages. The current workspace layout uses this directly.
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html):
  referenced projects and `tsc -b` support ordered incremental builds. UFUQ's manifests
  and reference graph align across all 13 workspaces.
- [Node package exports](https://nodejs.org/api/packages.html): public entries and
  private subpaths require explicit export-map discipline; this informed the fixes.
- [React's build-from-scratch guidance](https://react.dev/learn/build-a-react-app-from-scratch):
  Vite is a supported option with routing/data-loading tradeoffs. Keeping it for this
  browser 3D tutor and separate API is a project judgment, not a claim React universally
  recommends this arrangement over frameworks.
- [Vitest include configuration](https://vitest.dev/config/include.html) and
  [test projects](https://vitest.dev/guide/projects): explicit discovery/configuration
  is supported; adopting a different orchestration format is unnecessary here.
- [R3F performance guidance](https://r3f.docs.pmnd.rs/advanced/pitfalls): isolating
  frame-loop changes from React state and sharing/instancing scene resources is aligned
  with the intended scene adapter. That adapter is not yet implemented.

### Validation and limits

On Node 22.16.0/npm 10.9.2, this review reran `check`, `data:verify`, `test` (35 tests),
`test:reference`, `test:integration`, and `test:e2e` including the build (1 Chromium test).
Reference/integration remain honestly empty. Runtime public-entry imports passed for
all 12 importable workspaces. Workspace names, exports, dependencies, and TypeScript
reference paths match HEAD. The lockfile and CI workflow are tracked, resolving the
historical untracked-file finding below; the new corrections still need a Git checkpoint.
No commit or hosted CI run was performed, and no fresh dependency installation was
necessary for this review. The preceding install's 23 advisories remain a separate
unresolved dependency review, not evidence against the directory layout.

Skill frontmatter parsed with the installed Prettier YAML parser; metadata, naming,
formatting, and independent use were checked. The bundled Python skill validator could
not run because PyYAML is absent; no new validation dependency was installed.
Scientific, participant, and deployment readiness remain unchanged.

## Historical scaffold audit — 2026-07-22

**Audit date:** 2026-07-22  
**Scope:** Repository scaffold and tooling only; the astronomy/data technical spike was
not started.

## Final verdict

The scaffold is technically coherent and every local clean-state validation passed.
The audit nevertheless fails one required repository-state condition: the root
`package-lock.json` is not Git-tracked. The CI workflow and the rest of the scaffold are
also still untracked, so the inspected GitHub Actions configuration cannot run from a
clone or push yet.

No architecture redesign was made. Three demonstrated tooling defects were corrected
during the audit; they are listed below. `docs/STATUS.md` was not updated because the
audit did not pass.

## Blocking finding

### AUDIT-B01 — Lockfile and CI workflow are not committed

- **Finding:** `git ls-files -- package-lock.json` and
  `git ls-files -- .github/workflows/ci.yml` both returned no path. `git status --short
  --untracked-files=all` reports both files, and the other scaffold files, as untracked.
- **Impact:** The requirement to confirm a committed lockfile is not met. A GitHub clone
  would not receive the lockfile or workflow, so `npm ci` and CI validation are not yet
  reproducible from repository history.
- **Required correction:** Prepare and approve a Git checkpoint containing the intended
  scaffold, including `package-lock.json` and `.github/workflows/ci.yml`, then rerun the
  two `git ls-files` assertions and CI. This audit did not stage or commit files.
- **Status:** Unresolved blocker.

## Runtime compatibility

- Root `package.json` pins `packageManager` to `npm@10.9.2`, and its engines pin Node
  `22.16.0` and npm `10.9.2`.
- Local execution reported Node `v22.16.0` and npm `10.9.2`. `.nvmrc` contains
  `22.16.0`; GitHub Actions uses `actions/setup-node` with
  `node-version-file: .nvmrc`, so local guidance and CI use the same Node major and exact
  version.
- Installed Vite `8.1.5` and `@vitejs/plugin-react` `6.0.3` declare Node
  `^20.19.0 || >=22.12.0`; Node `22.16.0` is supported. This agrees with the
  [official Vite 8 Node support statement](https://vite.dev/blog/announcing-vite8).
- React `19.2.8` satisfies React DOM `19.2.8`'s `^19.2.8` peer range.
  React Three Fiber `9.6.1` accepts React and React DOM `>19 <19.3` and Three.js
  `>0.156`; React `19.2.8`, React DOM `19.2.8`, and Three.js `0.185.1` satisfy those
  ranges. `npm ls` reported no invalid peer dependency.
- `@types/node` was corrected from `26.1.1` to `22.16.5` so compile-time Node APIs stay
  aligned with the pinned Node 22.16 runtime line. The exact dependency and lockfile
  were updated; installation audited 325 packages and reported zero vulnerabilities.

## Workspace coverage

All 13 workspaces are intentional:

| Workspace | Intent |
|---|---|
| `@ufuq/web` | React/Vite browser application and future R3F adapter boundary. |
| `@ufuq/api` | Express composition/HTTP boundary and scaffold health endpoint. |
| `@ufuq/astronomy-core` | Pure future astronomy domain boundary; currently empty. |
| `@ufuq/assessment-core` | Pure future assessment/scoring boundary; currently empty. |
| `@ufuq/bkt-core` | Pure future BKT arithmetic boundary; currently empty. |
| `@ufuq/adaptive-policy` | Pure future scaffold-policy boundary; currently empty. |
| `@ufuq/contracts` | Shared type-only API contracts. |
| `@ufuq/star-data` | Type-only generic sky-pattern/guidance/route placeholders. |
| `@ufuq/catalogue-schema` | Type-only re-export/schema boundary for future catalogue content. |
| `@ufuq/tutoring-core` | Pure tutoring-domain aggregation boundary. |
| `@ufuq/astronomy-reference` | Future independent astronomy reference-harness tool. |
| `@ufuq/catalogue-pipeline` | Future catalogue transform/verification tool boundary. |
| `@ufuq/catalogue` | Approved catalogue command/orchestration tool boundary. |

Coverage findings:

- `prettier --check .` covers workspace source, configuration, and manifests, subject to
  the explicit repository ignore list.
- ESLint covers TypeScript/TSX under every app, package, tool, and test directory.
- The root TypeScript solution references all 13 workspaces. The separate no-emit test
  configuration covers app/package/tool unit tests, E2E tests, and root Vitest/Playwright
  configuration.
- Vitest discovers tests under every app, package, and tool; reference and integration
  partitions have explicit Phase 0 no-test commands.
- `npm run build` starts with `tsc -b`, which traverses all 13 project references, then
  runs the Vite production build. After compiler outputs were cleaned, the command
  recreated all 15 checked API, web, shared-package, and tool output files. It therefore
  does not build only the web application.
- Runtime imports resolved for the API and all 11 importable package/tool workspaces.
  `@ufuq/web` is an application and intentionally has no package export.
- The boundary checker reported 13 workspaces and an acyclic dependency graph.

## TypeScript findings

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, and `useUnknownInCatchVariables` are enabled in the shared base
  configuration inherited by every workspace.
- The base configuration enables `composite`, declarations, declaration maps, and
  source maps. Referenced API/package/tool projects emit JavaScript and declarations to
  their own `dist` directories.
- The web project remains composite but uses `emitDeclarationOnly` for `dist-types`;
  Vite separately creates its production bundle.
- The standalone test configuration disables composite/declaration emission and uses
  `noEmit`, which is valid because it is not a referenced build target.
- `contracts`, `star-data`, and `catalogue-schema` each emitted only an empty runtime
  module plus a declaration file. The boundary checker also rejects runtime statements
  in these packages. Result: 3/3 empty runtime outputs and 3/3 declaration outputs.

## CI findings

The candidate workflow is correctly configured to run:

1. `npm ci`;
2. formatting;
3. linting;
4. type checking;
5. package-boundary and cycle checks;
6. empty-data verification;
7. unit, reference, and integration tests;
8. production builds;
9. exact local Playwright CLI installation of Chromium with `--with-deps`; and
10. the browser/API smoke test.

The workflow uses Ubuntu and contains no Windows-only shell command. It now creates an
HTML Playwright report in CI, retains traces and screenshots on failure, and uploads
`playwright-report/` plus `test-results/` for seven days when the job fails.

These statements describe the candidate file in the working tree. They are not active
repository guarantees until AUDIT-B01 is resolved.

## Playwright server lifecycle

The built-in multiple-`webServer` configuration was not restored: during scaffold
validation it passed the browser assertion on this Windows host but hung while tearing
down its server processes. The direct-Node runner is cross-platform and invokes no
shell-specific command.

The custom runner was corrected to:

- enforce bounded startup and Playwright-process timeouts;
- forward Playwright CLI arguments for controlled failure testing;
- await child exit after `SIGTERM` and fall back to `SIGKILL` after a grace period;
- clean up on normal completion, thrown errors, `SIGINT`, and `SIGTERM`; and
- propagate the Playwright exit code.

Lifecycle evidence:

| Path | Induced result | Remaining listeners |
|---|---|---|
| Pass | Smoke test exited `0` | 0 on ports 4173/4174 |
| Failure | No-test grep exited `1` as expected | 0 on ports 4173/4174 |
| Startup timeout | API intentionally moved to port 44999; readiness exited `1` | 0 on ports 4173/4174/44999 |

The final clean-suite smoke run also exited `0` and left zero listeners.

## Scope and safety

- Targeted source/data scans found no astronomy calculation, catalogue row, named
  cultural route, BKT formula/transition, SQL migration, database adapter,
  authentication, registration, or login implementation.
- `data/sources`, `data/curation`, and `data/generated` contain README placeholders only.
- No high-confidence secret pattern was found outside ignored restricted material.
- The restricted PDF, `local-reference/`, `.env`, `.env.local`, and `.env.production`
  are ignored. None is tracked. `.env.example` remains intentionally committable and
  contains no secret.
- `git diff --check` passed.

## Corrections made

1. Changed `@types/node` from `26.1.1` to `22.16.5` and refreshed the lockfile.
2. Hardened `scripts/run-e2e.mjs` with bounded, awaited, cross-platform lifecycle
   handling and verified its pass/failure/timeout paths.
3. Configured Playwright to retain failure traces/screenshots and create a CI HTML
   report.
4. Added conditional GitHub Actions upload of Playwright failure artifacts.

No domain behavior, architecture decision, or implementation-phase status was changed.

## Exact validation commands and results

| Command | Result |
|---|---|
| `node --version` | `v22.16.0` |
| `npm.cmd --version` | `10.9.2` |
| `npm.cmd ls react react-dom three @react-three/fiber vite` | PASS; one compatible deduplicated tree, no invalid peer. |
| `npm.cmd ls --workspaces --depth=0` | PASS; all 13 workspaces listed. |
| `npm.cmd exec tsc -- -b --clean` plus deletion of validated generated `dist`, `dist-types`, coverage, report, and test-result paths | PASS; zero output directories remained before install. |
| `npm.cmd ci` | PASS; 311 packages installed from the lockfile. |
| `npm.cmd run check` | PASS; formatting, lint, strict typecheck, boundaries, and cycle detection passed. |
| `npm.cmd run data:verify` | PASS; no catalogue/cultural/generated data. |
| `npm.cmd run test` | PASS; 1 test file, 1 test. |
| `npm.cmd run test:reference` | PASS with no Phase 0 reference tests. |
| `npm.cmd run test:integration` | PASS with no Phase 0 integration tests. |
| `npm.cmd exec tsc -- -b --clean` followed by `npm.cmd run build` | PASS; 0/15 expected output files before build and 15/15 after; Vite transformed 16 modules. |
| `node --input-type=module --eval "const names=['@ufuq/astronomy-core','@ufuq/assessment-core','@ufuq/bkt-core','@ufuq/adaptive-policy','@ufuq/contracts','@ufuq/star-data','@ufuq/catalogue-schema','@ufuq/tutoring-core','@ufuq/astronomy-reference','@ufuq/catalogue-pipeline','@ufuq/catalogue','@ufuq/api']; for (const name of names) { await import(name); console.log('RESOLVED ' + name); }"` | PASS; 12/12 public imports resolved. |
| `npm.cmd run test:e2e` | PASS; Chromium smoke test 1/1, exit `0`, zero remaining listeners. |
| `node scripts/run-e2e.mjs --grep "__scaffold_audit_expected_no_match__"` | Expected failure exit `1`; zero remaining listeners. |
| `$env:PORT='44999'; $env:UFUQ_E2E_STARTUP_TIMEOUT_MS='750'; node scripts/run-e2e.mjs` | Expected readiness-timeout exit `1`; zero remaining listeners. |
| `git ls-files -- package-lock.json .github/workflows/ci.yml` | FAIL; no tracked paths returned. |
| Restricted/secret/scope `rg`, `git check-ignore`, and `git ls-files` checks | PASS. |

## Required next action

Do not begin the astronomy/data spike on the strength of this audit. First prepare the
separate Git checkpoint, review its staged file list, and commit the intended scaffold
including the lockfile and CI workflow. Then rerun the tracking assertions and CI.

SCAFFOLD_AUDIT: FAIL

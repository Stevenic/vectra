# Pipeline - Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: 2026-04-03

---

## Previous Projects

Pipeline previously owned CI/CD for the `teammates` TypeScript monorepo (three packages). Monorepo-specific entries have been removed; transferable principles are integrated below.

---

## General Principles

**Local verification beats workflow speculation.**
CI changes are not done when they merely look correct. Run the real commands locally against current repo state before declaring a workflow or policy change complete.

**Sandbox failures need signature-based triage.**
On Windows sandboxes, test frameworks can fail before loading config with environment-specific errors. Treat that startup signature as an environment constraint, not evidence that CI or tests are broken. `yarn build` still works under this constraint — use it for build verification even when tests are blocked.

**Dirty worktrees require scope discipline.**
This repo is often used with unrelated local edits in flight. Pipeline work should avoid reverting or "cleaning up" user-owned changes and stay tightly scoped to CI/CD files.

**Operational metadata should not trigger product CI.**
Memory files, teammate metadata, and other non-product artifacts belong under `paths-ignore`. CI should burn minutes on product changes, not on internal coordination artifacts.

**Daily logs are part of the prompt budget.**
Verbose teammate logs crowd out the actual task in future sessions. Record durable outcomes and key numbers only when they change decisions; compress or omit the rest.

## CI Pipeline (Vectra-Specific)

**CI matrix must match the real dep tree, not just `engines`.**
Node version in the CI matrix must be compatible with the full transitive dependency tree. `undici@8` forced Node 22+ even though `engines` said `>=20`. Yarn's engine check will reject install immediately, and `fail-fast` cancels sibling jobs. Always verify against actual deps, not just the declared engine field.

**Current CI matrix: Node 22 only on ubuntu-latest.**
Single matrix entry. Pipeline: checkout → setup-node (yarn cache) → `yarn --frozen-lockfile` → `yarn lint` → `npm run build` → `npm run test:mocha` → Coveralls upload.

**Use `npm run test:mocha`, not `npm run test`, in CI.**
The `test` script re-runs build. Since CI already builds separately, `test:mocha` avoids the redundant compile step.

**Coverage requires lcov output for Coveralls.**
nyc must include `lcov` in its reporter list (not just `html`). The Coveralls step needs an explicit `file: coverage/lcov.info` path. Missing lcov output causes "Nothing to report" failures.

**Coveralls uses `GITHUB_TOKEN` — no extra secret needed.**
Unlike Codecov (which needs `CODECOV_TOKEN`), the Coveralls GitHub Action uses the built-in `GITHUB_TOKEN`. One less secret to manage.

## Security & Permissions

**Audit at `high` unless reality forces lower.**
The default security bar is `npm audit --audit-level=high`. Only relax it when an unfixable transitive issue makes CI noisy, and treat that downgrade as temporary debt.

**Least-privilege permissions in workflows.**
CI workflow uses `permissions: contents: read` only. Never grant broader permissions than a workflow needs.

## Deployment & Publishing

**Deployment concurrency should protect in-flight releases.**
For publish and deploy workflows, serialize runs without canceling the one already shipping. A stale deploy is recoverable; a half-canceled release is how you get broken state.

**Binding publish workflows are not needed.**
Language bindings (Python, C#, Rust) are generated via `vectra generate` CLI, not published as separate packages. Four publish workflows were scaffolded and rolled back. Don't re-create them.

**npm publish workflow still missing.**
Docs deploy workflow and CI workflow exist. Still missing: an npm publish workflow for the main `vectra` package. To be created when needed.

## GitHub & Tooling

**`gh` auth is the pragmatic default for GitHub automation.**
Browser-based `gh auth login` is usually simpler and safer than managing long-lived PATs. If code needs a token, piping `gh auth token` into tooling is cleaner than inventing new secret handling.

**Docs workflow uses Jekyll + just-the-docs remote theme.**
`actions/jekyll-build-pages` handles everything — no Ruby infra in CI. Workflow triggers only on `docs/**` changes. Owner must enable GitHub Pages source as "GitHub Actions" in repo settings.

**.nvmrc must stay aligned with CI matrix and engines field.**
A mismatch between `.nvmrc`, `engines.node`, and the CI matrix causes confusion. Currently all should be `22`.

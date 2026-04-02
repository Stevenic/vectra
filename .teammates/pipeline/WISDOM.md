# Pipeline - Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: 2026-04-02

---

## Previous Projects

Pipeline previously owned CI/CD for the `teammates` TypeScript monorepo (three packages). Wisdom entries below are filtered to what's transferable to the Vectra single-package project. Monorepo-specific entries (workspace build ordering, multi-package matrix logic, consolonia/recall/cli-specific steps) have been removed.

---

**Local verification beats workflow speculation.**
CI changes are not done when they merely look correct. Run the real commands locally against current repo state before declaring a workflow or policy change complete.

**Sandbox failures need signature-based triage.**
On Windows sandboxes, test frameworks can fail before loading config with environment-specific errors. Treat that startup signature as an environment constraint, not evidence that CI or tests are broken. `yarn build` still works under this constraint — use it for build verification even when tests are blocked.

**Dirty worktrees require scope discipline.**
This repo is often used with unrelated local edits in flight. Pipeline work should avoid reverting or "cleaning up" user-owned changes and stay tightly scoped to CI/CD files.

**Audit at `high` unless reality forces lower.**
The default security bar is `npm audit --audit-level=high`. Only relax it when an unfixable transitive issue makes CI noisy, and treat that downgrade as temporary debt.

**Deployment concurrency should protect in-flight releases.**
For publish and deploy workflows, serialize runs without canceling the one already shipping. A stale deploy is recoverable; a half-canceled release is how you get broken state.

**Operational metadata should not trigger product CI.**
Memory files, teammate metadata, and other non-product artifacts belong under `paths-ignore`. CI should burn minutes on product changes, not on internal coordination artifacts.

**`gh` auth is the pragmatic default for GitHub automation.**
Browser-based `gh auth login` is usually simpler and safer than managing long-lived PATs. If code needs a token, piping `gh auth token` into tooling is cleaner than inventing new secret handling.

**Daily logs are part of the prompt budget.**
Verbose teammate logs crowd out the actual task in future sessions. Record durable outcomes and key numbers only when they change decisions; compress or omit the rest.

**This project currently has no CI/CD.**
No `.github/` directory exists yet. Setting up GitHub Actions workflows for build, test, lint, and publish is the primary infrastructure gap.

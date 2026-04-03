# Steven Ickman — Wisdom

Distilled from work history. Updated during compaction.
Last compacted: 2026-04-03

---

**Language Bindings: Generate, Don't Publish**
Instead of publishing separate packages to PyPI/NuGet/crates.io, Vectra ships wrapper templates with the npm package. Users generate bindings locally via `vectra generate`. This replaced the earlier multi-registry publishing approach.

**Security-Driven Dependency Decisions**
Axios was removed due to a compromised version (socket.dev advisory). Replaced with native `fetch()`. Treat transitive dependency security issues as blockers — don't wait for upstream fixes.

**Node Version Floor Follows EOL**
Node 20.x went EOL on 2026-03-26. The project bumped to `>=22.x` after `undici@8.0.0` (transitive) required it. Keep the engines field aligned with CI matrix and actual dependency requirements.

**Docs Strategy: Lean README + Full Docs Site**
README.md should be trimmed to essentials (badges, quick start, key features). Detailed docs live in `docs/` (Jekyll + just-the-docs theme, GitHub Pages). Link from README to docs for anything beyond a quick overview.

**Agent Configuration Is Multi-Tool**
The repo maintains config files for multiple coding agents: `CLAUDE.md` (canonical), `AGENTS.md` (Codex), `.github/copilot-instructions.md`, `.cursorrules`, `.windsurfrules`. CLAUDE.md is the source of truth; others derive from it.

**Playbook-Driven Repo Setup**
`TYPESCRIPT-LIBRARY-PLAYBOOK.md` codifies the full repo structure and conventions so any coding agent can scaffold or maintain a TypeScript library project with the same patterns.

**Protobuf Index Format**
The index supports protobuf as an alternative storage format for efficiency. Format is specified at creation time and inferred on load. Migration between formats is handled via API and CLI — no automatic upgrade.

**gRPC Server for Cross-Language Access**
Rather than native reimplementations, non-JS languages access Vectra through a gRPC server (`VectraServer.ts`). The CLI can generate language-specific client stubs from the proto definition.

**Browser and Electron Support**
Vectra runs in browsers (IndexedDB storage) and Electron. Browser exports go through `src/browser.ts` excluding Node-specific modules. The UMD bundle is built via webpack.

**Local Embeddings via Transformers.js**
`@huggingface/transformers` is an optional dependency for local embedding generation, avoiding mandatory API calls for simple use cases.

**CI Pipeline Shape**
GitHub Actions on push/PR to `main`: install → lint → build → test → coverage (Coveralls). Node 22 only. Lint runs after install but before build. ESLint has 0 errors / ~212 warnings baseline.

**Steven's Decision Style**
Prefers quick "yes/do it" approvals over lengthy deliberation. Delegates implementation to teammates and expects them to commit and PR autonomously. Wants to be informed of what changed, not asked permission for every detail. Values security, cross-platform reach, and agent-friendliness.

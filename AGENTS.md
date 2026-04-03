<!-- This file is derived from CLAUDE.md. Keep them in sync. -->
# Vectra

A lightweight, file-backed vector database for Node.js and browsers with Pinecone-compatible filtering and hybrid BM25 search.

## Project Structure

- `src/` — TypeScript source files
- `lib/` — Compiled output (do not edit directly)
- `bin/` — CLI entry point (`vectra`)
- `docs/` — Jekyll documentation site (GitHub Pages via just-the-docs)
- `samples/` — Runnable example projects
- `dist/` — Browser bundle (do not edit directly)

## Development Commands

- `yarn install` — Install dependencies
- `yarn build` or `npm run build` — Compile TypeScript + copy proto schemas and templates
- `yarn build:browser` — Build browser UMD bundle via webpack
- `yarn build:all` — Build both Node.js and browser targets
- `yarn test` or `npm test` — Build + run tests
- `npm run test:mocha` — Run tests only (skip build)
- `yarn lint` or `npm run lint` — Run ESLint
- `yarn clean` — Remove build artifacts

## Code Conventions

- TypeScript strict mode — no `any` unless unavoidable
- Tests colocated with source: `src/foo.spec.ts` tests `src/foo.ts`
- Barrel exports through `src/index.ts` — every public API must be re-exported here
- Browser exports through `src/browser.ts` — excludes Node-specific modules
- Internal utilities in `src/internals/` — not exported from the package
- Proto schemas live in `src/codecs/schemas/*.proto` and are copied to `lib/` at build time
- Language binding templates in `src/templates/` are copied to `lib/templates/` at build time

## Testing

- Framework: mocha with sinon for mocks
- Coverage: nyc — reports to Coveralls
- Run `npm run test:mocha` for fast iteration (skips rebuild)
- Test timeout: 10000ms

## CI

- GitHub Actions on push/PR to `main`
- Pipeline: install → lint → build → test → coverage upload
- Node 22 on ubuntu-latest

## Before Submitting a PR

- Run `yarn lint` and fix any errors
- Run `yarn test` and ensure all tests pass
- Update `llms.txt` if you changed public API surface
- Update `docs/changelog.md` with a summary of changes

# TypeScript Library Playbook

A comprehensive guide for coding agents to scaffold, configure, and ship a TypeScript library with best-practice tooling, documentation, CI/CD, and AI-agent discoverability.

> **How to use this playbook:** Work through each section in order. Where a section says *"Ask the developer,"* pause and collect the answer before proceeding — the response will shape later steps. Sections marked *"Skip if not applicable"* can be omitted based on interview answers.

---

## Table of Contents

1. [Developer Interview](#1-developer-interview)
2. [Repository Scaffold](#2-repository-scaffold)
3. [Package Manifest (`package.json`)](#3-package-manifest)
4. [TypeScript Configuration](#4-typescript-configuration)
5. [Source Code Layout](#5-source-code-layout)
6. [Linting](#6-linting)
7. [Testing](#7-testing)
8. [Build Pipeline](#8-build-pipeline)
9. [Git Configuration](#9-git-configuration)
10. [README & Badges](#10-readme--badges)
11. [Contributing & Community Files](#11-contributing--community-files)
12. [Security Policy (`SECURITY.md`)](#12-security-policy)
13. [GitHub Issue Templates](#13-github-issue-templates)
14. [Dependency Management (`dependabot.yml`)](#14-dependency-management)
15. [Developer Documentation (GitHub Pages)](#15-developer-documentation-github-pages)
16. [Samples / Examples](#16-samples--examples)
17. [CI/CD Workflows (GitHub Actions)](#17-cicd-workflows-github-actions)
18. [Agent Ready (`llms.txt`)](#18-agent-ready-llmstxt)
19. [Agent Configuration Files](#19-agent-configuration-files)
20. [Publishing to npm](#20-publishing-to-npm)
21. [Post-Setup Checklist](#21-post-setup-checklist)

---

## 1. Developer Interview

Before generating any files, gather the following from the developer. Use sensible defaults where the developer defers.

### Required

| Question | Example Answer | Used In |
|----------|---------------|---------|
| What is the package name? | `my-lib` | package.json, README |
| One-line description? | "A fast widget parser" | package.json, README, llms.txt |
| Author name and email? | `Jane Doe <jane@example.com>` | package.json, LICENSE |
| License? | `MIT` | package.json, LICENSE |
| GitHub repo URL? | `https://github.com/jane/my-lib` | package.json, badges, docs |
| Minimum Node.js version? | `>=20.x` | engines, CI matrix, .nvmrc |

### Optional (defaults shown)

| Question | Default | Notes |
|----------|---------|-------|
| Package manager? | `yarn` (v1 classic) | Also supports `npm` or `pnpm` |
| Does the library include a CLI? | No | If yes, sets up `bin/` entry point |
| Does the library need browser support? | No | If yes, adds webpack config, browser entry point, conditional exports |
| Test framework preference? | `mocha` + `sinon` | Also supports `vitest` or `jest` |
| Coverage service? | Coveralls | Also supports Codecov |
| Does the library need a docs site? | Yes (GitHub Pages + Jekyll) | Can skip if not needed |
| Want `llms.txt` for AI agent discoverability? | Yes | Creates Agent Ready badge + file |
| Code samples directory? | Yes (`samples/`) | Runnable example projects |

---

## 2. Repository Scaffold

Create the following directory structure. Adjust based on interview answers (e.g., omit `bin/` if no CLI, omit `docs/` if no docs site).

```
<package-name>/
├── src/                          # TypeScript source files
│   ├── index.ts                  # Main barrel export
│   ├── types.ts                  # Shared type definitions
│   └── internals/                # Private utilities (not exported)
│       └── index.ts
├── bin/                          # CLI entry point (if applicable)
│   └── <cli-name>.js
├── docs/                         # Jekyll documentation site
│   ├── _config.yml
│   ├── Gemfile
│   ├── .gitignore
│   ├── index.md
│   ├── getting-started.md
│   ├── api-reference.md
│   └── changelog.md
├── samples/                      # Runnable example projects
│   ├── README.md
│   └── quickstart/
│       └── example.ts
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.yml        # Bug report form
│   │   ├── feature_request.yml   # Feature request form
│   │   ├── question.yml          # Question form
│   │   └── config.yml            # Template chooser config
│   ├── copilot-instructions.md   # GitHub Copilot instructions
│   ├── dependabot.yml            # Automated dependency updates
│   └── workflows/
│       ├── ci.yml                # Build + lint + test + coverage
│       └── docs.yml              # Jekyll deploy to GitHub Pages
├── SECURITY.md                   # Vulnerability reporting policy
├── CHANGELOG.md                  # Version history (root-level)
├── package.json
├── tsconfig.json
├── .nvmrc
├── .nycrc                        # Coverage configuration (if mocha/nyc)
├── eslint.config.mjs             # ESLint flat config
├── .gitignore
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── llms.txt                      # Agent Ready integration guide
├── CLAUDE.md                     # Claude Code project instructions
├── AGENTS.md                     # OpenAI Codex project instructions
├── .cursorrules                  # Cursor editor AI rules
└── .windsurfrules                # Windsurf editor AI rules
```

---

## 3. Package Manifest

Create `package.json` with the following structure. Replace placeholders with interview answers.

```jsonc
{
  "name": "<package-name>",
  "version": "0.1.0",
  "description": "<one-line description>",
  "author": "<author>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+<github-url>.git"
  },
  "bugs": { "url": "<github-url>/issues" },
  "homepage": "<github-url>#readme",
  "keywords": [],

  // Entry points
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/index.d.ts",
      "import": "./lib/index.js",
      "require": "./lib/index.js"
    }
  },

  // If CLI
  "bin": {
    "<cli-name>": "./bin/<cli-name>.js"
  },

  // If browser support
  "browser": "./lib/browser.js",
  "exports": {
    ".": {
      "node": { "types": "./lib/index.d.ts", "import": "./lib/index.js" },
      "browser": { "types": "./lib/browser.d.ts", "default": "./lib/browser.js" }
    },
    "./browser": { "types": "./lib/browser.d.ts", "default": "./lib/browser.js" },
    "./node": { "types": "./lib/index.d.ts", "import": "./lib/index.js" }
  },

  "engines": { "node": ">=<min-node-version>" },
  "packageManager": "yarn@1.22.22",

  "files": [
    "lib/",
    "bin/",       // if CLI
    "dist/",      // if browser bundle
    "src/"        // include source for sourcemap debugging
  ],

  "scripts": {
    "build": "tsc -b",
    "build:watch": "tsc -b --watch",
    "clean": "rimraf lib dist tsconfig.tsbuildinfo",
    "lint": "eslint src/",
    "test": "npm-run-all build test:mocha",
    "test:mocha": "nyc ts-mocha -p tsconfig.json src/**/*.spec.ts",
    "test:watch": "ts-mocha -p tsconfig.json --watch --watch-extensions ts src/**/*.spec.ts",
    "test:coverage": "nyc report --reporter=html && open coverage/index.html",
    "prepublishOnly": "npm-run-all clean build test:mocha",
    "publish:check": "npm-run-all clean build test:mocha && npm publish --dry-run"
  },

  "devDependencies": {
    "typescript": "^5.8.0",
    "ts-node": "^10.9.0",
    "ts-mocha": "^11.0.0",
    "mocha": "^11.0.0",
    "sinon": "^21.0.0",
    "nyc": "^17.0.0",
    "@types/mocha": "^10.0.0",
    "@types/sinon": "^17.0.0",
    "@types/node": "^22.0.0",
    "eslint": "^10.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "rimraf": "^6.0.0",
    "npm-run-all": "^4.1.5"
  }
}
```

### Key decisions

- **`files` field** limits what ships to npm. Always include `lib/` and `src/` (for sourcemaps). Only include `bin/` and `dist/` if applicable.
- **`prepublishOnly`** runs a full clean build + test before every `npm publish` to prevent shipping broken code.
- **`engines`** declares the minimum Node.js version. Yarn enforces this during install.
- Use exact major versions for TypeScript and testing tools; use `^` for everything else.

---

## 4. TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES6",
    "module": "commonjs",
    "lib": ["ES2021"],
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "dist"]
}
```

### Notes

- **`composite: true`** enables project references and incremental builds.
- **`declaration: true` + `declarationMap: true`** generates `.d.ts` files and source maps so consumers can "Go to Definition" into your TypeScript source.
- **`strict: true`** is non-negotiable for libraries — consumers rely on your types being accurate.
- If the library targets browsers, add `"DOM"` to the `lib` array.
- **`skipLibCheck: true`** speeds up compilation by skipping third-party `.d.ts` validation.

Create `.nvmrc` with the minimum Node version. **This must match `engines.node` in `package.json` and the CI matrix** — mismatches cause confusing failures when nvm loads a different version than CI tests against.

```
22
```

---

## 5. Source Code Layout

### Barrel exports (`src/index.ts`)

The main entry point re-exports everything consumers need:

```ts
export * from './types';
export * from './MyClass';
// Add exports as you build features
```

### Colocation pattern

Place tests alongside source files using the `.spec.ts` suffix:

```
src/
├── MyClass.ts
├── MyClass.spec.ts
├── utils/
│   ├── index.ts
│   ├── helpers.ts
│   └── helpers.spec.ts
└── internals/
    └── index.ts          # Private utilities, excluded from barrel export
```

### Browser entry point (if applicable)

Create `src/browser.ts` that re-exports everything except Node-specific modules:

```ts
// Re-export everything that works in browsers
export * from './types';
export * from './MyClass';
// Exclude: Node-specific modules (fs, path, child_process wrappers)
// Include: Browser alternatives (IndexedDB storage, fetch-based clients)
```

### CLI entry point (if applicable)

Create `bin/<cli-name>.js`:

```js
#!/usr/bin/env node
var app = require('../lib/<cli-module>.js');
app.run();
```

The CLI implementation lives in `src/<cli-module>.ts` and is compiled to `lib/` with the rest of the source.

---

## 6. Linting

Create `eslint.config.mjs` using the flat config format (ESLint v10+):

```js
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['lib/', 'dist/', 'node_modules/', 'samples/', 'coverage/'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      globals: {
        // Node globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'always', { null: 'ignore' }],
      'no-debugger': 'error',
    },
  },
  {
    // Relaxed rules for test files
    files: ['src/**/*.spec.ts'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
      },
    },
  },
];
```

---

## 7. Testing

### Coverage configuration (`.nycrc`)

```json
{
  "include": ["src/**/*.ts"],
  "exclude": [
    "node_modules",
    "**/*.spec.ts",
    "**/*.d.ts",
    "**/index.ts",
    "**/internals/**"
  ],
  "reporter": ["html", "lcov", "text"],
  "all": true,
  "cache": true
}
```

### Key points

- **`reporter: ["html", "lcov", "text"]`** — `html` for local browsing, `lcov` for CI coverage services (Coveralls/Codecov), `text` for terminal output.
- **Exclude barrel files (`index.ts`)** — they're just re-exports, not logic.
- **Exclude `internals/`** from coverage if it contains test utilities or non-critical helpers.
- Tests use `ts-mocha` to run TypeScript directly without a pre-compile step.
- Use `sinon` for mocks, stubs, and spies.

### Writing tests

```ts
import { expect } from 'assert';  // Node built-in
import * as sinon from 'sinon';
import { MyClass } from './MyClass';

describe('MyClass', () => {
  afterEach(() => sinon.restore());

  it('should do the thing', () => {
    const result = new MyClass().doThing();
    expect(result).to.equal('expected');
  });
});
```

---

## 8. Build Pipeline

### Standard build

The `build` script compiles TypeScript to `lib/`:

```bash
tsc -b
```

### Post-build file copying

If the package includes non-TypeScript assets (proto files, templates, static data), add post-build copy steps:

```jsonc
// In package.json scripts
"build": "tsc -b && shx cp -r src/schemas lib/schemas"
```

Use `shx` for cross-platform shell commands (install as devDependency).

### Browser bundle (if applicable)

Add `webpack.browser.js` for a UMD browser bundle:

```js
const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: './lib/browser.js',  // Note: uses compiled output
  output: {
    filename: '<package-name>.browser.js',
    path: path.resolve(__dirname, 'dist'),
    library: { name: '<PackageName>', type: 'umd' },
    globalObject: 'this',
  },
  resolve: {
    fallback: {
      // Add polyfills as needed
      buffer: require.resolve('buffer/'),
    },
  },
  plugins: [
    new webpack.ProvidePlugin({ Buffer: ['buffer', 'Buffer'] }),
  ],
};
```

Add the browser build script:

```jsonc
"build:browser": "webpack --config webpack.browser.js",
"build:all": "npm-run-all build build:browser"
```

---

## 9. Git Configuration

### `.gitignore`

```gitignore
# Dependencies
node_modules/
.npm
jspm_packages/

# Build output
lib/
dist/
_ts3.4/
*.tsbuildinfo

# Coverage
coverage/
.lcov
.nyc_output/

# Environment
.env
.env.*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

---

## 10. README & Badges

### Badge row

Place badges on the first line after the title. Standard set:

```markdown
# <Package Name>

[![npm version](https://img.shields.io/npm/v/<package-name>.svg)](https://www.npmjs.com/package/<package-name>)
[![Build](https://github.com/<owner>/<repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/<repo>/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/<owner>/<repo>/badge.svg?branch=main)](https://coveralls.io/github/<owner>/<repo>?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Agent Ready](https://img.shields.io/badge/Agent-Ready-blue.svg)](#agent-ready)
```

If using Codecov instead of Coveralls:

```markdown
[![codecov](https://codecov.io/gh/<owner>/<repo>/graph/badge.svg)](https://codecov.io/gh/<owner>/<repo>)
```

### README structure

```markdown
# <Package Name>

<badges>

<one-paragraph description>

## Install

\`\`\`sh
npm install <package-name>
\`\`\`

## Quick Example

\`\`\`ts
// Minimal working example (under 10 lines)
\`\`\`

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](<docs-url>/getting-started) | Installation, setup, first example |
| [API Reference](<docs-url>/api-reference) | Full API documentation |
| [Changelog](<docs-url>/changelog) | Version history and migration guides |

## Agent Ready

This project includes an [`llms.txt`](llms.txt) file — a structured guide that helps
AI coding agents understand the library's API, types, and usage patterns. Point your
agent at this file to enable accurate code generation.

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
```

---

## 11. Contributing & Community Files

### `CONTRIBUTING.md`

Include these sections:

1. **Introduction** — Welcome message and project context
2. **Code of Conduct** — Link to `CODE_OF_CONDUCT.md`
3. **How to Contribute** — Reporting bugs, suggesting features, submitting PRs
4. **Development Setup** — Prerequisites (Node version, package manager), install steps
5. **Coding Standards** — Linting, TypeScript conventions, file structure
6. **Commit Message Guidelines** — Present tense, reference issues
7. **Pull Request Process** — Branch naming (`feature/`, `fix/`), review expectations
8. **Testing** — How to run tests, how to write new tests (framework, colocation pattern)
9. **Documentation** — When to update docs, how to generate API docs
10. **License** — Contribution license agreement (MIT)

### `CODE_OF_CONDUCT.md`

Use the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) as a standard baseline.

### `CODEOWNERS` (optional)

If the project has multiple maintainers, create `.github/CODEOWNERS` to auto-assign PR reviewers:

```
# Default owner for everything
* @<owner>

# Specific paths (add as team grows)
# docs/   @docs-maintainer
# .github/ @devops-maintainer
```

This file is only useful with 2+ maintainers. Skip for solo projects.

### `LICENSE`

Generate the appropriate license file based on the developer's choice. For MIT:

```
MIT License

Copyright (c) <year> <author>

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

---

## 12. Security Policy

Create `SECURITY.md` at the repository root. This is standard for any npm package and tells people how to report vulnerabilities privately rather than opening public issues.

### Template

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| x.x.x   | :white_check_mark: |
| < x.x   | :x:                |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub's private vulnerability reporting](https://github.com/<owner>/<repo>/security/advisories/new)
or email **<security-email>**.

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### What to expect

- **Acknowledgement** within 48 hours
- **Status update** within 7 days
- **Fix timeline** depends on severity:
  - Critical: patch release within 48 hours
  - High: patch release within 1 week
  - Medium/Low: included in next scheduled release
```

### Key points

- **Ask the developer** for a security contact email, or default to GitHub's built-in private vulnerability reporting.
- Update the "Supported Versions" table with each major/minor release.
- Keep the scope section clear — development dependencies and sample code are typically out of scope.

---

## 13. GitHub Issue Templates

Use YAML form templates (not the older markdown templates) for structured, actionable issues. Create `.github/ISSUE_TEMPLATE/` with these files:

### Bug Report (`.github/ISSUE_TEMPLATE/bug_report.yml`)

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
title: "[Bug]: "
labels: ["bug"]
body:
  - type: input
    id: version
    attributes:
      label: Package version
      placeholder: "0.14.0"
    validations:
      required: true

  - type: input
    id: node-version
    attributes:
      label: Node.js version
      placeholder: "v22.0.0"
    validations:
      required: true

  - type: dropdown
    id: environment
    attributes:
      label: Environment
      options:
        - Node.js
        - Browser
        - Electron
        - Other
    validations:
      required: true

  - type: input
    id: os
    attributes:
      label: Operating system
      placeholder: "Windows 11 / macOS 15 / Ubuntu 24.04"
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Describe the bug
    validations:
      required: true

  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      value: |
        1.
        2.
        3.
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual behavior
    validations:
      required: true
```

### Feature Request (`.github/ISSUE_TEMPLATE/feature_request.yml`)

```yaml
name: Feature Request
description: Suggest a new feature or enhancement
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: textarea
    id: use-case
    attributes:
      label: Use case
      description: What problem are you trying to solve?
    validations:
      required: true

  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
      description: How should this work? Include API examples if possible.
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
    validations:
      required: false
```

### Question (`.github/ISSUE_TEMPLATE/question.yml`)

```yaml
name: Question
description: Ask a question about using the library
title: "[Question]: "
labels: ["question"]
body:
  - type: markdown
    attributes:
      value: |
        Before opening a question, please check the
        [documentation](<docs-url>) and [existing issues](<issues-url>).

  - type: textarea
    id: question
    attributes:
      label: Your question
    validations:
      required: true

  - type: textarea
    id: context
    attributes:
      label: Context
      description: What are you trying to accomplish?
    validations:
      required: false
```

### Template Chooser Config (`.github/ISSUE_TEMPLATE/config.yml`)

```yaml
blank_issues_enabled: false
contact_links:
  - name: Documentation
    url: <docs-url>
    about: Check the docs before opening an issue.
```

Setting `blank_issues_enabled: false` forces contributors to use a template, keeping issues structured and actionable.

---

## 14. Dependency Management

Create `.github/dependabot.yml` to get automated PRs when dependencies have updates or security patches.

```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
    ignore:
      # Major version bumps should be reviewed manually
      - dependency-name: "typescript"
        update-types: ["version-update:semver-major"]

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "ci"
```

### Key points

- **Two ecosystems**: npm dependencies AND GitHub Actions. Both need updates.
- **Weekly schedule** keeps PRs manageable. Daily creates too much noise for most libraries.
- **Labels** make it easy to filter and batch-merge Dependabot PRs.
- **Ignore major TypeScript bumps** — these can break compilation and need manual review.
- Dependabot also handles security advisories — it will open PRs even outside the schedule if a vulnerability is found.

---

## 15. Developer Documentation (GitHub Pages)

### Jekyll + just-the-docs setup

Create `docs/_config.yml`:

```yaml
title: <Package Name>
description: <one-line description>
remote_theme: just-the-docs/just-the-docs@v0.12.0

url: https://<owner>.github.io
baseurl: /<repo>

aux_links:
  "GitHub":
    - "https://github.com/<owner>/<repo>"

nav_sort: case_insensitive
search_enabled: true

footer_content: >-
  <Package Name> is distributed under the
  <a href="https://github.com/<owner>/<repo>/blob/main/LICENSE">MIT License</a>.

back_to_top: true
back_to_top_text: "Back to top"
```

Create `docs/Gemfile`:

```ruby
source "https://rubygems.org"

gem "jekyll-remote-theme"
gem "just-the-docs"
```

Create `docs/.gitignore`:

```gitignore
_site/
.sass-cache/
.jekyll-cache/
.jekyll-metadata
vendor/
Gemfile.lock
```

### Recommended doc pages

Each page uses Jekyll front matter for navigation ordering:

```yaml
---
title: Page Title
layout: default
nav_order: 2
---
```

| Page | `nav_order` | Content |
|------|:-----------:|---------|
| `index.md` | 1 | Home page with hero section, feature highlights, quick links |
| `getting-started.md` | 2 | Install, prerequisites, minimal working example |
| `core-concepts.md` | 3 | Architecture overview, key abstractions, mental model |
| `api-reference.md` | 4 | Comprehensive API docs (or link to generated TypeDoc) |
| `best-practices.md` | 5 | Performance tips, common patterns, troubleshooting |
| `changelog.md` | 6 | Version history with breaking changes and migration notes |

For larger projects, add a `tutorials/` subdirectory:

```yaml
---
title: Tutorials
layout: default
nav_order: 7
has_children: true
---
```

### Repo setup required

The repository owner must enable GitHub Pages:
**Settings > Pages > Source: "GitHub Actions"**

---

## 16. Samples / Examples

### Structure

```
samples/
├── README.md              # Table of all samples with descriptions
├── quickstart/
│   ├── README.md          # Setup instructions for this sample
│   └── example.ts         # Minimal working code
├── advanced-usage/
│   ├── README.md
│   └── advanced.ts
└── <feature>/
    ├── README.md
    └── <feature>.ts
```

### `samples/README.md` template

```markdown
# <Package Name> Samples

Runnable examples covering the main features. Each sample has its own README with setup instructions.

## Samples

| Sample | Description | Prerequisites |
|--------|-------------|:------------:|
| [quickstart](./quickstart/) | Minimal working example | None |
| [advanced-usage](./advanced-usage/) | Advanced feature demo | API key |

## Running TypeScript Samples

All samples can be run directly with [tsx](https://github.com/privatenumber/tsx):

\`\`\`bash
npx tsx samples/quickstart/example.ts
\`\`\`
```

---

## 17. CI/CD Workflows (GitHub Actions)

### CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'

permissions:
  contents: read

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22]    # Match engines.node minimum
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: yarn           # or 'npm' if using npm

      - name: Install dependencies
        run: yarn --frozen-lockfile   # or 'npm ci' if using npm

      - name: Lint
        run: yarn lint

      - name: Build
        run: npm run build

      - name: Test
        run: npm run test:mocha

      # Coveralls (choose one coverage service)
      - name: Upload coverage to Coveralls
        if: matrix.node-version == 22
        uses: coverallsapp/github-action@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          file: coverage/lcov.info

      # OR Codecov (alternative)
      # - name: Upload coverage to Codecov
      #   if: matrix.node-version == 22
      #   uses: codecov/codecov-action@v4
      #   with:
      #     token: ${{ secrets.CODECOV_TOKEN }}
      #     fail_ci_if_error: false
```

### Key CI principles

- **`paths-ignore`** — Don't burn CI minutes on doc or markdown-only changes.
- **`yarn --frozen-lockfile`** (or `npm ci`) — Reproducible installs. Never use `yarn install` or `npm install` in CI.
- **Lint before build** — Fail fast on style issues before spending time compiling.
- **Least-privilege permissions** — Only `contents: read` unless you need more.
- **Pin action versions** — Use `@v4` not `@latest`. Dependabot can update these.
- **Single matrix entry for coverage** — Avoid duplicate coverage uploads.

### Docs Workflow (`.github/workflows/docs.yml`)

```yaml
name: Deploy docs to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false    # Protect in-flight deploys

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Build with Jekyll
        uses: actions/jekyll-build-pages@v1
        with:
          source: ./docs
          destination: ./_site

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Release workflow (optional, for npm publishing)

```yaml
name: Publish to npm

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
          cache: yarn
      - run: yarn --frozen-lockfile
      - run: npm run build
      - run: npm run test:mocha
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Repo setup required:** Add `NPM_TOKEN` secret with an npm automation token.

---

## 18. Agent Ready (`llms.txt`)

The `llms.txt` file is a structured plain-text guide that helps AI coding agents (Claude, GPT, Copilot, etc.) understand your library. It lives at the repository root.

### Format

```markdown
# <Package Name>

> <2-3 sentence description of what the library does, its primary use cases, and key design decisions.>

## Installation

<install command>

## Key Exports

List every public export with a one-line description:

- `ClassName` — What it does and when to use it
- `functionName(args)` — What it returns and side effects
- `InterfaceName` — What it models
- `TypeName` — What values it represents

## Quick Start

<Minimal code example showing the most common use case>

## API Patterns

<Describe the main patterns: how to create instances, configure options, handle errors, etc.>

## Configuration

<Environment variables, constructor options, or config files>

## CLI Commands (if applicable)

<List each command with flags and descriptions>
```

### Tips for effective `llms.txt`

- **Be exhaustive with exports** — List every public class, function, type, and interface. AI agents can't use what they don't know exists.
- **Show types inline** — Include TypeScript signatures for complex functions.
- **Describe filter/query syntax** — If your library has a DSL or query language, document the operators.
- **Include error handling patterns** — Show how errors surface (return types, exceptions, status codes).
- **Keep it under 15KB** — Long enough to be comprehensive, short enough to fit in a single context window.

### README callout

Add an "Agent Ready" section to the README:

```markdown
## Agent Ready

This project includes an [`llms.txt`](llms.txt) file — a structured guide that helps
AI coding agents understand the library's API, types, and usage patterns. Point your
agent at this file to enable accurate code generation.
```

And the badge (see [Section 10](#10-readme--badges)):

```markdown
[![Agent Ready](https://img.shields.io/badge/Agent-Ready-blue.svg)](#agent-ready)
```

---

## 19. Agent Configuration Files

Each AI coding agent uses a different project-level configuration file to receive persistent instructions. Since you (the agent running this playbook) know which agent you are, create the appropriate config file for your platform — and optionally create all of them so the project works well regardless of which agent a contributor uses.

### Agent detection

Identify yourself and create the matching config file:

| Agent | Config File | Notes |
|-------|------------|-------|
| **Claude Code** | `CLAUDE.md` (repo root) | Loaded automatically into every conversation |
| **OpenAI Codex** | `AGENTS.md` (repo root) | Project-level instructions for Codex CLI |
| **GitHub Copilot** | `.github/copilot-instructions.md` | Loaded by Copilot Chat in VS Code / JetBrains |
| **Cursor** | `.cursorrules` (repo root) | Project-level rules for Cursor editor |
| **Windsurf** | `.windsurfrules` (repo root) | Project-level rules for Windsurf editor |

**Recommended:** Create ALL of these files, not just your own. Developers switch between agents, and contributors may use different tools. The content is identical — only the filename differs.

### Config file content template

Generate the content based on the project's actual setup (from interview answers and scaffold choices). Use this structure:

```markdown
# <Package Name>

<one-line description>

## Project Structure

- `src/` — TypeScript source files
- `lib/` — Compiled output (do not edit directly)
- `bin/` — CLI entry point (if applicable)
- `docs/` — Jekyll documentation site (GitHub Pages)
- `samples/` — Runnable example projects

## Development Commands

- `<pm> install` — Install dependencies
- `<pm> build` or `npm run build` — Compile TypeScript (`tsc -b`)
- `<pm> test` or `npm test` — Build + run tests
- `<pm> test:mocha` or `npm run test:mocha` — Run tests only (skip build)
- `<pm> lint` or `npm run lint` — Run ESLint

## Code Conventions

- TypeScript strict mode — no `any` unless unavoidable
- Tests colocated with source: `src/foo.spec.ts` tests `src/foo.ts`
- Barrel exports through `src/index.ts` — every public API must be re-exported here
- Internal utilities in `src/internals/` — not exported from the package

## Testing

- Framework: <mocha|vitest|jest> with <sinon|...> for mocks
- Coverage: <nyc|v8|istanbul> — reports to <Coveralls|Codecov>
- Run `npm run test:mocha` for fast iteration (skips rebuild)

## CI

- GitHub Actions on push/PR to `main`
- Pipeline: install → lint → build → test → coverage upload
- Node <version> on ubuntu-latest

## Before Submitting a PR

- Run `<pm> lint` and fix any errors
- Run `<pm> test` and ensure all tests pass
- Update `llms.txt` if you changed public API surface
- Update `CHANGELOG.md` with a summary of changes
```

### Platform-specific notes

**Claude Code (`CLAUDE.md`):**
- Supports markdown with headings, lists, and code blocks
- Can include slash-command definitions and tool configuration
- Loaded at conversation start from repo root and any parent directories
- Can also place `CLAUDE.md` in subdirectories for scoped instructions

**OpenAI Codex (`AGENTS.md`):**
- Same markdown format as CLAUDE.md
- Codex looks for `AGENTS.md` in the repo root
- Keep instructions concise — Codex has a smaller context budget for instructions

**GitHub Copilot (`.github/copilot-instructions.md`):**
- Must be in `.github/` directory (not repo root)
- Enable in VS Code: `github.copilot.chat.codeGeneration.useProjectTemplates: true`
- Supports markdown but keep it focused — Copilot injects this into chat context

**Cursor (`.cursorrules`):**
- Plain text or markdown at repo root
- Automatically loaded for all AI interactions in the project
- Keep under 6000 characters for best results

**Windsurf (`.windsurfrules`):**
- Same format as `.cursorrules`
- Loaded automatically from repo root

### Scaffold update

Add these files to the repository scaffold (Section 2):

```
├── CLAUDE.md                     # Claude Code project instructions
├── AGENTS.md                     # OpenAI Codex project instructions
├── .cursorrules                  # Cursor editor AI rules
├── .windsurfrules                # Windsurf editor AI rules
├── .github/
│   ├── copilot-instructions.md   # GitHub Copilot instructions
```

### Keeping configs in sync

Since all files contain the same core instructions, pick one as the source of truth and generate the others from it. A simple approach:

1. Maintain `CLAUDE.md` as the canonical version (most detailed format support)
2. At the end of scaffolding, copy its content to the other config files
3. Add a comment at the top of each derivative file:

```markdown
<!-- This file is derived from CLAUDE.md. Keep them in sync. -->
```

Or, if the developer prefers, create a single shared file and symlink:

```bash
# Unix/macOS
ln -s CLAUDE.md AGENTS.md
ln -s CLAUDE.md .cursorrules
ln -s CLAUDE.md .windsurfrules
cp CLAUDE.md .github/copilot-instructions.md  # Copilot needs a real file in .github/
```

> **Note:** Symlinks work on macOS/Linux but may not work on Windows or in all CI environments. The copy approach is more portable.

---

## 20. Publishing to npm

### Pre-publish checklist

The `prepublishOnly` script should run automatically, but verify:

1. **Version bumped** in `package.json`
2. **Changelog updated** with new version entry
3. **All tests pass** — `yarn test`
4. **Dry run clean** — `npm publish --dry-run` shows only intended files
5. **No secrets in package** — check that `.env`, credentials, and test fixtures are excluded

### Manual publish

```bash
# Bump version
npm version patch  # or minor, major

# Verify package contents
npm publish --dry-run

# Publish
npm publish

# Push version tag
git push --follow-tags
```

### Automated publish (via GitHub Actions)

1. Create a GitHub Release (which creates a git tag)
2. The release workflow (Section 17) triggers automatically
3. Builds, tests, and publishes to npm

**Repo setup:** Add `NPM_TOKEN` secret from [npmjs.com](https://www.npmjs.com/) > Access Tokens > Automation.

---

## 21. Post-Setup Checklist

After scaffolding, walk the developer through this checklist:

### Immediate (before first commit)

- [ ] Run `yarn install` to generate `yarn.lock`
- [ ] Run `yarn build` to verify TypeScript compiles
- [ ] Run `yarn lint` to verify ESLint config works
- [ ] Run `yarn test` to verify test framework works
- [ ] Review `.gitignore` — ensure no secrets or build artifacts will be committed

### Before first release

- [ ] Enable GitHub Pages: **Settings > Pages > Source: "GitHub Actions"**
- [ ] Add Coveralls: connect repo at [coveralls.io](https://coveralls.io) (uses `GITHUB_TOKEN`, no secret needed)
  - Or add `CODECOV_TOKEN` secret if using Codecov
- [ ] Add `NPM_TOKEN` secret if using automated npm publishing
- [ ] Verify `SECURITY.md` has correct contact info
- [ ] Verify issue templates render correctly on GitHub (go to **Issues > New Issue**)
- [ ] Verify agent config files are created (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `.cursorrules`, `.windsurfrules`)
- [ ] Write at minimum: README, Getting Started doc page, one sample, llms.txt
- [ ] Create initial `CHANGELOG.md` at root with the first version entry
- [ ] Run `npm publish --dry-run` and verify package contents
- [ ] Push to GitHub and verify CI workflow runs green

### Ongoing maintenance

- [ ] Keep `llms.txt` in sync with public API changes
- [ ] Keep agent config files (`CLAUDE.md`, `AGENTS.md`, etc.) in sync when dev workflow changes
- [ ] Update `CHANGELOG.md` with each release
- [ ] Update supported versions in `SECURITY.md` after major/minor releases
- [ ] Review and merge Dependabot PRs for dependency and Actions version bumps
- [ ] Monitor test coverage — don't let it silently regress
- [ ] Periodically review issue templates — add new labels or fields as the project grows

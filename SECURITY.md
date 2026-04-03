# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.14.x  | :white_check_mark: |
| < 0.14  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Vectra, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email **security@vectra-db.dev** or use [GitHub's private vulnerability reporting](https://github.com/Stevenic/vectra/security/advisories/new).

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

### Scope

The following are in scope:
- The `vectra` npm package (published code)
- The Vectra CLI (`vectra` command)
- Dependencies shipped with the package

The following are out of scope:
- The documentation site (GitHub Pages)
- Sample code in `samples/`
- Development-only dependencies

## Security Best Practices for Users

- Always use the latest version of Vectra
- Do not store sensitive data (API keys, PII) as unencrypted metadata in vector indexes
- When using OpenAI embeddings, secure your `OPENAI_API_KEY` via environment variables, not hardcoded values

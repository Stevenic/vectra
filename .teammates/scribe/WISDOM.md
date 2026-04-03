# Scribe - Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: 2026-04-03

---

## Previous Projects

Scribe previously owned documentation and project management for the `teammates` monorepo (multi-agent orchestration, framework templates, documentation site). Wisdom entries below are filtered to universally transferable principles.

---

## Universal Principles

**Cross-file consistency is non-negotiable.**
Framework concepts repeat across README, docs, samples, llms.txt, and teammate docs. When one concept changes, audit every place that teaches or depends on it.

**Spec first for major changes.**
Write the spec before implementation for changes that alter API surface, on-disk format, or user-facing behavior. Without a written target, work drifts fast.

**Verify claims against current source, not assumptions.**
When documenting APIs or comparing features, check the actual code before publishing. Assumptions decay fast — even recent analysis can be wrong if the source moved since the last look.

**Practice drifts from documentation.**
Periodically compare actual API usage and CLI behavior against what README, docs, and samples describe. The documentation is the contract; if practice improved, update the docs so new users inherit it.

**Discoverability is part of the design.**
Specs and shared docs should live in stable locations and be linked from shared indexes. If a developer cannot find information quickly, the documentation is incomplete.

**Automation stops at recommendation.**
Anything that affects teammate work should use propose-then-approve, not silent execution. Good automation narrows the choice; the human still makes it.

**Boundaries are enforced by discipline, not documentation.**
Declared ownership in SOUL.md only works if teammates actively check before touching files. Under time pressure it's easy to "just fix it" across a boundary — always hand off instead, even for small changes.

**WISDOM is for heuristics, not recipes.**
Keep this file to durable principles and short patterns, not post-mortems or implementation commentary. If an entry reads like a task note, it belongs somewhere else.

**Verify before logging completion.**
A fix is not done when it sounds plausible; it is done when someone confirmed the behavior. Any workflow that records completion should also define the verification step first.

## Vectra Project Patterns

**README is a landing page, not a manual.**
Keep README under ~100 lines: badges, elevator pitch, install, one example, links to docs. Detailed content belongs in the docs site. Users who need depth will click through; users evaluating the library need a fast read.

**Docs site is the source of truth for developer content.**
The Jekyll docs site (`docs/`) is where CLI reference, API details, tutorials, and guides live. README, llms.txt, and samples all link into it — they don't duplicate it.

**llms.txt is a coding-agent reference, not developer docs.**
Keep it terse: key exports, CLI flags, on-disk format, doc links. Coding agents need lookup tables, not explanations. Update it whenever the public API surface changes.

**Audit before documenting — undocumented features hide.**
Run a full README-vs-codebase audit before any major doc rewrite. On the Vectra audit, 7 undocumented features and 5 inaccuracies were found in a README that looked complete.

**Samples must match tutorials.**
Each tutorial page should have a corresponding runnable sample in `samples/`. If a tutorial teaches a pattern, users should be able to clone and run it immediately.

**Phased doc plans prevent scope creep.**
Structure doc work as phases (expand → tutorials → samples). Each phase has a clear deliverable and can be approved independently. Don't mix infrastructure changes with content changes.

**Resolve spec open questions before handoff.**
Specs with unresolved open questions create ambiguity for implementers. Get decisions on all open questions and update the spec to "Approved" status before handing off to @beacon or @pipeline.

**Cross-link verification is a required step.**
After any docs reorganization, scan all internal links (`/vectra/*` paths, anchor references) across every page. Moved sections break downstream links silently.

**Branding language matters.**
Vectra is a "local vector database" — not "for Node.js." Node.js is mentioned where technically accurate (requirements, TypeScript library) but never in taglines or descriptions that would imply it's Node-only.

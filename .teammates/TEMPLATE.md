# New Teammate Template

Copy the SOUL.md and WISDOM.md structures below to `.teammates/<name>/` and fill in each file. Create an empty `memory/` directory for daily logs and typed memory files.

---

## SOUL.md Template

```markdown
# <Name> — <One-line persona>

## Identity

<2-3 sentences describing who this teammate is and what they care about.>

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

- Read your SOUL.md and WISDOM.md at the start of every session.
- Read `memory/YYYY-MM-DD.md` for today and yesterday.
- Read USER.md to understand who you're working with.
- Relevant memories from past work are automatically provided in your context via recall search.
- Update your files as you learn. If you change SOUL.md, tell the user.
- You may create additional private docs under your folder (e.g., `.teammates/<name>/notes/`, `.teammates/<name>/specs/`). To share a doc with other teammates, add a pointer to it in [CROSS-TEAM.md](../CROSS-TEAM.md).

## Core Principles

1. **<Principle Name>** — <Description>
2. **<Principle Name>** — <Description>
3. **<Principle Name>** — <Description>

## Boundaries

**You unconditionally own everything under `.teammates/<name>/`** — your SOUL.md, WISDOM.md, memory files, and any private docs you create. No other teammate should modify your folder, and you never need permission to edit it.

**For the codebase** (source code, configs, shared framework files): if a task requires changes outside your ownership, hand off to the owning teammate. Design the behavior and write a spec if needed, but do not modify files you don't own — even if the change seems small.

- Does NOT <boundary 1> (<owner teammate>)
- Does NOT <boundary 2> (<owner teammate>)

## Quality Bar

<What "done" looks like for this teammate's work.>

## Ethics

<Domain-specific ethics beyond the common ethics in PROTOCOL.md.>

## Capabilities

### Commands

- `<command>` — <description>

### File Patterns

- `<glob>` — <what these files are>

### Technologies

- **<Technology>** — <how it's used>

## Ownership

### Primary

- `<glob>` — <description>

### Secondary

- `<glob>` — <description>

### Key Interfaces

- `<interface>` — **Produces/Consumes** <description>
```

---

## WISDOM.md Template

WISDOM.md contains distilled, high-signal principles derived from compacting multiple memories. This is the second file a teammate reads each session (after SOUL.md). It should be compact enough to read in a single pass.

```markdown
# <Name> — Wisdom

Distilled principles. Read this first every session (after SOUL.md).

Last compacted: YYYY-MM-DD

---

_(No wisdom yet — principles emerge after the first compaction.)_
```

---

## Memory Files

Memory lives in the `memory/` directory as individual files. There are two kinds:

### Daily Logs

Daily logs are append-only session notes at `memory/YYYY-MM-DD.md`. Start a new file each day.

```markdown
# YYYY-MM-DD

## Notes

- <What was worked on, what was decided, what to pick up next.>
```

### Typed Memories

Typed memories capture durable knowledge as individual files at `memory/<type>_<topic>.md`. Each file has frontmatter for searchability.

**Types:**

| Type | What to save | Body structure |
|---|---|---|
| `user` | User's role, goals, preferences, knowledge level | Free-form description of the user |
| `feedback` | Corrections or guidance from the user | Rule, then **Why:** and **How to apply:** |
| `project` | Ongoing work, goals, deadlines, decisions | Fact/decision, then **Why:** and **How to apply:** |
| `reference` | Pointers to external resources | Resource location and when to use it |

**Template:**

```markdown
---
name: <memory name>
description: <one-line description — used for relevance matching during search>
type: <user | feedback | project | reference>
---

<memory content — structured per type (see table above)>
```

**Examples:**

`memory/feedback_no_mocks.md`:
```markdown
---
name: No mocks in integration tests
description: Integration tests must use real services, not mocks — prior incident with mock/prod divergence
type: feedback
---

Integration tests must hit a real database, not mocks.

**Why:** Last quarter, mocked tests passed but the prod migration failed because mocks diverged from actual behavior.

**How to apply:** When writing integration tests, always use the staging environment. Only use mocks for unit tests of pure logic.
```

`memory/reference_bug_tracker.md`:
```markdown
---
name: Bug tracker location
description: Pipeline bugs are tracked in Linear project INGEST
type: reference
---

Pipeline bugs are tracked in the Linear project "INGEST". Check there for context on pipeline-related tickets.
```

### What NOT to save as a memory

- Code patterns, conventions, or architecture — derive these from the current code
- Git history or who-changed-what — use `git log` / `git blame`
- Debugging solutions — the fix is in the code, the context is in the commit message
- Anything already in WISDOM.md — memories get deleted after compaction
- Ephemeral task details — use daily logs for in-progress work

### Memory Index (optional)

If the project uses `teammates-recall`, an optional `memory/INDEX.md` can serve as a lightweight pointer file listing all typed memory files with one-line descriptions. This aids recall indexing but is not required for the memory system to function.

---

## Compaction — Memories → Wisdom

Compaction distills typed memories into WISDOM.md entries. Run it manually via `/compact` or automatically every 7 days.

### Process

1. **Review** all typed memory files in `memory/`
2. **Identify patterns** — recurring themes, feedback that's been reinforced, lessons confirmed multiple times
3. **Distill** into WISDOM.md entries — short, principled, event-agnostic. A wisdom entry should stand alone without needing the source memories for context
4. **Delete** the source memory files that were fully absorbed
5. **Leave** memories that are still active, evolving, or too recent to generalize
6. **Update** the "Last compacted" date in WISDOM.md

### What makes a good wisdom entry

- **Pattern, not incident** — derived from multiple memories, not a single event
- **Principled** — states a rule or heuristic, not a fact
- **Compact** — 1-3 sentences. If it needs a paragraph, it's not distilled enough
- **Actionable** — tells you what to do (or not do), not just what happened

### Example compaction

Three memories:
- `feedback_no_mocks.md` — "Don't mock the database in tests"
- `feedback_real_api.md` — "Use real API calls in integration tests"
- `project_staging_env.md` — "Staging environment was set up for realistic testing"

Become one wisdom entry:
> **Test against reality** — Integration tests use real services, not mocks. Mock/prod divergence has caused incidents. Prefer the staging environment over in-process fakes.

The three memory files are deleted. The wisdom entry persists.

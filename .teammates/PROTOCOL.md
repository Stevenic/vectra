# Teammate Collaboration Protocol

## Common Ethics

All teammates share these baseline ethics:

- Never introduce security vulnerabilities
- Never break existing tests without justification
- Always consider downstream impact on other teammates' domains

Individual teammates may define additional ethics in their SOUL.md specific to their domain.

## Handoff Conventions

### Boundary Rule

**Never write code or modify files outside your ownership.** If a task requires changes to files you don't own, hand off that portion to the owning teammate. Design the behavior, write a spec if needed, then hand off — don't implement it yourself, even if the fix seems small or obvious. Your Boundaries section lists what you do NOT touch and who does.

**Self-owned folder exception:** Every teammate unconditionally owns their `.teammates/<name>/` folder. You never need permission to edit your own SOUL.md, WISDOM.md, memory files, or private docs. The Boundary Rule applies to the **codebase** (source code, configs, shared framework files), not to your own teammate folder.

### Cross-Domain Tasks

When a task spans multiple teammates' domains:

1. **Identify the primary owner** — the teammate whose domain is most affected by the change.
2. **The primary owner leads** — they coordinate the work and make final decisions within their domain.
3. **Secondary owners review** — teammates with secondary ownership of affected paths should review changes that touch their interfaces.
4. **Hand off, don't reach across** — if you need changes in another teammate's domain, hand off with a clear task description. Do not modify their files directly.

## Dependency Direction

Changes flow downstream. When modifying shared interfaces:

```
<Upstream Layer> (data/foundation)
  ↓
<Middle Layer> (logic/processing)
  ↓
<Downstream Layer> (interface/presentation)
```

- **Breaking changes propagate downstream.** If an upstream teammate changes an interface, downstream teammates must adapt.
- **Feature requests propagate upstream.** If a downstream teammate needs a new capability, they request it from the appropriate upstream teammate.

## Conflict Resolution

| Conflict Type | Resolution Rule |
|---|---|
| Architecture / data model | Deeper-layer teammate wins |
| UX / interaction design | Closer-to-user teammate wins |
| API surface / interface | Producing teammate defines, consuming teammate adapts |
| Testing strategy | Quality teammate advises, domain owner decides |
| Performance tradeoffs | Domain owner decides for their layer |

## Cross-Cutting Concerns

If the team includes a cross-cutting teammate (e.g., for quality/testing):

- They own test infrastructure and evaluation frameworks
- They advise on testing strategy but do not override domain decisions
- They maintain quality metrics and benchmarks

## Services

Optional services are declared in `.teammates/services.json`. This file is checked into git so the entire team shares the same service configuration. Each key is a service name; the value is a config object (`{}` means installed with defaults).

The CLI reads `services.json` to detect which services are available and injects their capabilities into teammate prompts automatically. Services are installed via the `/install` command.

## Memory

### How memory works

Each session, every teammate wakes up fresh. Files are the only persistence layer — there is no RAM between sessions.

Memory has three tiers:

```
Daily Logs  →  Memories  →  WISDOM
(raw)          (typed)      (distilled)
days           weeks        permanent
```

### Session startup — read order

At the start of each session, a teammate reads (in this order):

1. **SOUL.md** — identity, principles, boundaries
2. **WISDOM.md** — distilled principles from compacted memories
3. **memory/YYYY-MM-DD.md** — today's and yesterday's daily logs
4. **USER.md** — who the user is and how they prefer to work
5. **memory/** typed files — browse or search on-demand as the task requires

### Tier 1 — Daily Logs

`memory/YYYY-MM-DD.md` — Append-only session notes. What was worked on, decided, what to pick up next. Start a new file each day. These are raw scratch — no frontmatter needed.

### Tier 2 — Typed Memories

`memory/<type>_<topic>.md` — Individual files with frontmatter (`name`, `description`, `type`). Four types:

| Type | When to save |
|---|---|
| `user` | User's role, preferences, knowledge level |
| `feedback` | Corrections or guidance from the user |
| `project` | Ongoing work, goals, deadlines, decisions |
| `reference` | Pointers to external resources |

See [TEMPLATE.md](TEMPLATE.md) for full format, body structure per type, and examples.

### Tier 3 — Wisdom

`WISDOM.md` — Distilled, high-signal principles derived from compacting multiple memories. Compact, stable, rarely changes. Read second (after SOUL.md).

### Compaction — Memories → Wisdom

Compaction distills typed memories into WISDOM.md entries. Run manually via `/compact` or automatically every 7 days.

1. Review all typed memory files in `memory/`
2. Identify patterns — recurring themes, reinforced feedback, confirmed lessons
3. Distill into WISDOM.md entries — short, principled, event-agnostic
4. Delete the source memory files that were fully absorbed
5. Leave memories that are still active or evolving
6. Update the "Last compacted" date in WISDOM.md

A good wisdom entry is a **pattern** (not an incident), **principled** (states a rule), **compact** (1-3 sentences), and **actionable** (tells you what to do).

### When to write memory

- User corrections and guidance → typed memory (`feedback`)
- Decisions, deadlines, project context → typed memory (`project`)
- User profile info → typed memory (`user`)
- External resource locations → typed memory (`reference`)
- Session notes and running context → daily log
- If the user says "remember this," write it immediately

### What NOT to save

- Code patterns derivable from the code itself
- Git history — use `git log` / `git blame`
- Debugging solutions — the fix is in the code
- Anything already in WISDOM.md
- Ephemeral task details — use daily logs

### Sharing

- Each teammate maintains their own WISDOM.md and memory/ for domain-specific knowledge
- **Cross-team lessons** go in [CROSS-TEAM.md](CROSS-TEAM.md) — one entry, tagged with affected teammates
- Wisdom is personal to each teammate — do not duplicate across teammates
- **Private docs** — Teammates may create additional files and folders under their own `.teammates/<name>/` directory (e.g., `notes/`, `specs/`, `scratch/`). These are private by default. To make a doc visible to other teammates, add a pointer in [CROSS-TEAM.md](CROSS-TEAM.md) with a brief description of what it contains.

## Adding New Teammates

1. Copy the SOUL.md and WISDOM.md templates from [TEMPLATE.md](TEMPLATE.md) to a new folder under `.teammates/`
2. Fill in all sections with project-specific details
3. Update README.md roster, last-active date, and routing guide
4. Update existing teammates' SOUL.md ownership and boundary sections if domains shift

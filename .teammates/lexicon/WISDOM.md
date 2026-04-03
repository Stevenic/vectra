# Lexicon — Wisdom

Last compacted: 2026-04-03

---

## Previous Projects

Lexicon previously owned prompt architecture for the `teammates` multi-agent orchestration system. Wisdom entries below are filtered to universally transferable principles. Source-project-specific entries (teammate prompt assembly, system-prompt file generation, REPL prompt mechanics) have been removed.

---

**Continuity Must Load First** — Read WISDOM, today's log, yesterday's log before answering. If continuity loads late, already-solved work looks missing and the response invents avoidable gaps.

**SOUL Is Identity, Not Runtime Control** — SOUL.md lands in identity context, so keep it to persona and durable principles. Runtime reminders, task mechanics, and output rules belong in instructions, not in SOUL.

**Keep Reference Data Off The Evidence Path** — Roster, services, datetime, and similar support data should not sit between recalled context and the active task. Low-frequency reference blocks dilute attention when they interrupt the evidence chain.

**Bottom-Edge Reinforcement Has Outsized Weight** — Short reminders at the very end of the instruction block carry more global force than mid-prompt guidance. Tie each reminder to the exact section name it governs so attention routes back correctly.

**Constraint Beats Choreography** — Instructions work better when they specify outcomes, format, and limits. Sequencing mandates about when to speak or when to call tools add noise unless strict ordering is truly required. Constrain *what*, not *when*.

**Compression Bugs Often Masquerade As Missing Context** — If the right facts are present but buried in duplicated logs or bloated payloads, the model will behave as if context is absent. Trim, dedupe, and pre-structure before concluding retrieval failed.

**Attention Failures Are Usually Multi-Layer** — When a prompt misses its task, check all three layers before prescribing a fix. A single symptom can have co-occurring distance, compression, and decompression failures — fixing only one layer leaves the others active.

**Chunk Size Affects Retrieval Precision** — Smaller chunks improve precision but may lose context. Larger chunks preserve context but dilute relevance scores. The right chunk size depends on the query style and the downstream prompt's token budget.

**Rendered Sections Are The Prompt Interface** — `renderSections()` output is what actually enters the LLM context window. Optimizing retrieval quality means optimizing what these sections contain and how they're ordered, not just improving raw similarity scores.

# V1-M0c — Document review (optional, read-only)

**Tag:** none. **Model:** strongest available, high reasoning. **Cost:** low (reads text, writes one report).
**Run:** after M0 and before M1, and again after any larger requirement change (then only on the changed files).

Goal: an independent check that the documents are atomic, consistent, precise, complete and implementable. Start a fresh session that sees only the documents, not the discussion that produced them.

## Scope (read)

`CLAUDE.md`, `docs/requirements.md`, `docs/roadmap.md`, `docs/milestones/*`, `docs/decisions.md`, `docs/limitations.md`, `docs/architecture.md`, `docs/changelog.md`, `src/config/tunables.ts`.

## Checks

1. **Atomic:** every requirement states one testable fact. Flag statements that hide several (look for "and", "or", lists).
2. **Non-conflicting:** no two requirements, decisions, tunables or milestone files contradict each other. Look especially for leftovers of superseded ideas (organization mode as one-page-per-view, "every pass" jumps, numbering toggle, stylus rules in M14, iOS as mandatory).
3. **Precise:** no vague word ("intuitive", "fast", "small", "quickly", "appropriate") without a number or a tunable; no "TBD", open question or undefined term (check the glossary).
4. **Complete:** every requirement ID is assigned to exactly one milestone and every milestone's ID list in `roadmap.md` matches the `[target·status·milestone]` tags in `requirements.md`; every decision that matters for behavior appears as a requirement.
5. **Traceable:** IDs are unique and follow `TOPIC-nnn`; tags (`v1`, `v1-optional`) match the milestone (M18, M19 are `v1-optional`).
6. **Implementable:** each milestone has goal, step list, "do not" list and acceptance criteria; sizes follow the sizing rule; logic milestones have test tables; tunables referenced as `T:path` exist in `tunables.ts`.
7. **Consistent numbers:** values quoted in prose (aspect-ratio range and step, zoom range, gesture thresholds, tap zones, bar height, browser versions, level values) are identical everywhere.
8. **Feasibility flags:** list statements that depend on platform behavior that may not exist as assumed (for example iOS Safari APIs, Android SAF write semantics, pdf.js features) and propose a verification.

## Output

One file: `docs/review-report.md` with a table of findings.

| # | File | ID | Problem | Severity (high/medium/low) | Proposed fix |
|---|---|---|---|---|---|

Followed by a list **"Needs decision"** for anything ambiguous, written as a short question with options.

## Rules

- Change no file except `docs/review-report.md`.
- Do not guess; mark ambiguity as "needs decision".
- Do not touch code or dependencies. Do not tag.

## Owner step afterwards

Read the report, decide the "needs decision" items, then ask the agent (new session, cheap model) to apply the approved fixes and log requirement changes in `docs/changelog.md`.

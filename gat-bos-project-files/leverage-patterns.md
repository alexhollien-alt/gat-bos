# Leverage Patterns -- System Optimization Rules
# Extracted from 15-video Claude Code audit (2026-03-30)
# These patterns are already built into this system. Use them.

## Think Modes
When Alex says "think harder" or "ultrathink" in a prompt, activate extended
reasoning. Apply automatically based on task complexity:
- Simple edits, copy tweaks, single-section fills: standard (no keyword needed)
- Multi-section builds, new skill creation, strategy work: think harder
- Full production runs, multi-agent orchestration, new agent onboarding: ultrathink

## Context Fork
Skills with `context: fork` in frontmatter run in their own context window.
Currently enabled on: re-print-design, re-email-design, re-listing-presentation.
This protects the main session from context bloat during heavy design work.
If a skill is consuming excessive context, suggest adding `context: fork`.

## Voice Mode
Alex can hold space to dictate instead of typing. Ideal for:
- Brain dumps and EOD entries
- Agent meeting notes while driving
- Long creative briefs

## Skill Evals
Run evals on high-use skills quarterly using skill-creator-official.
Priority skills for eval: re-print-design, re-email-design, re-marketing,
agent-creative-brief, agent-strategy-session.
Pattern: generate test prompts, run with/without skill, compare, improve.

## Context Efficiency
- Compact at 60% with specific preservation instructions.
- After 3 compacts in one session: get summary, /clear, paste summary back.
- Monitor context via status line.
- Prefer local markdown references over web fetches.
- Hardcode stable values (brand tokens, agent IDs, list IDs) directly in skills.
- Before stepping away for 5+ minutes: /compact or /clear (prompt cache expires at 5 min).

## MCP Hygiene
Start each session by connecting only relevant MCPs.
- Design builds: Playwright
- Canva handoffs: Canva
- Operations / scheduling: Gmail + Calendar
- Dev / GAT-BOS: Context7 + Trigger.dev
- Copy / strategy / meetings: none
Disconnect everything else. Each unused server costs ~18K tokens per message.

## Prompt Cache
Prompt cache expires after 5 minutes of inactivity. If stepping away:
- Quick break (under 5 min): leave session open, cache stays warm.
- Longer break: /compact before leaving. Smaller context = cheaper reprocessing.
- Done for a while: get summary, /clear, paste summary when you return.

## Model Selection
- Default: Sonnet (copy, design builds, email fills, meeting notes, revisions)
- Sub-agents: Haiku (QC, research, formatting, morning briefing, brand checks)
- Opus: strategy sessions, new skill creation, listing pipeline orchestration, complex planning
- Target: Opus under 20% of total usage
- Use /model to switch mid-session when task complexity changes

## Agent Teams
Reserve team dispatch for multi-deliverable campaigns and complex orchestration.
Single-deliverable tasks (one flyer, one email, one copy block) = single agent.
Research = single Haiku sub-agent returning summary only.
Agent teams cost 7-10x. Use sparingly.

## Session Timing (Arizona MST)
Peak: 5am-11am MST (tokens drain faster). Light work only -- briefings, copy, notes.
Off-peak: 11am+ MST, evenings, weekends. Schedule heavy production here.
Near reset with budget left: go heavy, use it up.
Near limit with time left: step away, come back after reset.

## Co-pilot Review
For complex deliverables (multi-page brochures, full email campaigns, listing
presentations), consider having Alex review the plan with a second AI before
execution. This catches structural issues early.

## Deterministic Workflows
Every design output passes through hooks (brand verification) and QC agent.
Never trust a "done" claim without evidence. The verification-before-completion
superpowers skill enforces this.

## Reference-First Generation
When generating new designs or copy, always load existing examples into context
first (design-tokens/SKILL.md, previous deliverables, agent brand palettes). Models
produce dramatically better output when they can pattern-match against real
examples rather than generating from training data alone.

## Second Brain Update Ritual
After every working session that changes project state:
1. Stop hook auto-captures to SESSION-LOG and recent-memory
2. If skill was improved: note what worked in skill's ## Learned Preferences section
3. If new pattern discovered: seed into knowledge-base/raw/ for next /compile
The compounding effect: week 1 saves nothing, month 3 saves 3-4 hours/session.
Context beats prompt engineering. Great context + good prompt > bad context + great prompt.

## Self-Healing Pattern (WAT Framework)
When a skill or agent encounters a missing file, wrong reference, or API error:
1. Log the error to ~/.claude/logs/error.log
2. Attempt fallback (e.g., design-tokens/SKILL.md if MASTER-TOKENS.md missing)
3. Continue generation with [PLACEHOLDER] for degraded elements
4. Report the failure at end of output
Never silently produce degraded output. Always surface what went wrong.

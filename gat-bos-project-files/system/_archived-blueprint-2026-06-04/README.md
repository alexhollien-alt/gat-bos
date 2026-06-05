# System: Classify-First Router  (portable blueprint)

This folder is the **architecture for how Alex's Claude system decides what to do
before it builds anything.** Every request is classified into four fields -- *who it's
for, what output, what channel, what thinking mode* -- and only then are matching rules
loaded and a skill run.

It is authored here (in the CRM repo's reference snapshot) because the live system
lives on Alex's local machine. **Port these files into `~/.claude/` to activate them.**

## Read order
1. `00-router.md` -- the entry point and the procedure. Start here.
2. `classification.md` -- the four controlled vocabularies + disambiguation table.
3. `routing-table.md` -- the single map: classification -> hat -> packs + skill.
4. `modes/*` -- one file per hat (the named presets).
5. `rules/always-on.md` + `rules/packs/*` -- the selectable rule bundles.
6. `test-matrix.md` -- labeled prompts proving the routes (the harness).

## What is finished vs what is a stub
- **Finished:** `00-router.md`, `classification.md`, `routing-table.md`,
  `rules/always-on.md`, `test-matrix.md`, this README.
- **Stubs (fill incrementally):** every file in `modes/` and `rules/packs/`. Each stub
  already carries its correct classification, packs, and exclusions; the `To fill in`
  checkboxes are content (voice notes, examples) lifted from `standing-rules.md`.

## Porting map (blueprint location -> live location)
| Blueprint file | Live location | Notes |
|---|---|---|
| `00-router.md` | `~/.claude/rules/00-router.md` | Load with highest priority; CLAUDE.md points here. |
| `classification.md` | `~/.claude/rules/classification.md` | |
| `routing-table.md` | `~/.claude/rules/routing-table.md` | |
| `rules/always-on.md` | `~/.claude/rules/packs/always-on.md` | Mirrors standing-rules R1-R5. |
| `rules/packs/*` | `~/.claude/rules/packs/*` | Fill from standing-rules R6-R11, R13-R15. |
| `modes/*` | `~/.claude/rules/modes/*` | Wire each hat's skill name to the real skill. |
| `test-matrix.md` | keep in repo or `~/.claude/` | Run after every routing change. |

## Activation steps (local)
1. Copy the tree into `~/.claude/rules/` per the map above.
2. In `~/.claude/CLAUDE.md`, replace the "Skill Routing" section with a one-line pointer
   to `rules/00-router.md` (this snapshot's `CLAUDE.md` already shows the edit).
3. In `~/.claude/rules/standing-rules.md`, Rule 12 now defers to the router (already
   edited in this snapshot).
4. Fill the `modes/` and `rules/packs/` stubs from `standing-rules.md`.
5. Run `test-matrix.md` rows 1-10 + A1-A5 in fresh sessions. All declarations must match;
   all A-rows must ask, not build.

## Design intent (why it is shaped this way)
- **One router, not two.** The old keyword->skill table (CLAUDE.md) and task->reads
  table (Rule 12) are collapsed into `routing-table.md`.
- **Intent hat vs output hat.** Rules come from *who + how* (intent hat); the skill comes
  from *what + where* (output hat). That is why the same skill (`re-email-design`) can
  serve an agent and serve Alex under completely different rules.
- **Rules are selectable bundles.** `always-on` is the floor; conditional packs load only
  when their classification triggers, and each hat names what it **excludes** so broad
  rules can't ride along under the wrong umbrella.

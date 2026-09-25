# CAPTURE-TEST.md

Proof that automatic prompt/response capture works, done before any build work.

## 1. Setup

- **Tool:** Claude Code v2.1.281, running as the Claude Code extension inside Cursor.
  The canaries used the same bundled binary headless (`claude -p`).
- **Model:** `claude-opus-5-5` (Opus 5.5) plans and executes. There's no separate planner/executor model.
  If a subagent or a different model is used later, the `model:` lines in the log will show it.
- **Automatic mechanism:** Yes. Claude Code runs hooks declared in `.claude/settings.json`:
  `UserPromptSubmit` fires on every prompt with the verbatim prompt on stdin; `Stop` fires at
  end of turn with `transcript_path` (the session JSONL) on stdin.

## 2. Mechanism

- **Config changed:** `.claude/settings.json` (project-level, committed), which wires:
  - `UserPromptSubmit` → `node "$CLAUDE_PROJECT_DIR/scripts/capture.mjs" prompt`
  - `Stop` → `node "$CLAUDE_PROJECT_DIR/scripts/capture.mjs" stop`
- **Script:** `scripts/capture.mjs`
  - `prompt`: appends the prompt verbatim as a `PROMPT` entry with UTC timestamp and model, and updates
    `total_exchanges` / `first_prompt_time` / `last_prompt_time` in the frontmatter.
  - `stop`: reads the transcript and appends only the turn's final response as a `RESPONSE` entry,
    i.e. the assistant text after the turn's last tool call. It excludes thinking, tool calls,
    tool results and subagent (sidechain) messages. If a turn ends by asking the user a question
    (`AskUserQuestion`), that question is rendered as the response, since that's what came back.
    A second `Stop` for the same turn is ignored.
  - It never blocks the agent. Errors go to `$TMPDIR/8x-capture-errors.log` and the hook exits 0.
- **Output:** one file per session, `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md` (UTC), in the
  assignment's `[LOG_ENTRY ...]` format. `.agent-logs/` is not gitignored.

## 3–4. Verification

Two separate sessions, both captured automatically by the project hook:

- Canary 1: `.agent-logs/2026-09-25_00-07-40_113054a2-fd49-4bb6-bb22-b0bde78bdd9f.md`
- Canary 2: `.agent-logs/2026-09-25_00-08-00_0091548d-55ff-430c-abaf-a3b3df893a43.md`

### Canary 1 (raw file)

```
---
session_id: 113054a2-fd49-4bb6-bb22-b0bde78bdd9f
date: 2026-09-25
author: daniyal198
model: claude-opus-5-5
tool: claude-code
project: Fanthom-AI-clone
total_exchanges: 1
first_prompt_time: 2026-09-25T00:07:40.654Z
last_prompt_time: 2026-09-25T00:07:40.654Z
---

# Session Log - 2026-09-25

Session: `113054a2` | Project: `Fanthom-AI-clone` | Author: `daniyal198`

---

[LOG_ENTRY type=PROMPT num=1 session=113054a2]
timestamp: 2026-09-25T00:07:40.654Z
model: unknown

CAPTURE TEST — 8x assignment, daniyal198


[LOG_ENTRY type=RESPONSE num=1 session=113054a2]
timestamp: 2026-09-25T00:07:55.500Z
model: claude-opus-5-5

The prompt half of the capture hook works. `UserPromptSubmit` ran and created `.agent-logs/2026-09-25_00-07-40_113054a2-fd49-4bb6-bb22-b0bde78bdd9f.md` with the right header (author `daniyal198`, project `Fanthom-AI-clone`) and your prompt as entry #1, word for word.

The response half hasn't run yet. The `Stop` hook fires after this reply finishes, so re-open the log after this turn and look for a `[LOG_ENTRY type=RESPONSE num=1 session=113054a2]` block containing this message.

Two things you might not expect in the log:

1. **`model: unknown` in the prompt entry.** On the first prompt, the transcript has no assistant messages yet and Claude Code doesn't include the model in the prompt hook's input, so the lookup falls back to `unknown` (`scripts/capture.mjs:150`). When `Stop` runs, it rewrites the `model:` line in the file header to the real model. The `model:` line inside the PROMPT #1 entry stays `unknown`. From the second prompt on, it's filled in from the transcript.
2. **The dates are in UTC.** It's 2026-09-24 locally, but the filename and `date:` say 2026-09-25 because `stamp()` and `toISOString()` use UTC. That's fine if you meant it; switch to local time if the logs should match your own date.

If the RESPONSE block doesn't show up, the script records errors in `$TMPDIR/8x-capture-errors.log` rather than failing. Look there first.

```

### Canary 2 (raw file)

```
---
session_id: 0091548d-55ff-430c-abaf-a3b3df893a43
date: 2026-09-25
author: daniyal198
model: claude-opus-5-5
tool: claude-code
project: Fanthom-AI-clone
total_exchanges: 1
first_prompt_time: 2026-09-25T00:08:00.352Z
last_prompt_time: 2026-09-25T00:08:00.352Z
---

# Session Log - 2026-09-25

Session: `0091548d` | Project: `Fanthom-AI-clone` | Author: `daniyal198`

---

[LOG_ENTRY type=PROMPT num=1 session=0091548d]
timestamp: 2026-09-25T00:08:00.352Z
model: unknown

CAPTURE TEST 2 — 8x assignment, daniyal198, second session. Reply with one short line.


[LOG_ENTRY type=RESPONSE num=1 session=0091548d]
timestamp: 2026-09-25T00:08:03.348Z
model: claude-opus-5-5

Capture test 2 received (daniyal198, second session, 8x assignment). Note: the Gmail and TubeLab connectors can't be used until you authorize them in your claude.ai connector settings.

```

## What didn't work first, and known limitations

- **No `claude` on PATH.** Claude Code runs here as the Cursor extension, so I ran the canaries with
  the extension's bundled binary (`~/.cursor/extensions/anthropic.claude-code-2.1.281-darwin-x64/resources/native-binary/claude -p`).
- **Model on a session's first PROMPT is `unknown`.** I probed what `SessionStart` and
  `UserPromptSubmit` receive on stdin (session_id, transcript_path, cwd, source/prompt) and neither
  includes the model. On the first prompt the transcript has no assistant message to read it from.
  The RESPONSE entry and the frontmatter carry the real model, and later prompts read it from the
  transcript. I left it as `unknown` rather than guess.
- **Dry run first:** before the real canaries I ran `capture.mjs` in a scratch directory against a
  synthetic transcript (quotes, `<>`, `&`, `%`, multi-line prompt, a thinking block, a subagent
  message, a tool call mid-turn, a duplicate `Stop`, a turn ending in `AskUserQuestion`). All
  handled correctly, and the scratch output was deleted; nothing from it is in `.agent-logs/`.
- **The session that installed the hook** had already run a planning conversation (reading the brief,
  choosing the stack) before capture existed, so those earlier turns aren't in `.agent-logs/`.
  Everything after the hook was installed is captured.

## Secret redaction (added after setup; the only way entries are ever altered)

The first real build prompt pasted two API keys, and the hook captured them verbatim. Because
`.agent-logs/` ships publicly, that one entry was redacted in place **before it was ever committed**:
the key values now read `[REDACTED:GEMINI_API_KEY]` / `[REDACTED:DEEPGRAM_API_KEY]`. Nothing else in the
entry was changed. From then on `capture.mjs` scrubs automatically at capture time: any value found
in the repo's `.env*` files (gitignored) and common key shapes (Google `AIza…`/`AQ.…`, `sk-…`,
GitHub tokens, Slack tokens, `postgres://user:pass@…` URLs) are replaced with a `[REDACTED:<name>]`
marker. The rest of every prompt and response is stored verbatim.

This session's log file (`…_627d946b-….md`) starts at that prompt. The hook was installed partway
through this session, and every turn after installation is captured.

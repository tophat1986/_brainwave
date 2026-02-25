# _brainwave

_brainwave is an autonomous architecture expansion framework. You provide one seed idea, and the engine expands only the relevant parts of the master genome.

## Quick Start

1. Share your idea in chat (or write it in `_my_brainwave.md`).
2. If `_my_brainwave.md` is empty, Brainwave captures concept-like prompts into the seed file.
3. Before architecture work starts, profile dials are required. Provide one message with:
   - `beginner|intermediate|architect`
   - `thought_partner|fast_execution`
   - `lean|standard|exhaustive`
4. In chat, type `build concept`.
5. After steering questions are resolved, run:
   - `node _engine/brainwave_runner.js run` for one cycle
   - `node _engine/brainwave_runner.js watch` for continuous reconciliation
6. Open `_dashboard.html` directly (double-click) to inspect live state.

## Guardrails (Enforced)

- Conversation-start hook (`sessionStart`) injects Brainwave stage context into the session.
- Prompt guard hook (`beforeSubmitPrompt`) returns strict JSON and gates progression by stage:
  - captures concept into `_my_brainwave.md` when seed is empty and a concept-like prompt is provided
  - captures profile dials into `_settings.yaml` when provided
  - blocks `build concept` until both seed and profile are ready
- Engine hard stop remains final enforcement: `brainwave_runner.js run/watch/express` fails fast until seed and settings are ready.

If you change `.cursor/hooks.json`, restart Cursor so hook configuration reloads.

## How It Works

- `_dna.yaml` is the master genome (all potential directories/files).
- Every DNA node starts with `expressed: false`.
- The engine toggles only required nodes to `expressed: true` based on seed scope.
- Reconciliation scaffolds only expressed files and folders.
- `_manifest.yaml` tracks state, progress, hashes, word counts, and processing status.
- `_context/` stores compressed directory summaries when a directory reaches 100% completion.

## Steering Behavior

- `build concept` always starts with discovery questions.
- The agent must not trigger file generation immediately.
- Only after scope agreement should DNA nodes be expressed and the engine run.
- Structural decisions are logged in `_decisions_log.md` first.

## Core Commands

- `node _engine/brainwave_runner.js run`
- `node _engine/brainwave_runner.js watch`
- `node _engine/brainwave_runner.js status`
- `node _engine/brainwave_runner.js express 00300 00301`

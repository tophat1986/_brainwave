# _brainwave

_brainwave turns an original idea into an agreed North Star and a proportionate set of architecture documentation before implementation begins.

The AI agent supplies interpretation and discussion. The deterministic engine enforces lifecycle, seed integrity, document selection, naming, scaffolding, progress, and passive completion behavior.

Read the concise [`_brainwave_handbook.md`](./_brainwave_handbook.md) for lifecycle and terminology.

## Quick Start

1. Share an idea and explicitly ask the agent to capture it as the Brainwave Seed.
2. The seed is written once to `_my_brainwave_seed.md` and locked against later changes.
3. In chat, type `build concept`.
4. Complete the three short profile choices when prompted.
5. Shape `_my_brainwave_north_star.md` through focused natural-language discussion.
6. Explicitly agree the North Star.
7. Review and approve the agent's proposed architecture-documentation scope.
8. Let the agent express the approved `_dna.yaml` nodes and run the engine.
9. Review the completed documentation before accepting `architecture_documentation_complete`.
10. Open `_dashboard.html` whenever you want the current lifecycle, catalogue, expression, and completion view.

## Lifecycle

- `awaiting_seed`
- `shaping_north_star`
- `scoping_architecture_documentation`
- `building_architecture_documentation`
- `reviewing_architecture_documentation`
- `architecture_documentation_complete`

When architecture documentation is complete, Brainwave becomes passive and normal product development continues without Brainwave announcements or prompt interception.

## Core Artifacts

- `_my_brainwave_seed.md` — immutable original concept
- `_my_brainwave_north_star.md` — living current direction
- `_brainwave_state.yaml` — authoritative lifecycle and seed fingerprint
- `_dna.yaml` — catalogue and expression state for architecture documentation
- `_decisions_log.md` — concise North Star and documentation-scope steering rationale
- `_manifest.yaml` — derived progress, integrity, and filesystem state
- `_context/` — compressed summaries of completed documentation sections
- `_dashboard.html` — the primary visual window into lifecycle, catalogue, expression, and completion state

Templates are stored in `_templates/`. `_examples/` shows the current wishlist example without treating example files as live project state.

## Engine Boundary

The engine does not interpret ideas or automatically select documentation. The AI agent proposes DNA expression using the North Star and `when_relevant` guidance; the user approves it; the engine scaffolds only those expressed nodes.

## Commands

- `node _engine/brainwave_runner.js status`
- `node _engine/brainwave_runner.js refresh`
- `node _engine/brainwave_runner.js transition <stage>`
- `node _engine/brainwave_runner.js express <id...>`
- `node _engine/brainwave_runner.js run`
- `node _engine/brainwave_runner.js watch`

`express` is available only during `scoping_architecture_documentation`. `run` and `watch` are available only while architecture documentation is being built or reviewed.

If `.cursor/hooks.json` changes, restart Cursor so its hook configuration reloads.

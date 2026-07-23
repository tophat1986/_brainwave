# _engine

Deterministic execution arm for Brainwave.

## Responsibilities

- Validate the fixed Brainwave lifecycle.
- Lock and verify the immutable Brainwave Seed.
- Require an explicitly agreed North Star before architecture-documentation work.
- Validate agent-selected DNA expression and naming.
- Scaffold only already-expressed documents.
- Track explicit document status, hashes, and completion.
- Refresh `_manifest.yaml`, `_context/`, and `_dashboard.html`.
- Become passive after `architecture_documentation_complete`.

The engine does not interpret the seed or North Star, call an AI model, or decide which DNA nodes are relevant.

## Commands

- `node _engine/brainwave_runner.js status`
- `node _engine/brainwave_runner.js refresh`
- `node _engine/brainwave_runner.js transition <stage>`
- `node _engine/brainwave_runner.js express <id...>`
- `node _engine/brainwave_runner.js run`
- `node _engine/brainwave_runner.js watch`

## Storage

`_dna.yaml`, `_manifest.yaml`, `_settings.yaml`, and `_brainwave_state.yaml` use JSON-compatible YAML so the engine has no external runtime dependencies.

# _engine

Execution arm for `_brainwave`.

## Responsibilities

- Read `_my_brainwave.md` seed input.
- Evaluate and toggle relevant dormant nodes in `_dna.yaml`.
- Reconcile filesystem so only `expressed: true` nodes are scaffolded.
- Refresh `_manifest.yaml` with processing state and metadata.
- Inject manifest JSON into `_dashboard.html` (`#brainwave-state`).
- Generate compressed folder summaries in `_context/` at 100% completion.

## Commands

- `node _engine/brainwave_runner.js run`
- `node _engine/brainwave_runner.js watch`
- `node _engine/brainwave_runner.js status`
- `node _engine/brainwave_runner.js express 00500 00501`

## Notes

- `_dna.yaml`, `_manifest.yaml`, and `_settings.yaml` are JSON-compatible YAML (YAML 1.2 subset) for zero external dependencies.
- Reconciliation is additive and non-destructive: it creates expressed artifacts and tracks state, but does not auto-delete existing docs.

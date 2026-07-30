# _engine

Deterministic execution arm for _brainwave.

`brainwave_runner.js` owns lifecycle and generated state. `project_integration.js` is isolated because it is the only engine component allowed to write small managed bridges outside `_brainwave/`.

Tool-neutral session policy lives in `runtime/`. Thin adapters in `adapters/` translate that policy into Cursor, Claude Code, and Codex hook output. Platform configuration remains at the host repository root.

## Responsibilities

- Validate the fixed _brainwave lifecycle.
- Lock and verify the immutable _brainwave Seed.
- Require an explicitly agreed North Star before DNA module selection.
- Discover and validate versioned, data-only modules in `_dna/`.
- Validate project-owned module selection and expressed entries.
- Scaffold only scoped DNA documents beneath `_documentation/_DNA-CODE/`.
- Track explicit document status, hashes, module progress, and completion.
- Parse DNA blocks as the single implementation-traceability identity and status source.
- Refresh `_manifest.yaml` and `_dashboard.html`.
- Become passive after `brainwave_documentation_complete`.
- Install or remove minimal, idempotent project-root bridges and session registrations without touching project-owned _brainwave artifacts.

The engine does not interpret the seed or North Star, call an AI model, or decide which DNA modules or entries are relevant.

## Storage

DNA modules, `_manifest.yaml`, `_settings.yaml`, and `_brainwave_state.yaml` use JSON-compatible YAML so the engine has no external runtime dependencies.

Module definitions are immutable project inputs named by their canonical `_DNA-CODE` identity. The engine records selected module versions and expressed entries only in `_brainwave_state.yaml`.

DNA documents own their block statuses. The manifest and dashboard derive implementation visibility from those documents; they are not parallel logs.

Lifecycle, terminology, and project-integration instructions live in `_brainwave_handbook.md`; the repository-root `README.md` provides the release quick start.

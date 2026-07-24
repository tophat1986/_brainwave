# _engine

Deterministic execution arm for _brainwave.

`brainwave_runner.js` owns lifecycle and generated state. `project_integration.js` is isolated because it is the only engine component allowed to write small managed bridges outside `_brainwave/`.

## Responsibilities

- Validate the fixed _brainwave lifecycle.
- Lock and verify the immutable _brainwave Seed.
- Require an explicitly agreed North Star before DNA selection.
- Discover and validate versioned, data-only modules in `_dna/`.
- Validate project-owned module selection and expressed entries.
- Scaffold only approved documents beneath `_documentation/_DNA-CODE/`.
- Track explicit document status, hashes, module progress, and completion.
- Refresh `_manifest.yaml`, `_context/`, and `_dashboard.html`.
- Become passive after `brainwave_documentation_complete`.
- Install a minimal, idempotent project-root bridge when `_brainwave/` is nested in a host repository.

The engine does not interpret the seed or North Star, call an AI model, or decide which DNA modules or entries are relevant.

## Storage

DNA modules, `_manifest.yaml`, `_settings.yaml`, and `_brainwave_state.yaml` use JSON-compatible YAML so the engine has no external runtime dependencies.

Module definitions are immutable project inputs. The engine records selected module versions and expressed entries only in `_brainwave_state.yaml`.

Commands and project-integration instructions live in the root `README.md`.

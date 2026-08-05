# _engine

Deterministic execution arm for _brainwave.

The planning and authority contract is specified in `implementation_spine_spec.md`.

`brainwave_runner.js` owns lifecycle and generated state. `implementation_spine.js` owns the implementation-plan contract, guarded transitions, compact context packets, and audit output. `project_integration.js` is isolated because it is the only engine component allowed to write small managed bridges outside `_brainwave/`.

Tool-neutral session policy lives in `runtime/`. Thin adapters in `adapters/` translate that policy into Cursor, Claude Code, and Codex hook output. Platform configuration remains at the host repository root.

## Responsibilities

- Validate the fixed _brainwave lifecycle.
- Lock and verify the immutable _brainwave Seed.
- Require an explicitly agreed North Star before DNA module selection.
- Validate the dashboard introduction and project-basics experience checkpoints for settings schema 1.3 or newer.
- Discover and validate versioned, data-only modules and their explicit ownership contracts in `_dna/`.
- Validate project-owned module selection and expressed entries.
- Scaffold only scoped DNA documents beneath `_documentation/_DNA-CODE/`.
- Track explicit document status, hashes, module progress, and completion.
- Parse DNA blocks as the stable traceability identity and accepted-direction source.
- Compile applicable blocks into an unmapped inventory and proposal template without inventing document-derived slices.
- Import an agent-authored hybrid outcome proposal, including explicit order, primary ownership, cross-cutting applicability, dependencies, gates, checks, and existing-build reconciliation when requested.
- Generate a human-readable review and bind approval to the exact reviewed proposal fingerprint.
- Maintain `_implementation.yaml` as the sole source of implementation sequence, state, and evidence; `_implementation_proposal.yaml` is only draft input.
- Validate plan approval, slice dependencies, one active slice, concise evidence, holds, acceptance checks, and checked revisions.
- Reconstruct a bounded current-slice context packet without loading the full DNA corpus.
- Derive built and checked DNA direction coverage and record fresh-context alignment review attestations.
- Refresh `_manifest.yaml` and `_dashboard.html`.
- Enter ambient delivery alignment after `brainwave_documentation_complete` without resuming active documentation reconciliation.
- Install or remove minimal, idempotent project-root bridges and session registrations without touching project-owned _brainwave artifacts.

The engine does not interpret the seed or North Star, call an AI model, or decide which DNA modules or entries are relevant.

## Storage

DNA modules, `_implementation.yaml`, `_manifest.yaml`, `_settings.yaml`, and `_brainwave_state.yaml` use JSON-compatible YAML so the engine has no external runtime dependencies.

Module definitions are immutable project inputs named by their canonical `_DNA-CODE` identity. The engine records selected module versions, expressed entries, and experience checkpoints only in `_brainwave_state.yaml`. `_settings.yaml` holds the user's working preferences, confirmed build outcome, and lightweight project profile; supplied profile assets remain separate files beneath `_assets/`.

DNA documents own documentation state, accepted direction, applicability, and supersession. `_implementation_proposal.yaml` is an agent-authored planning input; the engine imports only allowed structural fields. `_implementation.yaml` owns working order, delivery state, and concise current evidence. `_implementation_review.md` is the human approval view. The manifest and dashboard are derived views, Git owns history, and `_brainwave_state.yaml` records only the latest fresh-context review kind, time, revision, and result.

Lifecycle, terminology, and project-integration instructions live in `_brainwave_handbook.md`; the repository-root `README.md` provides the release quick start.

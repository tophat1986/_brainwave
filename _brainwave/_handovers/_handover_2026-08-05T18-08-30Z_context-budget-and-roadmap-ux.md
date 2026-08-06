# _brainwave context-budget and roadmap UX handover

Timestamp: 2026-08-05T18:08:30Z

This supersedes `_handover_2026-08-05T15-38-29Z_roadmap-review-ux.md`.

## Current state

- Repository: the `_brainwave` repository root
- Branch: `codex/implementation-spine-experiment`
- Context-budget safeguards are implemented but uncommitted.
- Approval now blocks slices above 25 primary blocks, 40 effective blocks, 10 effective documents, 10,000 formatted characters, or cross-link fan-out above 8.
- Warning thresholds are 15 primary blocks, 25 effective blocks, 6 documents, 6,000 characters, and fan-out above 3.
- Canonical tests pass: 7/7 spine and 61/61 runner.

## Next-agent instruction

Review and preserve the generic safeguards. Complete the roadmap-review experience so the dashboard and chat clearly show tracks, slices, outcomes, dependencies, gates, primary/cross/effective counts, document count, packet size, warnings, and blockers before approval. Use progressive disclosure for block mappings. Never approve from counters alone or import downstream project-specific slice names or assumptions.

Run both canonical test suites and keep the framework changes separate from downstream project state.

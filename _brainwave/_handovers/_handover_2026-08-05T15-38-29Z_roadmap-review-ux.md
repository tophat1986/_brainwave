# _brainwave roadmap-review UX handover

Timestamp: 2026-08-05T15:38:29Z

## Repository state

- Repository: the `_brainwave` repository root
- Branch: `codex/implementation-spine-experiment`
- Preserve the uncommitted slice-synthesis implementation already on this branch.

## Next-agent instruction

Improve the public `_brainwave` experience for reviewing a synthesized implementation spine before approval.

- In the dashboard, present the proposed roadmap clearly by track and slice, including order, outcomes, dependencies, external gates, and the existing-build assessment summary. Use progressive disclosure for block-level mappings.
- In agent/chat guidance, present a concise plain-English roadmap checklist before requesting approval. Never ask for approval from plan/revision/status counters alone.
- Explain exactly what approval accepts and what it does not accept.
- Preserve inventory-first compilation, semantic synthesis, human review, proposal fingerprinting, explicit approval, DNA authority, and evidence gates. Do not auto-approve.

Start with `AGENTS.md`, `_brainwave/_engine/implementation_spine_spec.md`, `_brainwave/_engine/implementation_spine.js`, `_brainwave/_engine/brainwave_runner.js`, and the dashboard/runtime guidance. Add focused tests and run both implementation-spine and runner suites.

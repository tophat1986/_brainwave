# Implementation Spine Technical Contract

## Purpose and authority

DNA documents own accepted product direction. DNA blocks are the atomic traceability identity. `_implementation.yaml` owns implementation order, delivery state, evidence, and compact handoff after the DNA foundation is accepted.

`_implementation_proposal.yaml` is an agent-authored planning input, not a second delivery authority. `_implementation_review.md` is the human approval view. The manifest and dashboard are derived.

## Planning flow

1. `implementation-compile [--existing-build]` inventories every applicable current DNA block. It creates no tracks or slices and writes a proposal template.
2. An AI planning pass reads the North Star and identifies project-specific outcome-backbone documents by meaning. Relevant sources commonly include critical journeys, outcome or capability priorities, delivery phases, acceptance criteria, architecture boundaries, and risk or external-gate direction. IDs are never hardcoded.
3. In existing-build mode, the same pass inspects current code, tests, migrations, configuration, and representative rendered journeys. Every block receives a planning assessment.
4. The agent writes only `_implementation_proposal.yaml`.
5. `implementation-synthesize <authored-by> [proposal-path]` imports allowed structural fields, supplies command-owned delivery defaults, measures every effective execution context, validates the complete proposal, and records a proposal fingerprint.
6. `implementation-review` writes the human-readable review and records its proposal fingerprint.
7. The agent presents that review. The user may request another proposal/synthesis/review pass or explicitly approve it.
8. `implementation-approve <approved-by>` succeeds only when the current proposal exactly matches the reviewed fingerprint.
9. Delivery proceeds through the guarded start, evidence, hold, acceptance, check, and close commands.

## Slice synthesis rules

- Prefer one coherent, observable user or system outcome per slice.
- Use `foundation` or `external_gate` only when separating that work is necessary, and record a justification.
- A slice may combine blocks from several DNA documents and modules.
- A DNA document may contribute blocks to several slices.
- Every applicable block has exactly one `primary_slice`, which owns delivery accountability.
- `applies_to` records cross-cutting direction governing additional slices without duplicating primary ownership or evidence state.
- `applies_to` is exact semantic applicability, not a way to attach whole foundational areas to every outcome. A work item linked to more than 3 additional slices warns; more than 8 blocks approval.
- Slice size is measured from its complete effective scope: primary blocks plus `applies_to` blocks, unique owning documents, and the actual formatted execution packet. Primary blocks warn above 15 and block approval above 25; effective blocks warn above 25 and block above 40; documents warn above 6 and block above 10; packet characters warn above 6,000 and block above 10,000.
- Hard context budgets are safety invariants and have no ordinary override. Split the slice or narrow cross-cutting applicability. Synthesis and review expose approval blockers; approval and approved runtime state enforce them.
- Every track and slice has an explicit positive integer `order`. Dependencies must exist and remain acyclic.
- Every slice has at least one acceptance check. Gates and checks remain distinct: a gate may depend on an external owner; a check proves the slice outcome.
- Document boundaries and keyword matches are not valid synthesis logic.

## Proposal shape

The proposal is JSON-compatible YAML:

```yaml
{
  "proposal_version": "0.1.0",
  "adoption_mode": "greenfield",
  "synthesis_basis": [
    { "ref": "_my_brainwave_north_star.md", "role": "Current direction" }
  ],
  "tracks": [
    { "id": "TRACK-CORE", "title": "Core outcomes", "order": 1 }
  ],
  "slices": [
    {
      "id": "SLICE-JOIN-PLAN",
      "track": "TRACK-CORE",
      "kind": "outcome",
      "title": "Join a shared plan",
      "outcome": "A guest can securely join a shared plan and contribute.",
      "order": 1,
      "priority": "high",
      "depends_on": [],
      "blocking_gates": [],
      "acceptance_checks": [
        {
          "id": "SLICE-JOIN-PLAN-AC01",
          "type": "rendered_journey",
          "description": "Complete the representative guest journey."
        }
      ]
    }
  ],
  "work_items": {
    "_DNA-CODE-00000.01": {
      "primary_slice": "SLICE-JOIN-PLAN",
      "applies_to": [],
      "existing_build_assessment": {
        "status": "not_assessed",
        "refs": [],
        "note": null
      }
    }
  }
}
```

Allowed slice kinds are `outcome`, `foundation`, and `external_gate`. Existing-build assessment states are `absent`, `partial`, `appears_implemented`, and `appears_verified`; `not_assessed` is allowed only before existing-build synthesis. Partial or apparently built assessments require inspectable refs and a concise note.

Assessment is not evidence. Proposal import ignores attempted slice delivery states, check results, timestamps, and evidence. Those fields remain command-owned in `_implementation.yaml`.

The review and audit show primary, cross-cutting, effective-document, and formatted-packet measures for each slice. If an already approved legacy plan exceeds a hard budget, both CLI and automatic session context return a compact stop instruction instead of injecting the oversized slice.

## Replanning and staleness

A changed North Star or applicable DNA scope makes the spine stale. Recompile, repeat semantic synthesis and review, and obtain approval again. Recompilation preserves inspectable delivery evidence for still-applicable block IDs but clears old slice mappings so obsolete decomposition cannot silently survive.

`plan_version` counts compiled roadmap editions. `state_revision` counts recorded command-owned mutations. Neither is a progress score.

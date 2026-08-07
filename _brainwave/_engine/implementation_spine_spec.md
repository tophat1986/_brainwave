# Implementation Spine Technical Contract

## Purpose and authority

DNA documents own accepted product direction. DNA blocks are the atomic traceability identity. `_implementation.yaml` owns implementation order, delivery state, evidence, and compact handoff after the DNA foundation is accepted.

`_implementation_proposal.yaml` is an agent-authored planning input, not a second delivery authority. `_implementation_review.md` is the human approval view. The manifest and dashboard are derived.

The dashboard presents the spine as the eighth user-facing journey step, **Deliver the implementation**. This is a derived delivery view, not another `_brainwave_state.yaml` lifecycle value. It exposes the proposed or approved tracks and slices, outcomes, dependencies, gates, acceptance checks, context measures, validation notices, and progressively disclosed DNA mappings without owning or mutating them.

## Planning flow

1. `implementation-compile [--existing-build]` inventories every applicable current DNA block. It creates no tracks or slices and writes a proposal template.
2. An AI planning pass reads the North Star and identifies project-specific outcome-backbone documents by meaning. Relevant sources commonly include critical journeys, outcome or capability priorities, delivery phases, acceptance criteria, architecture boundaries, and risk or external-gate direction. IDs are never hardcoded.
3. In existing-build mode, the same pass inspects current code, tests, migrations, configuration, and representative rendered journeys. Every block receives a planning assessment.
4. The agent writes only `_implementation_proposal.yaml`.
5. `implementation-synthesize <authored-by> [proposal-path]` imports allowed structural fields, supplies command-owned delivery defaults, measures every effective execution context, validates the complete proposal, and records a proposal fingerprint.
6. `implementation-review` writes the human-readable review and records its proposal fingerprint.
7. The agent presents that review. The user may request another proposal/synthesis/review pass or explicitly approve it.
8. `implementation-approve <approved-by>` succeeds only when the current proposal exactly matches the reviewed fingerprint.
9. Delivery proceeds through guarded start, work-item evidence, hold, assurance prepare/submit/remediate/approve, check, and close commands.

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
- Every applicable DNA block inherits one or more registered assurance profiles and any consequential `assurance_levels_min` declared by its owning DNA node. A slice gate must include the union inherited by its primary and `applies_to` blocks and must meet the strongest inherited minimum level. Synthesis may add profiles or stronger levels but cannot remove or weaken inherited assurance.
- Every slice has at least one acceptance check and at least one check per sealed profile. Profile states what risk is checked, method states how it is checked, and required evidence states what inspectable artifact must exist. Gates and checks remain distinct: a blocking gate may depend on an external owner; an assurance gate seals the quality contract; a check proves part of the slice outcome.
- Registered profiles constrain compatible levels and methods. Each level expands to a complete minimum method set: for example, `experience: component` requires render review, while `experience: surface` and `experience: journey` require both render review and end-to-end execution; journey review also requires fresh context. Technical profiles similarly distinguish logic, boundary, outcome, migration, request-path, load, and recovery risks. Synthesis may add stronger checks but cannot select only the weakest compatible method.
- Every method has a minimum evidence contract: inspection requires an inspection record, automated methods a test report or journey trace, render review a rendered surface, and specialist methods their corresponding benchmark, security, migration, reconciliation, recovery, or external-review artifact. A check cannot relabel weaker evidence as sufficient.
- `self_allowed` and `fresh_context_required` are literal provenance requirements. Fresh-context provenance is recorded, not described as an independent professional audit. Human or specialist approval is sealed only where the gate requires it.
- Document boundaries and keyword matches are not valid synthesis logic.

## Proposal shape

The proposal is JSON-compatible YAML:

```yaml
{
  "proposal_version": "0.2.0",
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
      "assurance_gate": {
        "profiles": {
          "experience": { "level": "journey", "review": "fresh_context_required" }
        },
        "approval": "human",
        "references": ["REF-HOME-01"]
      },
      "acceptance_checks": [
        {
          "id": "SLICE-JOIN-PLAN-AC01",
          "description": "Inspect the assembled journey surfaces against the accepted composition.",
          "assurance": {
            "profile": "experience",
            "method": "render_review",
            "required_evidence": ["rendered_surface"]
          }
        },
        {
          "id": "SLICE-JOIN-PLAN-AC02",
          "description": "Complete the representative guest journey.",
          "assurance": {
            "profile": "experience",
            "method": "end_to_end",
            "required_evidence": ["journey_trace"]
          }
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

The implementation spine schema is `0.3.0`. Work-item evidence keeps its existing kinds. Assurance evidence uses its own registry (`inspection_record`, `test_report`, `rendered_surface`, `journey_trace`, benchmark/security/migration/reconciliation/recovery reports, review records, and external review) and is stored on the existing acceptance-check ID. A rendered surface identifies its target, runtime state, and viewport. An experience journey trace identifies its target and supported entry point plus the expected destination, expected return behaviour, and context that must be retained; this prevents successful clicks from standing in for coherent navigation. When a gate seals accepted references, current evidence must name every compared reference ID. Current check results record status, reviewer provenance, packet hash, evidence, and checked Git revision; no pass-history array is created. Profile status is derived from those checks.

## Bounded assurance review

`implementation-assurance-prepare <slice-id>` creates one temporary, maximum 12,000-character packet for the active slice. It contains the sealed gate and check contracts, current results, concise Direction/Verification excerpts, all and only the gate's maximum three reference records, unresolved findings, target Git revision, and the result contract. For experience-facing profiles it also repeats the recorded component and browser harness decisions; preparation refuses unresolved `not_reviewed` decisions, while explicit selected, declined, and not-applicable choices remain tool-neutral and visible. It contains no source, log, trace, or image bodies. The spine stores only the active packet hash, slice, state revision, Git revision, and time.

`implementation-assurance-submit` accepts a structured result only when its packet hash, active slice, state revision, Git revision, and reviewer mode match. The result must include:

- a scope preflight of `sufficient` or `insufficient` with a concise note;
- one result for every sealed acceptance-check ID with registered current evidence;
- explicit rechecks for every live non-scope finding; and
- any new `defect` or `omission` findings without caller-assigned IDs.

An insufficient scope preflight creates or retains one blocking `scope` finding. It does not mutate the sealed gate. Correct the plan/gate through its authority path, remediate the finding, and submit a later review. The engine allocates monotonic `QF-*` IDs. Remediation moves a finding to `recheck_required`; only a later result can resolve it. Optional enhancements are not durable QA findings and do not silently become product scope.

The root `assurance` map owns only the next finding number, one active-packet binding, compact findings, and a resolved count. Results stay on acceptance checks. There is no `_quality.yaml`, pass diary, or permanent per-pass file authority.

Normal slice closure is allowed only when every primary work item is verified, every required check passed at the exact closing Git revision with its required evidence, the scope preflight is sufficient at that revision, reviewer provenance satisfies the sealed gate, no unresolved finding remains, and any required human or specialist approval is current. Blocked and deferred slice closure retains the existing explicit-hold behaviour. A normal slice cannot close merely as `implemented` with pending assurance.

The review and audit show primary, cross-cutting, effective-document, and formatted-packet measures for each slice. If an already approved legacy plan exceeds a hard budget, both CLI and automatic session context return a compact stop instruction instead of injecting the oversized slice.

## Replanning and staleness

A changed North Star or applicable DNA scope makes the spine stale. Recompile, repeat semantic synthesis and review, and obtain approval again. Recompilation preserves inspectable work-item evidence for still-applicable block IDs but does not infer new assurance passes from legacy `verified` state. It clears old slice mappings so obsolete decomposition cannot silently survive. Unresolved findings remain stable and enter `needs_reconciliation` until mapped to the replacement slice/check; they cannot disappear through replanning.

`plan_version` counts compiled roadmap editions. `state_revision` counts recorded command-owned mutations. Neither is a progress score.

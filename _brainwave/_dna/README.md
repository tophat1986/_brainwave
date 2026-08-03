# DNA Modules

This directory contains versioned, data-only catalogues of documentation _brainwave can recommend. A module describes one domain; it never selects itself, stores project decisions, or executes code.

## Identity Tree

_brainwave uses one identity from module to implementation:

```text
_DNA-SAPP                 module
_DNA-SAPP-00300           DNA document group
_DNA-SAPP-00302           document
_DNA-SAPP-00302.01        DNA block within that document
```

Every module source file is named `_DNA-CODE.yaml`, using its immutable four-letter uppercase `dna_code`. Do not introduce a second module ID.

Document-group directories use `00300_topic`. Source document paths use `00300_topic/00302_snake_case.md`; generated files become `_DNA-CODE-00302_snake_case.md`. The first three digits bind a document to its group, and the final two positions allow up to 99 documents in that group.

## Module Contract

Each module is JSON-compatible YAML with:

- `schema_version` — compatibility with the _brainwave module contract
- `dna_code` — immutable four-letter uppercase identity
- `dna_version` — semantic version of the module content
- `name` — human-readable name
- `description` — purpose and boundaries
- `documentation_label` — name for the generated output
- `module_contract` — explicit relevance, timing, ownership, exclusion, coordination, and evidence-freshness boundary
- `nodes` — DNA document groups and DNA documents available for scoping

Every `module_contract` has:

- `when_relevant` — the semantic domain gate for selecting the module
- `selection_signals` — meaningful conditions that strengthen relevance; these guide judgment and are not keywords
- `owns` — decisions and outputs for which this module is authoritative
- `does_not_own` — adjacent concerns that must remain with another domain or future module
- `coordinates_with` — installed `_DNA-CODE` modules whose decisions this module consumes, supplies, or translates
- `live_verification` — topics where current authoritative evidence must replace stale model memory when material
- `timing` — when the domain should be considered, when it may be deliberately deferred, and the conditions that make deferral unsafe

Module contracts prevent a broad module from quietly absorbing a shallow version of every discipline. The agent reads all relevant contracts, selects modules semantically, and explains material omissions before the user agrees. Coordination does not create shared ownership: one module remains authoritative and the other translates or implements its direction.

Every node has a module-local five-digit `id`, `type`, module-relative `path`, `title`, `parent_id`, and `baseline` boolean. A DNA document group explains `when_relevant`; a DNA document explains its `intent`.

`baseline: true` means the agent should normally recommend the node when its module, or its parent DNA document group, is relevant. `baseline: false` means the node should be recommended only when its specific intent is material. Baseline is proportionate scoping guidance, not engine-forced expression: explicit user-approved scope remains authoritative.

Cross-cutting concerns such as accessibility, internationalisation, privacy, mobile use, product copy, AI behaviour, and distribution may affect several modules. Do not duplicate the decision in each domain. Keep intent with the owning module, translate it into domain-specific consequences in coordinating modules, and verify the complete thread during review.

## Minimum DNA Block Contract

A DNA block is one coherent direction, obligation, or verifiable rule inside a document. Blocks are the smallest traceable units; there is no separate implementation-ID system or implementation log.

An active block uses:

```markdown
### _DNA-CODE-00302.01 - Clear block title

Status: not_started
Supersedes: none

#### Context
#### Direction
#### Rationale
#### Alternatives Considered
#### Consequences
#### Future Fit
#### Verification
```

The headings prompt deliberate thinking without prescribing domain-specific answers. Write `Not applicable — <reason>` where a consideration genuinely does not apply; do not add filler.

Implementation status is one of:

- `not_started`
- `in_progress`
- `implemented`
- `verified`
- `blocked`
- `not_applicable`
- `superseded`

`verified` means the direction has been implemented and checked. `implemented` means the change exists but its verification is not complete.

When direction materially changes, add the next block, set its `Supersedes` field to the previous block, and turn the old block into a compact tombstone:

```markdown
### _DNA-CODE-00302.01 - Former direction

Status: superseded
Superseded by: _DNA-CODE-00302.02
Former direction: One concise sentence preserving what changed.
```

Git preserves the full history; the current document preserves only enough lineage for an agent to understand why the inactive block remains.

## Boundary

Module definitions remain unchanged during a _brainwave. Selected module versions and scoped DNA document IDs belong in `_brainwave_state.yaml`; generated files belong beneath `_documentation/_DNA-CODE/`.

Modules must not contain scripts, prompt overrides, lifecycle rules, `expressed` flags, absolute paths, or paths escaping their output directory.

When an installed `dna_version` changes, the engine pauses until the user explicitly reviews and reselects the module. Reselection accepts the new version and clears its previous expression so scope can be reviewed safely.

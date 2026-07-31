# _brainwave Handbook

_brainwave turns an original idea into an agreed North Star and a proportionate set of domain documentation before downstream work begins. It is active while the idea and documentation are shaped, then becomes passive once that foundation is accepted.

## Lifecycle

`_brainwave_state.yaml` owns one authoritative stage:

1. `awaiting_seed` — **Capture the idea:** discuss and preserve the immutable _brainwave Seed.
2. `shaping_north_star` — **Agree the direction:** develop and explicitly agree the living North Star.
3. `selecting_dna` — **Choose DNA modules:** recommend relevant domains and record the agreed modules.
4. `scoping_brainwave_documentation` — **Scope DNA documents:** agree the proportionate documents needed from those modules.
5. `building_brainwave_documentation` — **Build DNA documentation:** complete the scoped documents and their traceable DNA blocks.
6. `reviewing_brainwave_documentation` — **Review the foundation:** check gaps, conflicts, cross-module consistency, and downstream readiness.
7. `brainwave_documentation_complete` — **Ready for implementation:** remain passive unless the user explicitly reopens _brainwave.

A completed _brainwave returns to `shaping_north_star` when direction changes, `selecting_dna` when the relevant domains change, or `scoping_brainwave_documentation` when only DNA document scope changes.

## Guidance Modes

During onboarding, _brainwave asks whether to use:

- `guided` — concise stage signposting, a seven-step journey at orientation and approval points, plain-language explanations of unfamiliar terms, and early links to this handbook and `_dashboard.html`
- `concise` — the current step and immediate next action, with more explanation only when needed or requested

Guidance mode controls explanation of the process. The separate detail setting controls the depth of working output and documentation. Guided mode does not make every response longer, and the journey is not repeated during routine shaping questions.

The user-facing journey is:

1. Capture the idea.
2. Agree the direction.
3. Choose DNA modules.
4. Scope DNA documents.
5. Build DNA documentation.
6. Review the foundation.
7. Ready for implementation.

## Providing the Seed

The user can choose either route:

- **Discuss the concept:** develop it with the agent, then explicitly approve what is captured.
- **Use a prepared concept:** paste it into chat for verbatim capture, or save it directly in `_my_brainwave_seed.md`.

For the direct-file route, save the concept and tell the agent: `build concept using the seed file exactly as written`. Saving the file does not lock it. The engine locks its hash only after confirmation and transition to `shaping_north_star`.

## Core Terms

- **_brainwave Seed:** The user's explicitly approved concept, preserved in its supplied wording and natural shape. It becomes immutable after capture and is never a working-notes document.
- **North Star:** The living current direction derived from the seed. It may evolve without altering the original seed.
- **DNA Library:** The installed collection of DNA modules available to the project.
- **DNA module:** A versioned, data-only catalogue of possible documentation for one domain.
- **DNA document group:** A coherent folder of related DNA documents.
- **DNA document:** One expressed document such as system context, schema strategy, or voice and tone.
- **Baseline:** A DNA module or DNA document the agent should normally recommend when its module or parent DNA document group is relevant. It guides proportionate scoping but never overrides explicit user agreement.
- **DNA block:** One coherent direction, obligation, or verifiable rule inside a document. It is also the smallest implementation-traceability unit.
- **Expressed:** Agreed as relevant and recorded in the current _brainwave scope.
- **DNA documentation:** The full generated set across all selected DNA modules.
- **Architecture Decision Record (ADR):** One consequential architecture decision with context, alternatives, direction, and consequences. An ADR may be a DNA document, but system context, data models, user journeys, operational strategies, and brand guidance are not automatically ADRs.
- **Steering decision:** A recorded reason for changing North Star direction, DNA module selection, or DNA document scope.
- **Handover:** Temporary continuation state between working sessions. It is operational context, not a DNA module, DNA block, or architecture decision.

The canonical identity tree is:

```text
_DNA-SAPP                 module
_DNA-SAPP-00300           DNA document group
_DNA-SAPP-00302           document
_DNA-SAPP-00302.01        block
```

The minimum DNA block contract, implementation statuses, and supersession rules live in `_dna/README.md`.

## Project Placement

The supported layout is one repository and AI workspace:

```text
project-root/
|-- AGENTS.md
|-- CLAUDE.md
|-- .cursor/hooks.json
|-- .claude/settings.json
|-- .codex/hooks.json
|-- _brainwave/
`-- app/
```

The implementation may use another folder name. Keep it in the same repository as `_brainwave` so direction, documentation, implementation, and Git history travel together.

For a new project, use GitHub's **Use this template** action on the complete release repository. A normal clone retains the upstream _brainwave remote and must be repointed before product work. The root README and package metadata begin as framework onboarding and tooling; the project may replace them while retaining a signpost to this handbook.

For an existing project, confirm Node.js 20 or newer is installed, copy only the release `_brainwave/` directory into `project-root/_brainwave/`, then run:

```text
node _brainwave/_engine/brainwave_runner.js integrate
```

Integration preserves existing instructions and hook registrations. It adds or refreshes only managed _brainwave bridges and is safe to run repeatedly.

`unintegrate` removes those managed root bridges and registrations without deleting `_brainwave/` or any project artifacts:

```text
node _brainwave/_engine/brainwave_runner.js unintegrate
```

## Agent Support

Static discovery is the dependable baseline:

| Agent | Static project guidance | Session hook |
|---|---|---|
| Cursor | `AGENTS.md` | `.cursor/hooks.json` |
| Claude Code | `CLAUDE.md` | `.claude/settings.json` |
| Codex | `AGENTS.md` | `.codex/hooks.json` |

All three session hooks call thin platform adapters backed by the same tool-neutral runtime. The runtime reads lifecycle state and supplies relevant context; it never interprets the concept, infers profile values from keywords, or chooses DNA.

Command hooks execute local code. Cursor, Claude Code, and Codex may ask the user to review or trust project hooks before running them. `integrate` registers all three bundled hooks for portability, but registrations are inert in tools that do not read them and may be left untrusted or disabled in supported tools. There is currently no separate static-only integration mode. Hooks are enhancements rather than the source of truth: disabling them does not remove the governing instructions or deterministic engine safeguards.

In another IDE or agent environment, begin by telling the agent to read the root `AGENTS.md`, then `_brainwave/AGENTS.md` and this handbook. If the environment uses another native instruction filename, make that file a small bridge to `_brainwave/AGENTS.md`; do not duplicate the directive. _brainwave cannot make an unknown host discover repository instructions automatically, but its workflow and engine do not depend on hooks.

## The Dashboard

`_dashboard.html` is the window into _brainwave. Open it directly from disk; no local server is required.

It shows:

- a seven-stage vertical journey, with completed stages collapsed and the current stage in focus
- in-dashboard previews of the seed, North Star, decisions, handbook, and expressed documents
- the installed DNA Library, including each module's full DNA document catalogue before a concept is selected
- document and DNA-block progress using canonical IDs and expandable block-level detail
- a quiet project-state view for technical provenance without placing it in the main journey

The interface is intentionally presentation-led: icons, state, sequence, and visual placeholders do most of the explanatory work. Source links remain available inside previews for users who want to work directly with the files.

The dashboard is derived, not authoritative. `_dna/` owns module definitions, `_brainwave_state.yaml` owns selection, the decisions log owns material rationale, and DNA documents own block status. `_manifest.yaml` supplies the embedded dashboard snapshot.

Refresh it from the project root:

```text
node _brainwave/_engine/brainwave_runner.js refresh
```

## Bundled DNA

- **`_DNA-SAPP` — Software Application DNA** produces software architecture documentation for applications and digital services.
- **`_DNA-BRND` — Brand Identity DNA** produces enduring verbal and visual identity guidance without expanding into campaigns, acquisition, or go-to-market planning.

The agent may recommend either or both. Counts and document names are read directly from the module files and dashboard, so this handbook does not duplicate their catalogues.

## Working Agreement

- Preserve the user's wording and natural structure when capturing the seed. Do not expand it to fill a template or infer missing content; obtain approval before any material paraphrase or restructuring.
- Preserve `_my_brainwave_seed.md` exactly after capture.
- Read `_my_brainwave_north_star.md` first for current direction.
- Ask one to three focused questions at a time while shaping direction.
- Do not require exhaustive answers; resolve or explicitly mark only materially important gaps.
- Let the AI agent recommend DNA modules and DNA documents using semantic judgment. The engine validates and scaffolds; it does not interpret the idea.
- Use each DNA document group's `when_relevant` as the domain gate, its baseline documents as the normal starting point, and each file's `intent` to decide which optional documents are material.
- Obtain explicit user agreement before recording DNA module selection or DNA document scope.
- Keep DNA definitions unchanged during a project. Project selection belongs in `_brainwave_state.yaml`.
- Record a decision in its owning DNA block or ADR, not in the seed or a duplicate ledger.
- After DNA documentation is complete, update only the statuses of blocks affected by downstream work. Do not reopen the lifecycle unless direction, DNA module selection, or DNA document scope changes.
- Create a local README only for non-obvious purpose, boundaries, invariants, relationships, working rules, or known traps—not to list visible files.

## Framework and Project Ownership

Framework-owned files may be replaced by a future _brainwave update:

- `_engine/`
- `_dna/`
- `_templates/`
- `_brainwave_handbook.md`
- `_brainwave/AGENTS.md`

Project-owned files must never be overwritten by an update:

- `_my_brainwave_seed.md`
- `_my_brainwave_north_star.md`
- `_brainwave_state.yaml`
- `_settings.yaml`
- `_decisions_log.md`
- `_documentation/`

`_manifest.yaml` and the state embedded in `_dashboard.html` are derived and may be regenerated. Root bridges and hook configurations are merged rather than replaced.

Until an automated updater exists, update framework-owned files only and run `integrate` followed by `refresh`. Never copy a new release wholesale over an active project. `unintegrate` removes root connections only; project-owned artifacts must be backed up and removed deliberately.

## When _brainwave Is Complete

`brainwave_documentation_complete` means the initial DNA documentation foundation has been accepted. It does not mean the resulting product or brand has been implemented.

At this stage, _brainwave stops announcing or initiating its workflow during ordinary development. The relevant DNA blocks remain lightweight traceability anchors: downstream agents update a block from `not_started` through `implemented` and `verified`, or mark it `blocked`, `not_applicable`, or `superseded` when appropriate.

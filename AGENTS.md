# _brainwave Governing Directive

_brainwave turns an immutable concept seed into an agreed North Star and a proportionate set of documentation chosen from relevant DNA modules. Operate as one coordinated product, domain, architecture, engineering, brand, and operations expert, using only the expertise relevant to the selected modules.

Do not over-generate. Do not guess. Use natural-language discussion to resolve material gaps while allowing non-blocking unknowns to remain explicit.

All artifact paths in this directive are relative to the `_brainwave/` directory containing this file.

## Lifecycle Authority

Read `_brainwave_state.yaml` first. Its `stage` must be one of:

1. `awaiting_seed`
2. `shaping_north_star`
3. `selecting_dna`
4. `scoping_brainwave_documentation`
5. `building_brainwave_documentation`
6. `reviewing_brainwave_documentation`
7. `brainwave_documentation_complete`

If the stage is `brainwave_documentation_complete`, _brainwave is passive. Do not announce, initiate, or enforce the _brainwave workflow during normal downstream work. Respond only when the user explicitly invokes or reopens _brainwave.

## Core Artifacts

- `_my_brainwave_seed.md` is immutable after capture. Never refine it, append working notes, or place decisions in it.
- `_my_brainwave_north_star.md` is the living current direction. Read it before the seed in routine work.
- `_dna/` contains versioned, immutable DNA-module definitions. It does not contain project selection state.
- `_brainwave_state.yaml` owns lifecycle, selected DNA-module versions, and expressed entries.
- `_documentation/_DNA-CODE/` contains generated _brainwave documentation, separated by its registered four-letter module code.
- `_decisions_log.md` records only steering rationale that changes North Star direction, DNA selection, or documentation scope.
- `_manifest.yaml`, `_context/`, and `_dashboard.html` are derived state and summaries.
- `_brainwave_handbook.md` is the concise user guide and terminology authority.

## Decision Logging

Before materially changing an agreed North Star, recording DNA selection or expression, or creating or removing generated documentation, append the approved rationale to `_decisions_log.md` using its local template. Do not log routine answers, implementation progress, file inventories, or handover state.

## Trigger: `build concept`

When the user says `build concept`:

1. Read `_brainwave_state.yaml` and `_settings.yaml`.
2. If the stage is `awaiting_seed`, discuss the idea and capture `_my_brainwave_seed.md` only after explicit user instruction. Transition to `shaping_north_star`; this locks the seed hash.
3. If profile settings are incomplete, ask:
   - Technical proficiency: `beginner`, `intermediate`, or `architect`
   - Working mode: `thought_partner` or `fast_execution`
   - Detail level: `lean`, `standard`, or `exhaustive`
4. Write profile answers to `_settings.yaml` automatically and set:
   - `configured: true`
   - `onboarding_status: complete`
   - `profile_last_updated: <ISO timestamp>`
5. During `shaping_north_star`, ask one to three targeted questions at a time. Establish:
   - why the idea should exist
   - who it is for
   - what it should enable
   - guiding principles
   - boundaries and non-goals
   - what success means
   - which material questions remain
6. Keep `_my_brainwave_north_star.md` at `Status: shaping` until the user explicitly agrees it.
7. After agreement, set `Status: agreed` and transition to `selecting_dna`.
8. Recommend one or more DNA modules using semantic judgment, the conversation's meaning, and each module's declared purpose. Do not use keyword matching. Explain the recommendation and obtain explicit user agreement.
9. Record the approved selection with `select-dna`, log its rationale, and transition to `scoping_brainwave_documentation`.
10. Propose only relevant entries within the selected modules using semantic judgment and `when_relevant` guidance.
11. Log the approved scope and rationale, express entries using canonical references such as `_DNA-SAPP-00201`, and transition to `building_brainwave_documentation`.
12. Run the engine to scaffold only the already-expressed entries.

## _brainwave Documentation

Use **_brainwave documentation** for the full generated set across selected DNA modules. Use each module's own label for its output:

- Software Application DNA produces **software architecture documentation**.
- Brand Identity DNA produces **brand identity documentation**.

An Architecture Decision Record (ADR) is one type of software architecture document; system context, data models, user journeys, operational strategies, and brand identity guidance are not automatically ADRs.

During `building_brainwave_documentation`:

- Work in coherent, dependency-aware slices, including dependencies between modules.
- Use the North Star as current direction.
- Reconcile each newly agreed decision against the North Star before completing affected documentation. If the North Star remains accurate, keep the decision in its owning document. If the decision exposes ambiguity without changing direction, clarify the living North Star minimally. If it changes direction materially, log the rationale and return to `shaping_north_star`.
- Mark completion explicitly with `Status: complete`; word count never determines completion.
- Record decisions in their owning document or ADR, not in the immutable seed.
- Avoid duplicating North Star direction or decisions owned by another module.
- Treat a change as editorial only when no reasonable downstream behaviour could differ. Otherwise present it for explicit user agreement.

Transition to `reviewing_brainwave_documentation` only when every expressed document is explicitly complete. Review every expressed document for gaps, contradictions, cross-module conflicts, unresolved material questions, and downstream readiness. In particular:

- compare later decisions with every relevant North Star statement
- trace material invariants through their owning data, security, experience, implementation, and verification documents
- ensure user-facing behaviour and messages do not weaken privacy, permission, or threat-model requirements
- ensure documents consuming another DNA module translate all relevant source decisions without redefining them
- identify any behaviour introduced without explicit user agreement

Transition to `brainwave_documentation_complete` only after explicit user acceptance.

## DNA and Engine Boundaries

- The AI agent interprets meaning, asks questions, recommends modules and entries, and records selection only after user agreement.
- The engine validates lifecycle, seed integrity, DNA schema and versions, naming, selection state, and filesystem state.
- The engine never interprets the seed or North Star and never selects modules or entries.
- DNA modules are data-only JSON-compatible YAML. Never execute code referenced by a module.
- Only selected modules and expressed entries may be scaffolded.
- Module definitions remain unchanged during a _brainwave; project selection belongs in `_brainwave_state.yaml`.
- Module outputs are namespaced beneath `_documentation/_DNA-CODE/`.
- Document-group directory style: `00100_topic`
- DNA document style: `_DNA-CODE-00101_snake_case.md`
- A document's first three numeric digits identify its document group.

If direction changes after completion:

- Return to `shaping_north_star` when the North Star changes materially.
- Return to `selecting_dna` when the relevant domains change.
- Return to `scoping_brainwave_documentation` when the North Star and module selection remain valid but documentation scope changes.

## Local README Rule

Do not create README files that merely list visible contents. A local README is justified only when it contains non-obvious purpose, boundaries, invariants, relationships, working rules, or known traps.

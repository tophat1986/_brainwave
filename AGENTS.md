# Brainwave Governing Directive

Brainwave turns an immutable concept seed into an agreed North Star and a proportionate set of architecture documentation. Operate as one coordinated product, architecture, engineering, and operations expert.

Do not over-generate. Do not guess. Use natural-language discussion to resolve material gaps while allowing non-blocking unknowns to remain explicit.

## Lifecycle Authority

Read `_brainwave_state.yaml` first. Its `stage` must be one of:

1. `awaiting_seed`
2. `shaping_north_star`
3. `scoping_architecture_documentation`
4. `building_architecture_documentation`
5. `reviewing_architecture_documentation`
6. `architecture_documentation_complete`

If the stage is `architecture_documentation_complete`, Brainwave is passive. Do not announce, initiate, or enforce the Brainwave workflow during normal development. Respond only when the user explicitly invokes or reopens Brainwave.

## Core Artifacts

- `_my_brainwave_seed.md` is immutable after capture. Never refine it, append working notes, or place decisions in it.
- `_my_brainwave_north_star.md` is the living current direction. Read it before the seed in routine work.
- `_dna.yaml` is the catalogue of possible architecture documentation.
- `_decisions_log.md` records only steering rationale that changes North Star direction or architecture-documentation scope.
- `_manifest.yaml`, `_context/`, and `_dashboard.html` are derived state and summaries.
- `_brainwave_handbook.md` is the concise user guide and terminology authority.

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
7. After agreement, set `Status: agreed` and transition to `scoping_architecture_documentation`.
8. Propose only relevant DNA nodes using semantic judgment and each directory's `when_relevant` guidance. Do not use keyword matching.
9. Log the approved scope and rationale in `_decisions_log.md`, express the selected nodes, and transition to `building_architecture_documentation`.
10. Run the engine to scaffold only the already-expressed nodes.

## Architecture Documentation

Use the term **architecture documentation** for the full generated set. An Architecture Decision Record (ADR) is one type within that set; system context, data models, user journeys, and operational strategies are not automatically ADRs.

During `building_architecture_documentation`:

- Work in coherent, dependency-aware slices.
- Use the North Star as current direction.
- Mark completion explicitly with `Status: complete`; word count never determines completion.
- Record architectural decisions in the relevant document or ADR, not in the immutable seed.

Transition to `reviewing_architecture_documentation` only when every expressed document is explicitly complete. Review for gaps, contradictions, unresolved material questions, and implementation readiness. Transition to `architecture_documentation_complete` only after explicit user acceptance.

## DNA and Engine Boundaries

- The AI agent interprets meaning, asks questions, proposes scope, and edits DNA after agreement.
- The engine validates lifecycle, seed integrity, naming, and filesystem state.
- The engine never interprets the seed or North Star and never selects DNA nodes.
- Only expressed DNA nodes may be scaffolded.
- Parent directory style: `00100_topic`
- Child file style: `00101_snake_case.md`
- The first four digits of a child ID must match its parent segment prefix.

If direction changes after completion:

- Return to `shaping_north_star` when the North Star changes materially.
- Return to `scoping_architecture_documentation` when the North Star remains valid but documentation scope changes.

## Local README Rule

Do not create README files that merely list visible contents. A local README is justified only when it contains non-obvious purpose, boundaries, invariants, relationships, working rules, or known traps.

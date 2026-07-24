# _brainwave Handbook

_brainwave turns an original idea into a coherent, proportionate set of domain documentation before downstream work begins. It is active while the idea and documentation are being shaped, then becomes passive once that work is accepted.

## Lifecycle

_brainwave uses one authoritative stage from `_brainwave_state.yaml`:

1. `awaiting_seed` — capture the immutable _brainwave Seed.
2. `shaping_north_star` — use natural-language discussion to develop and agree the living North Star.
3. `selecting_dna` — recommend the relevant domain DNA modules from meaning and context, then record the user's selection.
4. `scoping_brainwave_documentation` — agree the proportionate entries needed from the selected modules.
5. `building_brainwave_documentation` — create and complete the agreed documentation.
6. `reviewing_brainwave_documentation` — check it for gaps, conflicts, cross-module consistency, and downstream readiness.
7. `brainwave_documentation_complete` — remain passive unless the user explicitly reopens _brainwave.

A completed _brainwave returns to `shaping_north_star` when direction changes, `selecting_dna` when the relevant domains change, or `scoping_brainwave_documentation` when only the documentation scope needs to change.

## Project Placement

The supported project layout is one complete `_brainwave/` folder directly beneath the project root. After copying it, run `node _brainwave/_engine/brainwave_runner.js integrate` once from the project root.

Integration preserves existing project instructions and Cursor hooks. It adds small managed bridges so Codex and other AGENTS-aware tools, Claude, and Cursor can find the nested foundation during repository-wide work. Running it again updates the managed bridge without duplicating it.

## The Dashboard

`_dashboard.html` is the window into _brainwave. Open it directly from disk; it does not require a local server.

The dashboard shows:

- the current lifecycle stage
- immutable-seed integrity and North Star status
- every installed DNA module and its current version
- the live number of document groups and documents in each module
- which modules and entries are selected for this _brainwave
- completion within each selected module and area
- recent lifecycle and reconciliation events

The dashboard is a derived view, not another source of truth. `_dna/` owns module definitions, `_brainwave_state.yaml` owns project selection, and `_manifest.yaml` supplies the snapshot embedded into the dashboard. Run `node _engine/brainwave_runner.js refresh` and reload the page when a fresh view is needed.

## Bundled DNA

- **Software Application DNA** translates the North Star into software architecture documentation for applications and digital services.
- **Brand Identity DNA** translates the North Star into enduring verbal and visual identity guidance. It does not own product strategy, interface behaviour, campaigns, acquisition, or go-to-market planning.

The agent may recommend either or both. When both are selected, brand primitives inform the software design system; software documentation owns their implementation in product interfaces. The dashboard and `dna` command calculate current document counts directly from the modules so this handbook does not duplicate a catalogue that could drift.

## Core Terms

- **_brainwave Seed:** The immutable verbatim concept. It preserves where the idea began and is never a working-notes document.
- **North Star:** The living statement of current direction derived from the seed. Future agents use it as the primary directional authority.
- **DNA module:** A versioned, data-only catalogue of possible documentation for one domain.
- **Selected DNA:** The module or modules agreed as relevant to the current _brainwave.
- **_brainwave documentation:** The umbrella term for all documentation generated from selected modules.
- **Expressed:** A DNA entry agreed as relevant and recorded in the current _brainwave's scope.
- **Software architecture documentation:** The output of Software Application DNA.
- **Architecture Decision Record (ADR):** One consequential architecture decision with context, alternatives, direction, and consequences. Not every software architecture document is an ADR.
- **Brand identity documentation:** The output of Brand Identity DNA.
- **Steering decision:** A recorded reason for changing the North Star, DNA selection, or documentation scope.
- **Handover:** Temporary continuation state between working sessions. It is operational context, not a DNA module or architecture decision.

## Working Agreement

- Preserve `_my_brainwave_seed.md` exactly after capture.
- Read `_my_brainwave_north_star.md` first for current direction.
- Ask one to three focused questions at a time while shaping the North Star.
- Do not require exhaustive answers. Resolve or explicitly mark only gaps that could materially change direction, DNA selection, or documentation scope.
- Let the AI agent recommend modules and entries using meaning and context. The engine validates and scaffolds; it does not interpret the idea.
- Obtain explicit user agreement before recording DNA selection or expression.
- Keep module definitions immutable during a project. Project state belongs in `_brainwave_state.yaml`.
- Do not call a folder README an index. Create one only for non-obvious local purpose, boundaries, invariants, relationships, working rules, or known traps.

## Custom DNA

A future or project-specific DNA module can be added as a JSON-compatible YAML file in `_dna/`. It must declare its internal ID, immutable four-letter code, schema version, DNA version, name, documentation label, and valid node catalogue. Local numeric IDs may repeat across modules because canonical identities such as `_DNA-SAPP-00201` include the registered module code.

DNA modules are declarative data. They cannot run scripts or override the _brainwave lifecycle.

## When _brainwave Is Complete

`brainwave_documentation_complete` means the selected initial documentation has been accepted. It does not mean the resulting application, brand, or other outcome has been implemented.

At this stage, hooks and agents must not announce or initiate _brainwave during normal downstream work. _brainwave responds only when explicitly invoked or reopened by the user.

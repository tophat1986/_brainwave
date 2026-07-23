# Brainwave Handbook

Brainwave turns an original idea into a coherent set of architecture documentation before implementation begins. It is active while the idea and documentation are being shaped, then becomes passive once that work is accepted.

## Lifecycle

Brainwave uses one authoritative stage from `_brainwave_state.yaml`:

1. `awaiting_seed` — help the user capture the immutable Brainwave Seed.
2. `shaping_north_star` — use natural-language discussion to develop the living North Star.
3. `scoping_architecture_documentation` — select the relevant DNA nodes and agree which architecture documentation is needed.
4. `building_architecture_documentation` — create and complete the agreed documentation.
5. `reviewing_architecture_documentation` — check the documentation for gaps, conflicts, and readiness.
6. `architecture_documentation_complete` — remain passive unless the user explicitly reopens Brainwave.

A completed Brainwave returns to `shaping_north_star` when product direction changes, or to `scoping_architecture_documentation` when the North Star remains valid but the documentation scope needs to expand.

## The Dashboard

`_dashboard.html` is the window into Brainwave. Open it directly from disk; it does not require a local server.

The dashboard shows:

- the current lifecycle stage
- immutable-seed integrity
- North Star status
- every architecture-documentation area derived from `_dna.yaml`
- how many documents are available, expressed, and complete within each area
- recent lifecycle and reconciliation events

The dashboard is a derived view, not another source of truth. `_dna.yaml` remains authoritative for the documentation catalogue, while `_manifest.yaml` supplies the current state embedded into the dashboard. Run `node _engine/brainwave_runner.js refresh` and reload the page when a fresh snapshot is needed.

## Core Terms

- **Brainwave Seed:** The immutable original concept. It preserves where the idea began and is not a working-notes document.
- **North Star:** The living statement of current direction derived from the seed. Future agents use it as the primary directional authority.
- **Architecture documentation:** The complete set of selected design, decision, system, product, data, security, delivery, and operational documents.
- **Architecture Decision Record (ADR):** A record of one consequential architecture decision, including its context, alternatives, chosen direction, and consequences. Not every architecture document is an ADR.
- **DNA:** The catalogue of architecture documents Brainwave can express.
- **Expressed:** Selected as relevant to the current Brainwave.
- **Steering decision:** A recorded reason for changing the North Star direction or the architecture-documentation scope.
- **Handover:** Temporary continuation state between working sessions. It is operational context, not an architecture decision.

## Working Agreement

- Preserve `_my_brainwave_seed.md` exactly after capture.
- Read `_my_brainwave_north_star.md` first for current direction.
- Ask one to three focused questions at a time while shaping the North Star.
- Do not require exhaustive answers. Resolve or explicitly mark only gaps that could materially change direction or documentation scope.
- Let the AI agent propose DNA expression using meaning and context. The engine validates and scaffolds; it does not interpret the idea.
- Do not call a folder README an index. Create one only when it contains non-obvious local purpose, boundaries, invariants, relationships, or working rules.

## When Brainwave Is Complete

`architecture_documentation_complete` means the initial architecture documentation has been accepted. It does not mean the product has been implemented.

At this stage, hooks and agents must not announce or initiate Brainwave during normal development. Brainwave responds only when explicitly invoked or reopened by the user.

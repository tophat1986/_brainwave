# _brainwave Handbook

_brainwave turns an original idea into an agreed North Star and a proportionate set of domain documentation before downstream work begins. It is active while the idea and documentation are shaped, then becomes passive once that foundation is accepted.

## Lifecycle

`_brainwave_state.yaml` owns one authoritative stage:

1. `awaiting_seed` — **Capture the idea:** discuss and preserve the immutable _brainwave Seed.
2. `shaping_north_star` — **Agree the direction:** develop the living North Star, confirm how far the current idea should be taken, and explicitly agree the result.
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

Everyone receives one short, friendly dashboard introduction near the start. Guided mode adds the fuller journey; concise mode keeps the introduction to a sentence.

Guidance mode controls explanation of the process. The separate detail setting controls the depth of working output and documentation. Guided mode does not make every response longer, and the journey is not repeated during routine shaping questions.

The user-facing journey is:

1. Capture the idea.
2. Agree the direction.
3. Choose DNA modules.
4. Scope DNA documents.
5. Build DNA documentation.
6. Review the foundation.
7. Ready for implementation.

## Working Modes

Working mode changes how _brainwave shapes direction, not its quality or approval gates:

- `thought_partner` — interprets, challenges, recommends, and runs one bounded opportunity scan before North Star agreement. It surfaces only strong, testable hypotheses and never adds them to the direction without approval.
- `fast_execution` — proposes the strongest supported direction directly, uses reversible working assumptions, and limits questions or alternatives to material decisions.

Guidance mode controls process explanation. Working mode controls decision collaboration. Detail level controls depth.

## Providing the Seed

The user can choose either route:

- **Discuss the concept:** develop it with the agent, then explicitly approve what is captured.
- **Use a prepared concept:** paste it into chat for verbatim capture, or save it directly in `_my_brainwave_seed.md`.

For the direct-file route, save the concept and tell the agent: `build concept using the seed file exactly as written`. Saving the file does not lock it. The engine locks its hash only after confirmation and transition to `shaping_north_star`.

## Project Basics

After reading the Seed, _brainwave asks once whether the user already has any project basics to carry forward: a name, short description or tagline, logo, colours, or a general style direction. The question is optional and bundled; `not yet` is a complete answer.

Supplied details are saved in `_settings.yaml` as either working or confirmed. Actual files such as a logo are stored beneath `_assets/project_profile/` and referenced from the project profile. These inputs appear in the dashboard and are reused during later direction and Brand Identity DNA work so the agent does not reinvent what already exists.

Colours may each have a name, value, role, intended use, and an optional featured marker for the dashboard. Roles are flexible and repeatable, so a project can have several primary or secondary colours rather than being forced into one slot of each type. Unclassified colours are also allowed.

Project basics are living information. They may evolve as the idea becomes clearer; only the approved Seed is immutable.

## Agreeing What Will Be Built

During North Star shaping, _brainwave asks **How far would you like us to take this idea?** after the concept is understood well enough for the choice to be meaningful:

- **Show me the idea** — create something people can see and try; sample data and simulated behaviour are acceptable, and it is not intended for real use.
- **Build a usable first version** — the agreed essential capabilities work properly for real users, and anything saved for later is identified and agreed upfront.
- **Build the complete product** — everything agreed as part of the current product direction works properly for its intended users, with nothing inside that boundary left as a mock-up, placeholder, or unfinished future task.
- A user-defined outcome when none of these expresses the intended result.

There is no default. The agent explains the selected outcome in the context of the concept and obtains confirmation before recording it in `_settings.yaml`. The North Star summarises the agreed meaning under **What We Are Building**. Detailed included, postponed, and excluded capabilities and their completion conditions belong in the relevant DNA documentation rather than turning the North Star into a feature catalogue.

The chosen outcome changes the breadth of what is built, not the care applied inside that boundary. A demonstration may deliberately use simulated behaviour; a usable or complete product requires real behaviour within its agreed scope. If a prototype may later become the product, _brainwave considers that trajectory before accepting a shortcut that would make the next step unnecessarily expensive.

## Progressive Discovery

_brainwave does not present a long setup questionnaire. It interprets what the user has already supplied, asks one to three high-leverage questions at a time, and uses each answer to decide which branch is relevant next.

Early questions concentrate on decisions that reshape many later choices: intended outcome and trajectory, users and use context, platforms and reach, countries and languages, identity and experience expectations, data and interaction risk, and AI behaviour. The agent also routes four venture-and-launch lenses without reciting them as a form: who funds the product and what could make it uneconomic; how people will discover and adopt it; whether users, data, claims, money, markets, sectors, or distribution create legal or policy consequences; and whether human or partner service, support, scheduling, fulfilment, or escalation delivers part of the value. Deeper details stay with their owning DNA documents.

At natural checkpoints the agent briefly reflects what is understood, what material area comes next, and what has safely been deferred. Before agreeing the North Star or recommending DNA, it checks that every material concern is understood as relevant, deliberately deferred, not applicable, or still unknown. Module timing distinguishes concerns that should shape the foundation now from those that can wait. Risk overrides phase: an early prototype does not justify overlooking real personal data, vulnerable users, regulated activity, payments, public claims, platform distribution, contracts, or human-dependent service. A material deferral records why it is safe and what event must reopen it. Only unknowns requiring the user's attention are surfaced.

Some concepts require **specialist coverage** that the installed DNA does not provide. If trust and safety, marketplace or network integrity, AI product assurance, or regulated-sector practice needs a specialist owner that is not installed, the agent says so. It does not hide the gap inside a neighbouring module or call the foundation comprehensive; the user agrees either to add the specialist domain or to accept the explicit limitation and re-entry trigger.

## Core Terms

- **_brainwave Seed:** The user's explicitly approved concept, preserved in its supplied wording and natural shape. It becomes immutable after capture and is never a working-notes document.
- **North Star:** The living current direction derived from the seed. It may evolve without altering the original seed.
- **DNA Library:** The installed collection of DNA modules available to the project.
- **DNA module:** A versioned, data-only catalogue of possible documentation for one domain.
- **Module contract:** A module's explicit relevance, timing, ownership, exclusions, coordination relationships, and current-evidence needs. It keeps domain boundaries clear as the library grows.
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

The DNA document-maturity contract, block direction statuses, implementation-spine states, and supersession rules live in `_dna/README.md`.

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

All three session hooks call thin platform adapters backed by the same tool-neutral runtime. The runtime reads lifecycle state and supplies relevant context; it never interprets the concept, infers profile values from keywords, or chooses DNA. After the foundation is accepted, the runtime supplies compact ambient delivery-alignment guidance at session start, resume, and supported context-compaction events without restarting or announcing the seven-stage workflow.

Command hooks execute local code. Cursor, Claude Code, and Codex may ask the user to review or trust project hooks before running them. `integrate` registers all three bundled hooks for portability, but registrations are inert in tools that do not read them and may be left untrusted or disabled in supported tools. There is currently no separate static-only integration mode. Hooks are enhancements rather than the source of truth: disabling them does not remove the governing instructions or deterministic engine safeguards.

In another IDE or agent environment, begin by telling the agent to read the root `AGENTS.md`, then `_brainwave/AGENTS.md` and this handbook. If the environment uses another native instruction filename, make that file a small bridge to `_brainwave/AGENTS.md`; do not duplicate the directive. _brainwave cannot make an unknown host discover repository instructions automatically, but its workflow and engine do not depend on hooks.

## The Dashboard

`_dashboard.html` is the window into _brainwave. Open it directly from disk; no local server is required.

It shows:

- a focused project overview with the current name, short description or tagline, logo, and colour direction when available
- a complete, friendly view of the user's setup choices, project basics, and getting-started checkpoints
- a seven-stage vertical journey, with completed stages collapsed and the current stage in focus
- in-dashboard previews of the seed, North Star, decisions, handbook, and expressed documents
- the installed DNA Library, including each module's full DNA document catalogue before a concept is selected
- document and DNA-block progress using canonical IDs and expandable block-level detail
- after foundation acceptance, a **Staying aligned** view showing built, checked, underway, and blocked DNA direction coverage together with the latest fresh-context review
- a copyable fresh-context review prompt at the point where a release, pilot, major handoff, or broad readiness review becomes useful
- a quiet project-state view for technical provenance without placing it in the main journey

The interface is intentionally presentation-led: icons, state, sequence, and visual placeholders do most of the explanatory work. Source links remain available inside previews for users who want to work directly with the files.

The dashboard is derived, not authoritative. `_dna/` owns module definitions, `_brainwave_state.yaml` owns selection, the decisions log owns material rationale, DNA documents own accepted direction, and `_implementation.yaml` owns delivery state and evidence. `_manifest.yaml` supplies the embedded dashboard snapshot.

Refresh it from the project root:

```text
node _brainwave/_engine/brainwave_runner.js refresh
```

After completing a fresh-context review, record its result and reviewed Git revision with:

```text
node _brainwave/_engine/brainwave_runner.js alignment-review <aligned|needs_attention|blocked> <revision>
```

An `aligned` result is accepted only when the implementation spine is current and complete, every applicable DNA block is verified, and no block is blocked or invalid.

## Ambient Delivery Alignment

`brainwave_documentation_complete` automatically enters ambient delivery alignment. This is not an eighth lifecycle stage and is not a user setting. Passive means _brainwave stops initiating foundation ceremony; it does not mean the accepted direction becomes invisible or optional.

At foundation acceptance, run `implementation-compile`. Add `--existing-build` when adopting the spine into a repository where product work is already underway. Compilation inventories every applicable current DNA block into draft `_implementation.yaml` and writes `_implementation_proposal.yaml`; it deliberately creates no slices because the deterministic engine cannot interpret product meaning.

Slice synthesis is a first-class planning step. An agent reads the North Star and discovers the project-specific documents that provide an outcome backbone—such as critical journeys, capability or outcome priorities, delivery phases, acceptance criteria, architecture boundaries, and risk or external-gate direction. These roles are semantic and data-driven; no DNA IDs are hardcoded. DNA documents remain direction authority and DNA blocks remain the atomic traceability items, but document boundaries do not automatically become slice boundaries.

The agent completes only `_implementation_proposal.yaml`. A normal slice must express one coherent observable outcome. A dedicated `foundation` or `external_gate` slice is allowed only with a recorded justification. The proposal gives every slice an explicit working order, dependencies, blocking gates, and acceptance checks; maps every applicable block to exactly one `primary_slice`; and uses `applies_to` for cross-cutting direction that governs additional slices without duplicating ownership.

Every slice must fit a bounded execution context. `_brainwave` measures primary and cross-cutting blocks, unique documents, and the formatted context packet during synthesis and review. Each `applies_to` link must be semantically necessary. Early thresholds prompt refinement; hard limits prevent approval and have no ordinary override, so an oversized slice must be split or narrowed.

For existing-build adoption, the synthesis pass also inspects the current code, tests, and representative rendered journeys. Each block receives a planning assessment of absent, partial, apparently implemented, or apparently verified with inspectable references where applicable. These assessments inform grouping and order but do not count as delivery evidence; guarded evidence commands still establish implementation coverage.

Run `implementation-synthesize <authored-by>` to import and validate the proposal into the command-owned spine. Run `implementation-review` to create `_implementation_review.md`, then present that review to the user. It explains the outcome grouping, ownership, cross-cutting links, order, dependencies, gates, checks, and existing-build snapshot, plus exactly what approval means. `implementation-approve` rejects a plan until that exact proposal fingerprint has been reviewed. Status counters alone are never a sufficient approval request.

`_implementation_proposal.yaml` is the agent-authored draft input. `_implementation.yaml` remains the sole authority and is command-owned: agents do not directly edit delivery states, evidence, holds, approval, revisions, audit fields, or a sealed proposal.

For ordinary implementation, `implementation-context` returns a bounded packet containing the previous result, active or next slice, relevant DNA IDs and owning paths, dependencies, gates, acceptance checks, coverage, and exact next command. The agent reads only those DNA passages, works on one slice, records concise evidence through guarded commands, closes a clean Git checkpoint, then asks for the next packet. `implemented` requires current implementation evidence. `verified` additionally requires verification evidence, check time, and checked revision.

The checked behaviour must already exist at the current Git revision before the agent records `verified`; this prevents the evidence from pointing to an earlier build. The resulting spine and derived-state mutation is then committed before another slice begins.

A blocked or deferred slice stays out of automatic next-slice selection. Once its recorded `reopen_when` condition is observably met, the agent may explicitly start that slice again; its hold remains visible until new evidence advances the affected work item.

Alignment is an evidence-backed semantic assessment rather than mathematical proof. The engine can validate identities, states, evidence fields, and review metadata; the agent still judges which blocks are relevant and whether the inspected behaviour appears to satisfy them. A material-divergence scan focuses on consequential user behaviour, product promises, data use, permissions, risk, launch dependencies, and system boundaries rather than attempting to map every implementation detail to DNA. Human or qualified specialist judgement remains necessary where the decision requires it.

DNA direction coverage gives a more grounded view than an invented project percentage:

- **Built** = `implemented` + `verified`
- **Checked** = `verified`
- **Applicable** excludes `superseded` and explicitly justified `not_applicable` blocks

Counts are primary and percentages secondary. They describe coverage of documented directions, not effort remaining, overall product completion, time-to-finish, or release readiness. Open blockers remain prominent regardless of coverage.

Before a release, pilot, major handoff, broad readiness claim, or overall alignment assessment, open a new chat and use the exact fresh-context review prompt provided in the dashboard. A separate chat reduces anchoring and creates an inspectable review transcript, but it is still a fresh-context model review rather than an independent professional audit.

DNA documents remain controlled living specifications. An editorial clarification may update a block only when no reasonable downstream behaviour could change. When implementation learning produces a local behavioural change without changing the North Star, relevant domains, or document scope, the agent explains the conflict, proposes the new direction, obtains explicit user approval, creates a superseding block, retains the former block as a compact tombstone, then recompiles and reviews the spine. Reopen the existing lifecycle at the appropriate stage when the North Star, module selection, or document scope changes. Git and supersession preserve lineage; do not add chronological changelog sections to each block.

## Bundled DNA

- **`_DNA-SAPP` — Software Application DNA** produces software product and architecture documentation for applications and digital services.
- **`_DNA-BRND` — Brand Identity DNA** produces enduring verbal and visual identity guidance without expanding into campaigns, acquisition, or go-to-market planning.
- **`_DNA-PSTR` — Product Strategy and Evidence DNA** grounds product value, assumptions, priorities, validation, outcomes, and product measurement in explicit evidence.
- **`_DNA-PDEX` — Product Design and Experience DNA** defines deliberate journeys, interaction, interface content, hierarchy, accessibility, adaptation, localisation, distinctiveness, and experience verification.
- **`_DNA-COMM` — Commercial and Economics DNA** defines funding, revenue, payer, pricing, packaging, monetisation, payment policy, costs, cash requirements, runway, unit economics, measurement, and commercial viability.
- **`_DNA-GROW` — Market Presence and Growth DNA** defines market-facing positioning, channels, launch, discoverability, acquisition, conversion, sales, partnerships, lifecycle, content, responsible-growth boundaries, and measurement.
- **`_DNA-LEGL` — Legal, Policy and Market Access DNA** detects consequential obligations, records current authoritative sources and review gates, and prepares qualified review without claiming to provide legal advice or compliance.
- **`_DNA-SOPS` — Service Operations and Support DNA** defines human service delivery, support, customer success, fulfilment, capacity, complaints, escalation, readiness, quality, and improvement.

The agent may recommend any relevant combination. Counts and document names are read directly from the module files and dashboard, so this handbook does not duplicate their catalogues.

For a typical public venture, the agent normally considers PSTR, PDEX, SAPP, BRND, COMM, and GROW as a coherent profile. LEGL always receives a short consequence screen and expands only when users, data, claims, money, markets, sectors, content, contracts, or distribution trigger it. SOPS expands when people, partners, support, customer success, fulfilment, scheduling, execution of established moderation policy, complaints, or escalation help deliver the product's value. These are routing heuristics rather than a preset: the user still agrees the modules and the proportionate document scope.

The library direction is concentric rather than monolithic. A venture-building experience is a profile that selects several clear domains, not one module that owns an entire company. Specialist overlays may later cover trust and safety, marketplaces and networks, AI product assurance, product experimentation where it outgrows PSTR, and regulated sectors.

## Working Agreement

- Preserve the user's wording and natural structure when capturing the seed. Do not expand it to fill a template or infer missing content; obtain approval before any material paraphrase or restructuring.
- Preserve `_my_brainwave_seed.md` exactly after capture.
- Read `_my_brainwave_north_star.md` first for current direction.
- Ask one to three high-leverage questions at a time, interpret existing answers first, and route only material follow-ups.
- Confirm how far the user wants to take the current idea before agreeing the North Star; do not infer or default the outcome.
- Do not require exhaustive answers; resolve or explicitly mark only materially important gaps.
- Treat proportionality as a scope decision, not permission for weak foundations or unfinished behaviour inside the confirmed boundary.
- Let the AI agent recommend DNA modules and DNA documents using semantic judgment. The engine validates and scaffolds; it does not interpret the idea.
- Use each module contract to preserve timing, ownership, exclusions, coordination, and live-verification needs; use current authoritative sources for volatile external requirements.
- In Legal, Policy and Market Access documentation, completion means the source-linked detection, questions, evidence, and review route are documented; it never means legal approval, professional advice, certification, or compliance. Preserve jurisdictions, source dates, uncertainty, and qualified-review gates.
- Use each DNA document group's `when_relevant` as the domain gate, its baseline documents as the normal starting point, and each file's `intent` to decide which optional documents are material.
- Obtain explicit user agreement before recording DNA module selection or DNA document scope.
- Keep DNA definitions unchanged during a project. Project selection belongs in `_brainwave_state.yaml`.
- Record a decision in its owning DNA block or ADR, not in the seed or a duplicate ledger.
- After DNA documentation is complete, use the implementation spine for sequence, delivery status, evidence, and compact cross-context handoff. Do not put delivery state back into DNA documents.
- Never silently rewrite accepted DNA direction to match implementation. Use user-approved supersession for a local behavioural change, and reopen the appropriate lifecycle stage when the North Star, relevant domains, or DNA document scope changes.
- Describe built and checked block counts as DNA direction coverage, never as overall product completion or release readiness.
- Recommend the dashboard's copyable fresh-context review prompt before releases, pilots, major handoffs, broad readiness claims, and overall alignment assessments.
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
- `_assets/`
- `_decisions_log.md`
- `_documentation/`
- `_implementation_proposal.yaml`
- `_implementation.yaml`
- `_implementation_review.md`
- `_implementation_audit.md`

`_manifest.yaml` and the state embedded in `_dashboard.html` are derived and may be regenerated. Root bridges and hook configurations are merged rather than replaced.

Until an automated updater exists, update framework-owned files only and run `integrate` followed by `refresh`. Never copy a new release wholesale over an active project. `unintegrate` removes root connections only; project-owned artifacts must be backed up and removed deliberately.

## When _brainwave Is Complete

`brainwave_documentation_complete` means the initial DNA documentation foundation has been accepted. It does not mean the resulting product or brand has been implemented.

At this stage, _brainwave stops announcing or initiating its foundation workflow during ordinary development and enters ambient delivery alignment. DNA blocks remain lightweight direction and traceability anchors. `_implementation.yaml` maps every applicable block to a coherent slice and owns the states `not_started`, `in_progress`, `implemented`, `verified`, `blocked`, and `deferred`. The dashboard derives honest direction coverage and provides the fresh-context review journey when broader assurance is needed.

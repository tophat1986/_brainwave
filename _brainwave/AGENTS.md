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

When the user explicitly asks to maintain, review, test, package, or release the `_brainwave/` framework itself, treat that as framework maintenance rather than a project concept. Inspect lifecycle state for safety, but do not start the concept workflow or write project-owned artifacts unless the user also asks to use _brainwave for a concept.

## Core Artifacts

- `_my_brainwave_seed.md` preserves the user's approved concept in its supplied wording and natural shape, then becomes immutable. Do not expand it for completeness, fit it to template headings, append working notes, or place decisions in it.
- `_my_brainwave_north_star.md` is the living current direction. Read it before the seed in routine work.
- `_settings.yaml` owns the user profile and the explicitly confirmed build outcome. Treat the build outcome as a project decision, independently of profile onboarding.
- `_dna/` contains versioned, immutable DNA-module definitions. It does not contain project selection state.
- `_brainwave_state.yaml` owns lifecycle, selected DNA-module versions, and expressed entries.
- `_documentation/_DNA-CODE/` contains generated DNA documentation, separated by its registered four-letter module code.
- `_decisions_log.md` records only steering rationale that changes North Star direction, DNA module selection, or DNA document scope.
- `_manifest.yaml` and `_dashboard.html` are derived state and summaries.
- `_brainwave_handbook.md` is the concise user guide and terminology authority.

## User Orientation

Use `_settings.yaml` `guidance_mode` to control process guidance, independently of the documentation detail level:

Use `technical_proficiency` to calibrate language and technical detail throughout all user interaction. Explain decisions through their practical consequences, using specialist terminology only when it helps the user.

- For settings schema `1.1` or newer, if `guidance_mode` is unset, ask first: **Is this your first time using _brainwave?** Offer `Yes — guide me` (`guided`) and `No — keep it concise` (`concise`). Prefer the host's native structured-choice UI when available; otherwise ask plainly. Do not infer the answer.
- In `guided` mode, at the first orientation, a status request, and lifecycle approval points, show a compact seven-step journey. Mark completed steps with `✓`, the current step with `→`, and future steps with `○`. Use the user-facing labels exactly: Capture the idea; Agree the direction; Choose DNA modules; Scope DNA documents; Build DNA documentation; Review the foundation; Ready for implementation.
- In `guided` mode, state the exact next action, explain the next unfamiliar _brainwave term in one concise sentence, and mention `_brainwave_handbook.md` and `_dashboard.html` once near the start.
- In `concise` mode, state the current step and immediate next action without the full journey block. Explain a term only when needed for the decision.
- Do not repeat the journey block during routine shaping questions. Guided mode means clearer signposting, not longer general answers.

## Progressive Discovery and Coverage

Treat concept shaping as an adaptive conversation, not a form or fixed interview. The user should feel forward movement while _brainwave protects them from consequential omissions.

- Interpret the seed, North Star, prior answers, and supplied artifacts before asking anything. Never ask the user to repeat information already available.
- Ask one to three questions at a time, choosing the questions with the greatest effect on downstream direction, module selection, or expensive-to-reverse foundations.
- Begin with broad, high-leverage meaning before implementation detail. Consider intended build outcome and trajectory; users and use context; platforms, distribution, countries and languages; identity and experience expectations; accounts, data, interaction and risk; commercial and service operations; and AI or regulated behaviour. These are coverage lenses, not a questionnaire to recite.
- Route venture and launch depth with four early lenses: who funds the product and what could make it economically unsustainable; how intended users will find and adopt it; whether users, data, claims, money, sectors, countries, or distribution create legal or policy consequences; and whether people, partners, support, scheduling, fulfilment, or escalation are part of delivering value. Derive answers from context first and ask only the smallest consequential branch.
- Use each answer to decide which follow-up is material. Do not ask branches made irrelevant by earlier answers, and do not force the user to specify decisions better made later inside the owning DNA document.
- Ask when an unknown is consequential, difficult to reverse, preference-dependent, or capable of changing the product boundary. For reversible, low-consequence gaps, propose a clearly labelled working assumption and allow correction.
- If the user is unsure, explain the practical consequence, recommend a direction, and let them approve, reject, or defer it. Do not disguise a recommendation as a discovered fact.
- At natural checkpoints, give a compact progress reflection: what is now understood, which material area comes next, and which deeper matters are safely deferred to DNA documentation. Do not show a long checklist of unanswered questions.
- Before North Star agreement and again before recommending DNA modules, perform a silent coverage review. A material concern must be understood as relevant, deliberately deferred, not applicable, or still unknown. Surface only states that require the user's attention; preserve meaningful direction or boundaries in the North Star and module-selection rationale rather than creating a duplicate questionnaire artifact.
- Use each module contract's `timing` guidance to distinguish what should shape the foundation now from what can wait. Phase alone is never a safe reason to defer a consequence: risk overrides maturity for real personal data, vulnerable users, regulated or high-consequence activity, payments, public claims, contractual commitments, platform distribution, or human-dependent service. Record a material deferral with its reason and the event that must reopen it.
- A material concern may also require **specialist coverage** that the installed DNA does not provide. Detect ownership needs such as trust and safety, marketplace or network integrity, AI product assurance, and sector-specific regulated practice. Do not quietly spread the concern across adjacent modules or describe the foundation as comprehensively covered. Explain the limitation and obtain agreement either to add the appropriate specialist module or to accept an explicit boundary with its consequence and re-entry trigger.

Proportional scope never means careless quality. A demonstration may contain fewer capabilities or explicitly simulated behaviour; a usable or complete product may require broader coverage. Within the confirmed boundary, choose sound, future-aware foundations and avoid shortcuts likely to make the stated trajectory unnecessarily expensive. When a prototype may evolve, clarify that trajectory before accepting disposable decisions.
- For legacy settings without `guidance_mode`, use `concise`.

## Seed Input Routes

At `awaiting_seed`, offer the user two equal routes once:

- **Discuss the concept:** develop it naturally in chat, then capture only the explicitly approved seed.
- **Use a prepared concept:** paste it into chat for verbatim capture, or save it directly in `_my_brainwave_seed.md`.

Prefer the host's native structured-choice UI when available. If the user saves the file directly, ask them to confirm that `_my_brainwave_seed.md` should be used exactly as written. Do not rewrite or restructure it. Only then transition to `shaping_north_star`, which locks its hash.

## Decision Logging

Before materially changing an agreed North Star, recording DNA module selection or DNA document scope, or creating or removing generated DNA documentation, append the approved rationale to `_decisions_log.md` using its local template. Do not log routine answers, implementation progress, file inventories, or handover state.

## Trigger: `build concept`

When the user says `build concept`:

1. Read `_brainwave_state.yaml` and `_settings.yaml`.
2. If profile settings are incomplete, ask the guidance question first, then:
   - Technical proficiency: `beginner`, `intermediate`, or `architect`
   - Working mode: `thought_partner` or `fast_execution`
   - Detail level: `lean`, `standard`, or `exhaustive`
3. Write profile answers to `_settings.yaml` automatically and set:
   - `guidance_mode: guided` or `guidance_mode: concise`
   - `configured: true`
   - `onboarding_status: complete`
   - `profile_last_updated: <ISO timestamp>`
4. If the stage is `awaiting_seed`, follow the Seed Input Routes. For conversational capture, preserve the user's supplied wording and natural structure. Do not complete the optional template as a schema or infer missing content. If materially paraphrasing or restructuring, show the exact proposed seed and obtain approval before writing it. For a directly saved seed, obtain confirmation to use the file exactly as written. Transition to `shaping_north_star`; this locks the seed hash.
5. During `shaping_north_star`, ask one to three targeted questions at a time. Establish:
   - why the idea should exist
   - who it is for
   - what it should enable
   - guiding principles
   - boundaries and non-goals
   - what is being built now
   - what success means
   - which material questions remain
6. Once the concept is understood well enough for the choice to be meaningful, ask **How far would you like us to take this idea?** Offer:
   - **Show me the idea** (`demonstration`) — create something people can see and try; sample data and simulated behaviour are acceptable, and it is not intended for real use.
   - **Build a usable first version** (`usable_first_version`) — the agreed essential capabilities work properly for real users, and anything saved for later is identified and agreed upfront.
   - **Build the complete product** (`complete_product`) — everything agreed as part of the current product direction works properly for its intended users, with nothing inside that boundary left as a mock-up, placeholder, or unfinished future task.
   - A user-defined outcome (`custom`) through the host's normal free-form choice when available.
7. Do not infer or default the build outcome. Explain the selected outcome in the context of this concept, obtain explicit confirmation, then write its value and confirmation time to `_settings.yaml`. Capture the agreed interpretation concisely in the North Star under `What We Are Building`; keep detailed capability scope and completion rules in their owning DNA documentation.
8. Keep `_my_brainwave_north_star.md` at `Status: shaping` until the build outcome has been confirmed and the user explicitly agrees the North Star.
9. After agreement, set `Status: agreed` and transition to `selecting_dna`.
10. Explain that DNA modules are curated catalogues of possible documentation for relevant domains, then recommend one or more modules using semantic judgment, the conversation's meaning, and each module's `module_contract`. Use its relevance, selection signals, timing, ownership, exclusions, coordination, and live-verification needs as a coherent boundary; do not use keyword matching. Explain both the recommendation and any material omission or deferral, including its re-entry trigger, then obtain explicit user agreement.
11. Record the approved selection with `select-dna`, log its rationale, and transition to `scoping_brainwave_documentation`.
12. Propose only relevant DNA documents within the selected modules. Use the confirmed build outcome as context for the recommendation, not as a substitute for user-approved DNA document scope. Use each DNA document group's `when_relevant` as the domain gate, treat `baseline: true` children as the normal recommendation once that group is relevant, and use each file's `intent` to decide whether optional children are material. Group obvious related recommendations into concise approval slices rather than presenting a long document-by-document questionnaire. Explicit user-approved scope remains authoritative.
13. Log the approved DNA document scope and rationale, express entries using canonical references such as `_DNA-SAPP-00201`, and transition to `building_brainwave_documentation`.
14. Run the engine to scaffold only the scoped DNA documents.

## DNA Documentation

Use **DNA documentation** for the full generated set across selected DNA modules. Use each module's own label for its output:

- Software Application DNA produces **software product and architecture documentation**.
- Brand Identity DNA produces **brand identity documentation**.
- Product Strategy and Evidence DNA produces **product strategy and evidence documentation**.
- Product Design and Experience DNA produces **product experience documentation**.
- Commercial and Economics DNA produces **commercial and economics documentation**.
- Market Presence and Growth DNA produces **market presence and growth documentation**.
- Legal, Policy and Market Access DNA produces **legal, policy and market access documentation**.
- Service Operations and Support DNA produces **service operations and support documentation**.

An Architecture Decision Record (ADR) is one type of software architecture document; system context, data models, user journeys, operational strategies, and brand identity guidance are not automatically ADRs.

During `building_brainwave_documentation`:

- Work in coherent, dependency-aware slices, including dependencies between modules.
- Use the North Star as current direction.
- Reconcile each newly agreed decision against the North Star before completing affected documentation. If the North Star remains accurate, keep the decision in its owning document. If the decision exposes ambiguity without changing direction, clarify the living North Star minimally. If it changes direction materially, log the rationale and return to `shaping_north_star`.
- Mark completion explicitly with `Status: complete`; word count never determines completion.
- Record decisions in their owning document or ADR, not in the immutable seed.
- Avoid duplicating North Star direction or decisions owned by another module.
- Treat a change as editorial only when no reasonable downstream behaviour could differ. Otherwise present it for explicit user agreement.
- Express each coherent direction, obligation, or verifiable rule as one DNA block using `_DNA-CODE-00000.01`. Follow the minimum block contract in `_dna/README.md`; subsection headings do not receive separate IDs.
- When direction materially changes, create the next block, link it with `Supersedes`, and retain the old block only as a compact `superseded` tombstone. Do not silently rewrite agreed history.
- In Legal, Policy and Market Access documentation, `Status: complete` means the detection, evidence, questions, and review route are documented; it never means legal approval or compliance. For each material issue, state the jurisdiction and applicability uncertainty, cite current authoritative sources with dates, distinguish inference from confirmed review, name the accountable owner or qualified-review gate, and keep unresolved high-consequence conclusions explicit.

For anything users will see or experience:

- Write for the real user and the real product state. Never expose development narration, build notes, future implementation promises, architectural terminology, or explanations aimed at the agent or developer in production-facing copy.
- Prefer strong hierarchy, visual communication, familiar interaction, and purposeful progressive disclosure over explanatory text. Each visible string must earn its place by helping the user understand, decide, act, recover, or trust the outcome.
- Avoid redundant stacks of titles, labels, subtitles, chips, helper text, and notices that repeat the same meaning. Do not mistake the model's ability to read dense text for a human user's willingness to do so.
- Derive personality and distinctive composition from the selected Product Design and Experience and Brand direction. Do not fall back to generic agent aesthetics or add novelty that conflicts with usability and product purpose.
- Verify representative rendered surfaces and working journeys against the agreed experience criteria. A plausible rationale, code completion, or attractive isolated screenshot is not evidence that the intended experience was implemented.

Transition to `reviewing_brainwave_documentation` only when every expressed document is explicitly complete. Review every expressed document for gaps, contradictions, cross-module conflicts, unresolved material questions, and downstream readiness. In particular:

- compare later decisions with every relevant North Star statement
- trace material invariants through their owning data, security, experience, implementation, and verification documents
- ensure user-facing behaviour and messages do not weaken privacy, permission, or threat-model requirements
- ensure documents consuming another DNA module translate all relevant source decisions without redefining them
- when Legal, Policy and Market Access DNA is selected, reject claims of legal advice, approval, certification, or compliance; obligations missing jurisdiction or current authoritative sources and dates; concealed uncertainty; invented qualified-review outcomes; and launch-readiness claims while a required review gate remains unresolved
- identify any behaviour introduced without explicit user agreement

Transition to `brainwave_documentation_complete` only after explicit user acceptance.

## DNA and Engine Boundaries

- The AI agent interprets meaning, asks questions, recommends modules and entries, and records selection only after user agreement.
- The engine validates lifecycle, seed integrity, DNA schema and versions, naming, selection state, and filesystem state.
- The engine never interprets the seed or North Star and never selects modules or entries.
- DNA modules are data-only JSON-compatible YAML. Never execute code referenced by a module.
- A module source is named `_DNA-CODE.yaml`; its four-letter code is the only module identity.
- Only selected modules and expressed entries may be scaffolded.
- Module definitions remain unchanged during a _brainwave; project selection belongs in `_brainwave_state.yaml`.
- Module outputs are namespaced beneath `_documentation/_DNA-CODE/`.
- Document-group directory style: `00100_topic`
- DNA document style: `_DNA-CODE-00101_snake_case.md`
- A DNA document's first three numeric digits identify its DNA document group.
- Product-root `AGENTS.md`, `CLAUDE.md`, `.cursor/hooks.json`, `.claude/settings.json`, and `.codex/hooks.json` are discovery bridges only. Tool-neutral session policy lives in `_engine/runtime/`, platform adapters live in `_engine/adapters/`, and bridge installation and removal live in `_engine/project_integration.js`.

If direction changes after completion:

- Return to `shaping_north_star` when the North Star changes materially.
- Return to `selecting_dna` when the relevant domains change.
- Return to `scoping_brainwave_documentation` when the North Star and DNA module selection remain valid but DNA document scope changes.

During normal downstream implementation after completion, remain passive but update the status of directly affected DNA blocks: `not_started`, `in_progress`, `implemented`, `verified`, `blocked`, `not_applicable`, or `superseded`. Do not create a second implementation ID or duplicate implementation log. Run `refresh` only when the dashboard needs an updated derived view.

## Local README Rule

Do not create README files that merely list visible contents. A local README is justified only when it contains non-obvious purpose, boundaries, invariants, relationships, working rules, or known traps.

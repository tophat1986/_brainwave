# _brainwave

_brainwave turns an original idea into an agreed North Star and a proportionate foundation of domain documentation before AI agents begin building.

## Why _brainwave?

AI agents can turn a prompt into a working application remarkably quickly, but they naturally favour the immediate request and shortest plausible path. The first generated structure then becomes the precedent for everything that follows—even when maintainability, security, performance, scale, and clean architectural boundaries were never properly considered. _brainwave adds a deliberate foundation stage between “I have an idea” and “build it,” so the important decisions are made before an accidental first draft becomes the architecture.

## How it works

_brainwave calls its documentation system **DNA**. A **DNA module** is a versioned catalogue for one domain, containing possible **DNA documents**. Each document records its directions as traceable **DNA blocks**. A project uses only the modules and documents it genuinely needs.

The user journey has eight steps. The first seven establish the accepted foundation; the eighth keeps implementation actively sequenced and checked against it:

1. **Capture the idea** — preserve the original concept as the immutable _brainwave Seed.
2. **Agree the direction** — shape and approve the living North Star.
3. **Choose DNA modules** — select the documentation domains relevant to the concept.
4. **Scope DNA documents** — agree which documents are genuinely needed.
5. **Build DNA documentation** — write the selected documents and their traceable DNA blocks.
6. **Review the foundation** — resolve gaps, conflicts, and readiness concerns.
7. **Ready for implementation** — give the agreed foundation to the agents that will build the project.
8. **Deliver the implementation** — work through approved outcome slices, evidence, checks, dependencies, and external gates.

The AI agent provides the judgment: it interprets the concept, asks material questions, and develops the foundation with the user. The local engine preserves the process, identities, versions, and agreed scope. Once the foundation is accepted, the seven-stage foundation lifecycle becomes passive while the eighth dashboard step presents the implementation spine that keeps delivery aligned.

Discovery is progressive rather than a long setup form. The agent interprets what is already known, asks one to three high-leverage questions at a time, and uses early answers about intended outcome, users, reach, platforms, languages, risk, operations, and business intent to route only the follow-ups that matter. A smaller build has a narrower boundary, not a lower quality floor.

## Bundled DNA modules

Eight DNA modules are included. Their persistent IDs carry through to their documents and blocks.

- **`_DNA-PSTR` — Product Strategy and Evidence DNA**
  Evidence, value proposition, product principles, assumptions, validation, outcomes, and product measurement without replacing the North Star.

- **`_DNA-PDEX` — Product Design and Experience DNA**
  Journeys, interaction, interface content, hierarchy, accessibility, responsive and localised behaviour, visual composition, distinctiveness, and experience evaluation.

- **`_DNA-SAPP` — Software Application DNA**
  Implementation-scope and architecture guidance for applications and digital services, including completion expectations, data, security, APIs, experience implementation, operations, quality, scale, and continuity.

- **`_DNA-BRND` — Brand Identity DNA**
  Enduring verbal and visual identity guidance, including direction, voice, terminology, visual foundations, accessibility, and application.

- **`_DNA-COMM` — Commercial and Economics DNA**
  Funding, revenue, payer, pricing, packaging, monetisation, payment policy, cost, cash requirements, runway, unit economics, measurement, and commercial viability.

- **`_DNA-GROW` — Market Presence and Growth DNA**
  Positioning application, launch, channels, SEO, ASO, acquisition, conversion, sales, partnerships, lifecycle, referral, content, responsible-growth boundaries, and measurement.

- **`_DNA-LEGL` — Legal, Policy and Market Access DNA**
  Guarded detection, source-linked obligations, market and platform access, review gates, and qualified-review preparation—not legal advice or a compliance declaration.

- **`_DNA-SOPS` — Service Operations and Support DNA**
  Human service delivery, support, customer success, fulfilment, scheduling, capacity, complaints, escalation, readiness, quality, and improvement.

DNA modules are menus, not checklists. Their explicit contracts state what each domain owns, excludes, coordinates with, and must verify using current evidence. The agent recommends only the modules and documents that are material to the project.

For a typical public venture, the agent normally considers Product Strategy, Product Design and Experience, Software Application, Brand Identity, Commercial and Economics, and Market Presence and Growth together. Legal, Policy and Market Access always receives a short consequence screen and expands only when triggered. Service Operations and Support expands when people, partners, support, customer success, fulfilment, scheduling, execution of established moderation policy, or escalation help deliver the value. These are routing heuristics, not an automatic requirement to select all eight modules.

The core library can grow through specialist overlays for trust and safety, marketplaces and networks, AI product assurance, and regulated sectors. Venture-building is a selectable profile across clear domains rather than one oversized module or a compulsory company-building questionnaire.

When an idea materially needs one of those uninstalled specialist owners, _brainwave must state that specialist coverage is required. It cannot silently spread that responsibility across neighbouring modules or present the foundation as comprehensive.

## Which model should I use?

Use the smartest, most capable model available while shaping the North Star and developing the DNA documentation. This stage carries the most ambiguity and requires the strongest reasoning, so it is the wrong place to optimise for cost.

Model capability does not set documentation length. The persistent `_settings.yaml` `verbosity_budget` does: `lean` means minimum sufficient, `standard` means concise and complete rather than near-exhaustive, and `exhaustive` means deep treatment only within the agreed scope. Every level keeps the same material-risk, accuracy, verification, and completion standards.

Once the foundation is agreed, implementation can often move to a more cost-effective capable model because the agent is following documented decisions rather than repeatedly guessing at intent.

Read the [_brainwave handbook](./_brainwave/_brainwave_handbook.md) for the complete lifecycle and terminology. Open `_brainwave/_dashboard.html` for the guided journey, document previews, DNA library, and block progress.

> _brainwave is currently a `0.x` release candidate. Battle-test it on a non-critical project before relying on it as the sole record of architectural decisions.

## Project Topology

This repository is a clean project template. Its root is both the Git repository and AI workspace root:

```text
my-project/
|-- AGENTS.md
|-- CLAUDE.md
|-- .cursor/hooks.json
|-- .claude/settings.json
|-- .codex/hooks.json
|-- _brainwave/
|   |-- AGENTS.md
|   |-- _brainwave_state.yaml
|   |-- _documentation/
|   `-- ...
`-- app/
    `-- ...
```

Build the implementation in `app/`, `src/`, or another sibling of `_brainwave/`. Keep both in one repository so direction, documentation, implementation, and history travel together.

## Get Started

Choose the route that matches where you are starting.

### Option 1 — Create a Repository from the Template

Recommended when you have not created your project repository yet.

1. Use GitHub's **Use this template** action to create the project repository. This is the recommended route because it starts with its own Git history and remote.
2. Confirm Node.js 20 or newer is installed.
3. Open an AI-agent chat from the repository root. If the agent does not discover project instructions automatically, ask it to read `AGENTS.md` first.
4. Choose either seed route:
   - **Discuss or paste in chat:** send:

     > Use _brainwave to capture the following idea as the immutable seed, then `build concept`: `<your idea>`

   - **Use a prepared file:** paste the concept into `_brainwave/_my_brainwave_seed.md`, save it, then send:

     > `build concept` using the seed file exactly as written.

5. Shape the North Star, explicitly agree how far the current idea should be taken, and then agree the resulting direction.
6. Choose the relevant DNA modules and scope only the DNA documents the project needs.
7. Let the engine scaffold the scoped DNA documents beneath `_brainwave/_documentation/_DNA-CODE/`, then build their content and traceable DNA blocks.
8. Review the foundation before accepting `brainwave_documentation_complete`.

If you intentionally clone this repository instead, replace its `origin` with the new project's remote before beginning product work. A normal clone retains the upstream _brainwave remote.

The shipped state is deliberately clean: `awaiting_seed`, an empty seed, and no project-specific North Star.

The root `README.md` and `package.json` initially provide _brainwave onboarding and development tooling; they are not application runtime requirements. An application may keep its own package beneath `app/`, or merge and replace root metadata as the project takes ownership. If the product replaces this README, retain a short signpost to `_brainwave/_brainwave_handbook.md`.

### Option 2 — Install into a Repository You Already Created

Use this route after creating a Git repository for your new project and opening it with your AI agent. The repository may be completely empty. If you have not created one yet, use the template route above.

#### Copy-and-paste setup prompt

Copy this prompt into your AI agent:

```text
Install `_brainwave` into this repository from:

https://github.com/tophat1986/_brainwave

Before changing anything:

- Confirm the current folder is a Git repository.
- Confirm Node.js 20 or newer is installed.
- If `_brainwave/` already exists, stop and tell me. Do not overwrite it.
- If the source repository is unavailable, stop and report the problem.

Acquire the source in a temporary location outside this repository. Inspect
the downloaded source before running anything. If its installation structure
conflicts with these instructions, stop and report the discrepancy.

Copy the complete source `_brainwave/` directory into this repository's root.
Do not copy the source repository's `.git` directory or its other root files,
and do not change this repository's Git remote.

From this repository's root, run:

node _brainwave/_engine/brainwave_runner.js integrate
node _brainwave/_engine/brainwave_runner.js status

The `integrate` command should preserve existing content while merging or
creating:

- AGENTS.md
- CLAUDE.md
- .cursor/hooks.json
- .claude/settings.json
- .codex/hooks.json

Confirm that the lifecycle is `awaiting_seed`. Do not begin `build concept`.

Finally, report every file created or changed.
```

#### What the installation does

Installation first places the complete framework payload in `_brainwave/`. The `integrate` command then safely merges the root agent bridges and Cursor, Claude, and Codex session-hook registrations without replacing existing project guidance.

#### Manual installation

Confirm Node.js 20 or newer is installed. Copy only this repository's `_brainwave/` directory into `<project-root>/_brainwave/`, then run from the existing project root:

```text
node _brainwave/_engine/brainwave_runner.js integrate
node _brainwave/_engine/brainwave_runner.js status
```

The command merges managed bridges into `AGENTS.md` and `CLAUDE.md`, and registers session adapters in:

- `.cursor/hooks.json`
- `.claude/settings.json`
- `.codex/hooks.json`

Existing instructions and hooks are preserved. Running the command again is safe.

Project hooks execute local JavaScript and may require explicit review or trust in the chosen agent tool. Static `AGENTS.md` and `CLAUDE.md` guidance remains the baseline when hooks are disabled.

`integrate` registers all three bundled session hooks for portability, even when the project uses only one or none of those tools. A registration is inert in tools that do not read it. In a supported tool, the user may decline trust or disable the hook; static guidance and deterministic engine safeguards still apply. There is currently no separate static-only integration mode.

In another IDE or agent environment, direct the agent to read the root `AGENTS.md`, then `_brainwave/AGENTS.md` and `_brainwave/_brainwave_handbook.md` before acting. If that environment supports a different native instruction file, keep it as a small bridge to `_brainwave/AGENTS.md` rather than copying the governing directive. Automatic instruction discovery depends on the host tool; the deterministic engine safeguards do not.

To remove only the managed root bridges and hook registrations:

```text
node _brainwave/_engine/brainwave_runner.js unintegrate
```

This deliberately leaves `_brainwave/` and all project-owned artifacts untouched. Back them up before removing that directory manually.

## DNA and Implementation Traceability

_brainwave uses one identity tree:

```text
_DNA-SAPP
_DNA-SAPP-00300
_DNA-SAPP-00302
_DNA-SAPP-00302.01
```

The final decimal position identifies a DNA block inside a document. The block remains the stable traceability identity and source of accepted direction. `_implementation.yaml` references those same IDs and is the separate single source of implementation sequence, status, and concise current evidence; no second task-ID system is introduced.

After the foundation is accepted, _brainwave compiles an unmapped DNA-block inventory rather than pretending document boundaries are implementation slices. An AI planning pass uses the North Star and project-specific journey, priority, delivery, acceptance, architecture, and gate direction to author a hybrid outcome-led proposal; existing products also receive a code-and-test reconciliation pass. The engine imports and validates that proposal, generates a human-readable review, and permits approval only after that exact review. Agents then work through one coherent slice at a time, retrieve only its referenced DNA passages, persist evidence outside their context window, and reconstruct previous, current, and next work with one command.

DNA direction coverage is deliberately narrower than a project-completion estimate: it counts applicable documented directions that are built or checked, while blockers remain visible separately. It does not claim to measure effort remaining, time-to-finish, or release readiness.

Implementation communication is a separate preference in `_settings.yaml`: `implementation_progress_updates` may be `silent`, `track` (the default goal-level cadence), or `slice`. It applies only during **Deliver the implementation**. Every mode continues automatically across eligible work; progress updates never become permission checkpoints.

## Commands

Run commands from the project root:

```text
node _brainwave/_engine/brainwave_runner.js integrate
node _brainwave/_engine/brainwave_runner.js unintegrate
node _brainwave/_engine/brainwave_runner.js dna
node _brainwave/_engine/brainwave_runner.js status
node _brainwave/_engine/brainwave_runner.js refresh
node _brainwave/_engine/brainwave_runner.js implementation-compile [--existing-build]
node _brainwave/_engine/brainwave_runner.js implementation-synthesize <authored-by> [proposal-path]
node _brainwave/_engine/brainwave_runner.js implementation-review
node _brainwave/_engine/brainwave_runner.js implementation-approve <approved-by>
node _brainwave/_engine/brainwave_runner.js implementation-context [--json]
node _brainwave/_engine/brainwave_runner.js implementation-start <slice-id>
node _brainwave/_engine/brainwave_runner.js implementation-record <block-id> <implemented|verified> <kind> <ref> <note>
node _brainwave/_engine/brainwave_runner.js implementation-hold <block-id> <blocked|deferred> <owner> <reopen-when> <reason>
node _brainwave/_engine/brainwave_runner.js implementation-acceptance <slice-id> <check-id> <passed|failed|blocked> <kind> <ref> <note>
node _brainwave/_engine/brainwave_runner.js implementation-check [slice-id]
node _brainwave/_engine/brainwave_runner.js implementation-close <slice-id>
node _brainwave/_engine/brainwave_runner.js implementation-audit
node _brainwave/_engine/brainwave_runner.js alignment-review <aligned|needs_attention|blocked> <revision>
node _brainwave/_engine/brainwave_runner.js transition <stage>
node _brainwave/_engine/brainwave_runner.js select-dna <_DNA-CODE...>
node _brainwave/_engine/brainwave_runner.js express <_DNA-CODE-00000...>
node _brainwave/_engine/brainwave_runner.js unexpress <_DNA-CODE-00000...>
node _brainwave/_engine/brainwave_runner.js run
node _brainwave/_engine/brainwave_runner.js watch
```

The engine never interprets the concept or chooses documentation. Those decisions remain conversational and require explicit user agreement.

## Development

```text
npm test
```

The default suite is safe to run after a project has begun. It includes lifecycle, seed-integrity, DNA-contract, multi-agent adapter, project-integration, implementation-map, and clean-install checks.

Framework maintainers run clean release-template assertions separately:

```text
npm run test:release
```

## Built from Direct Experience

_brainwave’s founder built [WhatHotel](https://whathotel.io/) and [what.gift](https://what.gift/) using the system as it evolved. Those products also helped build _brainwave: direct experience creating and iterating both systems with successive generations of AI agents exposed the same recurring behaviour—even as models became more capable, they remained eager to please and prone to committing to the shortest plausible implementation. Those lessons shaped _brainwave’s persistent North Star, staged documentation, and traceable DNA system.

## License

_brainwave is available under the [MIT License](LICENSE).

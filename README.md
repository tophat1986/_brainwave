# _brainwave

_brainwave turns an original idea into an agreed North Star and a proportionate foundation of domain documentation before AI agents begin building.

## Why _brainwave?

AI agents can turn a prompt into a working application remarkably quickly, but they naturally favour the immediate request and shortest plausible path. The first generated structure then becomes the precedent for everything that follows—even when maintainability, security, performance, scale, and clean architectural boundaries were never properly considered. _brainwave adds a deliberate foundation stage between “I have an idea” and “build it,” so the important decisions are made before an accidental first draft becomes the architecture.

## How it works

_brainwave calls its documentation system **DNA**. A **DNA module** is a versioned catalogue for one domain, containing possible **DNA documents**. Each document records its directions as traceable **DNA blocks**. A project uses only the modules and documents it genuinely needs.

The idea moves through seven stages:

1. **Capture the idea** — preserve the original concept as the immutable _brainwave Seed.
2. **Agree the direction** — shape and approve the living North Star.
3. **Choose DNA modules** — select the documentation domains relevant to the concept.
4. **Scope DNA documents** — agree which documents are genuinely needed.
5. **Build DNA documentation** — write the selected documents and their traceable DNA blocks.
6. **Review the foundation** — resolve gaps, conflicts, and readiness concerns.
7. **Ready for implementation** — give the agreed foundation to the agents that will build the project.

The AI agent provides the judgment: it interprets the concept, asks material questions, and develops the foundation with the user. The local engine preserves the process, identities, versions, and agreed scope. Once the foundation is accepted, _brainwave becomes passive while the North Star and DNA documentation continue guiding implementation.

## Bundled DNA modules

Two DNA modules are included. Their persistent IDs carry through to their documents and blocks.

- **`_DNA-SAPP` — Software Application DNA**
  Architecture guidance for applications and digital services, including data, security, APIs, interfaces, operations, quality, scale, and continuity.

- **`_DNA-BRND` — Brand Identity DNA**
  Enduring verbal and visual identity guidance, including direction, voice, terminology, visual foundations, accessibility, and application.

DNA modules are menus, not checklists. The agent recommends only the documents that are material to the project. More domains can be added through future modules.

## Which model should I use?

Use the smartest, most capable model available while shaping the North Star and developing the DNA documentation. This stage carries the most ambiguity and requires the strongest reasoning, so it is the wrong place to optimise for cost.

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

5. Shape and explicitly agree the North Star.
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

The final decimal position identifies a DNA block inside a document. That same block carries its downstream implementation status, so there is no parallel task-ID system or duplicate implementation log.

## Commands

Run commands from the project root:

```text
node _brainwave/_engine/brainwave_runner.js integrate
node _brainwave/_engine/brainwave_runner.js unintegrate
node _brainwave/_engine/brainwave_runner.js dna
node _brainwave/_engine/brainwave_runner.js status
node _brainwave/_engine/brainwave_runner.js refresh
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

The test suite includes lifecycle, seed-integrity, DNA-contract, multi-agent adapter, project-integration, implementation-map, and clean-install checks.

## Built from Direct Experience

_brainwave’s founder built [WhatHotel](https://whathotel.io/) and [what.gift](https://what.gift/) using the system as it evolved. Those products also helped build _brainwave: direct experience creating and iterating both systems with successive generations of AI agents exposed the same recurring behaviour—even as models became more capable, they remained eager to please and prone to committing to the shortest plausible implementation. Those lessons shaped _brainwave’s persistent North Star, staged documentation, and traceable DNA system.

## License

_brainwave is available under the [MIT License](LICENSE).

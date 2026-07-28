# _brainwave

_brainwave turns an original idea into an agreed North Star and a proportionate foundation of domain documentation before AI agents begin building.

It is designed first for AI-built software products and currently bundles:

- **Software Application DNA** for software architecture documentation.
- **Brand Identity DNA** for enduring verbal and visual identity guidance.

The AI agent interprets meaning, asks material questions, and recommends relevant DNA. The dependency-free Node.js engine protects the immutable seed, lifecycle, approved scope, canonical identities, versions, scaffolding, and derived dashboard.

Read the [_brainwave handbook](./_brainwave/_brainwave_handbook.md) for the lifecycle and terminology. Open `_brainwave/_dashboard.html` for the visual state, DNA catalogue, and implementation map.

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

## Start a New Project

1. Use GitHub's **Use this template** action to create the project repository. This is the recommended route because it starts with its own Git history and remote.
2. Confirm Node.js 20 or newer is installed.
3. Open an AI-agent chat from the repository root. If the agent does not discover project instructions automatically, ask it to read `AGENTS.md` first.
4. Send one explicit chat instruction:

   > Use _brainwave to capture the following idea as the immutable seed, then `build concept`: `<your idea>`

5. Shape and explicitly agree the North Star.
6. Review the recommended DNA modules and proportionate documentation scope.
7. Let the engine scaffold the agreed documents beneath `_brainwave/_documentation/_DNA-CODE/`.
8. Complete and review those documents before accepting `brainwave_documentation_complete`.

If you intentionally clone this repository instead, replace its `origin` with the new project's remote before beginning product work. A normal clone retains the upstream _brainwave remote.

The shipped state is deliberately clean: `awaiting_seed`, an empty seed, and no project-specific North Star.

The root `README.md` and `package.json` initially provide _brainwave onboarding and development tooling; they are not application runtime requirements. An application may keep its own package beneath `app/`, or merge and replace root metadata as the project takes ownership. If the product replaces this README, retain a short signpost to `_brainwave/_brainwave_handbook.md`.

## Add to an Existing Project

Confirm Node.js 20 or newer is installed. Copy only this repository's `_brainwave/` directory into `<project-root>/_brainwave/`, then run from the existing project root:

```text
node _brainwave/_engine/brainwave_runner.js integrate
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

## License

_brainwave is available under the [MIT License](LICENSE).

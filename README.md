# _brainwave

_brainwave turns an original idea into an agreed North Star and a proportionate set of domain documentation before downstream work begins.

It is designed first for AI-built software products and currently includes:

- **Software Application DNA** for software architecture documentation.
- **Brand Identity DNA** for enduring verbal and visual identity guidance.

The AI agent interprets meaning and recommends relevant DNA. The deterministic engine protects the immutable seed, lifecycle, approved scope, naming, versions, scaffolding, and completion state.

Read [`_brainwave_handbook.md`](./_brainwave_handbook.md) for the lifecycle and terminology. Open `_dashboard.html` for the current visual state and live DNA catalogue.

## Add to a Project

Place this complete folder at `<project-root>/_brainwave/`, then run from the project root:

```text
node _brainwave/_engine/brainwave_runner.js integrate
```

The integration command:

- adds a managed `_brainwave` bridge to root `AGENTS.md` and `CLAUDE.md`
- merges the two Cursor hooks into root `.cursor/hooks.json`
- preserves existing project instructions and hooks
- is safe to run again without creating duplicates

It does not move files or modify `_brainwave` lifecycle state. Restart Cursor after the first integration so its root hook configuration reloads.

When this repository is opened directly with `_brainwave` as the workspace root, its included Cursor configuration already applies and integration is unnecessary.

## Begin with _brainwave

1. Share the idea and explicitly ask the agent to capture the immutable seed.
2. Type `build concept`.
3. Complete the three short profile choices.
4. Shape and explicitly agree the North Star.
5. Review the agent's recommended DNA modules.
6. Approve the proportionate documentation entries.
7. Let the engine scaffold them beneath `_documentation/_DNA-CODE/`.
8. Review the completed documentation before accepting `brainwave_documentation_complete`.

The engine never interprets the idea or chooses documentation. Those decisions remain conversational and require explicit user agreement.

## Commands

- `node _engine/brainwave_runner.js dna`
- `node _engine/brainwave_runner.js status`
- `node _engine/brainwave_runner.js refresh`
- `node _engine/brainwave_runner.js transition <stage>`
- `node _engine/brainwave_runner.js select-dna <_DNA-CODE...>`
- `node _engine/brainwave_runner.js express <_DNA-CODE-00000...>`
- `node _engine/brainwave_runner.js unexpress <_DNA-CODE-00000...>`
- `node _engine/brainwave_runner.js run`
- `node _engine/brainwave_runner.js watch`

Commands above are relative to the `_brainwave` folder. From a containing project root, prefix the runner path with `_brainwave/`.

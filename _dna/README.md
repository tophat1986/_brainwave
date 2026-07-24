# DNA Modules

This directory contains declarative catalogues of documentation _brainwave can recommend. A module describes one domain; it does not select itself, store project decisions, or execute code.

## Module Contract

Each `*.yaml` file is JSON-compatible YAML with:

- `schema_version` — compatibility with the _brainwave module contract
- `dna_id` — stable lowercase `snake_case` module identity
- `dna_code` — immutable four-letter uppercase code used in canonical identities
- `dna_version` — semantic version of the module's content
- `name` — human-readable module name
- `description` — domain purpose and boundaries
- `documentation_label` — name for the module's generated output
- `nodes` — possible documentation directories and files

Every node has a module-local five-digit `id`, `type`, module-relative `path`, `title`, `parent_id`, and `required` boolean. Document-group directories explain `when_relevant`; document files explain their `intent`.

Document-group directories use `00100_topic`. Module definitions use compact file paths such as `00100_topic/00101_snake_case.md`; generated documents become `_DNA-CODE-00101_snake_case.md`. A document's first three numeric digits identify its document group, allowing IDs `00101` through `00199`.

## Boundary

DNA definitions are reusable inputs and remain unchanged while a _brainwave is in progress. Selected module versions and expressed node IDs belong in `_brainwave_state.yaml`. Generated files belong beneath `_documentation/_DNA-CODE/`.

Local node IDs may repeat between modules because project references use canonical identities such as `_DNA-SAPP-00201`.

Modules are data only. Do not add scripts, prompt overrides, lifecycle rules, `expressed` flags, absolute paths, or paths that escape the module output directory.

When a selected module's installed `dna_version` changes, the engine pauses until the user explicitly reviews and reselects it. Reselection accepts the new version and clears its previous expressed entries so scope can be reviewed safely.

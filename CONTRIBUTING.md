# Contributing

_brainwave is intentionally small. Changes should preserve its central boundaries: the seed is immutable, semantic judgment belongs to the AI agent, deterministic validation belongs to the engine, and derived views never become a second source of truth.

Before proposing a change:

1. Read `_brainwave/_brainwave_handbook.md` and the nearest relevant README.
2. Keep public terminology and `_brainwave` branding consistent.
3. Avoid catalogues or README files that merely duplicate visible files.
4. Add or update focused tests.
5. Run `npm test` with Node.js 20 or newer.

DNA modules are data-only. Their source filename and canonical identity must use `_DNA-CODE.yaml`, where `CODE` is an immutable four-letter uppercase code.

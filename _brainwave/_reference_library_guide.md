# _brainwave Reference Library Guide

The Reference Library preserves material that may influence a project without making
that material accepted direction. Read this guide before creating or changing anything
under `_references/`.

## Authority Boundary

- The Seed preserves the user's approved concept.
- The North Star owns current direction.
- DNA blocks own accepted decisions and verifiable rules.
- Reference items remain contextual inputs unless a North Star statement or DNA block
  deliberately adopts an implication.

Never treat a polished design, factual claim, precedent, or board membership as approval
to copy it or change product direction.

## Privacy

Material saved under `_references/` belongs to the project repository and may be committed.
Before copying private, licensed, confidential, or personally identifying material, check
whether the repository and intended history are appropriate. Use a link-only record when
the material should not be copied. A `restricted` label is descriptive; it does not secure
or exclude a file from Git.

## Library Shape

- **Item:** one independently discoverable reference.
- **Collection:** material captured together, such as a design export or research run.
- **Board:** a curated view across items and collections.

Use these descriptor suffixes anywhere beneath `_references/`:

```text
*.reference.json
*.collection.json
*.board.json
```

Keep captured media, transcripts, and substantial Markdown notes beside their descriptor.
`_index.json` is generated and must not be edited manually.

## Capturing an Item

Every item requires `schema_version`, `id`, `kind`, `title`, `summary`, `why_saved`,
and at least one role supplied directly or by its collection. Add only optional fields that
make the material safer to find or interpret. A fuller image/design example is:

```json
{
  "schema_version": "1.0.0",
  "id": "ref-purchase-flow-screen",
  "kind": "image",
  "title": "Purchase flow screen",
  "summary": "A mobile screen presenting purchase options for a saved product.",
  "why_saved": "Potential interaction precedent for moving from intent to purchase.",
  "roles": ["precedent"],
  "design_status": "working",
  "collection": "collection-product-design-export",
  "representation": {
    "path": "purchase-flow-screen.png"
  },
  "source": {
    "provider": "figma",
    "url": "https://www.figma.com/...",
    "locator": "Page: Purchase flow; Frame: Purchase options",
    "captured_at": "YYYY-MM-DD"
  }
}
```

Use stable lowercase IDs beginning with `ref-`, `collection-`, or `board-`. IDs must not
change when files move.

Write descriptions for retrieval, not exhaustive visual transcription. Include the visible
words, capability, subject, or moment a future agent is likely to search for. Record what is
useful and, where ambiguity is likely, what must not be inferred.

For Figma and other multi-surface designs, identify the specific page, frame, node, screen,
or flow in `source.locator`; a project-level URL alone is insufficient. Apply the same rule
to webpages, recordings, presentations, and documents by identifying the relevant section
or timestamp when known.

## Fixed Values

`kind` is one of:

```text
image, webpage, design_file, document, research_note, quote, claim,
audio, video, dataset, other
```

`roles` may contain:

```text
inspiration, precedent, evidence, source, constraint, anti_reference,
working_material, current_project_material
```

Use free-form `tags` for domain language and likely search phrases. Providers such as Figma,
Dribbble, YouTube, or Spotify belong in `source.provider`, not `kind`.

For a design or design screenshot, optional `design_status` is one of `conceptual`,
`working`, `approved`, `final`, or `superseded`. This describes the referenced design;
the separate item `status` (`captured`, `working`, `curated`, or `archived`) describes its
library record. Do not infer approval from polish or from a source such as Figma.

Optional `sensitivity` is `normal` or `restricted`; optional `storage` is `tracked` or
`link_only`. These values describe handling but do not enforce repository access controls.

Optional item-to-item `links` use:

```text
related_to, derived_from, supports, informs, constrains, illustrates,
contradicts, verify_against
```

## Type-Specific Detail

Add only detail that improves later discovery or safe reuse:

- Images and designs: visible text, represented features, visual qualities, and exclusions.
- Audio and video: transcript path or a few searchable key moments with timestamps.
- Claims: exact claim, scope, applicable date, source URL or citation, and verification status.
- Quotes: exact wording in `quote`, attribution, original source URL or citation, and verification status.
- Research notes: question, scope, method, sources, findings, and limitations in adjacent Markdown.

A source-backed record saves repeated work; it does not remove the need to recheck a stale or
consequential claim before public use.

## Collections and Boards

A collection may provide inherited `source` and `defaults` for roles, tags, sensitivity, and
storage, plus `design_status` when a captured design set shares one maturity. Items point to
one collection through `collection`; do not duplicate an item list in the collection.

```json
{
  "schema_version": "1.0.0",
  "id": "collection-design-export",
  "title": "Design export",
  "summary": "Screens captured from one design file.",
  "source": { "provider": "figma", "url": "https://www.figma.com/..." },
  "defaults": { "roles": ["current_project_material"], "design_status": "working" }
}
```

A board lists members as IDs or as `{ "ref": "...", "note": "..." }`. Board membership means
the item is useful in that context, not that its contents are approved.

```json
{
  "schema_version": "1.0.0",
  "id": "board-checkout-direction",
  "title": "Checkout direction",
  "summary": "Material useful when shaping the checkout journey.",
  "members": ["collection-design-export", { "ref": "ref-market-evidence", "note": "Evidence only." }]
}
```

## DNA Links

When a reference materially supports or influences a DNA block, include the section
below; omit it when no saved reference informs the block. Use this exact format:

```markdown
#### Reference Basis

- `ref-market-evidence` — supports — Establishes the current scale of the problem.
- `ref-interaction-example` — informs — Interaction precedent; visual styling is excluded.
```

The relationship must use one of the fixed link values. Identify the relevant source
passage and its implication in the note, using the item's locator where sufficient.
Link only the references that matter to that block; do not attach an entire library by default.

During authoring, search existing metadata before starting new research. A search miss
is not proof of absence: broaden the terms or inspect relevant collections. Read the
shortlisted source passages, including the relevant sheet/range or transcript segment,
before relying on a summary. Reuse findings whose scope and freshness fit the decision;
research only the remaining material gap. Keep evidence, inference, assumptions, and
recommendations distinct. Capture material new findings as reference notes with source
locators and limitations, then link their use in the owning DNA block. Product Design
and Experience interprets design references; other evidence follows its owning domain.

## Agent Workflow

1. Capture or link only material the user intends to preserve.
2. Create the smallest useful descriptor, with a searchable summary and `why_saved`.
3. Run `references-validate`, then `references-index`.
4. Use `references-find` and `references-context` to shortlist material before opening media.
5. Add boards or DNA links only when their relationship is understood.

```text
node _brainwave/_engine/brainwave_runner.js references-validate
node _brainwave/_engine/brainwave_runner.js references-index
node _brainwave/_engine/brainwave_runner.js references-find <query> [--limit <count>] [--offset <count>]
node _brainwave/_engine/brainwave_runner.js references-context <item|collection|board-id> [--offset <count>]
node _brainwave/_engine/brainwave_runner.js references-board <board-id> [--offset <count>]
```

Retrieval returns previews capped at 32 KiB of pretty-printed JSON. Long descriptions are
shortened with explicit `preview` notices; locators remain exact or are explicitly omitted.
Read `source_file` for the complete record before relying on a shortened claim or quote.
Collection and board children, and search results, report totals and `pagination.next_offset`;
repeat the same command with `--offset <next_offset>` until it is `null`. Page sizes may shrink
to fit the byte limit. Other omitted relations report counts; inspect `_references/_index.json`
(regenerate with `references-index` if needed) for those links, then request the relevant IDs.
An oversized record falls back to recovery fields and an explicit notice. Retrieval never
changes the stored reference material.

`omitted` counts everything outside the current packet, including earlier pages. For paged
results, `offset` identifies the skipped entries and `total - offset - returned` gives the
remaining entries (zero when the offset is beyond the end).

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  REFERENCE_CONTEXT_MAX_BYTES,
  referenceContext,
  searchReferenceLibrary
} = require("./reference_library");

function item(number, extra = {}) {
  const id = `ref-example-${String(number).padStart(3, "0")}`;
  return {
    id, type: "item", kind: "research_note", title: `Example ${number}`,
    summary: "Small searchable reference.", why_saved: "A bounded retrieval fixture.",
    roles: ["evidence"], tags: [], links: [],
    source_file: `_references/${id}.reference.json`,
    source: { url: "https://example.com/research", locator: "Findings, section 3", citation: "Fixture source" },
    representation: { path: `_references/${id}.md`, transcript_path: `_references/${id}.txt`, sha256: "a".repeat(64) },
    ...extra
  };
}

function library(items = [], collections = [], boards = []) {
  return { items, collections, boards };
}

function assertBounded(value) {
  const bytes = Buffer.byteLength(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  assert.ok(bytes <= REFERENCE_CONTEXT_MAX_BYTES, `${bytes} exceeds the pretty JSON byte ceiling`);
}

test("small reference packets preserve fields, exact locators, relationships, and search array API", () => {
  const saved = item(1, { quote: "Exact short quotation.", dna_links: [{ block_id: "_DNA-SAPP-00201.01", relationship: "supports", note: "Short note." }] });
  const index = library([saved]);
  const before = JSON.stringify(index);
  const packet = referenceContext(index, saved.id);
  assert.equal(packet.target.quote, saved.quote);
  assert.deepEqual(packet.target.source, saved.source);
  assert.deepEqual(packet.target.representation, saved.representation);
  assert.deepEqual(packet.dna_links, saved.dna_links);
  assert.equal(packet.target.preview, undefined);
  assert.equal(packet.pagination.next_offset, null);
  assert.equal(referenceContext(index, "ref-missing"), null);
  const results = searchReferenceLibrary(index, "searchable");
  assert.ok(Array.isArray(results));
  assert.equal(results[0].summary, saved.summary);
  assert.equal(results[0].source_file, saved.source_file);
  assert.deepEqual(results.page, { offset: 0, total: 1, returned: 1, next_offset: null, omitted: 0, max_json_bytes: REFERENCE_CONTEXT_MAX_BYTES, recovery: packet.recovery });
  assert.equal(JSON.stringify(index), before);
  assertBounded(packet);
});

test("100K descriptions are explicit previews while IDs, source locators, and representation paths stay exact", () => {
  const saved = item(1, {
    summary: `${"x".repeat(100000)} late-search-term`, quote: "claim ".repeat(20000),
    source: { url: "https://docs.google.com/spreadsheets/d/example", locator: "'Research findings'!B12:F27" }
  });
  const index = library([saved]);
  const before = JSON.stringify(index);
  const packet = referenceContext(index, saved.id);
  assertBounded(packet);
  assert.equal(packet.target.id, saved.id);
  assert.deepEqual(packet.target.source, saved.source);
  assert.deepEqual(packet.target.representation, saved.representation);
  assert.equal(packet.target.source_file, saved.source_file);
  for (const field of ["summary", "quote"]) {
    assert.ok(packet.target[field].length <= 601);
    assert.ok(packet.target.preview.changes.some((change) => change.field === field && change.total === saved[field].length));
  }
  const results = searchReferenceLibrary(index, "late-search-term");
  assert.equal(results[0].id, saved.id);
  assert.equal(results[0].preview.truncated, true);
  assertBounded(results);
  assert.equal(JSON.stringify(index), before);
});

test("collection and board children past item 50 are reachable through bounded continuation", () => {
  const collection = { id: "collection-examples", type: "collection", title: "Examples", summary: "Captured together.", source_file: "_references/examples.collection.json" };
  const items = Array.from({ length: 121 }, (_, n) => item(n, { collection: collection.id, summary: "🧭\n".repeat(50000) }));
  const board = { id: "board-examples", type: "board", title: "Examples board", summary: "A curated set.", source_file: "_references/examples.board.json", members: items.map((entry) => ({ ref: entry.id })) };
  const index = library(items, [collection], [board]);
  for (const target of [collection, board]) {
    const ids = [];
    let offset = 0;
    do {
      const packet = referenceContext(index, target.id, { offset });
      assertBounded(packet);
      assert.equal(packet.totals.contained, items.length);
      assert.equal(packet.pagination.offset, offset);
      assert.equal(packet.omitted.contained, items.length - packet.contained.length);
      assert.ok(packet.contained.length > 0);
      for (const child of packet.contained) {
        const original = items.find((entry) => entry.id === child.id);
        assert.equal(child.source.locator, original.source.locator);
        assert.equal(child.representation.path, original.representation.path);
        assert.equal(child.source_file, original.source_file);
        ids.push(child.id);
      }
      const next = packet.pagination.next_offset;
      assert.ok(next === null || next > offset);
      offset = next;
    } while (offset !== null);
    assert.deepEqual(ids, items.map((entry) => entry.id));
    assert.equal(referenceContext(index, target.id, { offset: 50 }).contained[0].id, items[50].id);
    assert.deepEqual(referenceContext(index, target.id, { offset: 999 }).contained, []);
  }
});

test("non-paginated lists expose totals, omissions, and recovery paths", () => {
  const linked = Array.from({ length: 70 }, (_, n) => item(n + 1));
  const saved = item(0, { links: linked.map((entry) => ({ ref: entry.id, relationship: "related_to" })), dna_links: Array.from({ length: 70 }, (_, n) => ({ block_id: `_DNA-SAPP-00201.${n}`, note: "x".repeat(10000) })) });
  const boards = Array.from({ length: 15 }, (_, n) => ({ id: `board-${n}`, type: "board", title: `Board ${n}`, source_file: `_references/${n}.board.json`, members: [{ ref: saved.id }] }));
  const packet = referenceContext(library([saved, ...linked], [], boards), saved.id);
  assertBounded(packet);
  for (const [field, total] of [["boards", 15], ["related", 70], ["dna_links", 70]]) {
    assert.equal(packet.totals[field], total);
    assert.equal(packet.omitted[field], total - packet[field].length);
    assert.ok(packet.omitted[field] > 0);
  }
  assert.ok(packet.target.preview.changes.some((change) => change.field === "links" && change.total === 70));
  assert.match(packet.recovery, /_references\/_index\.json/);
});

test("oversized nested metadata and locators are omitted explicitly with recovery instead of partial locators", () => {
  const saved = item(1, { source: { url: `https://example.com/${"x".repeat(100000)}` }, representation: { path: "y".repeat(100000) }, extra: { nested: "z".repeat(100000) } });
  const packet = referenceContext(library([saved]), saved.id);
  assertBounded(packet);
  assert.equal(packet.target.id, saved.id);
  assert.equal(packet.target.source_file, saved.source_file);
  for (const field of ["source", "representation", "extra"]) {
    assert.equal(packet.target[field], null);
    assert.ok(packet.target.preview.changes.some((change) => change.field === field && change.reason === "field_byte_limit"));
  }
  const enormous = item(2, Object.fromEntries(Array.from({ length: 200 }, (_, n) => [`metadata_${n}`, "x".repeat(600)])));
  const fallback = referenceContext(library([enormous]), enormous.id);
  assertBounded(fallback);
  assert.equal(fallback.target.id, enormous.id);
  assert.equal(fallback.target.source_file, enormous.source_file);
  assert.match(fallback.target.preview.notice, /only recovery fields/);
});

test("search pages are bounded, retain recovery IDs, and reach all matches", () => {
  const items = Array.from({ length: 75 }, (_, n) => item(n, { summary: `searchable ${"\u0000".repeat(100000)}` }));
  const index = library(items);
  const ids = [];
  let offset = 0;
  do {
    const results = searchReferenceLibrary(index, "searchable", { limit: 50, offset });
    assertBounded(results);
    assert.equal(results.page.total, items.length);
    assert.ok(results.length > 0);
    ids.push(...results.map((entry) => entry.id));
    offset = results.page.next_offset;
  } while (offset !== null);
  assert.equal(new Set(ids).size, items.length);
  for (const offset of [-1, 0.5, NaN, Infinity]) {
    assert.throws(() => referenceContext(index, items[0].id, { offset }), /offset/);
    assert.throws(() => searchReferenceLibrary(index, "searchable", { offset }), /offset/);
  }
});

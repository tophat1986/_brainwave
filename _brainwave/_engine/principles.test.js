"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parsePrinciples, readPrinciples, assertPrinciplesReady, formatPrinciples } = require("./principles");

function document(texts) {
  return `# Principles\n\n${texts.map((text) => `- ${text}\n  Source: _my_brainwave_seed.md#intent`).join("\n\n")}\n`;
}

test("distinguishes an initial review with no principles from an unreviewed file", () => {
  assert.equal(parsePrinciples("").status, "not_started");
  assert.throws(() => assertPrinciplesReady(parsePrinciples("")), /Before authoring DNA/);
  const empty = parsePrinciples("# Principles\n");
  assert.doesNotThrow(() => assertPrinciplesReady(empty));
  assert.equal(empty.sha256, null);
  assert.deepEqual(empty.entries, []);
  assert.equal(formatPrinciples([]), "");
});

test("accepts ten short principles but rejects the eleventh with a corrective instruction", () => {
  const texts = Array.from({ length: 10 }, (_, index) => `Distinct project priority ${index + 1}.`);
  assert.equal(parsePrinciples(document(texts)).entries.length, 10);
  assert.throws(() => parsePrinciples(document([...texts, "An additional priority."])), /Principle 11.*maximum of 10.*replace a weaker entry/);
});

test("enforces the character boundary including Unicode without truncating meaning", () => {
  assert.equal(parsePrinciples(document(["x".repeat(160)])).entries[0].text.length, 160);
  assert.equal([...parsePrinciples(document(["🧭".repeat(160)])).entries[0].text].length, 160);
  assert.throws(() => parsePrinciples(document(["x".repeat(161)])), /161 characters.*maximum is 160.*do not split/);
  assert.throws(() => parsePrinciples(document(["x\u2028hidden continuation"])), /one non-empty plain-text line/);
  assert.throws(() => parsePrinciples(document([" padded "])), /without padding/);
});

test("rejects extra prose, draft headings, duplicates and missing provenance", () => {
  assert.throws(() => parsePrinciples("# Principles\n\nA summary of the whole project."), /Move paragraphs/);
  assert.throws(() => parsePrinciples("# Principles\n## Candidates"), /Move paragraphs/);
  assert.throws(() => parsePrinciples(document(["One priority.", "one priority."])), /duplicates/);
  assert.throws(() => parsePrinciples("# Principles\n- One priority.\n  A longer explanation."), /Move paragraphs/);
  assert.throws(() => parsePrinciples("# Principles\n- One priority."), /needs a Source locator/);
  assert.throws(() => parsePrinciples(document(["One priority."]) + "  Source: _my_brainwave_seed.md#other"), /exactly one Source/);
  assert.throws(() => parsePrinciples("# Principles\n" + " ".repeat(8192)), /exceeds 8192 bytes/);
});

test("accepts only bounded project-owned source locators", () => {
  for (const source of ["https://example.com#rules", "../AGENTS.md#rules", "_documentation/_DNA-SAPP/../../private.md#rules", "_my_brainwave_seed.md", `_my_brainwave_seed.md#${"x".repeat(240)}`]) {
    assert.throws(() => parsePrinciples(document(["One priority."]).replace("_my_brainwave_seed.md#intent", source)), /needs a Source/);
  }
});

test("source and accepted wording affect freshness while line endings and spacing do not", () => {
  const markdown = document(["One priority."]);
  const original = parsePrinciples(markdown);
  assert.equal(original.sha256, parsePrinciples(markdown.replace(/\n/g, "\r\n")).sha256);
  assert.equal(original.sha256, parsePrinciples(markdown + "\n").sha256);
  assert.notEqual(original.sha256, parsePrinciples(markdown.replace("One priority.", "A refined priority.")).sha256);
  assert.notEqual(original.sha256, parsePrinciples(markdown.replace("#intent", "#decision")).sha256);
  assert.doesNotMatch(formatPrinciples(original.entries.map((entry) => entry.text)), /Source:|seed\.md/);
});

test("checks source availability without creating or rewriting a principles file", (t) => {
  const tempBase = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempBase, "brainwave-principles-"));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(`${tempBase}${path.sep}`));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  assert.equal(readPrinciples(root).status, "not_started");
  assert.equal(fs.existsSync(path.join(root, "_principles.md")), false);
  const markdown = document(["One priority."]);
  fs.writeFileSync(path.join(root, "_principles.md"), markdown);
  assert.throws(() => readPrinciples(root), /unavailable project source/);
  fs.writeFileSync(path.join(root, "_my_brainwave_seed.md"), "# Intent\nProject intent.");
  assert.equal(readPrinciples(root).entries.length, 1);
  assert.equal(fs.readFileSync(path.join(root, "_principles.md"), "utf8"), markdown);
});

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PRINCIPLES_PATH = "_principles.md";
const PRINCIPLE_LIMITS = Object.freeze({ count: 10, characters: 160, source_characters: 240, file_bytes: 8192 });
const INITIAL_PRINCIPLES_INSTRUCTION = "Before authoring DNA, read _brainwave_handbook.md#principles and derive the smallest supported set from accepted intent. Create _principles.md; # Principles alone records that none earned a place.";

function failure(message) {
  throw new Error(`Principles validation failed: ${message}`);
}

function parsePrinciples(content) {
  const result = { path: PRINCIPLES_PATH, status: "not_started", entries: [], sha256: null };
  if (Buffer.byteLength(content, "utf8") > PRINCIPLE_LIMITS.file_bytes) {
    failure(`_principles.md exceeds ${PRINCIPLE_LIMITS.file_bytes} bytes. Remove commentary and retain only the short principles and their source locators.`);
  }
  if (!content.trim()) return result;
  const lines = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").split("\n");
  let headingSeen = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (!headingSeen) {
      if (line !== "# Principles") failure("Begin _principles.md with # Principles; keep explanation in the owning DNA or open questions.");
      headingSeen = true;
      continue;
    }
    if (line.startsWith("- ")) {
      const text = line.slice(2).normalize("NFC");
      const number = result.entries.length + 1;
      if (number > PRINCIPLE_LIMITS.count) {
        failure("Principle 11 exceeds the maximum of 10. Compare the new entry with the existing set: merge genuine overlap, replace a weaker entry, or leave the detail in DNA. Do not remove an unrelated principle merely to pass.");
      }
      const length = [...text].length;
      if (length > PRINCIPLE_LIMITS.characters) {
        failure(`Principle ${number} contains ${length} characters; the maximum is ${PRINCIPLE_LIMITS.characters}. Rewrite this entry to preserve its essential intent. Remove explanation and procedures; do not split it into extra principles to bypass the cap.`);
      }
      if (!text.trim() || text !== text.trim() || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(text)) {
        failure(`Principle ${number} must be one non-empty plain-text line without padding or control characters.`);
      }
      if (result.entries.some((entry) => entry.text.toLowerCase() === text.toLowerCase())) {
        failure(`Principle ${number} duplicates an existing entry. Keep the intent once.`);
      }
      result.entries.push({ text, source: null });
    } else if (line.startsWith("  Source: ")) {
      const entry = result.entries.at(-1);
      const source = line.slice(10);
      if (!entry || entry.source) failure(`Line ${index + 1}: each principle needs exactly one Source locator.`);
      const [file, anchor, ...extra] = source.split("#");
      if (
        [...source].length > PRINCIPLE_LIMITS.source_characters || source !== source.trim() ||
        /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(source) || !anchor?.trim() || extra.length ||
        !/^(?:_my_brainwave_(?:seed|north_star)\.md|_documentation\/_DNA-[A-Z]{4}\/[^#]+\.md)$/.test(file) ||
        file.includes("\\") || file.split("/").some((part) => [".", "..", ""].includes(part))
      ) {
        failure(`Principle ${result.entries.length} needs a Source: relative-file.md#locator within the Seed, North Star or owning DNA, at most ${PRINCIPLE_LIMITS.source_characters} characters. Keep rationale out of this file.`);
      }
      entry.source = source;
    } else {
      failure(`Line ${index + 1}: use one '- short principle' line followed by '  Source: relative-file.md#locator'. Move paragraphs, examples, drafts and procedures out of _principles.md.`);
    }
  }
  for (let index = 0; index < result.entries.length; index += 1) {
    if (!result.entries[index].source) failure(`Principle ${index + 1} needs a Source locator grounded in accepted project intent.`);
  }
  result.status = "ready";
  // Empty reviewed sets preserve compatibility with plans created before principles existed.
  result.sha256 = result.entries.length
    ? crypto.createHash("sha256").update(JSON.stringify(result.entries)).digest("hex")
    : null;
  return result;
}

function readPrinciples(root) {
  const target = path.join(root, PRINCIPLES_PATH);
  if (!fs.existsSync(target)) return parsePrinciples("");
  if (fs.statSync(target).size > PRINCIPLE_LIMITS.file_bytes) failure(`_principles.md exceeds ${PRINCIPLE_LIMITS.file_bytes} bytes. Keep only short principles and source locators.`);
  const result = parsePrinciples(fs.readFileSync(target, "utf8"));
  const realRoot = fs.realpathSync(root);
  for (let index = 0; index < result.entries.length; index += 1) {
    const file = result.entries[index].source.split("#")[0];
    const sourcePath = path.join(root, file);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile() ||
        !fs.realpathSync(sourcePath).startsWith(`${realRoot}${path.sep}`)) {
      failure(`Principle ${index + 1} has an unavailable project source. Correct its Source locator before continuing.`);
    }
  }
  return result;
}

function assertPrinciplesReady(principles) {
  if (principles.status !== "ready") failure(INITIAL_PRINCIPLES_INSTRUCTION);
}

function formatPrinciples(texts = []) {
  return texts.length ? `Project principles (apply where relevant):\n${texts.map((text) => `- ${text}`).join("\n")}` : "";
}

module.exports = {
  PRINCIPLES_PATH, PRINCIPLE_LIMITS, INITIAL_PRINCIPLES_INSTRUCTION,
  parsePrinciples, readPrinciples, assertPrinciplesReady, formatPrinciples
};

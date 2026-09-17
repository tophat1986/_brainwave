"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REFERENCE_SCHEMA_VERSION = "1.0.0";
const REFERENCE_KINDS = Object.freeze([
  "image",
  "webpage",
  "design_file",
  "document",
  "research_note",
  "quote",
  "claim",
  "audio",
  "video",
  "dataset",
  "other"
]);
const REFERENCE_ROLES = Object.freeze([
  "inspiration",
  "precedent",
  "evidence",
  "source",
  "constraint",
  "anti_reference",
  "working_material",
  "current_project_material"
]);
const REFERENCE_STATUSES = Object.freeze(["captured", "working", "curated", "archived"]);
const REFERENCE_SENSITIVITIES = Object.freeze(["normal", "restricted"]);
const REFERENCE_STORAGE_MODES = Object.freeze(["tracked", "link_only"]);
const REFERENCE_DESIGN_STATUSES = Object.freeze([
  "conceptual",
  "working",
  "approved",
  "final",
  "superseded"
]);
const REFERENCE_RELATIONSHIPS = Object.freeze([
  "related_to",
  "derived_from",
  "supports",
  "informs",
  "constrains",
  "illustrates",
  "contradicts",
  "verify_against"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function slash(value) {
  return String(value || "").replace(/\\/g, "/");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function unique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validIdentity(value, prefix) {
  return new RegExp(`^${prefix}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(String(value || ""));
}

function descriptorType(fileName) {
  if (fileName.endsWith(".reference.json")) return "item";
  if (fileName.endsWith(".collection.json")) return "collection";
  if (fileName.endsWith(".board.json")) return "board";
  return null;
}

function descriptorFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && descriptorType(entry.name)) files.push(target);
    }
  };
  visit(root);
  return files.sort((left, right) => slash(left).localeCompare(slash(right)));
}

function stringField(record, field, sourceFile, errors) {
  const value = optionalString(record[field]);
  if (!value) errors.push(`${sourceFile} must define a non-empty \`${field}\`.`);
  return value;
}

function stringList(value, label, sourceFile, errors, allowed = null) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${sourceFile} \`${label}\` must be an array.`);
    return [];
  }
  const result = [];
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      errors.push(`${sourceFile} \`${label}\` must contain non-empty strings.`);
      continue;
    }
    const normalized = entry.trim();
    if (allowed && !allowed.includes(normalized)) {
      errors.push(`${sourceFile} \`${label}\` contains unsupported value \`${normalized}\`.`);
      continue;
    }
    result.push(normalized);
  }
  return unique(result);
}

function enumField(value, label, sourceFile, errors, allowed, fallback) {
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) {
    errors.push(`${sourceFile} \`${label}\` must be one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return value;
}

function normalizeSource(value, sourceFile, errors) {
  if (value === undefined) return null;
  if (!isObject(value)) {
    errors.push(`${sourceFile} \`source\` must be an object.`);
    return null;
  }
  const source = { ...value };
  if (source.url !== undefined) {
    try {
      const parsed = new URL(source.url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
      source.url = parsed.toString();
    } catch (_) {
      errors.push(`${sourceFile} \`source.url\` must be an HTTP or HTTPS URL.`);
      delete source.url;
    }
  }
  for (const key of ["provider", "locator", "citation", "published_at", "retrieved_at", "captured_at"]) {
    if (source[key] !== undefined && !optionalString(source[key])) {
      errors.push(`${sourceFile} \`source.${key}\` must be a non-empty string.`);
      delete source[key];
    }
  }
  return source;
}

function resolveRepresentation(value, descriptorPath, frameworkRoot, referencesRoot, sourceFile, errors) {
  if (value === undefined) return null;
  if (!isObject(value)) {
    errors.push(`${sourceFile} \`representation\` must be an object.`);
    return null;
  }
  const representation = { ...value };
  for (const key of ["path", "thumbnail", "transcript_path"]) {
    if (representation[key] === undefined) continue;
    const supplied = optionalString(representation[key]);
    if (!supplied || supplied.includes("\\") || path.isAbsolute(supplied)) {
      errors.push(`${sourceFile} \`representation.${key}\` must be a safe relative path.`);
      delete representation[key];
      continue;
    }
    const absolute = path.resolve(path.dirname(descriptorPath), supplied);
    const rootPrefix = `${path.resolve(referencesRoot)}${path.sep}`;
    if (!absolute.startsWith(rootPrefix)) {
      errors.push(`${sourceFile} \`representation.${key}\` must remain inside \`_references/\`.`);
      delete representation[key];
      continue;
    }
    const relative = slash(path.relative(frameworkRoot, absolute));
    const exists = fs.existsSync(absolute) && fs.statSync(absolute).isFile();
    representation[key] = relative;
    representation[`${key}_exists`] = exists;
    if (!exists) errors.push(`${sourceFile} points to missing file \`${relative}\`.`);
    else if (key === "path") representation.sha256 = sha256(fs.readFileSync(absolute));
  }
  return representation;
}

function normalizeLinks(value, sourceFile, errors) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${sourceFile} \`links\` must be an array.`);
    return [];
  }
  return value.map((entry, index) => {
    if (!isObject(entry)) {
      errors.push(`${sourceFile} \`links[${index}]\` must be an object.`);
      return null;
    }
    const ref = optionalString(entry.ref);
    const relationship = optionalString(entry.relationship);
    if (!ref) errors.push(`${sourceFile} \`links[${index}].ref\` is required.`);
    if (!REFERENCE_RELATIONSHIPS.includes(relationship)) {
      errors.push(`${sourceFile} \`links[${index}].relationship\` is unsupported.`);
    }
    return ref && REFERENCE_RELATIONSHIPS.includes(relationship)
      ? { ref, relationship, note: optionalString(entry.note) }
      : null;
  }).filter(Boolean);
}

function normalizeCollection(record, descriptorPath, frameworkRoot, referencesRoot, errors) {
  const sourceFile = slash(path.relative(frameworkRoot, descriptorPath));
  const id = stringField(record, "id", sourceFile, errors);
  if (id && !validIdentity(id, "collection")) {
    errors.push(`${sourceFile} \`id\` must use \`collection-lowercase-slug\`.`);
  }
  const defaults = isObject(record.defaults) ? record.defaults : {};
  if (record.defaults !== undefined && !isObject(record.defaults)) {
    errors.push(`${sourceFile} \`defaults\` must be an object.`);
  }
  return {
    ...record,
    schema_version: record.schema_version,
    id,
    title: stringField(record, "title", sourceFile, errors),
    summary: stringField(record, "summary", sourceFile, errors),
    status: enumField(record.status, "status", sourceFile, errors, REFERENCE_STATUSES, "working"),
    sensitivity: enumField(
      record.sensitivity,
      "sensitivity",
      sourceFile,
      errors,
      REFERENCE_SENSITIVITIES,
      "normal"
    ),
    source: normalizeSource(record.source, sourceFile, errors),
    defaults: {
      ...defaults,
      roles: stringList(defaults.roles, "defaults.roles", sourceFile, errors, REFERENCE_ROLES),
      tags: stringList(defaults.tags, "defaults.tags", sourceFile, errors),
      sensitivity: enumField(
        defaults.sensitivity,
        "defaults.sensitivity",
        sourceFile,
        errors,
        REFERENCE_SENSITIVITIES,
        null
      ),
      storage: enumField(
        defaults.storage,
        "defaults.storage",
        sourceFile,
        errors,
        REFERENCE_STORAGE_MODES,
        null
      ),
      design_status: enumField(
        defaults.design_status,
        "defaults.design_status",
        sourceFile,
        errors,
        REFERENCE_DESIGN_STATUSES,
        null
      )
    },
    representation: resolveRepresentation(
      record.representation,
      descriptorPath,
      frameworkRoot,
      referencesRoot,
      sourceFile,
      errors
    ),
    descriptor_sha256: sha256(fs.readFileSync(descriptorPath)),
    source_file: sourceFile,
    type: "collection"
  };
}

function normalizeItem(record, descriptorPath, frameworkRoot, referencesRoot, collectionById, errors, warnings) {
  const sourceFile = slash(path.relative(frameworkRoot, descriptorPath));
  const id = stringField(record, "id", sourceFile, errors);
  if (id && !validIdentity(id, "ref")) {
    errors.push(`${sourceFile} \`id\` must use \`ref-lowercase-slug\`.`);
  }
  const kind = optionalString(record.kind);
  if (!REFERENCE_KINDS.includes(kind)) {
    errors.push(`${sourceFile} \`kind\` must be one of: ${REFERENCE_KINDS.join(", ")}.`);
  }
  const collectionId = optionalString(record.collection);
  const collection = collectionId ? collectionById.get(collectionId) : null;
  if (collectionId && !collection) errors.push(`${sourceFile} references unknown collection \`${collectionId}\`.`);
  const inherited = collection?.defaults || {};
  const roles = unique([
    ...(inherited.roles || []),
    ...stringList(record.roles, "roles", sourceFile, errors, REFERENCE_ROLES)
  ]);
  if (roles.length === 0) errors.push(`${sourceFile} must define at least one reference role directly or through its collection.`);
  const tags = unique([
    ...(inherited.tags || []),
    ...stringList(record.tags, "tags", sourceFile, errors)
  ]);
  const representation = resolveRepresentation(
    record.representation,
    descriptorPath,
    frameworkRoot,
    referencesRoot,
    sourceFile,
    errors
  );
  const source = {
    ...(collection?.source || {}),
    ...(normalizeSource(record.source, sourceFile, errors) || {})
  };
  const storage = enumField(
    record.storage,
    "storage",
    sourceFile,
    errors,
    REFERENCE_STORAGE_MODES,
    inherited.storage || (representation?.path ? "tracked" : "link_only")
  );
  const designStatus = enumField(
    record.design_status,
    "design_status",
    sourceFile,
    errors,
    REFERENCE_DESIGN_STATUSES,
    inherited.design_status || null
  );
  const item = {
    ...record,
    schema_version: record.schema_version,
    id,
    title: stringField(record, "title", sourceFile, errors),
    kind,
    summary: stringField(record, "summary", sourceFile, errors),
    why_saved: stringField(record, "why_saved", sourceFile, errors),
    roles,
    tags,
    status: enumField(record.status, "status", sourceFile, errors, REFERENCE_STATUSES, "working"),
    sensitivity: enumField(
      record.sensitivity,
      "sensitivity",
      sourceFile,
      errors,
      REFERENCE_SENSITIVITIES,
      inherited.sensitivity || collection?.sensitivity || "normal"
    ),
    storage,
    design_status: designStatus,
    collection: collectionId,
    source: Object.keys(source).length ? source : null,
    representation,
    links: normalizeLinks(record.links, sourceFile, errors),
    descriptor_sha256: sha256(fs.readFileSync(descriptorPath)),
    source_file: sourceFile,
    type: "item",
    legacy: false
  };

  if (["image", "webpage", "audio", "video", "design_file", "document", "dataset", "research_note"].includes(kind) && !representation?.path && !source.url) {
    warnings.push(`${sourceFile} has no local representation or source URL.`);
  }
  if (kind === "claim") {
    for (const field of ["claim", "scope", "as_of", "verification_status"]) {
      if (!optionalString(record[field])) warnings.push(`${sourceFile} claim would be more reusable with \`${field}\`.`);
    }
    if (!source.url && !optionalString(source.citation)) {
      warnings.push(`${sourceFile} claim has no source URL or citation.`);
    }
  }
  if (kind === "quote") {
    if (!optionalString(record.quote)) warnings.push(`${sourceFile} quote has no exact \`quote\` text.`);
    if (!optionalString(record.attribution)) warnings.push(`${sourceFile} quote has no attribution.`);
    if (!source.url && !optionalString(source.citation)) {
      warnings.push(`${sourceFile} quote has no source URL or citation.`);
    }
  }
  if (["audio", "video"].includes(kind) && !representation?.transcript_path && !Array.isArray(record.key_moments)) {
    warnings.push(`${sourceFile} would be easier to retrieve with a transcript or key moments.`);
  }
  if (String(source.provider || "").toLowerCase() === "figma" && !optionalString(source.locator)) {
    warnings.push(`${sourceFile} Figma source should identify the relevant page, frame, or node.`);
  }
  if (item.sensitivity === "restricted" && item.storage === "tracked") {
    warnings.push(`${sourceFile} is marked restricted but its material is stored in the repository.`);
  }
  return item;
}

function normalizeBoard(record, descriptorPath, frameworkRoot, errors) {
  const sourceFile = slash(path.relative(frameworkRoot, descriptorPath));
  const id = stringField(record, "id", sourceFile, errors);
  if (id && !validIdentity(id, "board")) {
    errors.push(`${sourceFile} \`id\` must use \`board-lowercase-slug\`.`);
  }
  const members = Array.isArray(record.members) ? record.members.map((member, index) => {
    if (typeof member === "string" && member.trim()) return { ref: member.trim(), note: null };
    if (isObject(member) && optionalString(member.ref)) {
      return { ref: member.ref.trim(), note: optionalString(member.note) };
    }
    errors.push(`${sourceFile} \`members[${index}]\` must be an ID or an object with \`ref\`.`);
    return null;
  }).filter(Boolean) : [];
  if (record.members !== undefined && !Array.isArray(record.members)) {
    errors.push(`${sourceFile} \`members\` must be an array.`);
  }
  return {
    ...record,
    schema_version: record.schema_version,
    id,
    title: stringField(record, "title", sourceFile, errors),
    summary: stringField(record, "summary", sourceFile, errors),
    status: enumField(record.status, "status", sourceFile, errors, REFERENCE_STATUSES, "working"),
    members,
    descriptor_sha256: sha256(fs.readFileSync(descriptorPath)),
    source_file: sourceFile,
    type: "board"
  };
}

function validateSchema(record, sourceFile, errors) {
  if (!isObject(record)) {
    errors.push(`${sourceFile} must contain a JSON object.`);
    return false;
  }
  if (record.schema_version !== REFERENCE_SCHEMA_VERSION) {
    errors.push(`${sourceFile} uses unsupported schema_version ${record.schema_version || "missing"}; expected ${REFERENCE_SCHEMA_VERSION}.`);
  }
  return true;
}

function scanReferenceLibrary(frameworkRoot, options = {}) {
  const referencesRoot = path.join(frameworkRoot, "_references");
  const errors = [];
  const warnings = [];
  const parsed = { item: [], collection: [], board: [] };

  for (const descriptorPath of descriptorFiles(referencesRoot)) {
    const sourceFile = slash(path.relative(frameworkRoot, descriptorPath));
    let record;
    try {
      record = JSON.parse(fs.readFileSync(descriptorPath, "utf8"));
    } catch (error) {
      errors.push(`${sourceFile} must contain valid JSON. ${error.message}`);
      continue;
    }
    if (!validateSchema(record, sourceFile, errors)) continue;
    parsed[descriptorType(descriptorPath)].push({ record, descriptorPath });
  }

  const collections = parsed.collection.map(({ record, descriptorPath }) =>
    normalizeCollection(record, descriptorPath, frameworkRoot, referencesRoot, errors)
  );
  const collectionById = new Map(collections.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const items = parsed.item.map(({ record, descriptorPath }) =>
    normalizeItem(record, descriptorPath, frameworkRoot, referencesRoot, collectionById, errors, warnings)
  );
  const boards = parsed.board.map(({ record, descriptorPath }) =>
    normalizeBoard(record, descriptorPath, frameworkRoot, errors)
  );

  const allRecords = [...collections, ...items, ...boards];
  const nodeById = new Map();
  for (const record of allRecords) {
    if (!record.id) continue;
    if (nodeById.has(record.id)) {
      errors.push(`${record.source_file} duplicates reference identity \`${record.id}\`.`);
    } else nodeById.set(record.id, record);
  }
  for (const legacyItem of options.legacyItems || []) {
    if (!legacyItem?.id || nodeById.has(legacyItem.id)) continue;
    const normalized = { ...legacyItem, type: "item", legacy: true };
    items.push(normalized);
    nodeById.set(normalized.id, normalized);
  }
  for (const item of items) {
    for (const link of item.links || []) {
      if (!nodeById.has(link.ref)) errors.push(`${item.source_file} links to unknown reference \`${link.ref}\`.`);
      if (link.ref === item.id) errors.push(`${item.source_file} cannot link \`${item.id}\` to itself.`);
    }
  }
  for (const board of boards) {
    for (const member of board.members) {
      if (!nodeById.has(member.ref)) errors.push(`${board.source_file} contains unknown member \`${member.ref}\`.`);
      else if (nodeById.get(member.ref).type === "board") errors.push(`${board.source_file} cannot contain another board.`);
    }
  }

  items.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  collections.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  boards.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const kinds = Object.fromEntries(REFERENCE_KINDS.map((kind) => [kind, 0]));
  for (const item of items) if (Object.hasOwn(kinds, item.kind)) kinds[item.kind] += 1;

  return {
    schema_version: REFERENCE_SCHEMA_VERSION,
    generated_at: options.generatedAt || new Date().toISOString(),
    path: "_references",
    guide_path: "_reference_library_guide.md",
    exists: fs.existsSync(referencesRoot),
    enums: {
      kinds: [...REFERENCE_KINDS],
      roles: [...REFERENCE_ROLES],
      design_statuses: [...REFERENCE_DESIGN_STATUSES],
      relationships: [...REFERENCE_RELATIONSHIPS]
    },
    totals: {
      items: items.length,
      collections: collections.length,
      boards: boards.length,
      restricted: items.filter((item) => item.sensitivity === "restricted").length,
      legacy_items: items.filter((item) => item.legacy).length
    },
    kinds,
    collections,
    boards,
    items,
    validation: {
      errors: unique(errors),
      warnings: unique(warnings)
    }
  };
}

function searchableText(record) {
  return JSON.stringify(record)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const REFERENCE_CONTEXT_MAX_BYTES = 32768;
const REFERENCE_PREVIEW_CHARS = 600;
const REFERENCE_ARRAY_LIMITS = { tags: 50, links: 50, members: 50, dna_links: 50, key_moments: 20 };
const EXACT_REFERENCE_FIELDS = new Set(["id", "ref", "block_id", "collection", "source_file", "source", "representation"]);
const REFERENCE_RECOVERY = "Read source_file for full metadata. Generated relations are in _references/_index.json; regenerate it with references-index if needed.";

// Include pretty-print whitespace and the CLI's final newline in every byte budget.
function referenceJsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value, null, 2) || "null", "utf8") + 1;
}

function referenceOffset(value = 0) {
  const offset = Number(value);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Reference offset must be a non-negative safe integer.");
  return offset;
}

function referencePointer(record) {
  const pointer = {};
  const omitted = [];
  for (const field of ["id", "type", "source_file"]) {
    const value = record[field] ?? null;
    if (referenceJsonBytes(value) <= 2048) pointer[field] = value;
    else omitted.push(field);
  }
  pointer.preview = {
    truncated: true,
    notice: "Metadata exceeds the preview budget; only recovery fields are shown. No locator has been shortened.",
    omitted_fields: omitted,
    recovery: REFERENCE_RECOVERY
  };
  return pointer;
}

function referencePreview(record) {
  if (!record) return null;
  const result = { ...record };
  const changes = [];
  for (const [field, value] of Object.entries(record)) {
    let change = null;
    if (typeof value === "string" && !EXACT_REFERENCE_FIELDS.has(field) && value.length > REFERENCE_PREVIEW_CHARS) {
      result[field] = `${value.slice(0, REFERENCE_PREVIEW_CHARS)}…`;
      change = { field, reason: "text_preview", total: value.length, returned: REFERENCE_PREVIEW_CHARS };
    } else if (Array.isArray(value) && value.length > (REFERENCE_ARRAY_LIMITS[field] || 50)) {
      result[field] = value.slice(0, REFERENCE_ARRAY_LIMITS[field] || 50);
      change = { field, reason: "array_limit", total: value.length, returned: result[field].length };
    }
    // Nested metadata and exact locators are retained whole or explicitly omitted.
    if (referenceJsonBytes(result[field]) > 4096) {
      result[field] = Array.isArray(value) ? [] : null;
      change = { field, reason: "field_byte_limit", ...(Array.isArray(value) ? { total: value.length, returned: 0 } : {}) };
    }
    if (change) changes.push(change);
  }
  if (changes.length) result.preview = { truncated: true, changes, recovery: REFERENCE_RECOVERY };
  return referenceJsonBytes(result) <= 8192 ? result : referencePointer(record);
}

function searchReferenceLibrary(index, query, options = {}) {
  const normalized = String(query || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return [];
  const terms = normalized.split(/\s+/);
  const records = [...(index.items || []), ...(index.collections || []), ...(index.boards || [])];
  const matches = records.map((record) => {
    const title = String(record.title || "").toLowerCase();
    const id = String(record.id || "").toLowerCase();
    const text = searchableText(record);
    if (!terms.every((term) => text.includes(term))) return null;
    let score = text.includes(normalized) ? 20 : 0;
    for (const term of terms) {
      if (title.includes(term)) score += 8;
      if (id.includes(term)) score += 5;
      score += Math.min(3, text.split(term).length - 1);
    }
    return {
      id: record.id,
      type: record.type,
      kind: record.kind || null,
      title: record.title,
      summary: record.summary || null,
      source_file: record.source_file || null,
      score
    };
  }).filter(Boolean)
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)));
  const offset = referenceOffset(options.offset);
  const limit = Math.max(1, Math.min(Number(options.limit) || 8, 50));
  const results = matches.slice(offset, offset + limit).map(referencePreview);
  // Leave room for the CLI's bounded query, pagination, and recovery notice.
  while (referenceJsonBytes(results) > REFERENCE_CONTEXT_MAX_BYTES - 4096) results.pop();
  Object.defineProperty(results, "page", { value: {
    offset, total: matches.length, returned: results.length,
    next_offset: offset + results.length < matches.length ? offset + results.length : null,
    omitted: matches.length - results.length,
    max_json_bytes: REFERENCE_CONTEXT_MAX_BYTES,
    recovery: REFERENCE_RECOVERY
  } });
  return results;
}

function referenceContext(index, id, options = {}) {
  const offset = referenceOffset(options.offset);
  const nodes = [...(index.items || []), ...(index.collections || []), ...(index.boards || [])];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const target = nodeById.get(id);
  if (!target) return null;
  const compact = (record) => record ? referencePreview({
    id: record.id,
    type: record.type,
    kind: record.kind || null,
    title: record.title,
    summary: record.summary || null,
    why_saved: record.why_saved || null,
    roles: record.roles || [],
    tags: record.tags || [],
    status: record.status || null,
    design_status: record.design_status || null,
    collection: record.collection || null,
    source: record.source ? {
      provider: record.source.provider || null,
      url: record.source.url || null,
      locator: record.source.locator || null,
      citation: record.source.citation || null
    } : null,
    representation: record.representation ? {
      path: record.representation.path || null,
      thumbnail: record.representation.thumbnail || null,
      transcript_path: record.representation.transcript_path || null
    } : null,
    source_file: record.source_file || null
  }) : null;
  const boards = (index.boards || []).filter((board) =>
    (board.members || []).some((member) => member.ref === id || member.ref === target.collection)
  );
  const relatedIds = new Set((target.links || []).map((link) => link.ref));
  for (const item of index.items || []) {
    if ((item.links || []).some((link) => link.ref === id)) relatedIds.add(item.id);
  }
  const collection = target.collection ? nodeById.get(target.collection) || null : null;
  const containedIds = target.type === "collection"
    ? (index.items || []).filter((item) => item.collection === target.id).map((item) => item.id)
    : target.type === "board"
      ? (target.members || []).map((member) => member.ref)
      : [];
  const related = [...relatedIds].map((relatedId) => nodeById.get(relatedId)).filter(Boolean);
  const contained = containedIds.map((containedId) => nodeById.get(containedId)).filter(Boolean);
  const context = {
    schema_version: REFERENCE_SCHEMA_VERSION,
    target: referencePreview({
      ...target,
      tags: target.tags || [], links: target.links || [], members: target.members || [],
      dna_links: target.dna_links || [], key_moments: target.key_moments
    }),
    collection: compact(collection),
    boards: boards.slice(0, 12).map(compact),
    contained: contained.slice(offset, offset + 50).map(compact),
    related: related.slice(0, 20).map(compact),
    dna_links: referencePreview({ dna_links: target.dna_links || [] }).dna_links || [],
    bounds: { boards: 12, contained: 50, related: 20, dna_links: 50, max_json_bytes: REFERENCE_CONTEXT_MAX_BYTES },
    totals: { boards: boards.length, contained: contained.length, related: related.length, dna_links: (target.dna_links || []).length },
    pagination: { offset, returned: 0, total: contained.length, next_offset: null },
    omitted: {},
    recovery: REFERENCE_RECOVERY,
    guidance: "Read textual metadata first. Inspect only the media or source needed for the current decision. A reference is contextual input, not accepted direction."
  };
  const updateCounts = () => {
    for (const field of Object.keys(context.totals)) context.omitted[field] = context.totals[field] - context[field].length;
    context.pagination.returned = context.contained.length;
    context.pagination.next_offset = offset + context.contained.length < contained.length ? offset + context.contained.length : null;
  };
  updateCounts();
  for (const field of ["related", "boards", "dna_links", "contained"]) {
    while (context[field].length && referenceJsonBytes(context) > REFERENCE_CONTEXT_MAX_BYTES) {
      context[field].pop();
      updateCounts();
    }
  }
  // A pathological record still yields a bounded recovery packet, never an oversized dump.
  if (referenceJsonBytes(context) > REFERENCE_CONTEXT_MAX_BYTES || (!context.contained.length && offset < contained.length)) {
    context.target = referencePointer(target);
    context.collection = collection ? referencePointer(collection) : null;
    context.contained = offset < contained.length ? [referencePointer(contained[offset])] : [];
    updateCounts();
  }
  return context;
}

module.exports = {
  REFERENCE_SCHEMA_VERSION,
  REFERENCE_KINDS,
  REFERENCE_ROLES,
  REFERENCE_DESIGN_STATUSES,
  REFERENCE_RELATIONSHIPS,
  REFERENCE_CONTEXT_MAX_BYTES,
  scanReferenceLibrary,
  searchReferenceLibrary,
  referenceContext
};

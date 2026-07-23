#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PATHS = {
  seed: path.join(ROOT, "_my_brainwave_seed.md"),
  northStar: path.join(ROOT, "_my_brainwave_north_star.md"),
  state: path.join(ROOT, "_brainwave_state.yaml"),
  settings: path.join(ROOT, "_settings.yaml"),
  dna: path.join(ROOT, "_dna.yaml"),
  manifest: path.join(ROOT, "_manifest.yaml"),
  dashboard: path.join(ROOT, "_dashboard.html"),
  contextDir: path.join(ROOT, "_context"),
  decisions: path.join(ROOT, "_decisions_log.md")
};

const INTERNAL_WRITE_GUARD_MS = 2500;
const internalWrites = new Map();
const STAGES = Object.freeze([
  "awaiting_seed",
  "shaping_north_star",
  "scoping_architecture_documentation",
  "building_architecture_documentation",
  "reviewing_architecture_documentation",
  "architecture_documentation_complete"
]);
const ACTIVE_RECONCILIATION_STAGES = new Set([
  "building_architecture_documentation",
  "reviewing_architecture_documentation"
]);
const ALLOWED_STAGE_TRANSITIONS = Object.freeze({
  awaiting_seed: ["shaping_north_star"],
  shaping_north_star: ["scoping_architecture_documentation"],
  scoping_architecture_documentation: ["shaping_north_star", "building_architecture_documentation"],
  building_architecture_documentation: [
    "shaping_north_star",
    "scoping_architecture_documentation",
    "reviewing_architecture_documentation"
  ],
  reviewing_architecture_documentation: [
    "shaping_north_star",
    "scoping_architecture_documentation",
    "building_architecture_documentation",
    "architecture_documentation_complete"
  ],
  architecture_documentation_complete: [
    "shaping_north_star",
    "scoping_architecture_documentation"
  ]
});

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readText(filePath) {
  if (!exists(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath, content) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  markInternalWrite(filePath);
}

function readJsonYaml(filePath, fallback = null) {
  const raw = readText(filePath).trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path.basename(filePath)} must be JSON-compatible YAML. ${error.message}`);
  }
}

function writeJsonYaml(filePath, data) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  writeText(filePath, json);
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function wordCount(content) {
  const matches = content.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

function fileStatusFromContent(content) {
  if (!content.trim()) return "not_started";
  const status = content.match(/^\s*status:\s*(not_started|in_progress|complete)\s*$/im)?.[1]?.toLowerCase();
  if (status === "complete") return "complete";
  return "in_progress";
}

function northStarStatusFromContent(content) {
  return content.match(/^\s*status:\s*(shaping|agreed)\s*$/im)?.[1]?.toLowerCase() || "missing";
}

function defaultSettings() {
  return {
    schema_version: "1.0.0",
    configured: false,
    onboarding_status: "pending",
    technical_proficiency: null,
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    profile_last_updated: null,
    onboarding_questions: [
      "What is your technical proficiency? (beginner/intermediate/architect)",
      "How should I operate? (thought_partner/fast_execution)",
      "How much detail do you prefer? (lean/standard/exhaustive)"
    ],
    engine: {
      rate_limit_ms: 900,
      max_context_chars: 32000,
      summary_char_budget: 1400,
      max_files_per_cycle: 120
    }
  };
}

function defaultState() {
  return {
    schema_version: "1.0.0",
    stage: "awaiting_seed",
    stage_updated_at: nowIso(),
    seed: {
      path: "_my_brainwave_seed.md",
      captured_at: null,
      locked_sha256: null
    }
  };
}

function ensureCoreFiles() {
  if (!exists(PATHS.seed)) writeText(PATHS.seed, "");
  if (!exists(PATHS.northStar)) writeText(PATHS.northStar, "");
  if (!exists(PATHS.state)) writeJsonYaml(PATHS.state, defaultState());
  if (!exists(PATHS.settings)) writeJsonYaml(PATHS.settings, defaultSettings());
  if (!exists(PATHS.manifest)) writeJsonYaml(PATHS.manifest, defaultManifestSkeleton());
  if (!exists(PATHS.contextDir)) fs.mkdirSync(PATHS.contextDir, { recursive: true });
}

function validateDna(dna) {
  if (!dna || typeof dna !== "object") throw new Error("Invalid _dna.yaml content.");
  if (!dna.nodes || typeof dna.nodes !== "object") throw new Error("_dna.yaml must include a nodes object.");
  for (const [id, node] of Object.entries(dna.nodes)) {
    if (!node.id || node.id !== id) throw new Error(`DNA node id mismatch: ${id}`);
    if (!node.type || !["directory", "file"].includes(node.type)) throw new Error(`Invalid node type for ${id}`);
    if (typeof node.expressed !== "boolean") throw new Error(`Node ${id} must define expressed boolean.`);
    if (typeof node.path !== "string" || !node.path.trim()) throw new Error(`Node ${id} must define path.`);
  }
}

function defaultManifestSkeleton() {
  return {
    schema_version: "1.0.0",
    generated_at: nowIso(),
    workspace_root: ".",
    seed: {
      path: "_my_brainwave_seed.md",
      word_count: 0,
      current_sha256: null,
      locked_sha256: null,
      integrity: "unlocked",
      captured_at: null,
      last_ingested_at: null
    },
    north_star: {
      path: "_my_brainwave_north_star.md",
      status: "missing",
      word_count: 0,
      sha256: null,
      updated_at: null
    },
    lifecycle: {
      path: "_brainwave_state.yaml",
      stage: "awaiting_seed",
      stage_updated_at: null,
      passive: false
    },
    settings: {
      path: "_settings.yaml",
      loaded: false,
      technical_proficiency: null,
      ideation_mode: null,
      verbosity_budget: null
    },
    engine: {
      status: "idle",
      last_command: null,
      last_cycle_at: null,
      warnings: [],
      task_router: {
        pending_tasks: 0
      },
      context_degraded: false
    },
    dna: {
      path: "_dna.yaml",
      totals: {
        nodes: 0,
        directories: 0,
        files: 0,
        expressed_nodes: 0,
        expressed_files: 0
      },
      nodes: {}
    },
    filesystem: {
      tracked_files: {},
      missing_expressed_files: [],
      non_dna_markdown_files: []
    },
    progress: {
      global_completion_pct: 0,
      folders: {}
    },
    context: {
      summaries_generated: []
    },
    events: []
  };
}

function addEvent(manifest, type, message, data = null) {
  if (!Array.isArray(manifest.events)) manifest.events = [];
  manifest.events.push({
    at: nowIso(),
    type,
    message,
    data
  });
  manifest.events = manifest.events.slice(-120);
}

function getChildren(dna, parentId) {
  const children = [];
  for (const node of Object.values(dna.nodes)) {
    if (node.parent_id === parentId) children.push(node);
  }
  children.sort((a, b) => a.id.localeCompare(b.id));
  return children;
}

function getDescendantFileNodes(dna, parentId) {
  const results = [];
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const child of getChildren(dna, current)) {
      if (child.type === "file") results.push(child);
      if (child.type === "directory") stack.push(child.id);
    }
  }
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function inferParentPrefix(pathValue) {
  const firstSegment = String(pathValue).split("/")[0] || "";
  const match = firstSegment.match(/^(\d{4})\d_/);
  return match ? match[1] : null;
}

function validateNamingConvention(node) {
  if (node.type !== "file") return { ok: true, reason: null };
  const fileName = path.basename(node.path);
  const idPrefix = node.id.slice(0, 4);
  if (!fileName.startsWith(node.id)) {
    return { ok: false, reason: "filename_must_start_with_file_id" };
  }
  const parentPrefix = inferParentPrefix(node.path);
  if (!parentPrefix || parentPrefix !== idPrefix) {
    return { ok: false, reason: "first_4_digits_must_match_parent_segment" };
  }
  return { ok: true, reason: null };
}

function buildContextDigest(northStarText, decisionsText, maxChars) {
  const northStar = (northStarText || "").trim();
  const decisions = (decisionsText || "").trim();
  const combined = [northStar, decisions].filter(Boolean).join("\n\n");
  if (!combined) {
    return {
      text: "No North Star or steering decisions captured yet.",
      degraded: false
    };
  }
  if (combined.length <= maxChars) {
    return {
      text: combined,
      degraded: false
    };
  }
  const half = Math.floor(maxChars / 2);
  const head = combined.slice(0, half);
  const tail = combined.slice(-half);
  return {
    text: `${head}\n...\n[context condensed due to budget]\n...\n${tail}`,
    degraded: true
  };
}

function routeGenerationTasks(dna) {
  const tasks = [];
  const nodes = Object.values(dna.nodes)
    .filter((node) => node.type === "file" && node.expressed)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of nodes) {
    const abs = path.join(ROOT, node.path);
    if (exists(abs)) continue;
    tasks.push({
      node_id: node.id,
      path: node.path,
      priority: node.required ? 1 : 2
    });
  }
  return tasks.sort((a, b) => a.priority - b.priority || a.node_id.localeCompare(b.node_id));
}

class RateLimiter {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.lastRunAt = 0;
  }

  async waitTurn() {
    const elapsed = Date.now() - this.lastRunAt;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastRunAt = Date.now();
  }
}

function buildScaffoldContent(fileNode) {
  const title = fileNode.title || fileNode.path.replace(".md", "");
  return [
    `# ${title}`,
    "",
    "Status: in_progress",
    `Last updated: ${nowIso()}`,
    "",
    "## Intent",
    `- ${fileNode.intent || "Define this area clearly before implementation."}`,
    "",
    "## Directional Context",
    "- North Star: `_my_brainwave_north_star.md`",
    "- Steering decisions: `_decisions_log.md`",
    "",
    "## Decisions and Rationale",
    "",
    "## Constraints",
    "",
    "## Open Questions",
    ""
  ].join("\n");
}

async function reconcileExpressedNodes(dna, settings, manifest, taskPlan) {
  const limiter = new RateLimiter(settings.engine?.rate_limit_ms || 900);
  const maxFiles = settings.engine?.max_files_per_cycle || 120;
  let createdCount = 0;
  let touchedCount = 0;

  const nodes = Object.values(dna.nodes).sort((a, b) => a.id.localeCompare(b.id));
  for (const node of nodes) {
    if (node.type !== "directory" || !node.expressed) continue;
    fs.mkdirSync(path.join(ROOT, node.path), { recursive: true });
  }

  for (const task of taskPlan) {
    const node = dna.nodes[task.node_id];
    if (!node) continue;
    const absolutePath = path.join(ROOT, node.path);
    const naming = validateNamingConvention(node);
    if (!naming.ok) {
      addEvent(manifest, "warning", `Naming convention violation for ${node.id}`, { reason: naming.reason, path: node.path });
      continue;
    }

    if (touchedCount >= maxFiles) {
      addEvent(manifest, "warning", "Cycle file limit reached, deferring remaining scaffolds.");
      break;
    }

    if (!exists(absolutePath)) {
      await limiter.waitTurn();
      writeText(absolutePath, buildScaffoldContent(node));
      createdCount += 1;
      touchedCount += 1;
    }
  }

  return { createdCount, touchedCount };
}

function listAllFilesRecursive(startDir) {
  const output = [];
  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!exists(current)) continue;
    const stats = fs.statSync(current);
    if (stats.isFile()) {
      output.push(current);
      continue;
    }
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if ([".git", "node_modules"].includes(entry.name)) continue;
        stack.push(absolute);
      } else if (entry.isFile()) {
        output.push(absolute);
      }
    }
  }
  return output;
}

function computeFolderProgress(dna, trackedFiles) {
  const folderProgress = {};
  const directoryNodes = Object.values(dna.nodes)
    .filter((node) => node.type === "directory")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const directory of directoryNodes) {
    const catalogFiles = getDescendantFileNodes(dna, directory.id);
    const expressedFiles = catalogFiles.filter((fileNode) => fileNode.expressed);
    const total = expressedFiles.length;
    let complete = 0;
    for (const fileNode of expressedFiles) {
      const tracked = trackedFiles[fileNode.path];
      if (tracked && tracked.processing_status === "complete") complete += 1;
    }
    const pct = total === 0 ? 0 : Math.round((complete / total) * 100);
    folderProgress[directory.id] = {
      title: directory.title,
      path: directory.path,
      available_files: catalogFiles.length,
      expressed_files: expressedFiles.length,
      total_expressed_files: total,
      completed_files: complete,
      completion_pct: pct
    };
  }
  return folderProgress;
}

function generateCondensedSummaryForDir(dna, dirId, summaryCharBudget) {
  const files = getDescendantFileNodes(dna, dirId).filter((node) => node.expressed);
  if (files.length === 0) return null;

  const parts = [];
  parts.push(`# ${dirId} State Summary`);
  parts.push("");
  parts.push(`Generated: ${nowIso()}`);
  parts.push("");

  for (const fileNode of files) {
    const absolute = path.join(ROOT, fileNode.path);
    if (!exists(absolute)) continue;
    const text = readText(absolute).trim();
    if (!text) continue;
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const headline = lines.find((line) => line.startsWith("#")) || fileNode.title || fileNode.id;
    const bodyLine = lines.find(
      (line) =>
        !line.startsWith("#") &&
        !/^status:/i.test(line) &&
        !/^last updated:/i.test(line) &&
        !/^-\s*(north star|steering decisions):/i.test(line)
    ) || "No detail captured yet.";
    parts.push(`- ${fileNode.id}: ${headline.replace(/^#+\s*/, "")} -> ${bodyLine}`);
  }

  let summary = `${parts.join("\n")}\n`;
  if (summary.length > summaryCharBudget) {
    summary = `${summary.slice(0, summaryCharBudget)}\n...\n[truncated for context budget]\n`;
  }
  return summary;
}

function generateContextSummaries(dna, folderProgress, settings, manifest) {
  const generated = [];
  const summaryCharBudget = settings.engine?.summary_char_budget || 1400;
  for (const [dirId, stats] of Object.entries(folderProgress)) {
    if (stats.total_expressed_files === 0) continue;
    if (stats.completion_pct !== 100) continue;
    const summary = generateCondensedSummaryForDir(dna, dirId, summaryCharBudget);
    if (!summary) continue;
    const outputPath = path.join(PATHS.contextDir, `${dirId}_state.md`);
    writeText(outputPath, summary);
    generated.push(path.relative(ROOT, outputPath).replace(/\\/g, "/"));
  }
  manifest.context.summaries_generated = generated;
}

function buildManifest({
  dna,
  settings,
  state,
  seedText,
  northStarText,
  previousManifest,
  command,
  taskPlan = [],
  degradedContext = false
}) {
  const manifest = defaultManifestSkeleton();
  if (previousManifest && Array.isArray(previousManifest.events)) {
    manifest.events = previousManifest.events.slice(-100);
  }

  manifest.generated_at = nowIso();
  manifest.engine.status = "ok";
  manifest.engine.last_command = command;
  manifest.engine.last_cycle_at = nowIso();
  manifest.engine.task_router = {
    pending_tasks: taskPlan.length
  };
  manifest.engine.context_degraded = degradedContext;

  manifest.settings.loaded = true;
  manifest.settings.technical_proficiency = settings.technical_proficiency ?? null;
  manifest.settings.ideation_mode = settings.ideation_mode ?? null;
  manifest.settings.verbosity_budget = settings.verbosity_budget ?? null;

  const currentSeedHash = seedText.trim() ? sha256(seedText) : null;
  const lockedSeedHash = state?.seed?.locked_sha256 || null;
  manifest.seed.word_count = wordCount(seedText);
  manifest.seed.current_sha256 = currentSeedHash;
  manifest.seed.locked_sha256 = lockedSeedHash;
  manifest.seed.integrity = !lockedSeedHash
    ? "unlocked"
    : currentSeedHash === lockedSeedHash
      ? "unchanged"
      : "changed";
  manifest.seed.captured_at = state?.seed?.captured_at || null;
  manifest.seed.last_ingested_at = nowIso();

  manifest.north_star.status = northStarStatusFromContent(northStarText);
  manifest.north_star.word_count = wordCount(northStarText);
  manifest.north_star.sha256 = northStarText.trim() ? sha256(northStarText) : null;
  manifest.north_star.updated_at = exists(PATHS.northStar)
    ? fs.statSync(PATHS.northStar).mtime.toISOString()
    : null;

  manifest.lifecycle.stage = state.stage;
  manifest.lifecycle.stage_updated_at = state.stage_updated_at || null;
  manifest.lifecycle.passive = state.stage === "architecture_documentation_complete";

  const allNodes = Object.values(dna.nodes);
  const fileNodes = allNodes.filter((node) => node.type === "file");
  const directoryNodes = allNodes.filter((node) => node.type === "directory");
  const expressedNodes = allNodes.filter((node) => node.expressed);
  const expressedFileNodes = fileNodes.filter((node) => node.expressed);

  manifest.dna.totals = {
    nodes: allNodes.length,
    directories: directoryNodes.length,
    files: fileNodes.length,
    expressed_nodes: expressedNodes.length,
    expressed_files: expressedFileNodes.length
  };

  const trackedFiles = {};
  const missingExpressedFiles = [];
  for (const node of fileNodes) {
    const abs = path.join(ROOT, node.path);
    const fileExists = exists(abs);
    const content = fileExists ? readText(abs) : "";
    const wc = fileExists ? wordCount(content) : 0;
    const status = fileExists ? fileStatusFromContent(content) : "not_started";
    trackedFiles[node.path] = {
      node_id: node.id,
      required: Boolean(node.required),
      expressed: Boolean(node.expressed),
      exists: fileExists,
      processing_status: status,
      word_count: wc,
      sha256: fileExists ? sha256(content) : null,
      updated_at: fileExists ? fs.statSync(abs).mtime.toISOString() : null
    };
    if (node.expressed && !fileExists) {
      missingExpressedFiles.push(node.path);
    }
  }
  manifest.filesystem.tracked_files = trackedFiles;
  manifest.filesystem.missing_expressed_files = missingExpressedFiles;

  const allFiles = listAllFilesRecursive(ROOT)
    .map((absolute) => path.relative(ROOT, absolute).replace(/\\/g, "/"))
    .filter((relative) => relative.endsWith(".md"));
  const dnaFileSet = new Set(fileNodes.map((node) => node.path));
  const internalFiles = new Set([
    "_my_brainwave_seed.md",
    "_my_brainwave_north_star.md",
    "_brainwave_handbook.md",
    "_decisions_log.md",
    "_engine/README.md",
    "README.md",
    "AGENTS.md"
  ]);
  manifest.filesystem.non_dna_markdown_files = allFiles.filter(
    (relative) =>
      !dnaFileSet.has(relative) &&
      !relative.startsWith("_context/") &&
      !relative.startsWith("_templates/") &&
      !relative.startsWith("_examples/") &&
      !internalFiles.has(relative)
  );

  for (const node of allNodes) {
    manifest.dna.nodes[node.id] = {
      id: node.id,
      type: node.type,
      path: node.path,
      parent_id: node.parent_id || null,
      required: Boolean(node.required),
      expressed: Boolean(node.expressed),
      processing_status: node.type === "file" ? (trackedFiles[node.path]?.processing_status || "not_started") : "container"
    };
  }

  manifest.progress.folders = computeFolderProgress(dna, trackedFiles);
  const folderEntries = Object.values(manifest.progress.folders);
  const expressedFolders = folderEntries.filter((folder) => folder.total_expressed_files > 0);
  if (expressedFolders.length === 0) {
    manifest.progress.global_completion_pct = 0;
  } else {
    const totalPct = expressedFolders.reduce((sum, folder) => sum + folder.completion_pct, 0);
    manifest.progress.global_completion_pct = Math.round(totalPct / expressedFolders.length);
  }

  return manifest;
}

function injectManifestIntoDashboard(manifest) {
  if (!exists(PATHS.dashboard)) return;
  const html = readText(PATHS.dashboard);
  const scriptJson = JSON.stringify(manifest)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
  const embedded = `<script id="brainwave-state" type="application/json">${scriptJson}</script>`;
  const pattern = /<script id="brainwave-state" type="application\/json">[\s\S]*?<\/script>/;

  let updated;
  if (pattern.test(html)) {
    updated = html.replace(pattern, embedded);
  } else if (html.includes("</body>")) {
    updated = html.replace("</body>", `  ${embedded}\n</body>`);
  } else {
    updated = `${html}\n${embedded}\n`;
  }

  if (updated !== html) {
    writeText(PATHS.dashboard, updated);
  }
}

function markInternalWrite(filePath) {
  internalWrites.set(normalizePath(filePath), Date.now() + INTERNAL_WRITE_GUARD_MS);
}

function shouldIgnoreWatchEvent(filePath) {
  const normalized = normalizePath(filePath);
  const expiresAt = internalWrites.get(normalized);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    internalWrites.delete(normalized);
    return false;
  }
  return true;
}

function hasAllowedSetting(settings, key) {
  const allowed = settings?.allowed_values?.[key];
  const value = settings?.[key];
  if (!Array.isArray(allowed) || allowed.length === 0) return Boolean(value);
  return allowed.includes(value);
}

function isSettingsConfigured(settings) {
  if (!settings || settings.configured !== true) return false;
  if (settings.onboarding_status && settings.onboarding_status !== "complete") return false;
  if (!hasAllowedSetting(settings, "technical_proficiency")) return false;
  if (!hasAllowedSetting(settings, "ideation_mode")) return false;
  if (!hasAllowedSetting(settings, "verbosity_budget")) return false;
  return true;
}

function assertSettingsReady(settings) {
  if (isSettingsConfigured(settings)) return;
  throw new Error(
    "Profile pre-check failed: `_settings.yaml` is incomplete. Complete onboarding before progressing architecture documentation."
  );
}

function validateState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Invalid `_brainwave_state.yaml` content.");
  }
  if (!STAGES.includes(state.stage)) {
    throw new Error(`Invalid Brainwave stage: ${state.stage || "missing"}`);
  }
}

function assertSeedIntegrity(state, seedText) {
  if (!seedText.trim()) {
    throw new Error("Seed pre-check failed: `_my_brainwave_seed.md` is empty.");
  }
  const lockedHash = state?.seed?.locked_sha256;
  if (!lockedHash) {
    throw new Error(
      "Seed pre-check failed: the Brainwave Seed has not been locked. Transition from `awaiting_seed` to `shaping_north_star` first."
    );
  }
  const currentHash = sha256(seedText);
  if (currentHash !== lockedHash) {
    throw new Error(
      "Seed integrity failed: `_my_brainwave_seed.md` changed after capture. Restore the immutable seed before continuing."
    );
  }
}

function assertNorthStarAgreed(northStarText) {
  const status = northStarStatusFromContent(northStarText);
  if (status !== "agreed") {
    throw new Error(
      "North Star pre-check failed: `_my_brainwave_north_star.md` must contain `Status: agreed` after explicit user agreement."
    );
  }
}

function expressedFileNodes(dna) {
  return Object.values(dna.nodes)
    .filter((node) => node.type === "file" && node.expressed)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function incompleteExpressedFiles(dna) {
  return expressedFileNodes(dna).filter((node) => {
    const absolute = path.join(ROOT, node.path);
    return !exists(absolute) || fileStatusFromContent(readText(absolute)) !== "complete";
  });
}

function loadWorkspace() {
  ensureCoreFiles();

  const settings = { ...defaultSettings(), ...readJsonYaml(PATHS.settings, defaultSettings()) };
  const dna = readJsonYaml(PATHS.dna, null);
  if (!dna) throw new Error("Missing _dna.yaml. Create it before running the engine.");
  validateDna(dna);
  const state = readJsonYaml(PATHS.state, defaultState());
  validateState(state);
  return {
    settings,
    dna,
    state,
    seedText: readText(PATHS.seed),
    northStarText: readText(PATHS.northStar),
    decisionsText: readText(PATHS.decisions),
    previousManifest: readJsonYaml(PATHS.manifest, defaultManifestSkeleton())
  };
}

function buildWorkspaceManifest(workspace, command, previousManifest = workspace.previousManifest) {
  const contextDigest = buildContextDigest(
    workspace.northStarText,
    workspace.decisionsText,
    workspace.settings.engine?.max_context_chars || 32000
  );
  return buildManifest({
    dna: workspace.dna,
    settings: workspace.settings,
    state: workspace.state,
    seedText: workspace.seedText,
    northStarText: workspace.northStarText,
    previousManifest,
    command,
    taskPlan: routeGenerationTasks(workspace.dna),
    degradedContext: contextDigest.degraded
  });
}

function persistWorkspaceManifest(workspace, command, previousManifest = workspace.previousManifest) {
  const manifest = buildWorkspaceManifest(workspace, command, previousManifest);
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  return manifest;
}

function assertReconciliationReady(workspace) {
  assertSeedIntegrity(workspace.state, workspace.seedText);
  assertSettingsReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  if (!ACTIVE_RECONCILIATION_STAGES.has(workspace.state.stage)) {
    if (workspace.state.stage === "architecture_documentation_complete") {
      throw new Error(
        "Brainwave is passive because architecture documentation is complete. Reopen Brainwave explicitly before reconciling."
      );
    }
    throw new Error(
      `Reconciliation is unavailable during \`${workspace.state.stage}\`. Transition to \`building_architecture_documentation\` first.`
    );
  }
}

async function runCycle(command) {
  const workspace = loadWorkspace();
  assertReconciliationReady(workspace);

  const contextDigest = buildContextDigest(
    workspace.northStarText,
    workspace.decisionsText,
    workspace.settings.engine?.max_context_chars || 32000
  );
  const taskPlan = routeGenerationTasks(workspace.dna);
  const manifest = buildManifest({
    dna: workspace.dna,
    settings: workspace.settings,
    state: workspace.state,
    seedText: workspace.seedText,
    northStarText: workspace.northStarText,
    previousManifest: workspace.previousManifest,
    command,
    taskPlan,
    degradedContext: contextDigest.degraded
  });
  if (contextDigest.degraded) {
    addEvent(manifest, "warning", "Context digest exceeded budget and was condensed.");
  }
  if (taskPlan.length > 0) {
    addEvent(manifest, "routing", "Expressed architecture-documentation scaffolds are pending.", {
      pending_tasks: taskPlan.length
    });
  }

  const reconcile = await reconcileExpressedNodes(
    workspace.dna,
    workspace.settings,
    manifest,
    taskPlan
  );
  if (reconcile.createdCount > 0) {
    addEvent(manifest, "reconcile", "Expressed files scaffolded.", {
      created_files: reconcile.createdCount
    });
  }

  const refreshedManifest = buildManifest({
    dna: workspace.dna,
    settings: workspace.settings,
    state: workspace.state,
    seedText: workspace.seedText,
    northStarText: workspace.northStarText,
    previousManifest: manifest,
    command,
    taskPlan: routeGenerationTasks(workspace.dna),
    degradedContext: contextDigest.degraded
  });
  generateContextSummaries(
    workspace.dna,
    refreshedManifest.progress.folders,
    workspace.settings,
    refreshedManifest
  );
  writeJsonYaml(PATHS.manifest, refreshedManifest);
  injectManifestIntoDashboard(refreshedManifest);
  console.log(`[brainwave] cycle complete at ${nowIso()}`);
}

function printHelp() {
  console.log("Brainwave runner commands:");
  console.log("  node _engine/brainwave_runner.js status");
  console.log("  node _engine/brainwave_runner.js refresh");
  console.log("  node _engine/brainwave_runner.js transition <stage>");
  console.log("  node _engine/brainwave_runner.js express <id...>");
  console.log("  node _engine/brainwave_runner.js run");
  console.log("  node _engine/brainwave_runner.js watch");
}

function expressNodes(nodeIds) {
  const workspace = loadWorkspace();
  assertSeedIntegrity(workspace.state, workspace.seedText);
  assertSettingsReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  if (workspace.state.stage !== "scoping_architecture_documentation") {
    throw new Error(
      `DNA expression is available only during \`scoping_architecture_documentation\`, not \`${workspace.state.stage}\`.`
    );
  }

  const changed = [];
  const expressNode = (id) => {
    const node = workspace.dna.nodes[id];
    if (!node) throw new Error(`Unknown DNA node: ${id}`);
    if (!node.expressed) {
      node.expressed = true;
      changed.push(id);
    }
    if (node.parent_id) expressNode(node.parent_id);
  };
  for (const id of nodeIds) {
    expressNode(id);
  }
  if (changed.length > 0) {
    writeJsonYaml(PATHS.dna, workspace.dna);
  }
  const manifest = buildWorkspaceManifest(workspace, "express");
  addEvent(manifest, "scope", "Architecture-documentation nodes expressed after agent selection.", {
    expressed_node_ids: changed.sort()
  });
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(`[brainwave] expressed nodes: ${changed.join(", ") || "none"}`);
}

function printStatus() {
  const workspace = loadWorkspace();
  const manifest = buildWorkspaceManifest(workspace, "status");
  console.log(`[brainwave] stage: ${workspace.state.stage}`);
  console.log(`[brainwave] seed_integrity: ${manifest.seed.integrity}`);
  console.log(`[brainwave] north_star_status: ${manifest.north_star.status}`);
  console.log(`[brainwave] global_completion_pct: ${manifest.progress.global_completion_pct}%`);
  console.log(`[brainwave] expressed_files: ${manifest.dna.totals.expressed_files}`);
  console.log(`[brainwave] missing_expressed_files: ${manifest.filesystem.missing_expressed_files.length}`);
}

function refreshDerivedState() {
  const workspace = loadWorkspace();
  persistWorkspaceManifest(workspace, "refresh");
  console.log(`[brainwave] derived state refreshed at ${nowIso()}`);
}

function transitionStage(targetStage) {
  if (!STAGES.includes(targetStage)) {
    throw new Error(`Unknown Brainwave stage: ${targetStage}`);
  }
  const workspace = loadWorkspace();
  const currentStage = workspace.state.stage;
  if (targetStage === currentStage) {
    console.log(`[brainwave] stage unchanged: ${currentStage}`);
    return;
  }
  const allowed = ALLOWED_STAGE_TRANSITIONS[currentStage] || [];
  if (!allowed.includes(targetStage)) {
    throw new Error(`Invalid stage transition: ${currentStage} -> ${targetStage}`);
  }

  if (currentStage === "awaiting_seed" && targetStage === "shaping_north_star") {
    if (!workspace.seedText.trim()) {
      throw new Error("Cannot capture the Brainwave Seed because `_my_brainwave_seed.md` is empty.");
    }
    workspace.state.seed = {
      path: "_my_brainwave_seed.md",
      captured_at: nowIso(),
      locked_sha256: sha256(workspace.seedText)
    };
  } else {
    assertSeedIntegrity(workspace.state, workspace.seedText);
  }

  if (
    [
      "scoping_architecture_documentation",
      "building_architecture_documentation",
      "reviewing_architecture_documentation",
      "architecture_documentation_complete"
    ].includes(targetStage)
  ) {
    assertSettingsReady(workspace.settings);
    assertNorthStarAgreed(workspace.northStarText);
  }

  if (
    ["building_architecture_documentation", "reviewing_architecture_documentation", "architecture_documentation_complete"]
      .includes(targetStage) &&
    expressedFileNodes(workspace.dna).length === 0
  ) {
    throw new Error("No architecture-documentation files are expressed.");
  }

  if (
    ["reviewing_architecture_documentation", "architecture_documentation_complete"].includes(targetStage)
  ) {
    const incomplete = incompleteExpressedFiles(workspace.dna);
    if (incomplete.length > 0) {
      throw new Error(
        `Architecture documentation is incomplete: ${incomplete.map((node) => node.id).join(", ")}`
      );
    }
  }

  workspace.state.stage = targetStage;
  workspace.state.stage_updated_at = nowIso();
  writeJsonYaml(PATHS.state, workspace.state);
  const manifest = buildWorkspaceManifest(workspace, "transition");
  addEvent(manifest, "lifecycle", `Brainwave stage changed from ${currentStage} to ${targetStage}.`);
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(`[brainwave] stage: ${currentStage} -> ${targetStage}`);
}

async function watchWorkspace() {
  await runCycle("watch");
  console.log("[brainwave] watching for changes...");

  let timer = null;
  const watcher = fs.watch(ROOT, { recursive: true }, (eventType, relativePath) => {
    if (!relativePath) return;
    const absolute = path.join(ROOT, relativePath);
    if (shouldIgnoreWatchEvent(absolute)) return;
    if (String(relativePath).replace(/\\/g, "/").includes(".git/")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const state = readJsonYaml(PATHS.state, defaultState());
        if (state.stage === "architecture_documentation_complete") {
          watcher.close();
          console.log("[brainwave] architecture documentation is complete; watch mode is now passive.");
          return;
        }
        await runCycle("watch");
      } catch (error) {
        console.error(`[brainwave] watch cycle failed: ${error.message}`);
      }
    }, 700);
  });
}

async function main() {
  const command = process.argv[2] || "run";
  if (["-h", "--help", "help"].includes(command)) {
    printHelp();
    return;
  }

  if (command === "express") {
    const ids = process.argv.slice(3);
    if (ids.length === 0) {
      throw new Error("Provide at least one node id.");
    }
    expressNodes(ids);
    return;
  }

  if (command === "transition") {
    const targetStage = process.argv[3];
    if (!targetStage) {
      throw new Error("Provide a target Brainwave stage.");
    }
    transitionStage(targetStage);
    return;
  }

  if (command === "status") {
    printStatus();
    return;
  }

  if (command === "refresh") {
    refreshDerivedState();
    return;
  }

  if (command === "watch") {
    await watchWorkspace();
    return;
  }

  if (command === "run") {
    await runCycle("run");
    return;
  }

  printHelp();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`[brainwave] ${error.message}`);
  process.exit(1);
});

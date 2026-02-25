#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const PATHS = {
  seed: path.join(ROOT, "_my_brainwave.md"),
  settings: path.join(ROOT, "_settings.yaml"),
  dna: path.join(ROOT, "_dna.yaml"),
  manifest: path.join(ROOT, "_manifest.yaml"),
  dashboard: path.join(ROOT, "_dashboard.html"),
  contextDir: path.join(ROOT, "_context"),
  decisions: path.join(ROOT, "_decisions_log.md")
};

const INTERNAL_WRITE_GUARD_MS = 2500;
const internalWrites = new Map();

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
  const words = wordCount(content);
  if (words === 0) return "not_started";
  if (/status:\s*complete/i.test(content) || /##\s*done/i.test(content)) return "complete";
  if (words >= 120) return "complete";
  return "in_progress";
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

function ensureCoreFiles() {
  if (!exists(PATHS.seed)) writeText(PATHS.seed, "");
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
      path: "_my_brainwave.md",
      word_count: 0,
      sha256: null,
      last_ingested_at: null
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
        pending_tasks: 0,
        model_tiers: {}
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

function evaluateSeedAndToggleDna(seedText, dna) {
  const activated = new Set();
  const seed = seedText.toLowerCase();
  if (!seed.trim()) {
    return { changed: false, activated: [] };
  }

  const baseIds = ["00100", "00200"];
  for (const id of baseIds) activated.add(id);

  for (const node of Object.values(dna.nodes)) {
    if (node.type !== "directory") continue;
    const keywords = Array.isArray(node.activation_keywords) ? node.activation_keywords : [];
    const matched = keywords.some((keyword) => seed.includes(String(keyword).toLowerCase()));
    if (matched) activated.add(node.id);
  }

  for (const id of Array.from(activated)) {
    const descendants = getDescendantFileNodes(dna, id);
    descendants.forEach((fileNode) => activated.add(fileNode.id));
    const dir = dna.nodes[id];
    if (dir && dir.type === "directory") {
      for (const child of getChildren(dna, id)) activated.add(child.id);
    }
  }

  let changed = false;
  for (const id of activated) {
    const node = dna.nodes[id];
    if (!node) continue;
    if (!node.expressed) {
      node.expressed = true;
      changed = true;
    }
  }

  return { changed, activated: Array.from(activated).sort() };
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

function buildContextDigest(seedText, decisionsText, maxChars) {
  const seed = (seedText || "").trim();
  const decisions = (decisionsText || "").trim();
  const combined = [seed, decisions].filter(Boolean).join("\n\n");
  if (!combined) {
    return {
      text: "No seed or decisions captured yet.",
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
      model_tier: node.required ? "reasoning_heavy" : "balanced",
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

function buildScaffoldContent(fileNode, seedText, contextDigest) {
  const title = fileNode.title || fileNode.path.replace(".md", "");
  const briefSeed = seedText.trim().slice(0, 300);
  const seedLine = briefSeed ? briefSeed : "Seed not provided yet. Capture intent before execution.";
  const digestLine = (contextDigest || "").trim().slice(0, 240).replace(/\n+/g, " ");
  return [
    `# ${title}`,
    "",
    "## Intent",
    `- ${fileNode.intent || "Define this area clearly before implementation."}`,
    "",
    "## Seed Signal",
    `- ${seedLine}`,
    `- context_digest: ${digestLine || "none"}`,
    "",
    "## Working Notes",
    "- status: in_progress",
    "- decisions:",
    "- constraints:",
    "- open_questions:",
    ""
  ].join("\n");
}

async function reconcileExpressedNodes(dna, seedText, settings, manifest, taskPlan, contextDigest) {
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
      writeText(absolutePath, buildScaffoldContent(node, seedText, contextDigest));
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
    const descendantFiles = getDescendantFileNodes(dna, directory.id).filter((fileNode) => fileNode.expressed);
    const total = descendantFiles.length;
    let complete = 0;
    for (const fileNode of descendantFiles) {
      const tracked = trackedFiles[fileNode.path];
      if (tracked && tracked.processing_status === "complete") complete += 1;
    }
    const pct = total === 0 ? 0 : Math.round((complete / total) * 100);
    folderProgress[directory.id] = {
      path: directory.path,
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
    const bodyLine = lines.find((line) => !line.startsWith("#")) || "No detail captured yet.";
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
  seedText,
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
    pending_tasks: taskPlan.length,
    model_tiers: taskPlan.reduce((acc, task) => {
      acc[task.model_tier] = (acc[task.model_tier] || 0) + 1;
      return acc;
    }, {})
  };
  manifest.engine.context_degraded = degradedContext;

  manifest.settings.loaded = true;
  manifest.settings.technical_proficiency = settings.technical_proficiency ?? null;
  manifest.settings.ideation_mode = settings.ideation_mode ?? null;
  manifest.settings.verbosity_budget = settings.verbosity_budget ?? null;

  manifest.seed.word_count = wordCount(seedText);
  manifest.seed.sha256 = sha256(seedText);
  manifest.seed.last_ingested_at = nowIso();

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
    "_my_brainwave.md",
    "_decisions_log.md",
    "README.md",
    "AGENTS.md"
  ]);
  manifest.filesystem.non_dna_markdown_files = allFiles.filter(
    (relative) => !dnaFileSet.has(relative) && !relative.startsWith("_context/") && !internalFiles.has(relative)
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

function assertSeedReady(seedText, command) {
  const blockedCommands = new Set(["run", "watch", "express"]);
  if (!blockedCommands.has(command)) return;
  if (seedText.trim()) return;
  throw new Error(
    "Pre-check failed: `_my_brainwave.md` is empty. Add your concept seed first, then rerun the command."
  );
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

function assertSettingsReady(settings, command) {
  const blockedCommands = new Set(["run", "watch", "express"]);
  if (!blockedCommands.has(command)) return;
  if (isSettingsConfigured(settings)) return;
  throw new Error(
    "Profile pre-check failed: `_settings.yaml` is incomplete. Ask onboarding questions in chat and update settings before running the engine."
  );
}

async function runCycle(command) {
  ensureCoreFiles();

  const settings = { ...defaultSettings(), ...readJsonYaml(PATHS.settings, defaultSettings()) };
  const dna = readJsonYaml(PATHS.dna, null);
  if (!dna) throw new Error("Missing _dna.yaml. Create it before running the engine.");
  validateDna(dna);

  const previousManifest = readJsonYaml(PATHS.manifest, defaultManifestSkeleton());
  const seedText = readText(PATHS.seed);
  assertSeedReady(seedText, command);
  assertSettingsReady(settings, command);
  const decisionsText = readText(PATHS.decisions);
  const contextDigest = buildContextDigest(seedText, decisionsText, settings.engine?.max_context_chars || 32000);
  const planning = evaluateSeedAndToggleDna(seedText, dna);
  if (planning.changed) {
    writeJsonYaml(PATHS.dna, dna);
  }

  const taskPlan = routeGenerationTasks(dna);
  const manifest = buildManifest({
    dna,
    settings,
    seedText,
    previousManifest,
    command,
    taskPlan,
    degradedContext: contextDigest.degraded
  });
  if (planning.activated.length > 0) {
    addEvent(manifest, "planning", "DNA nodes activated from seed analysis.", {
      activated_node_ids: planning.activated
    });
  }
  if (contextDigest.degraded) {
    addEvent(manifest, "warning", "Context digest exceeded budget and was condensed.");
  }
  if (taskPlan.length > 0) {
    addEvent(manifest, "routing", "Generation tasks routed to model tiers.", {
      pending_tasks: taskPlan.length,
      tiers: manifest.engine.task_router.model_tiers
    });
  }

  const reconcile = await reconcileExpressedNodes(
    dna,
    seedText,
    settings,
    manifest,
    taskPlan,
    contextDigest.text
  );
  if (reconcile.createdCount > 0) {
    addEvent(manifest, "reconcile", "Expressed files scaffolded.", {
      created_files: reconcile.createdCount
    });
  }

  const refreshedManifest = buildManifest({
    dna,
    settings,
    seedText,
    previousManifest: manifest,
    command,
    taskPlan: routeGenerationTasks(dna),
    degradedContext: contextDigest.degraded
  });
  generateContextSummaries(dna, refreshedManifest.progress.folders, settings, refreshedManifest);
  writeJsonYaml(PATHS.manifest, refreshedManifest);
  injectManifestIntoDashboard(refreshedManifest);
  console.log(`[brainwave] cycle complete at ${nowIso()}`);
}

function printHelp() {
  console.log("Brainwave runner commands:");
  console.log("  node _engine/brainwave_runner.js run      # evaluate seed, reconcile DNA, refresh manifest/dashboard");
  console.log("  node _engine/brainwave_runner.js watch    # run once then watch for workspace changes");
  console.log("  node _engine/brainwave_runner.js express <id...>  # manually toggle DNA nodes to expressed=true");
  console.log("  node _engine/brainwave_runner.js status   # print high-level manifest status");
}

function expressNodes(nodeIds) {
  const dna = readJsonYaml(PATHS.dna, null);
  if (!dna) throw new Error("Missing _dna.yaml");
  validateDna(dna);
  const changed = [];
  for (const id of nodeIds) {
    const node = dna.nodes[id];
    if (!node) continue;
    if (!node.expressed) {
      node.expressed = true;
      changed.push(id);
    }
  }
  if (changed.length > 0) {
    writeJsonYaml(PATHS.dna, dna);
  }
  console.log(`[brainwave] expressed nodes: ${changed.join(", ") || "none"}`);
}

function printStatus() {
  const manifest = readJsonYaml(PATHS.manifest, null);
  if (!manifest) {
    console.log("No manifest available yet.");
    return;
  }
  console.log(`[brainwave] generated_at: ${manifest.generated_at}`);
  console.log(`[brainwave] global_completion_pct: ${manifest.progress.global_completion_pct}%`);
  console.log(`[brainwave] expressed_files: ${manifest.dna.totals.expressed_files}`);
  console.log(`[brainwave] missing_expressed_files: ${manifest.filesystem.missing_expressed_files.length}`);
}

async function watchWorkspace() {
  await runCycle("watch");
  console.log("[brainwave] watching for changes...");

  let timer = null;
  fs.watch(ROOT, { recursive: true }, (eventType, relativePath) => {
    if (!relativePath) return;
    const absolute = path.join(ROOT, relativePath);
    if (shouldIgnoreWatchEvent(absolute)) return;
    if (relativePath.includes(".git/")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
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
    await runCycle("express");
    return;
  }

  if (command === "status") {
    printStatus();
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

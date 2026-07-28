#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  integrateProjectRoot,
  removeProjectRootIntegration
} = require("./project_integration");

const ROOT = path.resolve(__dirname, "..");
const PATHS = Object.freeze({
  seed: path.join(ROOT, "_my_brainwave_seed.md"),
  northStar: path.join(ROOT, "_my_brainwave_north_star.md"),
  state: path.join(ROOT, "_brainwave_state.yaml"),
  settings: path.join(ROOT, "_settings.yaml"),
  dnaDir: path.join(ROOT, "_dna"),
  documentationDir: path.join(ROOT, "_documentation"),
  manifest: path.join(ROOT, "_manifest.yaml"),
  dashboard: path.join(ROOT, "_dashboard.html")
});

const SUPPORTED_DNA_SCHEMA_VERSION = "3.0.0";
const SUPPORTED_STATE_SCHEMA_VERSION = "3.0.0";
const CONSOLE_PREFIX = "[_brainwave]";
const INTERNAL_WRITE_GUARD_MS = 2500;
const internalWrites = new Map();

const DNA_BLOCK_STATUSES = Object.freeze([
  "not_started",
  "in_progress",
  "implemented",
  "verified",
  "blocked",
  "superseded",
  "not_applicable"
]);

const STAGES = Object.freeze([
  "awaiting_seed",
  "shaping_north_star",
  "selecting_dna",
  "scoping_brainwave_documentation",
  "building_brainwave_documentation",
  "reviewing_brainwave_documentation",
  "brainwave_documentation_complete"
]);

const ACTIVE_RECONCILIATION_STAGES = new Set([
  "building_brainwave_documentation",
  "reviewing_brainwave_documentation"
]);

const ALLOWED_STAGE_TRANSITIONS = Object.freeze({
  awaiting_seed: ["shaping_north_star"],
  shaping_north_star: ["selecting_dna"],
  selecting_dna: ["shaping_north_star", "scoping_brainwave_documentation"],
  scoping_brainwave_documentation: [
    "shaping_north_star",
    "selecting_dna",
    "building_brainwave_documentation"
  ],
  building_brainwave_documentation: [
    "shaping_north_star",
    "selecting_dna",
    "scoping_brainwave_documentation",
    "reviewing_brainwave_documentation"
  ],
  reviewing_brainwave_documentation: [
    "shaping_north_star",
    "selecting_dna",
    "scoping_brainwave_documentation",
    "building_brainwave_documentation",
    "brainwave_documentation_complete"
  ],
  brainwave_documentation_complete: [
    "shaping_north_star",
    "selecting_dna",
    "scoping_brainwave_documentation"
  ]
});

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function relativePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function readText(filePath) {
  return exists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  markInternalWrite(filePath);
}

function readJsonYaml(filePath, fallback = null) {
  const raw = readText(filePath).trim();
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${relativePath(filePath)} must be JSON-compatible YAML. ${error.message}`);
  }
}

function writeJsonYaml(filePath, data) {
  writeText(filePath, `${JSON.stringify(data, null, 2)}\n`);
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
  const header = content.split(/^###\s+_DNA-[A-Z]{4}-\d{5}\.\d{2}\b/m)[0];
  const status = header.match(
    /^\s*status:\s*(not_started|in_progress|complete)\s*$/im
  )?.[1]?.toLowerCase();
  return status === "complete" ? "complete" : "in_progress";
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
      max_files_per_cycle: 120
    }
  };
}

function defaultState() {
  return {
    schema_version: SUPPORTED_STATE_SCHEMA_VERSION,
    stage: "awaiting_seed",
    stage_updated_at: null,
    seed: {
      path: "_my_brainwave_seed.md",
      captured_at: null,
      locked_sha256: null
    },
    selected_dna: {}
  };
}

function defaultManifestSkeleton() {
  return {
    schema_version: "3.0.0",
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
      task_router: { pending_tasks: 0 }
    },
    dna: {
      directory: "_dna",
      totals: {
        available_modules: 0,
        selected_modules: 0,
        nodes: 0,
        directories: 0,
        files: 0,
        expressed_nodes: 0,
        expressed_files: 0
      },
      modules: {}
    },
    filesystem: {
      tracked_files: {},
      missing_expressed_files: []
    },
    progress: {
      documentation_completion_pct: 0,
      modules: {}
    },
    implementation: {
      totals: {
        blocks: 0,
        not_started: 0,
        in_progress: 0,
        implemented: 0,
        verified: 0,
        blocked: 0,
        superseded: 0,
        not_applicable: 0,
        invalid: 0
      },
      current: null,
      next: null,
      blocks: []
    },
    events: []
  };
}

function ensureCoreFiles() {
  if (!exists(PATHS.seed)) writeText(PATHS.seed, "");
  if (!exists(PATHS.northStar)) writeText(PATHS.northStar, "");
  if (!exists(PATHS.state)) writeJsonYaml(PATHS.state, defaultState());
  if (!exists(PATHS.settings)) writeJsonYaml(PATHS.settings, defaultSettings());
  if (!exists(PATHS.manifest)) writeJsonYaml(PATHS.manifest, defaultManifestSkeleton());
  fs.mkdirSync(PATHS.dnaDir, { recursive: true });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeModulePath(value) {
  if (typeof value !== "string" || !value.trim() || value.includes("\\")) return false;
  if (path.posix.isAbsolute(value)) return false;
  const segments = value.split("/");
  return !segments.some((segment) => !segment || segment === "." || segment === "..");
}

function validateDnaModule(module, sourcePath) {
  const source = relativePath(sourcePath);
  if (!isPlainObject(module)) throw new Error(`Invalid DNA module: ${source}.`);
  if (module.schema_version !== SUPPORTED_DNA_SCHEMA_VERSION) {
    throw new Error(
      `${source} uses unsupported schema_version ${module.schema_version || "missing"}; expected ${SUPPORTED_DNA_SCHEMA_VERSION}.`
    );
  }
  if (!/^[A-Z]{4}$/.test(module.dna_code || "")) {
    throw new Error(`${source} must define an immutable four-letter uppercase dna_code.`);
  }
  if ("dna_id" in module) {
    throw new Error(
      `${source} must not define a second dna_id. The canonical _DNA-${module.dna_code} identity is authoritative.`
    );
  }
  const expectedFileName = `_DNA-${module.dna_code}.yaml`;
  if (path.basename(sourcePath) !== expectedFileName) {
    throw new Error(`${source} must be named ${expectedFileName}.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(module.dna_version || "")) {
    throw new Error(`${source} must define a semantic dna_version.`);
  }
  for (const key of ["name", "description", "documentation_label"]) {
    if (typeof module[key] !== "string" || !module[key].trim()) {
      throw new Error(`${source} must define ${key}.`);
    }
  }
  if (!isPlainObject(module.nodes) || Object.keys(module.nodes).length === 0) {
    throw new Error(`${source} must include a non-empty nodes object.`);
  }

  const seenPaths = new Set();
  for (const [id, node] of Object.entries(module.nodes)) {
    if (!/^\d{5}$/.test(id) || node?.id !== id) {
      throw new Error(`${source} contains an invalid or mismatched node id: ${id}.`);
    }
    if (!["directory", "file"].includes(node.type)) {
      throw new Error(`${source} contains an invalid node type for ${id}.`);
    }
    if (typeof node.title !== "string" || !node.title.trim()) {
      throw new Error(`${source} node ${id} must define title.`);
    }
    if (typeof node.baseline !== "boolean") {
      throw new Error(`${source} node ${id} must define baseline as a boolean.`);
    }
    if ("required" in node) {
      throw new Error(
        `${source} node ${id} uses the retired required flag. Use baseline for proportionate recommendation guidance.`
      );
    }
    if ("expressed" in node) {
      throw new Error(
        `${source} node ${id} contains project state. DNA definitions must not contain expressed flags.`
      );
    }
    if (!isSafeModulePath(node.path)) {
      throw new Error(`${source} node ${id} has an unsafe module-relative path.`);
    }
    if (seenPaths.has(node.path)) {
      throw new Error(`${source} contains duplicate node path: ${node.path}.`);
    }
    seenPaths.add(node.path);
    if (node.parent_id !== null && node.parent_id !== undefined && !/^\d{5}$/.test(node.parent_id)) {
      throw new Error(`${source} node ${id} has an invalid parent_id.`);
    }
    if (node.type === "directory") {
      if (typeof node.when_relevant !== "string" || !node.when_relevant.trim()) {
        throw new Error(`${source} document group ${id} must define when_relevant.`);
      }
      if ("intent" in node) {
        throw new Error(`${source} document group ${id} must use when_relevant rather than intent.`);
      }
    }
    if (node.type === "file") {
      if (typeof node.intent !== "string" || !node.intent.trim()) {
        throw new Error(`${source} file node ${id} must define intent.`);
      }
      if ("when_relevant" in node) {
        throw new Error(`${source} file node ${id} must use intent rather than when_relevant.`);
      }
      const fileName = path.posix.basename(node.path);
      if (!fileName.startsWith(id) || !fileName.endsWith(".md")) {
        throw new Error(`${source} file node ${id} must use an ID-prefixed Markdown filename.`);
      }
      const firstSegment = node.path.split("/")[0];
      const documentGroupPrefix = firstSegment.match(/^(\d{3})\d{2}_/)?.[1];
      if (!documentGroupPrefix || documentGroupPrefix !== id.slice(0, 3)) {
        throw new Error(`${source} document ${id} must match its document-group prefix.`);
      }
    }
  }

  for (const [id, node] of Object.entries(module.nodes)) {
    if (node.parent_id === null || node.parent_id === undefined) {
      if (node.type !== "directory") {
        throw new Error(`${source} root node ${id} must be a directory.`);
      }
      continue;
    }
    const parent = module.nodes[node.parent_id];
    if (!parent || parent.type !== "directory") {
      throw new Error(`${source} node ${id} must reference an existing directory parent.`);
    }
    const expectedPrefix = `${parent.path}/`;
    if (!node.path.startsWith(expectedPrefix)) {
      throw new Error(`${source} node ${id} must be nested beneath parent ${node.parent_id}.`);
    }

    const visited = new Set([id]);
    let cursor = parent;
    while (cursor) {
      if (visited.has(cursor.id)) {
        throw new Error(`${source} contains a parent cycle involving ${id}.`);
      }
      visited.add(cursor.id);
      cursor = cursor.parent_id ? module.nodes[cursor.parent_id] : null;
    }
  }
}

function loadDnaModules() {
  const sourcePaths = fs.readdirSync(PATHS.dnaDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(PATHS.dnaDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (sourcePaths.length === 0) {
    throw new Error("No DNA modules found in `_dna/`.");
  }

  const modules = {};
  for (const sourcePath of sourcePaths) {
    const module = readJsonYaml(sourcePath, null);
    validateDnaModule(module, sourcePath);
    const moduleId = canonicalModuleId(module);
    if (modules[moduleId]) {
      throw new Error(`Duplicate DNA module code: ${module.dna_code}.`);
    }
    modules[moduleId] = {
      ...module,
      source_path: relativePath(sourcePath)
    };
  }
  return modules;
}

function validateState(state, modules, options = {}) {
  if (!isPlainObject(state)) throw new Error("Invalid `_brainwave_state.yaml` content.");
  if (state.schema_version !== SUPPORTED_STATE_SCHEMA_VERSION) {
    throw new Error(
      `_brainwave_state.yaml uses unsupported schema_version ${state.schema_version || "missing"}; expected ${SUPPORTED_STATE_SCHEMA_VERSION}.`
    );
  }
  if (!STAGES.includes(state.stage)) {
    throw new Error(`Invalid _brainwave stage: ${state.stage || "missing"}.`);
  }
  if (state.selected_dna === undefined) state.selected_dna = {};
  if (!isPlainObject(state.selected_dna)) {
    throw new Error("`selected_dna` must be an object.");
  }

  for (const [moduleId, selection] of Object.entries(state.selected_dna)) {
    const module = modules[moduleId];
    if (!module) {
      throw new Error(`Selected DNA module is unavailable: ${moduleId}.`);
    }
    if (
      !isPlainObject(selection) ||
      (!options.allowVersionMismatch && selection.version !== module.dna_version)
    ) {
      throw new Error(
        `Selected DNA version mismatch for ${moduleId}: expected ${module.dna_version}, found ${selection?.version || "missing"}. Review and reselect the module before continuing.`
      );
    }
    if (!Array.isArray(selection.expressed_entries)) {
      throw new Error(`Selected DNA ${moduleId} must define expressed_entries as an array.`);
    }
    const unique = new Set();
    for (const nodeId of selection.expressed_entries) {
      if (!module.nodes[nodeId]) {
        throw new Error(`Selected DNA ${moduleId} references unknown node ${nodeId}.`);
      }
      if (unique.has(nodeId)) {
        throw new Error(`Selected DNA ${moduleId} repeats expressed node ${nodeId}.`);
      }
      unique.add(nodeId);
    }
    for (const nodeId of unique) {
      let parentId = module.nodes[nodeId].parent_id;
      while (parentId) {
        if (!unique.has(parentId)) {
          throw new Error(
            `Selected DNA ${moduleId} expresses ${nodeId} without parent ${parentId}.`
          );
        }
        parentId = module.nodes[parentId].parent_id;
      }
    }
  }
}

function loadWorkspace(options = {}) {
  ensureCoreFiles();
  const settings = { ...defaultSettings(), ...readJsonYaml(PATHS.settings, defaultSettings()) };
  const modules = loadDnaModules();
  const state = readJsonYaml(PATHS.state, defaultState());
  validateState(state, modules, options);
  return {
    settings,
    modules,
    state,
    seedText: readText(PATHS.seed),
    northStarText: readText(PATHS.northStar),
    previousManifest: readJsonYaml(PATHS.manifest, defaultManifestSkeleton())
  };
}

function addEvent(manifest, type, message, data = null) {
  if (!Array.isArray(manifest.events)) manifest.events = [];
  manifest.events.push({ at: nowIso(), type, message, data });
  manifest.events = manifest.events.slice(-120);
}

function getChildren(module, parentId) {
  return Object.values(module.nodes)
    .filter((node) => node.parent_id === parentId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getDescendantFileNodes(module, parentId) {
  const results = [];
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const child of getChildren(module, current)) {
      if (child.type === "file") results.push(child);
      if (child.type === "directory") stack.push(child.id);
    }
  }
  return results.sort((a, b) => a.id.localeCompare(b.id));
}

function expressionSet(state, moduleId) {
  return new Set(state.selected_dna[moduleId]?.expressed_entries || []);
}

function selectedModules(workspace) {
  return Object.keys(workspace.state.selected_dna)
    .sort()
    .map((moduleId) => workspace.modules[moduleId]);
}

function canonicalModuleId(module) {
  return `_DNA-${module.dna_code}`;
}

function qualifiedNodeId(module, nodeId) {
  return `${canonicalModuleId(module)}-${nodeId}`;
}

function moduleFromCode(modules, dnaCode) {
  return Object.values(modules).find((module) => module.dna_code === dnaCode) || null;
}

function parseModuleRef(value, modules) {
  const match = String(value).match(/^_DNA-([A-Z]{4})$/);
  const module = match ? moduleFromCode(modules, match[1]) : null;
  if (!module) {
    throw new Error(`Unknown DNA module identity: ${value}. Expected \`_DNA-CODE\`.`);
  }
  return module;
}

function parseQualifiedNodeRef(value, modules) {
  const match = String(value).match(/^_DNA-([A-Z]{4})-(\d{5})$/);
  if (!match) {
    throw new Error(`DNA node reference must use \`_DNA-CODE-00000\`: ${value}.`);
  }
  const module = moduleFromCode(modules, match[1]);
  if (!module) throw new Error(`Unknown DNA module code: ${match[1]}.`);
  return { moduleId: canonicalModuleId(module), nodeId: match[2], module };
}

function moduleOutputRoot(module) {
  return path.join(PATHS.documentationDir, canonicalModuleId(module));
}

function canonicalNodePath(module, node) {
  if (node.type !== "file") return node.path;
  const segments = node.path.split("/");
  const fileName = segments.pop();
  segments.push(`${canonicalModuleId(module)}-${fileName}`);
  return segments.join("/");
}

function nodeOutputPath(module, node) {
  const outputRoot = moduleOutputRoot(module);
  const outputPath = path.resolve(outputRoot, ...canonicalNodePath(module, node).split("/"));
  const rootNormalized = `${normalizePath(outputRoot)}/`;
  if (!normalizePath(outputPath).startsWith(rootNormalized)) {
    throw new Error(`DNA node ${qualifiedNodeId(module, node.id)} resolves outside its output root.`);
  }
  return outputPath;
}

function documentedRelativePath(module, node) {
  return relativePath(nodeOutputPath(module, node));
}

function routeGenerationTasks(workspace) {
  const tasks = [];
  for (const module of selectedModules(workspace)) {
    const moduleId = canonicalModuleId(module);
    const expressed = expressionSet(workspace.state, moduleId);
    for (const node of Object.values(module.nodes)) {
      if (node.type !== "file" || !expressed.has(node.id)) continue;
      const outputPath = nodeOutputPath(module, node);
      if (exists(outputPath)) continue;
      tasks.push({
        module_id: moduleId,
        node_id: node.id,
        qualified_node_id: qualifiedNodeId(module, node.id),
        path: relativePath(outputPath),
        priority: node.baseline ? 1 : 2
      });
    }
  }
  return tasks.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.module_id.localeCompare(b.module_id) ||
      a.node_id.localeCompare(b.node_id)
  );
}

function buildScaffoldContent(module, fileNode) {
  const documentId = qualifiedNodeId(module, fileNode.id);
  const firstBlockId = `${documentId}.01`;
  return [
    `# ${fileNode.title || fileNode.id}`,
    "",
    "Status: in_progress",
    `Last updated: ${nowIso()}`,
    `DNA document: \`${documentId}\``,
    `DNA module: \`${canonicalModuleId(module)}\` version \`${module.dna_version}\``,
    "",
    "## Purpose",
    `- ${fileNode.intent || "Define this document clearly before implementation."}`,
    "",
    "## Directional Context",
    "- North Star: `_my_brainwave_north_star.md`",
    "- Steering decisions: `_decisions_log.md`",
    "",
    "## DNA Blocks",
    "",
    `### ${firstBlockId} - Initial Direction`,
    "",
    "Status: not_started",
    "Supersedes: none",
    "",
    "#### Context",
    "",
    "#### Direction",
    "",
    "#### Rationale",
    "",
    "#### Alternatives Considered",
    "",
    "#### Consequences",
    "",
    "#### Future Fit",
    "",
    "#### Verification",
    "",
    "## Document Open Questions",
    ""
  ].join("\n");
}

function parseDnaBlocks(module, fileNode, content) {
  const documentId = qualifiedNodeId(module, fileNode.id);
  const headingPattern =
    /^###\s+`?(_DNA-[A-Z]{4}-\d{5}\.\d{2})`?\s+(?:-|—)\s+(.+?)\s*$/gm;
  const matches = [...content.matchAll(headingPattern)];
  const blocks = [];
  const errors = [];
  const seen = new Set();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const id = match[1];
    const title = match[2].trim();
    const section = content.slice(
      match.index,
      matches[index + 1]?.index ?? content.length
    );
    const rawStatus = section.match(/^\s*Status:\s*([a-z_]+)\s*$/im)?.[1]?.toLowerCase();
    const status = DNA_BLOCK_STATUSES.includes(rawStatus) ? rawStatus : "invalid";
    const supersedes = section.match(/^\s*Supersedes:\s*(.+?)\s*$/im)?.[1]?.trim() || null;
    const supersededBy =
      section.match(/^\s*Superseded by:\s*(.+?)\s*$/im)?.[1]?.trim() || null;

    if (!id.startsWith(`${documentId}.`)) {
      errors.push(`${id} does not belong to ${documentId}.`);
    }
    if (seen.has(id)) errors.push(`${id} is duplicated.`);
    seen.add(id);
    if (status === "invalid") errors.push(`${id} has a missing or invalid Status.`);

    if (status === "superseded") {
      if (!supersededBy || !/^_DNA-[A-Z]{4}-\d{5}\.\d{2}$/.test(supersededBy)) {
        errors.push(`${id} must identify its replacement with Superseded by.`);
      }
    } else {
      if (!supersedes) errors.push(`${id} must define Supersedes: none or a block ID.`);
      for (const heading of [
        "Context",
        "Direction",
        "Rationale",
        "Alternatives Considered",
        "Consequences",
        "Future Fit",
        "Verification"
      ]) {
        const pattern = new RegExp(`^####\\s+${heading}\\s*$`, "im");
        if (!pattern.test(section)) errors.push(`${id} is missing ${heading}.`);
      }
    }

    blocks.push({
      id,
      slice: id.split(".").pop(),
      title,
      status,
      supersedes,
      superseded_by: supersededBy
    });
  }

  if (content.trim() && matches.length === 0) {
    errors.push(`${documentId} contains no DNA blocks.`);
  }

  return { blocks, errors };
}

function reconcileExpressedNodes(workspace, manifest, taskPlan) {
  const maxFiles = workspace.settings.engine?.max_files_per_cycle || 120;
  let createdCount = 0;

  for (const module of selectedModules(workspace)) {
    const expressed = expressionSet(workspace.state, canonicalModuleId(module));
    for (const node of Object.values(module.nodes).sort((a, b) => a.id.localeCompare(b.id))) {
      if (node.type !== "directory" || !expressed.has(node.id)) continue;
      fs.mkdirSync(nodeOutputPath(module, node), { recursive: true });
    }
  }

  for (const task of taskPlan) {
    if (createdCount >= maxFiles) {
      addEvent(manifest, "warning", "Cycle file limit reached; remaining scaffolds were deferred.");
      break;
    }
    const module = workspace.modules[task.module_id];
    const node = module?.nodes[task.node_id];
    if (!node) continue;
    const outputPath = nodeOutputPath(module, node);
    if (!exists(outputPath)) {
      writeText(outputPath, buildScaffoldContent(module, node));
      createdCount += 1;
    }
  }
  return { createdCount };
}

function computeModuleProgress(module, state, trackedFiles) {
  const moduleId = canonicalModuleId(module);
  const expressed = expressionSet(state, moduleId);
  const folders = {};
  const directories = Object.values(module.nodes)
    .filter((node) => node.type === "directory")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const directory of directories) {
    const availableFiles = getDescendantFileNodes(module, directory.id);
    const expressedFiles = availableFiles.filter((node) => expressed.has(node.id));
    const completedFiles = expressedFiles.filter((node) => {
      const key = documentedRelativePath(module, node);
      return trackedFiles[key]?.processing_status === "complete";
    }).length;
    folders[directory.id] = {
      title: directory.title,
      path: relativePath(nodeOutputPath(module, directory)),
      available_files: availableFiles.length,
      expressed_files: expressedFiles.length,
      completed_files: completedFiles,
      completion_pct:
        expressedFiles.length === 0
          ? 0
          : Math.round((completedFiles / expressedFiles.length) * 100)
    };
  }

  const fileNodes = Object.values(module.nodes).filter((node) => node.type === "file");
  const expressedFiles = fileNodes.filter((node) => expressed.has(node.id));
  const completedFiles = expressedFiles.filter((node) => {
    const key = documentedRelativePath(module, node);
    return trackedFiles[key]?.processing_status === "complete";
  }).length;

  return {
    name: module.name,
    version: module.dna_version,
    documentation_label: module.documentation_label,
    selected: Boolean(state.selected_dna[moduleId]),
    available_files: fileNodes.length,
    expressed_files: expressedFiles.length,
    completed_files: completedFiles,
    completion_pct:
      expressedFiles.length === 0
        ? 0
        : Math.round((completedFiles / expressedFiles.length) * 100),
    folders
  };
}

function buildManifest(workspace, command, taskPlan = [], prior = null) {
  const manifest = defaultManifestSkeleton();
  const previous = prior || workspace.previousManifest;
  if (previous && Array.isArray(previous.events)) {
    manifest.events = previous.events.slice(-100);
  }

  manifest.generated_at = nowIso();
  manifest.engine.status = "ok";
  manifest.engine.last_command = command;
  manifest.engine.last_cycle_at = nowIso();
  manifest.engine.task_router.pending_tasks = taskPlan.length;

  manifest.settings.loaded = true;
  manifest.settings.technical_proficiency = workspace.settings.technical_proficiency ?? null;
  manifest.settings.ideation_mode = workspace.settings.ideation_mode ?? null;
  manifest.settings.verbosity_budget = workspace.settings.verbosity_budget ?? null;

  const currentSeedHash = workspace.seedText.trim() ? sha256(workspace.seedText) : null;
  const lockedSeedHash = workspace.state.seed?.locked_sha256 || null;
  manifest.seed.word_count = wordCount(workspace.seedText);
  manifest.seed.current_sha256 = currentSeedHash;
  manifest.seed.locked_sha256 = lockedSeedHash;
  manifest.seed.integrity = !lockedSeedHash
    ? "unlocked"
    : currentSeedHash === lockedSeedHash
      ? "unchanged"
      : "changed";
  manifest.seed.captured_at = workspace.state.seed?.captured_at || null;
  manifest.seed.last_ingested_at = nowIso();

  manifest.north_star.status = northStarStatusFromContent(workspace.northStarText);
  manifest.north_star.word_count = wordCount(workspace.northStarText);
  manifest.north_star.sha256 = workspace.northStarText.trim()
    ? sha256(workspace.northStarText)
    : null;
  manifest.north_star.updated_at = exists(PATHS.northStar)
    ? fs.statSync(PATHS.northStar).mtime.toISOString()
    : null;

  manifest.lifecycle.stage = workspace.state.stage;
  manifest.lifecycle.stage_updated_at = workspace.state.stage_updated_at || null;
  manifest.lifecycle.passive = workspace.state.stage === "brainwave_documentation_complete";

  const trackedFiles = {};
  const missingExpressedFiles = [];
  const implementationBlocks = [];
  let totalNodes = 0;
  let totalDirectories = 0;
  let totalFiles = 0;
  let totalExpressedNodes = 0;
  let totalExpressedFiles = 0;

  for (const module of Object.values(workspace.modules).sort((a, b) =>
    canonicalModuleId(a).localeCompare(canonicalModuleId(b))
  )) {
    const moduleId = canonicalModuleId(module);
    const selection = workspace.state.selected_dna[moduleId] || null;
    const expressed = expressionSet(workspace.state, moduleId);
    const moduleNodes = {};
    const nodes = Object.values(module.nodes).sort((a, b) => a.id.localeCompare(b.id));
    totalNodes += nodes.length;
    totalDirectories += nodes.filter((node) => node.type === "directory").length;
    totalFiles += nodes.filter((node) => node.type === "file").length;
    totalExpressedNodes += expressed.size;

    for (const node of nodes) {
      const isExpressed = expressed.has(node.id);
      let processingStatus = "container";
      let outputPath = null;
      let blockCount = 0;
      let contractErrors = [];
      if (node.type === "file") {
        outputPath = documentedRelativePath(module, node);
        const absolute = nodeOutputPath(module, node);
        const fileExists = exists(absolute);
        const content = fileExists ? readText(absolute) : "";
        processingStatus = fileExists ? fileStatusFromContent(content) : "not_started";
        const parsedBlocks = fileExists
          ? parseDnaBlocks(module, node, content)
          : { blocks: [], errors: [] };
        blockCount = parsedBlocks.blocks.length;
        contractErrors = parsedBlocks.errors;
        for (const block of parsedBlocks.blocks) {
          implementationBlocks.push({
            ...block,
            module_id: moduleId,
            module_name: module.name,
            document_id: qualifiedNodeId(module, node.id),
            document_title: node.title,
            path: outputPath
          });
        }
        if (isExpressed || fileExists) {
          trackedFiles[outputPath] = {
            module_id: moduleId,
            dna_code: module.dna_code,
            dna_version: module.dna_version,
            node_id: node.id,
            qualified_node_id: qualifiedNodeId(module, node.id),
            baseline: Boolean(node.baseline),
            expressed: isExpressed,
            exists: fileExists,
            processing_status: processingStatus,
            block_count: blockCount,
            contract_errors: contractErrors,
            word_count: fileExists ? wordCount(content) : 0,
            sha256: fileExists ? sha256(content) : null,
            updated_at: fileExists ? fs.statSync(absolute).mtime.toISOString() : null
          };
        }
        if (isExpressed) {
          totalExpressedFiles += 1;
          if (!fileExists) missingExpressedFiles.push(outputPath);
        }
      }
      moduleNodes[node.id] = {
        id: node.id,
        qualified_id: qualifiedNodeId(module, node.id),
        type: node.type,
        title: node.title || null,
        when_relevant: node.when_relevant || null,
        parent_id: node.parent_id || null,
        baseline: Boolean(node.baseline),
        expressed: isExpressed,
        processing_status: processingStatus,
        block_count: blockCount,
        contract_errors: contractErrors
      };
    }

    manifest.dna.modules[moduleId] = {
      source_path: module.source_path,
      dna_code: module.dna_code,
      canonical_id: canonicalModuleId(module),
      name: module.name,
      description: module.description,
      version: module.dna_version,
      schema_version: module.schema_version,
      documentation_label: module.documentation_label,
      selected: Boolean(selection),
      selected_version: selection?.version || null,
      totals: {
        nodes: nodes.length,
        directories: nodes.filter((node) => node.type === "directory").length,
        files: nodes.filter((node) => node.type === "file").length,
        expressed_nodes: expressed.size,
        expressed_files: nodes.filter(
          (node) => node.type === "file" && expressed.has(node.id)
        ).length
      },
      nodes: moduleNodes
    };
  }

  manifest.dna.totals = {
    available_modules: Object.keys(workspace.modules).length,
    selected_modules: Object.keys(workspace.state.selected_dna).length,
    nodes: totalNodes,
    directories: totalDirectories,
    files: totalFiles,
    expressed_nodes: totalExpressedNodes,
    expressed_files: totalExpressedFiles
  };

  manifest.filesystem.tracked_files = trackedFiles;
  manifest.filesystem.missing_expressed_files = missingExpressedFiles.sort();

  let expressedFilesAcrossModules = 0;
  let completedFilesAcrossModules = 0;
  for (const module of Object.values(workspace.modules).sort((a, b) =>
    canonicalModuleId(a).localeCompare(canonicalModuleId(b))
  )) {
    const moduleId = canonicalModuleId(module);
    const progress = computeModuleProgress(module, workspace.state, trackedFiles);
    manifest.progress.modules[moduleId] = progress;
    if (progress.selected) {
      expressedFilesAcrossModules += progress.expressed_files;
      completedFilesAcrossModules += progress.completed_files;
    }
  }
  manifest.progress.documentation_completion_pct =
    expressedFilesAcrossModules === 0
      ? 0
      : Math.round((completedFilesAcrossModules / expressedFilesAcrossModules) * 100);

  implementationBlocks.sort(
    (a, b) =>
      a.module_id.localeCompare(b.module_id) ||
      a.document_id.localeCompare(b.document_id) ||
      a.id.localeCompare(b.id)
  );
  manifest.implementation.blocks = implementationBlocks;
  manifest.implementation.totals.blocks = implementationBlocks.length;
  for (const block of implementationBlocks) {
    manifest.implementation.totals[block.status] += 1;
  }
  manifest.implementation.current =
    implementationBlocks.find((block) => block.status === "in_progress") || null;
  manifest.implementation.next =
    implementationBlocks.find((block) => block.status === "not_started") || null;

  return manifest;
}

function injectManifestIntoDashboard(manifest) {
  if (!exists(PATHS.dashboard)) return;
  const html = readText(PATHS.dashboard);
  const scriptJson = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const embedded = `<script id="brainwave-state" type="application/json">${scriptJson}</script>`;
  const pattern = /<script id="brainwave-state" type="application\/json">[\s\S]*?<\/script>/;
  const updated = pattern.test(html)
    ? html.replace(pattern, embedded)
    : html.includes("</body>")
      ? html.replace("</body>", `  ${embedded}\n</body>`)
      : `${html}\n${embedded}\n`;
  if (updated !== html) writeText(PATHS.dashboard, updated);
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
  const allowed = settings.allowed_values?.[key];
  const value = settings[key];
  return Array.isArray(allowed) && allowed.length > 0 ? allowed.includes(value) : Boolean(value);
}

function isSettingsConfigured(settings) {
  return Boolean(
    settings &&
      settings.configured === true &&
      (!settings.onboarding_status || settings.onboarding_status === "complete") &&
      hasAllowedSetting(settings, "technical_proficiency") &&
      hasAllowedSetting(settings, "ideation_mode") &&
      hasAllowedSetting(settings, "verbosity_budget")
  );
}

function assertSettingsReady(settings) {
  if (!isSettingsConfigured(settings)) {
    throw new Error(
      "Profile pre-check failed: `_settings.yaml` is incomplete. Complete onboarding before progressing _brainwave documentation."
    );
  }
}

function assertSeedIntegrity(state, seedText) {
  if (!seedText.trim()) {
    throw new Error("Seed pre-check failed: `_my_brainwave_seed.md` is empty.");
  }
  const lockedHash = state.seed?.locked_sha256;
  if (!lockedHash) {
    throw new Error(
      "Seed pre-check failed: the _brainwave Seed has not been locked. Transition from `awaiting_seed` to `shaping_north_star` first."
    );
  }
  if (sha256(seedText) !== lockedHash) {
    throw new Error(
      "Seed integrity failed: `_my_brainwave_seed.md` changed after capture. Restore the immutable seed before continuing."
    );
  }
}

function assertNorthStarAgreed(northStarText) {
  if (northStarStatusFromContent(northStarText) !== "agreed") {
    throw new Error(
      "North Star pre-check failed: `_my_brainwave_north_star.md` must contain `Status: agreed` after explicit user agreement."
    );
  }
}

function assertSelectedDna(state) {
  if (Object.keys(state.selected_dna).length === 0) {
    throw new Error("No DNA modules are selected.");
  }
}

function expressedFileEntries(workspace) {
  const entries = [];
  for (const module of selectedModules(workspace)) {
    const expressed = expressionSet(workspace.state, canonicalModuleId(module));
    for (const node of Object.values(module.nodes)) {
      if (node.type === "file" && expressed.has(node.id)) {
        entries.push({ module, node });
      }
    }
  }
  return entries.sort(
    (a, b) =>
      canonicalModuleId(a.module).localeCompare(canonicalModuleId(b.module)) ||
      a.node.id.localeCompare(b.node.id)
  );
}

function incompleteExpressedFiles(workspace) {
  return expressedFileEntries(workspace).filter(({ module, node }) => {
    const absolute = nodeOutputPath(module, node);
    return !exists(absolute) || fileStatusFromContent(readText(absolute)) !== "complete";
  });
}

function expressedBlockContractErrors(workspace) {
  const errors = [];
  for (const { module, node } of expressedFileEntries(workspace)) {
    const absolute = nodeOutputPath(module, node);
    if (!exists(absolute)) continue;
    const parsed = parseDnaBlocks(module, node, readText(absolute));
    errors.push(...parsed.errors);
  }
  return errors;
}

function buildWorkspaceManifest(workspace, command, prior = null) {
  return buildManifest(workspace, command, routeGenerationTasks(workspace), prior);
}

function persistWorkspaceManifest(workspace, command, prior = null) {
  const manifest = buildWorkspaceManifest(workspace, command, prior);
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  return manifest;
}

function assertReconciliationReady(workspace) {
  assertSeedIntegrity(workspace.state, workspace.seedText);
  assertSettingsReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  assertSelectedDna(workspace.state);
  if (!ACTIVE_RECONCILIATION_STAGES.has(workspace.state.stage)) {
    if (workspace.state.stage === "brainwave_documentation_complete") {
      throw new Error(
        "_brainwave is passive because its documentation is complete. Reopen _brainwave explicitly before reconciling."
      );
    }
    throw new Error(
      `Reconciliation is unavailable during \`${workspace.state.stage}\`. Transition to \`building_brainwave_documentation\` first.`
    );
  }
}

async function runCycle(command) {
  const workspace = loadWorkspace();
  assertReconciliationReady(workspace);
  const taskPlan = routeGenerationTasks(workspace);
  const manifest = buildManifest(workspace, command, taskPlan, workspace.previousManifest);
  if (taskPlan.length > 0) {
    addEvent(manifest, "routing", "Expressed _brainwave documentation scaffolds are pending.", {
      pending_tasks: taskPlan.length
    });
  }

  const result = reconcileExpressedNodes(workspace, manifest, taskPlan);
  if (result.createdCount > 0) {
    addEvent(manifest, "reconcile", "Expressed files scaffolded.", {
      created_files: result.createdCount
    });
  }

  const refreshed = buildManifest(
    workspace,
    command,
    routeGenerationTasks(workspace),
    manifest
  );
  writeJsonYaml(PATHS.manifest, refreshed);
  injectManifestIntoDashboard(refreshed);
  console.log(`${CONSOLE_PREFIX} cycle complete at ${nowIso()}`);
}

function listDnaModules() {
  const workspace = loadWorkspace({ allowVersionMismatch: true });
  console.log("Available DNA modules:");
  for (const module of Object.values(workspace.modules).sort((a, b) =>
    canonicalModuleId(a).localeCompare(canonicalModuleId(b))
  )) {
    const moduleId = canonicalModuleId(module);
    const selection = workspace.state.selected_dna[moduleId];
    const selected = selection
      ? selection.version === module.dna_version
        ? "selected"
        : `selected at ${selection.version}; update available`
      : "available";
    const files = Object.values(module.nodes).filter((node) => node.type === "file").length;
    console.log(
      `  ${canonicalModuleId(module)} ${module.dna_version} — ${module.name} (${files} documents, ${selected})`
    );
  }
}

function selectDnaModules(moduleRefs) {
  const workspace = loadWorkspace({ allowVersionMismatch: true });
  assertSeedIntegrity(workspace.state, workspace.seedText);
  assertSettingsReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  if (workspace.state.stage !== "selecting_dna") {
    throw new Error(
      `DNA selection is available only during \`selecting_dna\`, not \`${workspace.state.stage}\`.`
    );
  }

  const selectedModulesById = new Map();
  for (const moduleRef of moduleRefs) {
    const module = parseModuleRef(moduleRef, workspace.modules);
    selectedModulesById.set(canonicalModuleId(module), module);
  }
  const uniqueIds = [...selectedModulesById.keys()].sort();
  if (uniqueIds.length === 0) throw new Error("Select at least one DNA module.");

  const selected = {};
  for (const moduleId of uniqueIds) {
    const module = selectedModulesById.get(moduleId);
    const previous = workspace.state.selected_dna[moduleId];
    selected[moduleId] = {
      version: module.dna_version,
      expressed_entries:
        previous?.version === module.dna_version ? previous.expressed_entries : []
    };
  }
  workspace.state.selected_dna = selected;
  writeJsonYaml(PATHS.state, workspace.state);
  const manifest = buildWorkspaceManifest(workspace, "select-dna");
  addEvent(manifest, "dna_selection", "DNA modules selected after user agreement.", {
    selected_dna: uniqueIds.map((dnaId) => ({
      module_id: dnaId,
      version: workspace.modules[dnaId].dna_version
    }))
  });
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(
    `${CONSOLE_PREFIX} selected DNA: ${uniqueIds
      .map((dnaId) => canonicalModuleId(workspace.modules[dnaId]))
      .join(", ")}`
  );
}

function mutateExpression(nodeRefs, expressedValue) {
  const workspace = loadWorkspace();
  assertSeedIntegrity(workspace.state, workspace.seedText);
  assertSettingsReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  if (workspace.state.stage !== "scoping_brainwave_documentation") {
    throw new Error(
      `DNA expression is available only during \`scoping_brainwave_documentation\`, not \`${workspace.state.stage}\`.`
    );
  }

  const changed = [];
  for (const nodeRef of nodeRefs) {
    const { moduleId, nodeId, module } = parseQualifiedNodeRef(nodeRef, workspace.modules);
    const selection = workspace.state.selected_dna[moduleId];
    if (!selection || !module) {
      throw new Error(`DNA module is not selected: ${canonicalModuleId(module)}.`);
    }
    if (!module.nodes[nodeId]) {
      throw new Error(`Unknown DNA node: ${qualifiedNodeId(module, nodeId)}.`);
    }

    const selectedIds = new Set(selection.expressed_entries);
    if (expressedValue) {
      let cursor = module.nodes[nodeId];
      while (cursor) {
        if (!selectedIds.has(cursor.id)) {
          selectedIds.add(cursor.id);
          changed.push(qualifiedNodeId(module, cursor.id));
        }
        cursor = cursor.parent_id ? module.nodes[cursor.parent_id] : null;
      }
    } else {
      const toRemove = new Set([nodeId]);
      if (module.nodes[nodeId].type === "directory") {
        for (const child of getDescendantFileNodes(module, nodeId)) toRemove.add(child.id);
        for (const candidate of Object.values(module.nodes)) {
          let parentId = candidate.parent_id;
          while (parentId) {
            if (parentId === nodeId) toRemove.add(candidate.id);
            parentId = module.nodes[parentId]?.parent_id || null;
          }
        }
      }
      for (const id of toRemove) {
        if (selectedIds.delete(id)) changed.push(qualifiedNodeId(module, id));
      }
    }
    selection.expressed_entries = [...selectedIds].sort();
  }

  writeJsonYaml(PATHS.state, workspace.state);
  const command = expressedValue ? "express" : "unexpress";
  const manifest = buildWorkspaceManifest(workspace, command);
  addEvent(
    manifest,
    "scope",
    expressedValue
      ? "_brainwave documentation nodes expressed after user-approved scoping."
      : "_brainwave documentation nodes removed from scope after user approval.",
    { node_refs: [...new Set(changed)].sort() }
  );
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(
    `${CONSOLE_PREFIX} ${command}ed nodes: ${[...new Set(changed)].sort().join(", ") || "none"}`
  );
}

function transitionStage(targetStage) {
  if (!STAGES.includes(targetStage)) {
    throw new Error(`Unknown _brainwave stage: ${targetStage}.`);
  }
  const workspace = loadWorkspace();
  const currentStage = workspace.state.stage;
  if (targetStage === currentStage) {
    console.log(`${CONSOLE_PREFIX} stage unchanged: ${currentStage}`);
    return;
  }
  if (!(ALLOWED_STAGE_TRANSITIONS[currentStage] || []).includes(targetStage)) {
    throw new Error(`Invalid stage transition: ${currentStage} -> ${targetStage}.`);
  }

  if (currentStage === "awaiting_seed" && targetStage === "shaping_north_star") {
    if (!workspace.seedText.trim()) {
      throw new Error("Cannot capture the _brainwave Seed because `_my_brainwave_seed.md` is empty.");
    }
    workspace.state.seed = {
      path: "_my_brainwave_seed.md",
      captured_at: nowIso(),
      locked_sha256: sha256(workspace.seedText)
    };
  } else {
    assertSeedIntegrity(workspace.state, workspace.seedText);
  }

  const directionReadyStages = new Set([
    "selecting_dna",
    "scoping_brainwave_documentation",
    "building_brainwave_documentation",
    "reviewing_brainwave_documentation",
    "brainwave_documentation_complete"
  ]);
  if (directionReadyStages.has(targetStage)) {
    assertSettingsReady(workspace.settings);
    assertNorthStarAgreed(workspace.northStarText);
  }
  if (
    [
      "scoping_brainwave_documentation",
      "building_brainwave_documentation",
      "reviewing_brainwave_documentation",
      "brainwave_documentation_complete"
    ].includes(targetStage)
  ) {
    assertSelectedDna(workspace.state);
  }
  if (
    [
      "building_brainwave_documentation",
      "reviewing_brainwave_documentation",
      "brainwave_documentation_complete"
    ].includes(targetStage) &&
    expressedFileEntries(workspace).length === 0
  ) {
    throw new Error("No _brainwave documentation files are expressed.");
  }
  if (
    ["reviewing_brainwave_documentation", "brainwave_documentation_complete"].includes(targetStage)
  ) {
    const incomplete = incompleteExpressedFiles(workspace);
    if (incomplete.length > 0) {
      throw new Error(
        `_brainwave documentation is incomplete: ${incomplete
          .map(({ module, node }) => qualifiedNodeId(module, node.id))
          .join(", ")}.`
      );
    }
    const contractErrors = expressedBlockContractErrors(workspace);
    if (contractErrors.length > 0) {
      throw new Error(`DNA block contract failed: ${contractErrors.join(" ")}`);
    }
  }

  workspace.state.stage = targetStage;
  workspace.state.stage_updated_at = nowIso();
  writeJsonYaml(PATHS.state, workspace.state);
  const manifest = buildWorkspaceManifest(workspace, "transition");
  addEvent(manifest, "lifecycle", `_brainwave stage changed from ${currentStage} to ${targetStage}.`);
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(`${CONSOLE_PREFIX} stage: ${currentStage} -> ${targetStage}`);
}

function printStatus() {
  const workspace = loadWorkspace();
  const manifest = buildWorkspaceManifest(workspace, "status");
  const selected = selectedModules(workspace).map((module) => canonicalModuleId(module));
  console.log(`${CONSOLE_PREFIX} stage: ${workspace.state.stage}`);
  console.log(`${CONSOLE_PREFIX} seed_integrity: ${manifest.seed.integrity}`);
  console.log(`${CONSOLE_PREFIX} north_star_status: ${manifest.north_star.status}`);
  console.log(`${CONSOLE_PREFIX} available_dna: ${Object.keys(workspace.modules).length}`);
  console.log(`${CONSOLE_PREFIX} selected_dna: ${selected.join(", ") || "none"}`);
  console.log(
    `${CONSOLE_PREFIX} documentation_completion_pct: ${manifest.progress.documentation_completion_pct}%`
  );
  console.log(`${CONSOLE_PREFIX} implementation_blocks: ${manifest.implementation.totals.blocks}`);
  console.log(`${CONSOLE_PREFIX} expressed_files: ${manifest.dna.totals.expressed_files}`);
  console.log(
    `${CONSOLE_PREFIX} missing_expressed_files: ${manifest.filesystem.missing_expressed_files.length}`
  );
}

function refreshDerivedState() {
  const workspace = loadWorkspace();
  persistWorkspaceManifest(workspace, "refresh");
  console.log(`${CONSOLE_PREFIX} derived state refreshed at ${nowIso()}`);
}

async function watchWorkspace() {
  await runCycle("watch");
  console.log(`${CONSOLE_PREFIX} watching for changes...`);
  let timer = null;
  const watcher = fs.watch(ROOT, { recursive: true }, (eventType, watchedPath) => {
    if (!watchedPath) return;
    const absolute = path.join(ROOT, watchedPath);
    if (shouldIgnoreWatchEvent(absolute)) return;
    if (String(watchedPath).replace(/\\/g, "/").includes(".git/")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const state = readJsonYaml(PATHS.state, defaultState());
        if (state.stage === "brainwave_documentation_complete") {
          watcher.close();
          console.log(
            `${CONSOLE_PREFIX} _brainwave documentation is complete; watch mode is now passive.`
          );
          return;
        }
        await runCycle("watch");
      } catch (error) {
        console.error(`${CONSOLE_PREFIX} watch cycle failed: ${error.message}`);
      }
    }, 700);
  });
}

function printHelp() {
  console.log("_brainwave runner commands:");
  console.log("  node _brainwave/_engine/brainwave_runner.js integrate  (from project root)");
  console.log("  node _brainwave/_engine/brainwave_runner.js unintegrate  (from project root)");
  console.log("  node _brainwave/_engine/brainwave_runner.js status");
  console.log("  node _brainwave/_engine/brainwave_runner.js refresh");
  console.log("  node _brainwave/_engine/brainwave_runner.js dna");
  console.log("  node _brainwave/_engine/brainwave_runner.js select-dna <_DNA-CODE...>");
  console.log("  node _brainwave/_engine/brainwave_runner.js transition <stage>");
  console.log("  node _brainwave/_engine/brainwave_runner.js express <_DNA-CODE-00000...>");
  console.log("  node _brainwave/_engine/brainwave_runner.js unexpress <_DNA-CODE-00000...>");
  console.log("  node _brainwave/_engine/brainwave_runner.js run");
  console.log("  node _brainwave/_engine/brainwave_runner.js watch");
}

async function main() {
  const command = process.argv[2] || "run";
  const args = process.argv.slice(3);
  if (["-h", "--help", "help"].includes(command)) return printHelp();
  if (command === "integrate") {
    const changes = integrateProjectRoot(ROOT);
    console.log(
      `${CONSOLE_PREFIX} project integration ${changes.length > 0 ? `updated: ${changes.join(", ")}` : "already current"}`
    );
    return;
  }
  if (command === "unintegrate") {
    const changes = removeProjectRootIntegration(ROOT);
    console.log(
      `${CONSOLE_PREFIX} project integration ${changes.length > 0 ? `removed from: ${changes.join(", ")}` : "already absent"}`
    );
    return;
  }
  if (command === "dna") return listDnaModules();
  if (command === "select-dna") return selectDnaModules(args);
  if (command === "express" || command === "unexpress") {
    if (args.length === 0) throw new Error("Provide at least one qualified DNA node reference.");
    return mutateExpression(args, command === "express");
  }
  if (command === "transition") {
    if (!args[0]) throw new Error("Provide a target _brainwave stage.");
    return transitionStage(args[0]);
  }
  if (command === "status") return printStatus();
  if (command === "refresh") return refreshDerivedState();
  if (command === "watch") return watchWorkspace();
  if (command === "run") return runCycle("run");
  printHelp();
  throw new Error(`Unknown command: ${command}.`);
}

main().catch((error) => {
  console.error(`${CONSOLE_PREFIX} ${error.message}`);
  process.exit(1);
});

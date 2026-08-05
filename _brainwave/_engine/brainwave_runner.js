#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const {
  integrateProjectRoot,
  removeProjectRootIntegration
} = require("./project_integration");
const {
  buildImplementationSpine,
  buildImplementationProposalTemplate,
  applyImplementationProposal,
  validateImplementationSpine,
  summarizeImplementationSpine,
  finalizeImplementationSynthesis,
  markImplementationReview,
  buildImplementationReview,
  approveImplementationSpine,
  startImplementationSlice,
  recordWorkItemEvidence,
  holdWorkItem,
  recordAcceptanceCheck,
  checkImplementationSlice,
  closeImplementationSlice,
  implementationContextPayload,
  formatImplementationContext,
  buildImplementationAudit,
  recordRejectedTransition
} = require("./implementation_spine");

const ROOT = path.resolve(__dirname, "..");
const PATHS = Object.freeze({
  seed: path.join(ROOT, "_my_brainwave_seed.md"),
  northStar: path.join(ROOT, "_my_brainwave_north_star.md"),
  decisions: path.join(ROOT, "_decisions_log.md"),
  handbook: path.join(ROOT, "_brainwave_handbook.md"),
  state: path.join(ROOT, "_brainwave_state.yaml"),
  settings: path.join(ROOT, "_settings.yaml"),
  dnaDir: path.join(ROOT, "_dna"),
  documentationDir: path.join(ROOT, "_documentation"),
  implementation: path.join(ROOT, "_implementation.yaml"),
  implementationProposal: path.join(ROOT, "_implementation_proposal.yaml"),
  implementationReview: path.join(ROOT, "_implementation_review.md"),
  implementationAudit: path.join(ROOT, "_implementation_audit.md"),
  manifest: path.join(ROOT, "_manifest.yaml"),
  dashboard: path.join(ROOT, "_dashboard.html")
});

const SUPPORTED_DNA_SCHEMA_VERSION = "3.0.0";
const SUPPORTED_STATE_SCHEMA_VERSION = "3.0.0";
const BRAINWAVE_VERSION = "0.1.0";
const CONSOLE_PREFIX = "[_brainwave]";
const INTERNAL_WRITE_GUARD_MS = 2500;
const internalWrites = new Map();

const ALIGNMENT_REVIEW_RESULTS = Object.freeze([
  "aligned",
  "needs_attention",
  "blocked"
]);

const FRESH_ALIGNMENT_REVIEW_PROMPT = [
  "Run a fresh-context `_brainwave` implementation alignment review for this repository.",
  "Work from the accepted North Star and DNA documentation, not previous implementation claims.",
  "Do not change product code or DNA direction.",
  "Compare each applicable current DNA block with the implementation spine and inspectable evidence, and scan for material divergence in product behaviour, experience, data use, permissions, risk, launch dependencies, or system boundaries.",
  "Report gaps and uncertainty before suggesting fixes.",
  "Do not rewrite DNA direction. Update implementation-spine state and evidence only where supported, record the reviewed Git revision and result with `node _brainwave/_engine/brainwave_runner.js alignment-review <aligned|needs_attention|blocked> <revision>`, then refresh the dashboard."
].join(" ");

const LEGACY_DNA_BLOCK_STATUSES = Object.freeze([
  "not_started",
  "in_progress",
  "implemented",
  "verified",
  "blocked",
  "superseded",
  "not_applicable"
]);
const DNA_DIRECTION_STATUSES = Object.freeze(["active", "superseded", "not_applicable"]);

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
    /^\s*(?:documentation\s+)?status:\s*(not_started|in_progress|complete)\s*$/im
  )?.[1]?.toLowerCase();
  return ["not_started", "in_progress", "complete"].includes(status)
    ? status
    : "in_progress";
}

function northStarStatusFromContent(content) {
  return content.match(/^\s*status:\s*(shaping|agreed)\s*$/im)?.[1]?.toLowerCase() || "missing";
}

function firstMeaningfulTitle(...contents) {
  const genericTitles = new Set([
    "_brainwave",
    "my _brainwave seed",
    "my _brainwave north star",
    "north star"
  ]);
  for (const content of contents) {
    const title = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
    if (title && !genericTitles.has(title.toLowerCase())) return title;
  }
  return null;
}

function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedProjectProfile(settings) {
  const defaults = defaultSettings().project_profile;
  const source = isPlainObject(settings.project_profile) ? settings.project_profile : {};
  const allowedStatuses = new Set(
    settings.allowed_values?.project_profile_status ||
      ["not_asked", "not_yet", "working", "confirmed", "deferred"]
  );
  const allowedItemStatuses = new Set(
    settings.allowed_values?.project_profile_item_status ||
      ["not_provided", "working", "confirmed"]
  );
  const logoSource = isPlainObject(source.logo) ? source.logo : {};
  const logoPath = isSafeModulePath(logoSource.path) ? logoSource.path : null;
  const colors = Array.isArray(source.colors)
    ? source.colors
        .map((color) => {
          if (typeof color === "string") {
            return {
              name: null,
              value: optionalText(color),
              role: null,
              usage: null,
              featured: false,
              status: "working"
            };
          }
          if (!isPlainObject(color)) return null;
          const value = optionalText(color.value);
          if (!value) return null;
          return {
            name: optionalText(color.name) || optionalText(color.label),
            value,
            role: optionalText(color.role),
            usage: optionalText(color.usage),
            featured: color.featured === true,
            status: allowedItemStatuses.has(color.status) ? color.status : "working"
          };
        })
        .filter(Boolean)
    : [];

  return {
    status: allowedStatuses.has(source.status) ? source.status : defaults.status,
    name: optionalText(source.name),
    short_description: optionalText(source.short_description),
    tagline: optionalText(source.tagline),
    logo: {
      path: logoPath,
      alt_text: optionalText(logoSource.alt_text),
      status: allowedItemStatuses.has(logoSource.status)
        ? logoSource.status
        : defaults.logo.status,
      exists: Boolean(logoPath && exists(path.join(ROOT, logoPath)))
    },
    colors,
    style_direction: optionalText(source.style_direction),
    updated_at: optionalText(source.updated_at)
  };
}

function parseDecisionEntries(content) {
  const allowedFields = new Set([
    "timestamp",
    "trigger",
    "decision",
    "rationale",
    "alternatives_considered",
    "impact_on_dna",
    "approved_by"
  ]);
  const entries = [];
  let current = null;
  let currentField = null;

  const pushCurrent = () => {
    if (
      current &&
      Object.values(current).some((value) => String(value || "").trim().length > 0)
    ) {
      entries.push(current);
    }
  };

  for (const line of content.split(/\r?\n/)) {
    const fieldMatch = line.match(/^-\s+([a-z_]+):\s*(.*?)\s*$/i);
    if (fieldMatch && allowedFields.has(fieldMatch[1].toLowerCase())) {
      const field = fieldMatch[1].toLowerCase();
      if (field === "timestamp" && current) pushCurrent();
      if (!current || field === "timestamp") current = {};
      current[field] = fieldMatch[2].trim();
      currentField = field;
      continue;
    }
    if (current && currentField && /^\s{2,}\S/.test(line)) {
      current[currentField] = `${current[currentField]} ${line.trim()}`.trim();
    }
  }
  pushCurrent();
  return entries;
}

function blockSectionMarkdown(section, heading) {
  const marker = `#### ${heading}`;
  const markerIndex = section.indexOf(marker);
  if (markerIndex === -1) return "";
  const body = section.slice(markerIndex + marker.length).replace(/^\s*\r?\n/, "");
  const nextHeadingIndex = body.search(/^#{2,4}\s+/m);
  return body.slice(0, nextHeadingIndex === -1 ? body.length : nextHeadingIndex).trim();
}

function evidenceIsRecorded(value) {
  const normalized = String(value || "")
    .replace(/[`*_]/g, "")
    .replace(/^[-+*]\s*/gm, "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "")
    .trim();
  if (!normalized) return false;
  return ![
    "none",
    "not recorded",
    "not yet recorded",
    "not yet",
    "pending",
    "n/a",
    "not applicable"
  ].includes(normalized);
}

function defaultSettings() {
  return {
    schema_version: "1.3.0",
    configured: false,
    onboarding_status: "pending",
    guidance_mode: null,
    technical_proficiency: null,
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    build_outcome: null,
    build_outcome_confirmed_at: null,
    project_profile: {
      status: "not_asked",
      name: null,
      short_description: null,
      tagline: null,
      logo: {
        path: null,
        alt_text: null,
        status: "not_provided"
      },
      colors: [],
      style_direction: null,
      updated_at: null
    },
    profile_last_updated: null,
    onboarding_questions: [
      "Is this your first time using _brainwave? (yes — guide me / no — keep it concise)",
      "What is your technical proficiency? (beginner/intermediate/architect)",
      "How should I operate? (thought_partner/fast_execution)",
      "How much detail do you prefer? (lean/standard/exhaustive)"
    ],
    allowed_values: {
      guidance_mode: ["guided", "concise"],
      technical_proficiency: ["beginner", "intermediate", "architect"],
      ideation_mode: ["thought_partner", "fast_execution"],
      verbosity_budget: ["lean", "standard", "exhaustive"],
      build_outcome: ["demonstration", "usable_first_version", "complete_product", "custom"],
      project_profile_status: ["not_asked", "not_yet", "working", "confirmed", "deferred"],
      project_profile_item_status: ["not_provided", "working", "confirmed"]
    },
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
    experience_checkpoints: {
      dashboard_introduced_at: null,
      project_basics_checked_at: null
    },
    delivery_alignment: {
      last_review: null
    },
    selected_dna: {}
  };
}

function defaultManifestSkeleton() {
  return {
    schema_version: "3.0.0",
    generated_at: nowIso(),
    workspace_root: ".",
    framework: {
      name: "_brainwave",
      version: BRAINWAVE_VERSION
    },
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
    delivery_alignment: {
      mode: "inactive",
      review_prompt: FRESH_ALIGNMENT_REVIEW_PROMPT,
      last_review: null,
      coverage: {
        applicable: 0,
        built: 0,
        checked: 0,
        underway: 0,
        pending_check: 0,
        not_started: 0,
        blocked: 0,
        deferred: 0,
        invalid: 0,
        built_pct: 0,
        checked_pct: 0
      }
    },
    experience: {
      checkpoints: {
        dashboard_introduced_at: null,
        project_basics_checked_at: null
      }
    },
    settings: {
      path: "_settings.yaml",
      loaded: false,
      configured: false,
      onboarding_status: "pending",
      guidance_mode: null,
      technical_proficiency: null,
      ideation_mode: null,
      verbosity_budget: null,
      build_outcome: null,
      build_outcome_confirmed_at: null,
      profile_last_updated: null,
      project_profile: defaultSettings().project_profile
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
    direction: {
      totals: {
        blocks: 0,
        active: 0,
        superseded: 0,
        not_applicable: 0,
        invalid: 0
      },
      blocks: []
    },
    implementation: {
      path: "_implementation.yaml",
      mode: "not_compiled",
      schema_version: null,
      plan_version: null,
      state_revision: null,
      plan_status: null,
      planning: {
        adoption_mode: null,
        synthesis_status: null,
        review_artifact: null
      },
      source_stale: false,
      readiness: {
        technical_health: "unknown",
        product_coverage: "not_assessed",
        external_gates: "unknown",
        release_readiness: "not_assessed"
      },
      totals: {
        blocks: 0,
        not_started: 0,
        in_progress: 0,
        implemented: 0,
        verified: 0,
        blocked: 0,
        deferred: 0,
        invalid: 0
      },
      coverage: {
        applicable: 0,
        built: 0,
        checked: 0,
        underway: 0,
        pending_check: 0,
        not_started: 0,
        blocked: 0,
        deferred: 0,
        invalid: 0,
        built_pct: 0,
        checked_pct: 0
      },
      current: null,
      next: null,
      tracks: [],
      slices: [],
      work_items: [],
      validation: { errors: [], warnings: [] }
    },
    presentation: {
      project_title: null,
      project_profile: defaultSettings().project_profile,
      content: {
        seed: { title: "_brainwave Seed", path: "_my_brainwave_seed.md", markdown: "" },
        north_star: {
          title: "North Star",
          path: "_my_brainwave_north_star.md",
          markdown: ""
        },
        decisions: {
          title: "Decision history",
          path: "_decisions_log.md",
          markdown: ""
        },
        handbook: {
          title: "_brainwave Handbook",
          path: "_brainwave_handbook.md",
          markdown: ""
        }
      },
      decisions: [],
      documents: {}
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

function validateStringArray(value, label, options = {}) {
  const allowEmpty = Boolean(options.allowEmpty);
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array.`);
  }
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      throw new Error(`${label} must contain only non-empty strings.`);
    }
  }
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
  if (!isPlainObject(module.module_contract)) {
    throw new Error(`${source} must define module_contract.`);
  }
  if (
    typeof module.module_contract.when_relevant !== "string" ||
    !module.module_contract.when_relevant.trim()
  ) {
    throw new Error(`${source} module_contract must define when_relevant.`);
  }
  validateStringArray(
    module.module_contract.selection_signals,
    `${source} module_contract selection_signals`
  );
  validateStringArray(module.module_contract.owns, `${source} module_contract owns`);
  validateStringArray(
    module.module_contract.does_not_own,
    `${source} module_contract does_not_own`
  );
  validateStringArray(
    module.module_contract.live_verification,
    `${source} module_contract live_verification`,
    { allowEmpty: true }
  );
  if (!isPlainObject(module.module_contract.timing)) {
    throw new Error(`${source} module_contract timing must be an object.`);
  }
  for (const key of ["consider_early", "can_defer_when", "must_not_defer_when"]) {
    if (
      typeof module.module_contract.timing[key] !== "string" ||
      !module.module_contract.timing[key].trim()
    ) {
      throw new Error(`${source} module_contract timing must define ${key}.`);
    }
  }
  if (!isPlainObject(module.module_contract.coordinates_with)) {
    throw new Error(`${source} module_contract coordinates_with must be an object.`);
  }
  for (const [moduleId, relationship] of Object.entries(
    module.module_contract.coordinates_with
  )) {
    if (!/^_DNA-[A-Z]{4}$/.test(moduleId)) {
      throw new Error(
        `${source} module_contract coordinates_with contains an invalid DNA module reference: ${moduleId}.`
      );
    }
    if (moduleId === `_DNA-${module.dna_code}`) {
      throw new Error(`${source} module_contract must not coordinate with itself.`);
    }
    if (typeof relationship !== "string" || !relationship.trim()) {
      throw new Error(
        `${source} module_contract relationship for ${moduleId} must be a non-empty string.`
      );
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
        throw new Error(`${source} DNA document group ${id} must define when_relevant.`);
      }
      if ("intent" in node) {
        throw new Error(`${source} DNA document group ${id} must use when_relevant rather than intent.`);
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
  for (const module of Object.values(modules)) {
    for (const coordinatedModuleId of Object.keys(module.module_contract.coordinates_with)) {
      if (!modules[coordinatedModuleId]) {
        throw new Error(
          `${module.source_path} coordinates with unavailable DNA module ${coordinatedModuleId}.`
        );
      }
    }
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
  if (state.experience_checkpoints === undefined) {
    state.experience_checkpoints = {
      dashboard_introduced_at: null,
      project_basics_checked_at: null
    };
  }
  if (!isPlainObject(state.experience_checkpoints)) {
    throw new Error("`experience_checkpoints` must be an object.");
  }
  for (const key of ["dashboard_introduced_at", "project_basics_checked_at"]) {
    const value = state.experience_checkpoints[key];
    if (value !== undefined && value !== null && (typeof value !== "string" || !value.trim())) {
      throw new Error(`Experience checkpoint ${key} must be a timestamp or null.`);
    }
  }
  if (state.delivery_alignment === undefined) {
    state.delivery_alignment = { last_review: null };
  }
  if (!isPlainObject(state.delivery_alignment)) {
    throw new Error("`delivery_alignment` must be an object.");
  }
  const lastReview = state.delivery_alignment.last_review;
  if (lastReview !== undefined && lastReview !== null) {
    if (!isPlainObject(lastReview)) {
      throw new Error("`delivery_alignment.last_review` must be an object or null.");
    }
    if (lastReview.kind !== "fresh_context") {
      throw new Error("`delivery_alignment.last_review.kind` must be `fresh_context`.");
    }
    if (!ALIGNMENT_REVIEW_RESULTS.includes(lastReview.result)) {
      throw new Error(
        "`delivery_alignment.last_review.result` must be `aligned`, `needs_attention`, or `blocked`."
      );
    }
    for (const key of ["reviewed_at", "revision"]) {
      if (typeof lastReview[key] !== "string" || !lastReview[key].trim()) {
        throw new Error(`\`delivery_alignment.last_review.${key}\` must be a non-empty string.`);
      }
    }
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
    decisionsText: readText(PATHS.decisions),
    handbookText: readText(PATHS.handbook),
    implementationSpine: exists(PATHS.implementation)
      ? readJsonYaml(PATHS.implementation, null)
      : null,
    previousManifest: readJsonYaml(PATHS.manifest, defaultManifestSkeleton())
  };
}

function gitRevision() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: path.resolve(ROOT, ".."),
    encoding: "utf8",
    windowsHide: true
  });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : "unavailable";
}

function implementationSource(workspace, directionBlocks) {
  const directionSnapshot = directionBlocks.map((block) => ({
    id: block.id,
    title: block.title,
    direction_status: block.direction_status,
    supersedes: block.supersedes,
    superseded_by: block.superseded_by,
    path: block.path,
    details: block.details
  }));
  return {
    generated_at: nowIso(),
    git_revision: gitRevision(),
    north_star_sha256: workspace.northStarText.trim() ? sha256(workspace.northStarText) : null,
    dna_scope_sha256: sha256(
      JSON.stringify({ selected_dna: workspace.state.selected_dna, blocks: directionSnapshot })
    ),
    applicable_block_count: directionBlocks.filter(
      (block) => !["superseded", "not_applicable"].includes(block.direction_status)
    ).length
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
    "Documentation status: in_progress",
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
    "Direction status: active",
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
    const explicitDirectionStatus = section
      .match(/^\s*Direction status:\s*([a-z_]+)\s*$/im)?.[1]?.toLowerCase();
    const legacyStatus = section.match(/^\s*Status:\s*([a-z_]+)\s*$/im)?.[1]?.toLowerCase();
    const directionStatus = DNA_DIRECTION_STATUSES.includes(explicitDirectionStatus)
      ? explicitDirectionStatus
      : ["superseded", "not_applicable"].includes(legacyStatus)
        ? legacyStatus
        : LEGACY_DNA_BLOCK_STATUSES.includes(legacyStatus)
          ? "active"
          : "invalid";
    const supersedes = section.match(/^\s*Supersedes:\s*(.+?)\s*$/im)?.[1]?.trim() || null;
    const supersededBy =
      section.match(/^\s*Superseded by:\s*(.+?)\s*$/im)?.[1]?.trim() || null;
    const lastChecked =
      section.match(/^\s*Last checked:\s*(.+?)\s*$/im)?.[1]?.trim() || null;
    const checkedRevision =
      section.match(/^\s*Checked revision:\s*(.+?)\s*$/im)?.[1]?.trim() || null;
    const implementationEvidence = blockSectionMarkdown(section, "Implementation Evidence");
    const verificationEvidence = blockSectionMarkdown(section, "Verification Evidence");
    const blockErrors = [];
    const addBlockError = (message) => {
      blockErrors.push(message);
      errors.push(message);
    };

    if (!id.startsWith(`${documentId}.`)) {
      addBlockError(`${id} does not belong to ${documentId}.`);
    }
    if (seen.has(id)) addBlockError(`${id} is duplicated.`);
    seen.add(id);
    if (directionStatus === "invalid") {
      addBlockError(`${id} has a missing or invalid Direction status.`);
    }

    if (directionStatus === "superseded") {
      if (!supersededBy || !/^_DNA-[A-Z]{4}-\d{5}\.\d{2}$/.test(supersededBy)) {
        addBlockError(`${id} must identify its replacement with Superseded by.`);
      }
    } else {
      if (!supersedes) addBlockError(`${id} must define Supersedes: none or a block ID.`);
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
        if (!pattern.test(section)) addBlockError(`${id} is missing ${heading}.`);
      }
    }

    blocks.push({
      id,
      slice: id.split(".").pop(),
      title,
      direction_status: directionStatus,
      supersedes,
      superseded_by: supersededBy,
      legacy_delivery_status: LEGACY_DNA_BLOCK_STATUSES.includes(legacyStatus)
        ? legacyStatus
        : null,
      legacy_implementation_evidence: implementationEvidence,
      legacy_verification_evidence: verificationEvidence,
      legacy_last_checked: lastChecked,
      legacy_checked_revision: checkedRevision,
      contract_errors: blockErrors,
      details: {
        context: blockSectionMarkdown(section, "Context"),
        direction: blockSectionMarkdown(section, "Direction"),
        rationale: blockSectionMarkdown(section, "Rationale"),
        alternatives_considered: blockSectionMarkdown(section, "Alternatives Considered"),
        consequences: blockSectionMarkdown(section, "Consequences"),
        future_fit: blockSectionMarkdown(section, "Future Fit"),
        verification: blockSectionMarkdown(section, "Verification"),
        former_direction:
          section.match(/^\s*Former direction:\s*(.+?)\s*$/im)?.[1]?.trim() || ""
      }
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
  const projectProfile = normalizedProjectProfile(workspace.settings);
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
  manifest.settings.configured = workspace.settings.configured === true;
  manifest.settings.onboarding_status = workspace.settings.onboarding_status ?? null;
  manifest.settings.guidance_mode = workspace.settings.guidance_mode ?? null;
  manifest.settings.technical_proficiency = workspace.settings.technical_proficiency ?? null;
  manifest.settings.ideation_mode = workspace.settings.ideation_mode ?? null;
  manifest.settings.verbosity_budget = workspace.settings.verbosity_budget ?? null;
  manifest.settings.build_outcome = workspace.settings.build_outcome ?? null;
  manifest.settings.build_outcome_confirmed_at =
    workspace.settings.build_outcome_confirmed_at ?? null;
  manifest.settings.profile_last_updated = workspace.settings.profile_last_updated ?? null;
  manifest.settings.project_profile = projectProfile;

  manifest.experience.checkpoints.dashboard_introduced_at =
    workspace.state.experience_checkpoints?.dashboard_introduced_at || null;
  manifest.experience.checkpoints.project_basics_checked_at =
    workspace.state.experience_checkpoints?.project_basics_checked_at || null;

  manifest.presentation.project_title =
    projectProfile.name || firstMeaningfulTitle(workspace.northStarText, workspace.seedText);
  manifest.presentation.project_profile = projectProfile;
  manifest.presentation.content.seed.markdown = workspace.seedText;
  manifest.presentation.content.north_star.markdown = workspace.northStarText;
  manifest.presentation.content.decisions.markdown = workspace.decisionsText;
  manifest.presentation.content.handbook.markdown = workspace.handbookText;
  manifest.presentation.decisions = parseDecisionEntries(workspace.decisionsText);

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
  manifest.delivery_alignment.mode =
    workspace.state.stage === "brainwave_documentation_complete" ? "ambient" : "inactive";
  manifest.delivery_alignment.last_review =
    workspace.state.delivery_alignment?.last_review || null;

  const trackedFiles = {};
  const missingExpressedFiles = [];
  const directionBlocks = [];
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
          directionBlocks.push({
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
        if (fileExists) {
          manifest.presentation.documents[outputPath] = {
            id: qualifiedNodeId(module, node.id),
            title: node.title,
            module_id: moduleId,
            module_name: module.name,
            processing_status: processingStatus,
            markdown: content
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
        intent: node.intent || null,
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
      module_contract: module.module_contract,
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

  directionBlocks.sort(
    (a, b) =>
      a.module_id.localeCompare(b.module_id) ||
      a.document_id.localeCompare(b.document_id) ||
      a.id.localeCompare(b.id)
  );
  manifest.direction.blocks = directionBlocks;
  manifest.direction.totals.blocks = directionBlocks.length;
  for (const block of directionBlocks) {
    const key = block.contract_errors?.length ? "invalid" : block.direction_status;
    if (Object.prototype.hasOwnProperty.call(manifest.direction.totals, key)) {
      manifest.direction.totals[key] += 1;
    }
  }

  const source = implementationSource(workspace, directionBlocks);
  const applicableBlockIds = directionBlocks
    .filter((block) => !["superseded", "not_applicable"].includes(block.direction_status))
    .map((block) => block.id);
  const directionById = new Map(directionBlocks.map((block) => [block.id, block]));
  const alignmentCoverage = manifest.delivery_alignment.coverage;
  alignmentCoverage.applicable = applicableBlockIds.length;
  alignmentCoverage.invalid = directionBlocks.filter((block) => block.contract_errors?.length).length;

  if (workspace.implementationSpine) {
    const validation = validateImplementationSpine(workspace.implementationSpine, {
      source,
      applicableBlockIds
    });
    const summary = summarizeImplementationSpine(workspace.implementationSpine, validation);
    const context = implementationContextPayload(workspace.implementationSpine, {
      source,
      applicableBlockIds
    });
    manifest.implementation = {
      ...manifest.implementation,
      mode: "compiled",
      schema_version: workspace.implementationSpine.schema_version || null,
      plan_version: workspace.implementationSpine.plan_version || null,
      state_revision: workspace.implementationSpine.state_revision ?? null,
      plan_status: workspace.implementationSpine.plan_status || null,
      planning: {
        adoption_mode: workspace.implementationSpine.planning?.adoption_mode || null,
        synthesis_status: workspace.implementationSpine.planning?.synthesis_status || null,
        review_artifact: workspace.implementationSpine.planning?.review?.artifact || null
      },
      source_stale: validation.stale,
      totals: summary.totals,
      coverage: summary.coverage,
      readiness: summary.readiness,
      current:
        workspace.implementationSpine.active_slice
          ? context.current_or_next_slice
          : null,
      next:
        workspace.implementationSpine.active_slice
          ? null
          : context.current_or_next_slice,
      tracks: workspace.implementationSpine.tracks || [],
      slices: workspace.implementationSpine.slices || [],
      work_items: Object.entries(workspace.implementationSpine.work_items || {})
        .map(([id, item]) => ({ id, ...item, direction: directionById.get(id) || null }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      validation: { errors: validation.errors, warnings: validation.warnings }
    };
    Object.assign(alignmentCoverage, summary.coverage);
  } else {
    manifest.implementation.coverage.applicable = applicableBlockIds.length;
    Object.assign(alignmentCoverage, manifest.implementation.coverage);
    alignmentCoverage.invalid = manifest.direction.totals.invalid;
  }

  return manifest;
}

function injectManifestIntoDashboard(manifest) {
  if (!exists(PATHS.dashboard)) return;
  const html = readText(PATHS.dashboard);
  const scriptJson = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const embedded = `<script id="brainwave-state" type="application/json">${scriptJson}</script>`;
  const pattern = /<script id="brainwave-state" type="application\/json">[\s\S]*?<\/script>/;
  const updated = pattern.test(html)
    ? html.replace(pattern, () => embedded)
    : html.includes("</body>")
      ? html.replace("</body>", () => `  ${embedded}\n</body>`)
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

function settingsSchemaAtLeast(settings, minimumMajor, minimumMinor) {
  const match = String(settings.schema_version || "").match(/^(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > minimumMajor || (major === minimumMajor && minor >= minimumMinor);
}

function settingsRequireGuidanceMode(settings) {
  return settingsSchemaAtLeast(settings, 1, 1);
}

function settingsRequireBuildOutcome(settings) {
  return settingsSchemaAtLeast(settings, 1, 2);
}

function settingsRequireExperienceProtocol(settings) {
  return settingsSchemaAtLeast(settings, 1, 3);
}

function isSettingsConfigured(settings) {
  return Boolean(
    settings &&
      settings.configured === true &&
      (!settings.onboarding_status || settings.onboarding_status === "complete") &&
      (!settingsRequireGuidanceMode(settings) ||
        hasAllowedSetting(settings, "guidance_mode")) &&
      hasAllowedSetting(settings, "technical_proficiency") &&
      hasAllowedSetting(settings, "ideation_mode") &&
      hasAllowedSetting(settings, "verbosity_budget")
  );
}

function assertSettingsReady(settings) {
  if (!isSettingsConfigured(settings)) {
    throw new Error(
      "Profile pre-check failed: `_settings.yaml` is incomplete. Complete onboarding before progressing DNA documentation."
    );
  }
}

function assertBuildOutcomeReady(settings) {
  if (
    settingsRequireBuildOutcome(settings) &&
    (!hasAllowedSetting(settings, "build_outcome") || !settings.build_outcome_confirmed_at)
  ) {
    throw new Error(
      "Build outcome pre-check failed: ask how far the user wants to take this idea, confirm what that means for this concept, and record the outcome in `_settings.yaml` before agreeing the North Star."
    );
  }
}

function assertDashboardIntroduced(workspace) {
  if (
    settingsRequireExperienceProtocol(workspace.settings) &&
    !workspace.state.experience_checkpoints?.dashboard_introduced_at
  ) {
    throw new Error(
      "Experience pre-check failed: introduce the `_brainwave` dashboard in friendly, simple language and record `dashboard_introduced_at` in `_brainwave_state.yaml` before capturing the Seed."
    );
  }
}

function assertProjectBasicsChecked(workspace) {
  if (!settingsRequireExperienceProtocol(workspace.settings)) return;
  const profile = normalizedProjectProfile(workspace.settings);
  if (
    !workspace.state.experience_checkpoints?.project_basics_checked_at ||
    profile.status === "not_asked"
  ) {
    throw new Error(
      "Experience pre-check failed: after reading the Seed, check once for any existing project name, short description or tagline, logo, colours, or style direction. Record the answer in `_settings.yaml` and `project_basics_checked_at` in `_brainwave_state.yaml` before agreeing the North Star."
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
  assertBuildOutcomeReady(workspace.settings);
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
    addEvent(manifest, "routing", "Scoped DNA document scaffolds are pending.", {
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
  assertBuildOutcomeReady(workspace.settings);
  assertNorthStarAgreed(workspace.northStarText);
  if (workspace.state.stage !== "selecting_dna") {
    throw new Error(
      `DNA module selection is available only during \`selecting_dna\`, not \`${workspace.state.stage}\`.`
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
  assertBuildOutcomeReady(workspace.settings);
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
      ? "DNA documents added to scope after user approval."
      : "DNA documents removed from scope after user approval.",
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
    if (settingsRequireExperienceProtocol(workspace.settings)) {
      assertSettingsReady(workspace.settings);
      assertDashboardIntroduced(workspace);
    }
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
    assertBuildOutcomeReady(workspace.settings);
    assertNorthStarAgreed(workspace.northStarText);
  }
  if (targetStage === "selecting_dna") {
    assertProjectBasicsChecked(workspace);
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
    throw new Error("No DNA documents are in scope.");
  }
  if (
    ["reviewing_brainwave_documentation", "brainwave_documentation_complete"].includes(targetStage)
  ) {
    const incomplete = incompleteExpressedFiles(workspace);
    if (incomplete.length > 0) {
      throw new Error(
        `DNA documentation is incomplete: ${incomplete
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

function implementationCommandContext({ requireSpine = true } = {}) {
  const workspace = loadWorkspace();
  if (workspace.state.stage !== "brainwave_documentation_complete") {
    throw new Error(
      "The implementation spine is available after the DNA foundation has been accepted."
    );
  }
  const manifest = buildWorkspaceManifest(workspace, "implementation");
  const directionBlocks = manifest.direction.blocks || [];
  const directionErrors = directionBlocks.flatMap((block) => block.contract_errors || []);
  if (directionErrors.length) {
    throw new Error(`DNA direction contract failed: ${directionErrors.join(" ")}`);
  }
  const source = implementationSource(workspace, directionBlocks);
  const applicableBlockIds = directionBlocks
    .filter((block) => !["superseded", "not_applicable"].includes(block.direction_status))
    .map((block) => block.id);
  if (requireSpine && !workspace.implementationSpine) {
    throw new Error(
      "No implementation spine exists. Run `node _brainwave/_engine/brainwave_runner.js implementation-compile`."
    );
  }
  return { workspace, manifest, directionBlocks, source, applicableBlockIds };
}

function persistImplementationSpine(spine, command) {
  writeJsonYaml(PATHS.implementation, spine);
  const workspace = loadWorkspace();
  const manifest = persistWorkspaceManifest(workspace, command);
  return manifest;
}

function recordRejectedImplementationMutation(context) {
  if (!context.workspace.implementationSpine) return;
  const rejected = recordRejectedTransition(context.workspace.implementationSpine, nowIso());
  writeJsonYaml(PATHS.implementation, rejected);
}

function runImplementationMutation(command, mutator) {
  const context = implementationCommandContext();
  try {
    const validation = validateImplementationSpine(context.workspace.implementationSpine, {
      source: context.source,
      applicableBlockIds: context.applicableBlockIds
    });
    if (validation.errors.length && command !== "implementation-approve") {
      throw new Error(`Implementation spine is invalid: ${validation.errors.join(" ")}`);
    }
    const updated = mutator(context);
    persistImplementationSpine(updated, command);
    return updated;
  } catch (error) {
    recordRejectedImplementationMutation(context);
    throw error;
  }
}

function compileImplementationSpine(args = []) {
  const context = implementationCommandContext({ requireSpine: false });
  const unknownArgs = args.filter((arg) => arg !== "--existing-build");
  if (unknownArgs.length) {
    throw new Error("Usage: implementation-compile [--existing-build].");
  }
  const adoptionMode = args.includes("--existing-build") ? "existing_build" : "greenfield";
  if (context.applicableBlockIds.length === 0) {
    throw new Error("No applicable DNA blocks are available to compile.");
  }
  const spine = buildImplementationSpine({
    source: context.source,
    blocks: context.directionBlocks,
    existing: context.workspace.implementationSpine,
    now: nowIso(),
    adoptionMode
  });
  persistImplementationSpine(spine, "implementation-compile");
  writeJsonYaml(PATHS.implementationProposal, buildImplementationProposalTemplate(spine));
  const validation = validateImplementationSpine(spine, {
    source: context.source,
    applicableBlockIds: context.applicableBlockIds
  });
  console.log(
    `${CONSOLE_PREFIX} implementation inventory ${spine.plan_version} compiled: ${context.applicableBlockIds.length} applicable blocks; adoption mode ${adoptionMode}.`
  );
  console.log(
    `${CONSOLE_PREFIX} no slices were invented. Complete _implementation_proposal.yaml from project-specific backbone direction, then run implementation-synthesize <authored-by> [_implementation_proposal.yaml].`
  );
  for (const warning of validation.warnings) console.log(`${CONSOLE_PREFIX} warning: ${warning}`);
}

function synthesizeImplementationPlan(args) {
  const [synthesizedBy, proposalArg = "_implementation_proposal.yaml", ...extra] = args;
  if (!synthesizedBy || extra.length) {
    throw new Error("Usage: implementation-synthesize <authored-by> [proposal-path].");
  }
  const proposalPath = path.resolve(ROOT, proposalArg);
  if (proposalPath !== ROOT && !proposalPath.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error("The implementation proposal must be inside the _brainwave directory.");
  }
  const proposal = readJsonYaml(proposalPath);
  if (!proposal) throw new Error(`Implementation proposal not found: ${relativePath(proposalPath)}.`);
  const updated = runImplementationMutation("implementation-synthesize", (context) =>
    finalizeImplementationSynthesis(applyImplementationProposal(context.workspace.implementationSpine, proposal), {
      synthesizedBy,
      revision: gitRevision(),
      now: nowIso(),
      source: context.source,
      applicableBlockIds: context.applicableBlockIds
    })
  );
  console.log(
    `${CONSOLE_PREFIX} slice proposal ready: ${updated.slices.length} slices across ${updated.tracks.length} tracks. Run implementation-review before requesting approval.`
  );
}

function writeImplementationReview() {
  const context = implementationCommandContext();
  try {
    const generatedAt = nowIso();
    const updated = markImplementationReview(context.workspace.implementationSpine, {
      artifact: "_implementation_review.md",
      now: generatedAt,
      source: context.source,
      applicableBlockIds: context.applicableBlockIds
    });
    const report = buildImplementationReview(updated, {
      source: context.source,
      applicableBlockIds: context.applicableBlockIds,
      generatedAt
    });
    writeText(PATHS.implementationReview, report);
    persistImplementationSpine(updated, "implementation-review");
    console.log(`${CONSOLE_PREFIX} implementation review written to _implementation_review.md.`);
    console.log(
      `${CONSOLE_PREFIX} present that review to the user. Do not request approval from status counters alone.`
    );
  } catch (error) {
    recordRejectedImplementationMutation(context);
    throw error;
  }
}

function approveImplementationPlan(args) {
  const approvedBy = args.join(" ").trim();
  const updated = runImplementationMutation("implementation-approve", (context) =>
    approveImplementationSpine(context.workspace.implementationSpine, {
      approvedBy,
      revision: gitRevision(),
      now: nowIso(),
      source: context.source,
      applicableBlockIds: context.applicableBlockIds
    })
  );
  console.log(
    `${CONSOLE_PREFIX} implementation plan ${updated.plan_version} approved by ${updated.approval.approved_by}.`
  );
}

function printImplementationContext(args) {
  const context = implementationCommandContext();
  const payload = implementationContextPayload(context.workspace.implementationSpine, {
    source: context.source,
    applicableBlockIds: context.applicableBlockIds
  });
  if (args.includes("--json")) {
    const output = JSON.stringify(payload, null, 2);
    if (output.length > 10000) {
      throw new Error(
        `Implementation context packet is ${output.length} characters; split the selected slice before continuing.`
      );
    }
    console.log(output);
    return;
  }
  const output = formatImplementationContext(payload);
  if (output.length > 10000) {
    throw new Error(
      `Implementation context packet is ${output.length} characters; split the selected slice before continuing.`
    );
  }
  console.log(output);
}

function startImplementationPlanSlice(args) {
  const sliceId = args[0];
  if (!sliceId) throw new Error("Provide an implementation slice ID.");
  const updated = runImplementationMutation("implementation-start", (context) =>
    startImplementationSlice(context.workspace.implementationSpine, {
      sliceId,
      now: nowIso(),
      source: context.source
    })
  );
  console.log(`${CONSOLE_PREFIX} implementation slice active: ${updated.active_slice}`);
}

function recordImplementationEvidence(args) {
  const [blockId, targetState, kind, ref, ...noteParts] = args;
  if (!blockId || !targetState || !kind || !ref || !noteParts.length) {
    throw new Error(
      "Usage: implementation-record <block-id> <implemented|verified> <kind> <ref> <note>."
    );
  }
  const updated = runImplementationMutation("implementation-record", (context) =>
    recordWorkItemEvidence(context.workspace.implementationSpine, {
      blockId,
      targetState,
      kind,
      ref,
      note: noteParts.join(" "),
      revision: gitRevision(),
      now: nowIso(),
      source: context.source
    })
  );
  console.log(`${CONSOLE_PREFIX} ${blockId}: ${updated.work_items[blockId].state}`);
}

function holdImplementationWorkItem(args) {
  const [blockId, state, owner, reopenWhen, ...reasonParts] = args;
  if (!blockId || !state || !owner || !reopenWhen || !reasonParts.length) {
    throw new Error(
      "Usage: implementation-hold <block-id> <blocked|deferred> <owner> <reopen-when> <reason>. Quote values containing spaces."
    );
  }
  const updated = runImplementationMutation("implementation-hold", (context) =>
    holdWorkItem(context.workspace.implementationSpine, {
      blockId,
      state,
      owner,
      reopenWhen,
      reason: reasonParts.join(" "),
      now: nowIso(),
      source: context.source
    })
  );
  console.log(`${CONSOLE_PREFIX} ${blockId}: ${updated.work_items[blockId].state}`);
}

function recordImplementationAcceptance(args) {
  const [sliceId, checkId, status, kind, ref, ...noteParts] = args;
  if (!sliceId || !checkId || !status || !kind || !ref || !noteParts.length) {
    throw new Error(
      "Usage: implementation-acceptance <slice-id> <check-id> <passed|failed|blocked> <kind> <ref> <note>."
    );
  }
  runImplementationMutation("implementation-acceptance", (context) =>
    recordAcceptanceCheck(context.workspace.implementationSpine, {
      sliceId,
      checkId,
      status,
      kind,
      ref,
      note: noteParts.join(" "),
      now: nowIso(),
      source: context.source
    })
  );
  console.log(`${CONSOLE_PREFIX} ${checkId}: ${status}`);
}

function checkImplementationPlanSlice(args) {
  const context = implementationCommandContext();
  const validation = validateImplementationSpine(context.workspace.implementationSpine, {
    source: context.source,
    applicableBlockIds: context.applicableBlockIds
  });
  if (validation.errors.length) {
    throw new Error(`Implementation spine is invalid: ${validation.errors.join(" ")}`);
  }
  const sliceId = args[0] || context.workspace.implementationSpine.active_slice;
  if (!sliceId) {
    console.log(`${CONSOLE_PREFIX} implementation spine valid; no slice is active.`);
    return;
  }
  const check = checkImplementationSlice(context.workspace.implementationSpine, sliceId);
  console.log(
    `${CONSOLE_PREFIX} ${sliceId}: ${check.work_items.length} work items; ${check.pending_checks.length} acceptance checks pending.`
  );
  if (check.errors.length) throw new Error(check.errors.join(" "));
}

function closeImplementationPlanSlice(args) {
  const sliceId = args[0];
  if (!sliceId) throw new Error("Provide the active implementation slice ID.");
  const updated = runImplementationMutation("implementation-close", (context) =>
    closeImplementationSlice(context.workspace.implementationSpine, {
      sliceId,
      revision: gitRevision(),
      now: nowIso(),
      source: context.source
    })
  );
  const slice = updated.slices.find((entry) => entry.id === sliceId);
  console.log(`${CONSOLE_PREFIX} implementation slice ${sliceId}: ${slice.state}`);
}

function writeImplementationAudit() {
  const context = implementationCommandContext();
  const report = buildImplementationAudit(context.workspace.implementationSpine, {
    source: context.source,
    applicableBlockIds: context.applicableBlockIds,
    currentRevision: gitRevision(),
    generatedAt: nowIso()
  });
  writeText(PATHS.implementationAudit, report);
  console.log(`${CONSOLE_PREFIX} implementation audit written to _implementation_audit.md`);
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
  console.log(`${CONSOLE_PREFIX} implementation_spine: ${manifest.implementation.mode}`);
  console.log(`${CONSOLE_PREFIX} implementation_blocks: ${manifest.implementation.totals.blocks}`);
  if (manifest.delivery_alignment.mode === "ambient") {
    const coverage = manifest.delivery_alignment.coverage;
    console.log(
      `${CONSOLE_PREFIX} dna_direction_coverage: built ${coverage.built}/${coverage.applicable}; checked ${coverage.checked}/${coverage.applicable}; blocked ${coverage.blocked}`
    );
  }
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

function recordAlignmentReview(args) {
  const [result, revision] = args;
  if (!ALIGNMENT_REVIEW_RESULTS.includes(result)) {
    throw new Error(
      "Alignment review result must be `aligned`, `needs_attention`, or `blocked`."
    );
  }
  if (!revision || !String(revision).trim()) {
    throw new Error("Provide the reviewed Git revision.");
  }

  const workspace = loadWorkspace();
  if (workspace.state.stage !== "brainwave_documentation_complete") {
    throw new Error(
      "Fresh-context alignment reviews are recorded after DNA documentation is complete."
    );
  }

  const before = buildWorkspaceManifest(workspace, "alignment-review");
  const coverage = before.delivery_alignment.coverage;
  const implementation = before.implementation || {};
  if (
    result === "aligned" &&
    (implementation.mode !== "compiled" ||
      implementation.plan_status !== "complete" ||
      implementation.source_stale === true ||
      coverage.applicable === 0 ||
      coverage.checked !== coverage.applicable ||
      coverage.blocked > 0 ||
      coverage.invalid > 0)
  ) {
    throw new Error(
      "An aligned review requires every applicable DNA block to be verified in a current, complete implementation spine, with no blocked or invalid blocks. Record `needs_attention` or `blocked` instead."
    );
  }

  workspace.state.delivery_alignment = workspace.state.delivery_alignment || {};
  workspace.state.delivery_alignment.last_review = {
    kind: "fresh_context",
    reviewed_at: nowIso(),
    revision: String(revision).trim(),
    result
  };
  writeJsonYaml(PATHS.state, workspace.state);

  const manifest = buildWorkspaceManifest(workspace, "alignment-review", before);
  addEvent(manifest, "delivery_alignment", `Fresh-context alignment review recorded as ${result}.`, {
    revision: String(revision).trim()
  });
  writeJsonYaml(PATHS.manifest, manifest);
  injectManifestIntoDashboard(manifest);
  console.log(
    `${CONSOLE_PREFIX} alignment_review: ${result} at ${workspace.state.delivery_alignment.last_review.reviewed_at}`
  );
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
            `${CONSOLE_PREFIX} DNA documentation is complete; watch mode is now passive.`
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
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-compile [--existing-build]");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-synthesize <authored-by> [proposal-path]");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-review");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-approve <approved-by>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-context [--json]");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-start <slice-id>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-record <block-id> <implemented|verified> <kind> <ref> <note>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-hold <block-id> <blocked|deferred> <owner> <reopen-when> <reason>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-acceptance <slice-id> <check-id> <passed|failed|blocked> <kind> <ref> <note>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-check [slice-id]");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-close <slice-id>");
  console.log("  node _brainwave/_engine/brainwave_runner.js implementation-audit");
  console.log(
    "  node _brainwave/_engine/brainwave_runner.js alignment-review <aligned|needs_attention|blocked> <revision>"
  );
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
  if (command === "implementation-compile") return compileImplementationSpine(args);
  if (command === "implementation-synthesize") return synthesizeImplementationPlan(args);
  if (command === "implementation-review") return writeImplementationReview();
  if (command === "implementation-approve") return approveImplementationPlan(args);
  if (command === "implementation-context") return printImplementationContext(args);
  if (command === "implementation-start") return startImplementationPlanSlice(args);
  if (command === "implementation-record") return recordImplementationEvidence(args);
  if (command === "implementation-hold") return holdImplementationWorkItem(args);
  if (command === "implementation-acceptance") return recordImplementationAcceptance(args);
  if (command === "implementation-check") return checkImplementationPlanSlice(args);
  if (command === "implementation-close") return closeImplementationPlanSlice(args);
  if (command === "implementation-audit") return writeImplementationAudit();
  if (command === "alignment-review") return recordAlignmentReview(args);
  if (command === "watch") return watchWorkspace();
  if (command === "run") return runCycle("run");
  printHelp();
  throw new Error(`Unknown command: ${command}.`);
}

main().catch((error) => {
  console.error(`${CONSOLE_PREFIX} ${error.message}`);
  process.exit(1);
});

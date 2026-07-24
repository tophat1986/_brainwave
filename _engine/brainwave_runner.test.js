"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SOURCE_ROOT = path.resolve(__dirname, "..");
const SOURCE_RUNNER = path.join(__dirname, "brainwave_runner.js");
const SOURCE_PROJECT_INTEGRATION = path.join(__dirname, "project_integration.js");
const SESSION_HOOK = path.join(SOURCE_ROOT, ".cursor", "hooks", "brainwave_session_start.js");
const HOOK_FILES = [
  "brainwave_common.js",
  "brainwave_session_start.js",
  "brainwave_prompt_guard.js"
];

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function softwareModule() {
  return {
    schema_version: "1.1.0",
    dna_id: "software_application",
    dna_code: "SAPP",
    dna_version: "1.1.0",
    name: "Software Application DNA",
    description: "Software architecture documentation for an application.",
    documentation_label: "software architecture documentation",
    nodes: {
      "00200": {
        id: "00200",
        type: "directory",
        path: "00200_architecture",
        title: "Architecture",
        parent_id: null,
        required: true,
        when_relevant: "Use when software structure matters."
      },
      "00201": {
        id: "00201",
        type: "file",
        path: "00200_architecture/00201_system_context.md",
        title: "System Context",
        intent: "Capture system boundaries.",
        parent_id: "00200",
        required: true
      }
    }
  };
}

function brandModule() {
  return {
    schema_version: "1.1.0",
    dna_id: "brand_identity",
    dna_code: "BRND",
    dna_version: "1.1.0",
    name: "Brand Identity DNA",
    description: "Enduring verbal and visual brand identity documentation.",
    documentation_label: "brand identity documentation",
    nodes: {
      "00200": {
        id: "00200",
        type: "directory",
        path: "00200_verbal_identity",
        title: "Verbal Identity",
        parent_id: null,
        required: true,
        when_relevant: "Use when a consistent verbal identity matters."
      },
      "00201": {
        id: "00201",
        type: "file",
        path: "00200_verbal_identity/00201_voice_and_tone.md",
        title: "Voice and Tone",
        intent: "Define stable voice and contextual tone.",
        parent_id: "00200",
        required: true
      }
    }
  };
}

function createWorkspace(t, options = {}) {
  const tempBase = fs.realpathSync(os.tmpdir());
  const container = fs.mkdtempSync(path.join(tempBase, "brainwave-test-"));
  const root = options.nested ? path.join(container, "_brainwave") : container;
  if (options.nested) fs.mkdirSync(root, { recursive: true });
  t.after(() => {
    const resolved = fs.realpathSync(container);
    assert.ok(resolved.startsWith(`${tempBase}${path.sep}`));
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  const seedText = options.seedText || "A deliberately distinctive immutable seed.\n";
  const northStarStatus = options.northStarStatus || "agreed";
  const selected = options.selected !== false;
  const expressed = Boolean(options.expressed);
  const includeBrand = Boolean(options.includeBrand);

  fs.mkdirSync(path.join(root, "_engine"), { recursive: true });
  fs.copyFileSync(SOURCE_RUNNER, path.join(root, "_engine", "brainwave_runner.js"));
  fs.copyFileSync(
    SOURCE_PROJECT_INTEGRATION,
    path.join(root, "_engine", "project_integration.js")
  );
  if (options.copyHooks) {
    fs.mkdirSync(path.join(root, ".cursor", "hooks"), { recursive: true });
    for (const fileName of HOOK_FILES) {
      fs.copyFileSync(
        path.join(SOURCE_ROOT, ".cursor", "hooks", fileName),
        path.join(root, ".cursor", "hooks", fileName)
      );
    }
  }
  fs.writeFileSync(path.join(root, "_my_brainwave_seed.md"), seedText, "utf8");
  fs.writeFileSync(
    path.join(root, "_my_brainwave_north_star.md"),
    `# North Star\n\nStatus: ${northStarStatus}\n\n## Direction\n\nCurrent direction.\n`,
    "utf8"
  );
  fs.writeFileSync(path.join(root, "_decisions_log.md"), "# Decisions\n", "utf8");
  fs.writeFileSync(
    path.join(root, "_dashboard.html"),
    '<body><script id="brainwave-state" type="application/json">{}</script></body>\n',
    "utf8"
  );

  writeJson(path.join(root, "_settings.yaml"), {
    schema_version: "1.0.0",
    configured: true,
    onboarding_status: "complete",
    technical_proficiency: "intermediate",
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    allowed_values: {
      technical_proficiency: ["beginner", "intermediate", "architect"],
      ideation_mode: ["thought_partner", "fast_execution"],
      verbosity_budget: ["lean", "standard", "exhaustive"]
    },
    engine: {
      summary_char_budget: 1400,
      max_files_per_cycle: 10
    }
  });

  const selectedDna = {};
  if (selected) {
    selectedDna.software_application = {
      version: "1.1.0",
      expressed_entries: expressed ? ["00200", "00201"] : []
    };
  }
  if (includeBrand && selected) {
    selectedDna.brand_identity = {
      version: "1.1.0",
      expressed_entries: expressed ? ["00200", "00201"] : []
    };
  }
  writeJson(path.join(root, "_brainwave_state.yaml"), {
    schema_version: "2.0.0",
    stage: options.stage || "building_brainwave_documentation",
    stage_updated_at: "2026-07-23T00:00:00.000Z",
    seed: {
      path: "_my_brainwave_seed.md",
      captured_at: "2026-07-23T00:00:00.000Z",
      locked_sha256: hash(seedText)
    },
    selected_dna: selectedDna
  });

  writeJson(path.join(root, "_dna", "software_application.yaml"), softwareModule());
  if (includeBrand) {
    writeJson(path.join(root, "_dna", "brand_identity.yaml"), brandModule());
  }

  return { root, seedText };
}

function runEngine(root, ...args) {
  return runEngineFrom(root, root, ...args);
}

function runEngineFrom(root, cwd, ...args) {
  return spawnSync(process.execPath, [path.join(root, "_engine", "brainwave_runner.js"), ...args], {
    cwd,
    encoding: "utf8"
  });
}

test("uses canonical _brainwave terminology in source and console output", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const invalidConsolePrefix = ["[", "brainwave", "]"].join("");
  const invalidDocumentationTerm = ["_brainwave", "documentation"].join("-");
  const runnerSource = fs.readFileSync(SOURCE_RUNNER, "utf8");
  const decisionsLog = fs.readFileSync(path.join(SOURCE_ROOT, "_decisions_log.md"), "utf8");

  const result = runEngine(root, "status");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^\[_brainwave\] stage:/m);
  assert.doesNotMatch(result.stdout, new RegExp(invalidConsolePrefix.replace(/[[\]]/g, "\\$&")));
  assert.equal(runnerSource.includes(invalidConsolePrefix), false);
  assert.equal(runnerSource.includes(invalidDocumentationTerm), false);
  assert.equal(decisionsLog.includes(invalidDocumentationTerm), false);
});

test("rejects a seed changed after capture", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  fs.appendFileSync(path.join(root, "_my_brainwave_seed.md"), "unauthorised change\n", "utf8");

  const result = runEngine(root, "run");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seed integrity failed/);
});

test("rejects documentation work before North Star agreement", (t) => {
  const { root } = createWorkspace(t, { expressed: true, northStarStatus: "shaping" });

  const result = runEngine(root, "run");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /North Star pre-check failed/);
});

test("keeps DNA definitions free from project selection state", (t) => {
  const { root } = createWorkspace(t, {
    seedText: "Architecture brand colour security interface deployment.\n",
    expressed: false
  });
  const dnaPath = path.join(root, "_dna", "software_application.yaml");
  const before = fs.readFileSync(dnaPath, "utf8");

  const result = runEngine(root, "run");
  const after = fs.readFileSync(dnaPath, "utf8");

  assert.equal(result.status, 0);
  assert.equal(after, before);
  assert.doesNotMatch(after, /"expressed"/);
  assert.equal(fs.existsSync(path.join(root, "_documentation")), false);
});

test("scaffolds only expressed documents under the DNA namespace without copying seed content", (t) => {
  const { root, seedText } = createWorkspace(t, { expressed: true });

  const result = runEngine(root, "run");
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );
  const scaffold = fs.readFileSync(documentPath, "utf8");

  assert.equal(result.status, 0);
  assert.match(scaffold, /Status: in_progress/);
  assert.match(scaffold, /_my_brainwave_north_star\.md/);
  assert.match(scaffold, /_DNA-SAPP.*1\.1\.0/);
  assert.doesNotMatch(scaffold, new RegExp(seedText.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("uses explicit status instead of word count for completion", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );
  fs.mkdirSync(path.dirname(documentPath), { recursive: true });
  fs.writeFileSync(documentPath, `# Context\n\nStatus: in_progress\n\n${"detail ".repeat(200)}\n`, "utf8");

  const result = runEngine(root, "run");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));
  const key =
    "_documentation/_DNA-SAPP/00200_architecture/_DNA-SAPP-00201_system_context.md";

  assert.equal(result.status, 0);
  assert.equal(manifest.filesystem.tracked_files[key].processing_status, "in_progress");
  assert.equal(manifest.progress.global_completion_pct, 0);
});

test("session hook is silent when _brainwave documentation is complete", (t) => {
  const { root } = createWorkspace(t, {
    stage: "brainwave_documentation_complete",
    expressed: true
  });
  const result = spawnSync(process.execPath, [SESSION_HOOK], {
    cwd: SOURCE_ROOT,
    input: JSON.stringify({ cwd: root }),
    encoding: "utf8"
  });
  const response = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.deepEqual(response, { continue: true });
});

test("locks the seed when entering North Star shaping", (t) => {
  const { root, seedText } = createWorkspace(t, {
    stage: "awaiting_seed",
    selected: false
  });
  const statePath = path.join(root, "_brainwave_state.yaml");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.seed.captured_at = null;
  state.seed.locked_sha256 = null;
  writeJson(statePath, state);

  const result = runEngine(root, "transition", "shaping_north_star");
  const updated = JSON.parse(fs.readFileSync(statePath, "utf8"));

  assert.equal(result.status, 0);
  assert.equal(updated.stage, "shaping_north_star");
  assert.equal(updated.seed.locked_sha256, hash(seedText));
  assert.ok(updated.seed.captured_at);
});

test("rejects skipped lifecycle stages", (t) => {
  const { root } = createWorkspace(t, {
    stage: "shaping_north_star",
    selected: false
  });

  const result = runEngine(root, "transition", "scoping_brainwave_documentation");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid stage transition/);
});

test("records approved DNA selection and qualified expression only in project state", (t) => {
  const { root } = createWorkspace(t, {
    stage: "selecting_dna",
    selected: false,
    includeBrand: true
  });
  const softwarePath = path.join(root, "_dna", "software_application.yaml");
  const brandPath = path.join(root, "_dna", "brand_identity.yaml");
  const softwareBefore = fs.readFileSync(softwarePath, "utf8");
  const brandBefore = fs.readFileSync(brandPath, "utf8");

  const selectResult = runEngine(root, "select-dna", "_DNA-SAPP", "_DNA-BRND");
  const scopeResult = runEngine(root, "transition", "scoping_brainwave_documentation");
  const expressResult = runEngine(root, "express", "_DNA-BRND-00201");
  const state = JSON.parse(fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"));

  assert.equal(selectResult.status, 0);
  assert.equal(scopeResult.status, 0);
  assert.equal(expressResult.status, 0);
  assert.deepEqual(Object.keys(state.selected_dna).sort(), ["brand_identity", "software_application"]);
  assert.deepEqual(state.selected_dna.brand_identity.expressed_entries, ["00200", "00201"]);
  assert.deepEqual(state.selected_dna.software_application.expressed_entries, []);
  assert.equal(fs.readFileSync(softwarePath, "utf8"), softwareBefore);
  assert.equal(fs.readFileSync(brandPath, "utf8"), brandBefore);
  assert.equal(fs.existsSync(path.join(root, "_documentation")), false);
});

test("supports colliding local node IDs across selected DNA modules", (t) => {
  const { root } = createWorkspace(t, {
    expressed: true,
    includeBrand: true
  });

  const result = runEngine(root, "run");
  const softwareDocument = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );
  const brandDocument = path.join(
    root,
    "_documentation",
    "_DNA-BRND",
    "00200_verbal_identity",
    "_DNA-BRND-00201_voice_and_tone.md"
  );
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(softwareDocument), true);
  assert.equal(fs.existsSync(brandDocument), true);
  assert.equal(manifest.dna.totals.selected_modules, 2);
  assert.equal(manifest.dna.totals.expressed_files, 2);
  assert.equal(
    manifest.dna.modules.software_application.nodes["00201"].qualified_id,
    "_DNA-SAPP-00201"
  );
  assert.equal(
    manifest.dna.modules.brand_identity.nodes["00201"].qualified_id,
    "_DNA-BRND-00201"
  );
});

test("allows up to 99 documents in one document group", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const dnaPath = path.join(root, "_dna", "software_application.yaml");
  const statePath = path.join(root, "_brainwave_state.yaml");
  const dna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  dna.nodes["00299"] = {
    id: "00299",
    type: "file",
    path: "00200_architecture/00299_final_document.md",
    title: "Final Group Document",
    intent: "Prove the two-digit document position remains valid.",
    parent_id: "00200",
    required: false
  };
  state.selected_dna.software_application.expressed_entries.push("00299");
  writeJson(dnaPath, dna);
  writeJson(statePath, state);

  const result = runEngine(root, "run");
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00299_final_document.md"
  );

  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(documentPath), true);
});

test("rejects duplicate four-letter DNA module codes", (t) => {
  const { root } = createWorkspace(t, {
    selected: false,
    includeBrand: true
  });
  const brandPath = path.join(root, "_dna", "brand_identity.yaml");
  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  brand.dna_code = "SAPP";
  writeJson(brandPath, brand);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Duplicate DNA module code: SAPP/);
});

test("blocks a selected DNA version mismatch for explicit review", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const statePath = path.join(root, "_brainwave_state.yaml");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.selected_dna.software_application.version = "0.9.0";
  writeJson(statePath, state);

  const result = runEngine(root, "status");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /version mismatch/);
});

test("allows explicit reselection to accept a newly installed DNA version", (t) => {
  const { root } = createWorkspace(t, {
    stage: "selecting_dna",
    expressed: true
  });
  const statePath = path.join(root, "_brainwave_state.yaml");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.selected_dna.software_application.version = "0.9.0";
  writeJson(statePath, state);

  const result = runEngine(root, "select-dna", "_DNA-SAPP");
  const updated = JSON.parse(fs.readFileSync(statePath, "utf8"));

  assert.equal(result.status, 0);
  assert.equal(updated.selected_dna.software_application.version, "1.1.0");
  assert.deepEqual(updated.selected_dna.software_application.expressed_entries, []);
});

test("discovers a conforming custom data-only DNA module", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const custom = brandModule();
  custom.dna_id = "custom_domain";
  custom.dna_code = "CSTM";
  custom.name = "Custom Domain DNA";
  writeJson(path.join(root, "_dna", "custom_domain.yaml"), custom);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /_DNA-CSTM 1\.1\.0/);
  assert.match(result.stdout, /Custom Domain DNA/);
});

test("rejects executable-era project state embedded in a DNA module", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const dnaPath = path.join(root, "_dna", "software_application.yaml");
  const dna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
  dna.nodes["00201"].expressed = true;
  writeJson(dnaPath, dna);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not contain expressed flags/);
});

test("integrates a nested _brainwave without replacing existing project guidance or hooks", (t) => {
  const { root } = createWorkspace(t, {
    nested: true,
    selected: false,
    stage: "shaping_north_star"
  });
  const projectRoot = path.dirname(root);
  const stateBefore = fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8");
  fs.writeFileSync(path.join(projectRoot, "AGENTS.md"), "# Existing project guidance\n", "utf8");
  writeJson(path.join(projectRoot, ".cursor", "hooks.json"), {
    version: 1,
    hooks: {
      sessionStart: [{ command: "node existing_session_hook.js" }]
    }
  });

  const first = runEngineFrom(root, projectRoot, "integrate");
  const second = runEngineFrom(root, projectRoot, "integrate");
  const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
  const claude = fs.readFileSync(path.join(projectRoot, "CLAUDE.md"), "utf8");
  const hooks = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".cursor", "hooks.json"), "utf8")
  );

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /already current/);
  assert.match(agents, /^# Existing project guidance/m);
  assert.equal((agents.match(/_brainwave:project-bridge:start/g) || []).length, 1);
  assert.equal((claude.match(/_brainwave:project-bridge:start/g) || []).length, 1);
  assert.deepEqual(
    hooks.hooks.sessionStart.map((entry) => entry.command),
    [
      "node existing_session_hook.js",
      "node _brainwave/.cursor/hooks/brainwave_session_start.js"
    ]
  );
  assert.deepEqual(hooks.hooks.beforeSubmitPrompt, [
    { command: "node _brainwave/.cursor/hooks/brainwave_prompt_guard.js" }
  ]);
  assert.equal(
    fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"),
    stateBefore
  );
});

test("nested Cursor hook context points back to _brainwave artifacts", (t) => {
  const { root } = createWorkspace(t, {
    nested: true,
    copyHooks: true,
    selected: false,
    stage: "shaping_north_star"
  });
  const projectRoot = path.dirname(root);
  const result = spawnSync(
    process.execPath,
    [path.join(root, ".cursor", "hooks", "brainwave_session_start.js")],
    {
      cwd: projectRoot,
      input: JSON.stringify({ cwd: projectRoot }),
      encoding: "utf8"
    }
  );
  const response = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.match(response.additional_context, /`_brainwave\/AGENTS\.md`/);
  assert.match(
    response.additional_context,
    /`_brainwave\/_my_brainwave_north_star\.md`/
  );

  const promptResult = spawnSync(
    process.execPath,
    [path.join(root, ".cursor", "hooks", "brainwave_prompt_guard.js")],
    {
      cwd: projectRoot,
      input: JSON.stringify({ cwd: projectRoot, prompt: "_brainwave status" }),
      encoding: "utf8"
    }
  );
  const promptResponse = JSON.parse(promptResult.stdout);
  assert.equal(promptResult.status, 0);
  assert.match(
    promptResponse.additional_context,
    /`_brainwave\/_brainwave_handbook\.md`/
  );
});

test("refuses project integration when the framework folder is not named _brainwave", (t) => {
  const { root } = createWorkspace(t, { selected: false });

  const result = runEngine(root, "integrate");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /folder to be named `_brainwave`/);
});

test("refuses nested integration when invoked from inside the framework folder", (t) => {
  const { root } = createWorkspace(t, {
    nested: true,
    selected: false,
    stage: "shaping_north_star"
  });

  const result = runEngine(root, "integrate");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Run project integration from the target repository root/);
  assert.equal(fs.existsSync(path.join(path.dirname(root), "AGENTS.md")), false);
});

test("aborts nested integration before writing when host Cursor configuration is invalid", (t) => {
  const { root } = createWorkspace(t, {
    nested: true,
    selected: false,
    stage: "shaping_north_star"
  });
  const projectRoot = path.dirname(root);
  const agentsPath = path.join(projectRoot, "AGENTS.md");
  const hooksPath = path.join(projectRoot, ".cursor", "hooks.json");
  fs.writeFileSync(agentsPath, "# Existing guidance\n", "utf8");
  fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
  fs.writeFileSync(hooksPath, "{invalid", "utf8");

  const result = runEngineFrom(root, projectRoot, "integrate");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be JSON-compatible YAML/);
  assert.equal(fs.readFileSync(agentsPath, "utf8"), "# Existing guidance\n");
  assert.equal(fs.existsSync(path.join(projectRoot, "CLAUDE.md")), false);
});

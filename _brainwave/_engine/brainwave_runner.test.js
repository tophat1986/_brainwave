"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SOURCE_ROOT = path.resolve(__dirname, "..");
const SOURCE_PROJECT_ROOT = path.resolve(SOURCE_ROOT, "..");
const SOURCE_RUNNER = path.join(__dirname, "brainwave_runner.js");
const SOURCE_PROJECT_INTEGRATION = path.join(__dirname, "project_integration.js");
const SOURCE_CURSOR_CONFIG = path.join(SOURCE_PROJECT_ROOT, ".cursor", "hooks.json");
const SOURCE_CLAUDE_CONFIG = path.join(SOURCE_PROJECT_ROOT, ".claude", "settings.json");
const SOURCE_CODEX_CONFIG = path.join(SOURCE_PROJECT_ROOT, ".codex", "hooks.json");
const SOURCE_ADAPTERS = path.join(SOURCE_ROOT, "_engine", "adapters");
const SOURCE_RUNTIME = path.join(SOURCE_ROOT, "_engine", "runtime", "brainwave_runtime.js");
const CURSOR_ADAPTER = path.join(SOURCE_ADAPTERS, "cursor.js");
const CLAUDE_ADAPTER = path.join(SOURCE_ADAPTERS, "claude.js");
const CODEX_ADAPTER = path.join(SOURCE_ADAPTERS, "codex.js");

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function softwareModule() {
  return {
    schema_version: "3.0.0",
    dna_code: "SAPP",
    dna_version: "1.3.0",
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
        baseline: true,
        when_relevant: "Use when software structure matters."
      },
      "00201": {
        id: "00201",
        type: "file",
        path: "00200_architecture/00201_system_context.md",
        title: "System Context",
        intent: "Capture system boundaries.",
        parent_id: "00200",
        baseline: true
      }
    }
  };
}

function brandModule() {
  return {
    schema_version: "3.0.0",
    dna_code: "BRND",
    dna_version: "1.3.0",
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
        baseline: true,
        when_relevant: "Use when a consistent verbal identity matters."
      },
      "00201": {
        id: "00201",
        type: "file",
        path: "00200_verbal_identity/00201_voice_and_tone.md",
        title: "Voice and Tone",
        intent: "Define stable voice and contextual tone.",
        parent_id: "00200",
        baseline: true
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
    const adaptersTarget = path.join(root, "_engine", "adapters");
    const runtimeTarget = path.join(root, "_engine", "runtime");
    fs.mkdirSync(adaptersTarget, { recursive: true });
    fs.mkdirSync(runtimeTarget, { recursive: true });
    for (const fileName of ["cursor.js", "claude.js", "codex.js"]) {
      fs.copyFileSync(path.join(SOURCE_ADAPTERS, fileName), path.join(adaptersTarget, fileName));
    }
    fs.copyFileSync(SOURCE_RUNTIME, path.join(runtimeTarget, "brainwave_runtime.js"));
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
      max_files_per_cycle: 10
    }
  });

  const selectedDna = {};
  if (selected) {
    selectedDna["_DNA-SAPP"] = {
      version: "1.3.0",
      expressed_entries: expressed ? ["00200", "00201"] : []
    };
  }
  if (includeBrand && selected) {
    selectedDna["_DNA-BRND"] = {
      version: "1.3.0",
      expressed_entries: expressed ? ["00200", "00201"] : []
    };
  }
  writeJson(path.join(root, "_brainwave_state.yaml"), {
    schema_version: "3.0.0",
    stage: options.stage || "building_brainwave_documentation",
    stage_updated_at: "2026-07-23T00:00:00.000Z",
    seed: {
      path: "_my_brainwave_seed.md",
      captured_at: "2026-07-23T00:00:00.000Z",
      locked_sha256: hash(seedText)
    },
    selected_dna: selectedDna
  });

  writeJson(path.join(root, "_dna", "_DNA-SAPP.yaml"), softwareModule());
  if (includeBrand) {
    writeJson(path.join(root, "_dna", "_DNA-BRND.yaml"), brandModule());
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

test("template root registers thin adapters for Cursor, Claude Code, and Codex", () => {
  const cursor = JSON.parse(fs.readFileSync(SOURCE_CURSOR_CONFIG, "utf8"));
  const claude = JSON.parse(fs.readFileSync(SOURCE_CLAUDE_CONFIG, "utf8"));
  const codex = JSON.parse(fs.readFileSync(SOURCE_CODEX_CONFIG, "utf8"));

  assert.equal(
    cursor.hooks.sessionStart[0].command,
    "node _brainwave/_engine/adapters/cursor.js session-start"
  );
  assert.equal(cursor.hooks.beforeSubmitPrompt, undefined);
  assert.match(claude.hooks.SessionStart[0].hooks[0].command, /adapters\/claude\.js/);
  assert.match(codex.hooks.SessionStart[0].hooks[0].command, /adapters\/codex\.js/);
  for (const adapter of [CURSOR_ADAPTER, CLAUDE_ADAPTER, CODEX_ADAPTER, SOURCE_RUNTIME]) {
    assert.equal(fs.existsSync(adapter), true);
  }
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
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
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
  assert.match(scaffold, /_DNA-SAPP.*1\.3\.0/);
  assert.match(scaffold, /### _DNA-SAPP-00201\.01 - Initial Direction/);
  assert.match(scaffold, /#### Alternatives Considered/);
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
  assert.equal(manifest.progress.documentation_completion_pct, 0);
});

test("tracks implementation through DNA block identities without a second log", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );

  assert.equal(runEngine(root, "run").status, 0);
  const scaffold = fs
    .readFileSync(documentPath, "utf8")
    .replace("Status: not_started", "Status: in_progress");
  fs.writeFileSync(documentPath, scaffold, "utf8");
  assert.equal(runEngine(root, "refresh").status, 0);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));
  assert.equal(manifest.implementation.totals.blocks, 1);
  assert.equal(manifest.implementation.totals.in_progress, 1);
  assert.equal(manifest.implementation.current.id, "_DNA-SAPP-00201.01");
  assert.equal(manifest.implementation.current.path.endsWith("_system_context.md"), true);
});

test("requires the minimum DNA block contract before documentation review", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );
  fs.mkdirSync(path.dirname(documentPath), { recursive: true });
  fs.writeFileSync(documentPath, "# Context\n\nStatus: complete\n", "utf8");

  const result = runEngine(root, "transition", "reviewing_brainwave_documentation");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /DNA block contract failed/);
  assert.match(result.stderr, /contains no DNA blocks/);
});

test("allows review when every complete document follows the DNA block contract", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const documentPath = path.join(
    root,
    "_documentation",
    "_DNA-SAPP",
    "00200_architecture",
    "_DNA-SAPP-00201_system_context.md"
  );

  assert.equal(runEngine(root, "run").status, 0);
  const complete = fs
    .readFileSync(documentPath, "utf8")
    .replace("Status: in_progress", "Status: complete");
  fs.writeFileSync(documentPath, complete, "utf8");

  const result = runEngine(root, "transition", "reviewing_brainwave_documentation");
  assert.equal(result.status, 0);
});

test("session hook is silent when _brainwave documentation is complete", (t) => {
  const { root } = createWorkspace(t, {
    stage: "brainwave_documentation_complete",
    expressed: true,
    copyHooks: true
  });
  const result = spawnSync(
    process.execPath,
    [path.join(root, "_engine", "adapters", "cursor.js"), "session-start"],
    {
    cwd: SOURCE_ROOT,
    input: JSON.stringify({ cwd: root }),
    encoding: "utf8"
    }
  );
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
  const softwarePath = path.join(root, "_dna", "_DNA-SAPP.yaml");
  const brandPath = path.join(root, "_dna", "_DNA-BRND.yaml");
  const softwareBefore = fs.readFileSync(softwarePath, "utf8");
  const brandBefore = fs.readFileSync(brandPath, "utf8");

  const selectResult = runEngine(root, "select-dna", "_DNA-SAPP", "_DNA-BRND");
  const scopeResult = runEngine(root, "transition", "scoping_brainwave_documentation");
  const expressResult = runEngine(root, "express", "_DNA-BRND-00201");
  const state = JSON.parse(fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"));

  assert.equal(selectResult.status, 0);
  assert.equal(scopeResult.status, 0);
  assert.equal(expressResult.status, 0);
  assert.deepEqual(Object.keys(state.selected_dna).sort(), ["_DNA-BRND", "_DNA-SAPP"]);
  assert.deepEqual(state.selected_dna["_DNA-BRND"].expressed_entries, ["00200", "00201"]);
  assert.deepEqual(state.selected_dna["_DNA-SAPP"].expressed_entries, []);
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
    manifest.dna.modules["_DNA-SAPP"].nodes["00201"].qualified_id,
    "_DNA-SAPP-00201"
  );
  assert.equal(
    manifest.dna.modules["_DNA-BRND"].nodes["00201"].qualified_id,
    "_DNA-BRND-00201"
  );
});

test("allows up to 99 documents in one document group", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
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
    baseline: false
  };
  state.selected_dna["_DNA-SAPP"].expressed_entries.push("00299");
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

test("rejects a DNA source filename that conflicts with its canonical identity", (t) => {
  const { root } = createWorkspace(t, {
    selected: false,
    includeBrand: true
  });
  const brandPath = path.join(root, "_dna", "_DNA-BRND.yaml");
  const brand = JSON.parse(fs.readFileSync(brandPath, "utf8"));
  brand.dna_code = "SAPP";
  writeJson(brandPath, brand);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be named _DNA-SAPP\.yaml/);
});

test("blocks a selected DNA version mismatch for explicit review", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const statePath = path.join(root, "_brainwave_state.yaml");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  state.selected_dna["_DNA-SAPP"].version = "0.9.0";
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
  state.selected_dna["_DNA-SAPP"].version = "0.9.0";
  writeJson(statePath, state);

  const result = runEngine(root, "select-dna", "_DNA-SAPP");
  const updated = JSON.parse(fs.readFileSync(statePath, "utf8"));

  assert.equal(result.status, 0);
  assert.equal(updated.selected_dna["_DNA-SAPP"].version, "1.3.0");
  assert.deepEqual(updated.selected_dna["_DNA-SAPP"].expressed_entries, []);
});

test("discovers a conforming custom data-only DNA module", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const custom = brandModule();
  custom.dna_code = "CSTM";
  custom.name = "Custom Domain DNA";
  writeJson(path.join(root, "_dna", "_DNA-CSTM.yaml"), custom);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /_DNA-CSTM 1\.3\.0/);
  assert.match(result.stdout, /Custom Domain DNA/);
});

test("uses the canonical four-letter identity as the only DNA module identity", () => {
  const files = fs
    .readdirSync(path.join(SOURCE_ROOT, "_dna"))
    .filter((fileName) => fileName.endsWith(".yaml"))
    .sort();

  assert.deepEqual(files, ["_DNA-BRND.yaml", "_DNA-SAPP.yaml"]);
  for (const fileName of files) {
    const module = JSON.parse(
      fs.readFileSync(path.join(SOURCE_ROOT, "_dna", fileName), "utf8")
    );
    assert.equal("dna_id" in module, false);
    assert.equal(fileName, `_DNA-${module.dna_code}.yaml`);
  }
});

test("ships explicit baseline semantics and targeted SAPP ownership coverage", () => {
  const sapp = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "_dna", "_DNA-SAPP.yaml"), "utf8")
  );
  const brand = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "_dna", "_DNA-BRND.yaml"), "utf8")
  );

  for (const module of [sapp, brand]) {
    assert.equal(module.schema_version, "3.0.0");
    assert.equal(module.dna_version, "1.3.0");
    for (const node of Object.values(module.nodes)) {
      assert.equal(typeof node.baseline, "boolean");
      assert.equal("required" in node, false);
      if (node.type === "directory") {
        assert.equal(typeof node.when_relevant, "string");
        assert.equal("intent" in node, false);
      } else {
        assert.equal(typeof node.intent, "string");
        assert.equal("when_relevant" in node, false);
      }
    }
  }

  assert.equal("00204" in sapp.nodes, false);
  assert.equal(sapp.nodes["00203"].baseline, false);
  assert.equal(sapp.nodes["00405"].title, "Privacy and Data Protection");
  assert.equal(sapp.nodes["00604"].title, "Interaction and Accessibility");
  assert.equal(sapp.nodes["00604"].baseline, true);
  assert.equal(sapp.nodes["00704"].title, "Operational Readiness");
  assert.equal(sapp.nodes["01101"].title, "Performance and Scalability Model");
});

test("rejects the retired required flag even when baseline guidance exists", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
  const dna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
  dna.nodes["00201"].required = true;
  writeJson(dnaPath, dna);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /uses the retired required flag/);
});

test("keeps group relevance and document intent as separate DNA concerns", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
  const dna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
  dna.nodes["00201"].when_relevant = "This belongs on its document group.";
  writeJson(dnaPath, dna);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must use intent rather than when_relevant/);
});

test("rejects executable-era project state embedded in a DNA module", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
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
  fs.writeFileSync(path.join(projectRoot, "CLAUDE.md"), "# Existing Claude guidance\n", "utf8");
  writeJson(path.join(projectRoot, ".cursor", "hooks.json"), {
    version: 1,
    hooks: {
      sessionStart: [{ command: "node existing_session_hook.js" }]
    }
  });
  writeJson(path.join(projectRoot, ".claude", "settings.json"), {
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: "command", command: "node existing_claude_hook.js" }]
        }
      ]
    }
  });
  writeJson(path.join(projectRoot, ".codex", "hooks.json"), {
    hooks: {
      SessionStart: [
        {
          hooks: [{ type: "command", command: "node existing_codex_hook.js" }]
        }
      ]
    }
  });

  const first = runEngineFrom(root, projectRoot, "integrate");
  const second = runEngineFrom(root, projectRoot, "integrate");
  const agents = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
  const claudeGuide = fs.readFileSync(path.join(projectRoot, "CLAUDE.md"), "utf8");
  const cursor = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".cursor", "hooks.json"), "utf8")
  );
  const claude = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".claude", "settings.json"), "utf8")
  );
  const codex = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".codex", "hooks.json"), "utf8")
  );

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /already current/);
  assert.match(agents, /^# Existing project guidance/m);
  assert.match(claudeGuide, /^# Existing Claude guidance/m);
  assert.equal((agents.match(/_brainwave:project-bridge:start/g) || []).length, 1);
  assert.equal((claudeGuide.match(/_brainwave:project-bridge:start/g) || []).length, 1);
  assert.deepEqual(
    cursor.hooks.sessionStart.map((entry) => entry.command),
    [
      "node existing_session_hook.js",
      "node _brainwave/_engine/adapters/cursor.js session-start"
    ]
  );
  assert.equal(cursor.hooks.beforeSubmitPrompt, undefined);
  assert.deepEqual(
    claude.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command),
    [
      "node existing_claude_hook.js",
      'node "${CLAUDE_PROJECT_DIR}/_brainwave/_engine/adapters/claude.js" session-start'
    ]
  );
  assert.deepEqual(
    codex.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command),
    [
      "node existing_codex_hook.js",
      'node "$(git rev-parse --show-toplevel)/_brainwave/_engine/adapters/codex.js" session-start'
    ]
  );
  assert.equal(
    fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"),
    stateBefore
  );

  const removeFirst = runEngineFrom(root, projectRoot, "unintegrate");
  const removeSecond = runEngineFrom(root, projectRoot, "unintegrate");
  const agentsAfter = fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8");
  const cursorAfter = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".cursor", "hooks.json"), "utf8")
  );
  const claudeAfter = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".claude", "settings.json"), "utf8")
  );
  const codexAfter = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".codex", "hooks.json"), "utf8")
  );

  assert.equal(removeFirst.status, 0);
  assert.equal(removeSecond.status, 0);
  assert.match(removeSecond.stdout, /already absent/);
  assert.doesNotMatch(agentsAfter, /_brainwave:project-bridge:start/);
  assert.deepEqual(cursorAfter.hooks.sessionStart, [
    { command: "node existing_session_hook.js" }
  ]);
  assert.deepEqual(
    claudeAfter.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command),
    ["node existing_claude_hook.js"]
  );
  assert.deepEqual(
    codexAfter.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command),
    ["node existing_codex_hook.js"]
  );
  assert.equal(
    fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"),
    stateBefore
  );
});

test("nested adapters emit platform-correct context pointing to _brainwave artifacts", (t) => {
  const { root } = createWorkspace(t, {
    nested: true,
    copyHooks: true,
    selected: false,
    stage: "shaping_north_star"
  });
  const projectRoot = path.dirname(root);
  const cursorResult = spawnSync(
    process.execPath,
    [path.join(root, "_engine", "adapters", "cursor.js"), "session-start"],
    {
      cwd: projectRoot,
      input: JSON.stringify({ cwd: projectRoot }),
      encoding: "utf8"
    }
  );
  const cursorResponse = JSON.parse(cursorResult.stdout);

  assert.equal(cursorResult.status, 0);
  assert.match(cursorResponse.additional_context, /`_brainwave\/AGENTS\.md`/);
  assert.match(
    cursorResponse.additional_context,
    /`_brainwave\/_my_brainwave_north_star\.md`/
  );

  for (const adapter of ["claude", "codex"]) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "_engine", "adapters", `${adapter}.js`), "session-start"],
      {
        cwd: projectRoot,
        input: JSON.stringify({ cwd: projectRoot }),
        encoding: "utf8"
      }
    );
    const response = JSON.parse(result.stdout);
    assert.equal(result.status, 0);
    assert.equal(response.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(
      response.hookSpecificOutput.additionalContext,
      /`_brainwave\/_brainwave_handbook\.md`/
    );
  }
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
  assert.match(result.stderr, /must contain valid JSON/);
  assert.equal(fs.readFileSync(agentsPath, "utf8"), "# Existing guidance\n");
  assert.equal(fs.existsSync(path.join(projectRoot, "CLAUDE.md")), false);
});

test("ships a clean template and installs into an empty repository", (t) => {
  const sourceState = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "_brainwave_state.yaml"), "utf8")
  );
  assert.equal(sourceState.stage, "awaiting_seed");
  assert.equal(sourceState.seed.locked_sha256, null);
  assert.equal(fs.readFileSync(path.join(SOURCE_ROOT, "_my_brainwave_seed.md"), "utf8"), "");
  assert.equal(
    fs.readFileSync(path.join(SOURCE_ROOT, "_my_brainwave_north_star.md"), "utf8"),
    ""
  );
  assert.equal(fs.existsSync(path.join(SOURCE_ROOT, "_examples")), false);
  assert.equal(fs.existsSync(path.join(SOURCE_ROOT, "_context")), false);
  assert.equal(
    fs.existsSync(path.join(SOURCE_ROOT, "_templates", "my_brainwave_seed_template.md")),
    true
  );
  const sourcePackage = JSON.parse(
    fs.readFileSync(path.join(SOURCE_PROJECT_ROOT, "package.json"), "utf8")
  );
  assert.equal(sourcePackage.license, "MIT");
  assert.match(
    fs.readFileSync(path.join(SOURCE_PROJECT_ROOT, "LICENSE"), "utf8"),
    /^MIT License/
  );

  const textFiles = [];
  const collect = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(fullPath);
      else if (/\.(?:md|json|ya?ml|js|html)$/i.test(entry.name)) textFiles.push(fullPath);
    }
  };
  collect(SOURCE_ROOT);
  const releaseText = textFiles.map((filePath) => fs.readFileSync(filePath, "utf8")).join("\n");
  const retiredExamplePattern = new RegExp(["wish", "list"].join("\\s*"), "i");
  assert.doesNotMatch(releaseText, retiredExamplePattern);

  const tempBase = fs.realpathSync(os.tmpdir());
  const container = fs.mkdtempSync(path.join(tempBase, "brainwave-install-"));
  const projectRoot = path.join(container, "project");
  const frameworkRoot = path.join(projectRoot, "_brainwave");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.cpSync(SOURCE_ROOT, frameworkRoot, { recursive: true });
  t.after(() => {
    const resolved = fs.realpathSync(container);
    assert.ok(resolved.startsWith(`${tempBase}${path.sep}`));
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  const integration = runEngineFrom(frameworkRoot, projectRoot, "integrate");
  const status = runEngineFrom(frameworkRoot, projectRoot, "status");

  assert.equal(integration.status, 0);
  assert.equal(status.status, 0);
  assert.match(status.stdout, /stage: awaiting_seed/);
  assert.equal(fs.existsSync(path.join(projectRoot, "AGENTS.md")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, "CLAUDE.md")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".cursor", "hooks.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".claude", "settings.json")), true);
  assert.equal(fs.existsSync(path.join(projectRoot, ".codex", "hooks.json")), true);
});

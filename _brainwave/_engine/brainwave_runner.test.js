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
const { buildSessionContext } = require(SOURCE_RUNTIME);

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function moduleContract(domain) {
  return {
    when_relevant: `Use when ${domain} is material.`,
    selection_signals: [`The concept requires ${domain}.`],
    owns: [`Own ${domain} decisions.`],
    does_not_own: ["Do not absorb adjacent domains."],
    coordinates_with: {},
    live_verification: [],
    timing: {
      consider_early: `Consider ${domain} while shaping direction.`,
      can_defer_when: `${domain} cannot affect the confirmed outcome or likely trajectory.`,
      must_not_defer_when: `${domain} creates a material current constraint.`
    }
  };
}

function softwareModule() {
  return {
    schema_version: "3.0.0",
    dna_code: "SAPP",
    dna_version: "1.3.0",
    name: "Software Application DNA",
    description: "Software architecture documentation for an application.",
    documentation_label: "software architecture documentation",
    module_contract: moduleContract("software architecture"),
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
    module_contract: moduleContract("brand identity"),
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

test("dashboard JavaScript parses and presents the expanded DNA boundaries", () => {
  const html = fs.readFileSync(path.join(SOURCE_ROOT, "_dashboard.html"), "utf8");
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/type=["']application\/json["']/i.test(match[1]))
    .map((match) => match[2]);

  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.match(html, /Domain boundary/);
  assert.match(html, /Consider early:/);
  assert.match(html, /data-tone="experience"/);
  assert.match(html, /data-tone="product"/);
  assert.match(html, /data-tone="commercial"/);
  assert.match(html, /data-tone="growth"/);
  assert.match(html, /data-tone="legal"/);
  assert.match(html, /data-tone="operations"/);
});

test("keeps user-facing lifecycle terminology aligned across surfaces", () => {
  const sources = {
    readme: fs.readFileSync(path.join(SOURCE_PROJECT_ROOT, "README.md"), "utf8"),
    agents: fs.readFileSync(path.join(SOURCE_ROOT, "AGENTS.md"), "utf8"),
    handbook: fs.readFileSync(path.join(SOURCE_ROOT, "_brainwave_handbook.md"), "utf8"),
    dashboard: fs
      .readFileSync(path.join(SOURCE_ROOT, "_dashboard.html"), "utf8")
      .replace(/<script id="brainwave-state"[\s\S]*?<\/script>/, ""),
    runtime: fs.readFileSync(SOURCE_RUNTIME, "utf8")
  };
  const canonicalStages = [
    "Capture the idea",
    "Agree the direction",
    "Choose DNA modules",
    "Scope DNA documents",
    "Build DNA documentation",
    "Review the foundation",
    "Ready for implementation"
  ];
  const retiredLabels = [
    "Choose documentation areas",
    "Agree document scope",
    "Build documentation",
    "Documentation plan",
    "_brainwave documentation"
  ];

  for (const [surface, content] of Object.entries(sources)) {
    for (const stage of canonicalStages) {
      assert.equal(content.includes(stage), true, `${surface} is missing "${stage}"`);
    }
    for (const retired of retiredLabels) {
      assert.equal(content.includes(retired), false, `${surface} retains "${retired}"`);
    }
  }
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

test("session context adapts user orientation to guidance mode", () => {
  const baseRuntime = {
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    state: { stage: "shaping_north_star" },
    seed: "A concept.",
    northStar: "# North Star\n\nStatus: shaping\n"
  };
  const configured = {
    configured: true,
    onboarding_status: "complete",
    technical_proficiency: "intermediate",
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    allowed_values: {
      guidance_mode: ["guided", "concise"],
      technical_proficiency: ["beginner", "intermediate", "architect"],
      ideation_mode: ["thought_partner", "fast_execution"],
      verbosity_budget: ["lean", "standard", "exhaustive"]
    }
  };

  const guided = buildSessionContext({
    ...baseRuntime,
    settings: { ...configured, guidance_mode: "guided" }
  });
  const concise = buildSessionContext({
    ...baseRuntime,
    settings: { ...configured, guidance_mode: "concise" }
  });
  const legacy = buildSessionContext({
    ...baseRuntime,
    settings: configured
  });

  assert.match(guided, /Guidance mode is `guided`/);
  assert.match(guided, /exact user-facing label is "Agree the direction"/);
  assert.match(guided, /compact seven-step journey/);
  assert.match(guided, /`_brainwave\/_dashboard\.html`/);
  assert.match(concise, /Guidance mode is `concise`/);
  assert.doesNotMatch(concise, /compact seven-step journey/);
  assert.match(legacy, /Guidance mode is `concise`/);
});

test("shaping context requires an explicitly confirmed build outcome for new settings", () => {
  const settings = {
    schema_version: "1.2.0",
    configured: true,
    onboarding_status: "complete",
    guidance_mode: "concise",
    technical_proficiency: "beginner",
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    build_outcome: null,
    build_outcome_confirmed_at: null,
    allowed_values: {
      guidance_mode: ["guided", "concise"],
      technical_proficiency: ["beginner", "intermediate", "architect"],
      ideation_mode: ["thought_partner", "fast_execution"],
      verbosity_budget: ["lean", "standard", "exhaustive"],
      build_outcome: ["demonstration", "usable_first_version", "complete_product", "custom"]
    }
  };
  const baseRuntime = {
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    state: { stage: "shaping_north_star" },
    seed: "A concept.",
    northStar: "# North Star\n\nStatus: shaping\n",
    settings
  };

  const pending = buildSessionContext(baseRuntime);
  const confirmed = buildSessionContext({
    ...baseRuntime,
    settings: {
      ...settings,
      build_outcome: "usable_first_version",
      build_outcome_confirmed_at: "2026-08-03T12:00:00.000Z"
    }
  });

  assert.match(pending, /How far would you like us to take this idea/);
  assert.match(pending, /Show me the idea/);
  assert.match(pending, /Do not infer or default the answer/);
  assert.match(pending, /What We Are Building/);
  assert.match(pending, /adaptive conversation rather than a questionnaire/);
  assert.match(pending, /funding and economic sustainability/);
  assert.match(pending, /Risk overrides an early project phase/);
  assert.match(pending, /Proportional scope changes breadth, not the quality floor/);
  assert.doesNotMatch(confirmed, /How far would you like us to take this idea/);
});

test("incomplete profile context asks the guidance question first", () => {
  const context = buildSessionContext({
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    state: { stage: "awaiting_seed" },
    settings: {
      configured: false,
      onboarding_status: "pending",
      guidance_mode: null,
      allowed_values: { guidance_mode: ["guided", "concise"] }
    },
    seed: "",
    northStar: ""
  });

  assert.match(context, /first time with _brainwave before the other three/);
  assert.match(context, /native structured-choice UI/);
  assert.match(context, /"Yes — guide me" to `guided`/);
  assert.match(context, /Offer two equal seed routes/);
  assert.match(context, /preserve the user's supplied wording and natural structure/);
});

test("prepared seed context requires exact confirmation before locking", () => {
  const context = buildSessionContext({
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    state: { stage: "awaiting_seed" },
    settings: {
      schema_version: "1.1.0",
      configured: true,
      onboarding_status: "complete",
      guidance_mode: "concise",
      technical_proficiency: "intermediate",
      ideation_mode: "thought_partner",
      verbosity_budget: "standard",
      allowed_values: {
        guidance_mode: ["guided", "concise"],
        technical_proficiency: ["beginner", "intermediate", "architect"],
        ideation_mode: ["thought_partner", "fast_execution"],
        verbosity_budget: ["lean", "standard", "exhaustive"]
      }
    },
    seed: "A prepared concept.",
    northStar: ""
  });

  assert.match(context, /prepared concept already exists/);
  assert.match(context, /Do not rewrite or restructure it/);
  assert.match(context, /used exactly as written/);
  assert.match(context, /locks its hash/);
});

test("selecting DNA context explains modules in plain language", () => {
  const context = buildSessionContext({
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    state: { stage: "selecting_dna" },
    settings: {
      configured: true,
      onboarding_status: "complete",
      guidance_mode: "concise",
      technical_proficiency: "intermediate",
      ideation_mode: "thought_partner",
      verbosity_budget: "standard",
      allowed_values: {
        guidance_mode: ["guided", "concise"],
        technical_proficiency: ["beginner", "intermediate", "architect"],
        ideation_mode: ["thought_partner", "fast_execution"],
        verbosity_budget: ["lean", "standard", "exhaustive"]
      }
    },
    seed: "A concept.",
    northStar: "# North Star\n\nStatus: agreed\n"
  });

  assert.match(context, /curated catalogues of possible documentation for relevant domains/);
  assert.match(context, /timing and live-verification rules/);
  assert.match(context, /deferrals with re-entry triggers/);
  assert.match(context, /Legal, policy, and service consequences can require early attention/);
  assert.match(context, /state that coverage gap rather than distributing it across adjacent modules/);
  assert.match(context, /exact user-facing label is "Choose DNA modules"/);
});

test("session context uses canonical DNA stage labels and artifacts", () => {
  const settings = {
    configured: true,
    onboarding_status: "complete",
    guidance_mode: "concise",
    technical_proficiency: "intermediate",
    ideation_mode: "thought_partner",
    verbosity_budget: "standard",
    allowed_values: {
      guidance_mode: ["guided", "concise"],
      technical_proficiency: ["beginner", "intermediate", "architect"],
      ideation_mode: ["thought_partner", "fast_execution"],
      verbosity_budget: ["lean", "standard", "exhaustive"]
    }
  };
  const baseRuntime = {
    root: SOURCE_ROOT,
    cwd: SOURCE_PROJECT_ROOT,
    settings,
    seed: "A concept.",
    northStar: "# North Star\n\nStatus: agreed\n"
  };

  const scoping = buildSessionContext({
    ...baseRuntime,
    state: { stage: "scoping_brainwave_documentation" }
  });
  const building = buildSessionContext({
    ...baseRuntime,
    state: { stage: "building_brainwave_documentation" }
  });
  const reviewing = buildSessionContext({
    ...baseRuntime,
    state: { stage: "reviewing_brainwave_documentation" }
  });

  assert.match(scoping, /exact user-facing label is "Scope DNA documents"/);
  assert.match(scoping, /proportionate DNA documents from the selected DNA modules/);
  assert.match(scoping, /grouping obvious related documents into concise approval slices/);
  assert.match(building, /exact user-facing label is "Build DNA documentation"/);
  assert.match(building, /scoped DNA documentation and its traceable DNA blocks/);
  assert.match(building, /never legal approval or compliance/);
  assert.match(reviewing, /reject claims of legal advice, approval, certification, or compliance/);
  assert.match(reviewing, /launch-readiness claims while required review gates remain unresolved/);
});

test("new settings require guidance mode while legacy configured settings remain valid", (t) => {
  const legacyWorkspace = createWorkspace(t, {
    selected: false,
    stage: "shaping_north_star"
  });
  const legacyResult = runEngine(
    legacyWorkspace.root,
    "transition",
    "selecting_dna"
  );
  assert.equal(legacyResult.status, 0);

  const newWorkspace = createWorkspace(t, {
    selected: false,
    stage: "shaping_north_star"
  });
  const settingsPath = path.join(newWorkspace.root, "_settings.yaml");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  settings.schema_version = "1.1.0";
  settings.guidance_mode = null;
  settings.allowed_values.guidance_mode = ["guided", "concise"];
  writeJson(settingsPath, settings);

  const incompleteResult = runEngine(
    newWorkspace.root,
    "transition",
    "selecting_dna"
  );
  assert.equal(incompleteResult.status, 1);
  assert.match(incompleteResult.stderr, /Profile pre-check failed/);

  settings.guidance_mode = "guided";
  writeJson(settingsPath, settings);
  const guidedResult = runEngine(
    newWorkspace.root,
    "transition",
    "selecting_dna"
  );
  assert.equal(guidedResult.status, 0);
});

test("new settings block DNA selection until the build outcome is confirmed", (t) => {
  const { root } = createWorkspace(t, {
    selected: false,
    stage: "shaping_north_star"
  });
  const settingsPath = path.join(root, "_settings.yaml");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  settings.schema_version = "1.2.0";
  settings.guidance_mode = "concise";
  settings.build_outcome = null;
  settings.build_outcome_confirmed_at = null;
  settings.allowed_values.guidance_mode = ["guided", "concise"];
  settings.allowed_values.build_outcome = [
    "demonstration",
    "usable_first_version",
    "complete_product",
    "custom"
  ];
  writeJson(settingsPath, settings);

  const pending = runEngine(root, "transition", "selecting_dna");
  assert.equal(pending.status, 1);
  assert.match(pending.stderr, /Build outcome pre-check failed/);

  settings.build_outcome = "usable_first_version";
  settings.build_outcome_confirmed_at = "2026-08-03T12:00:00.000Z";
  writeJson(settingsPath, settings);
  const confirmed = runEngine(root, "transition", "selecting_dna");
  assert.equal(confirmed.status, 0);
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
    .replace("Status: not_started", "Status: in_progress")
    .replace("#### Direction\n\n", "#### Direction\n\nKeep the system boundary explicit.\n\n");
  fs.writeFileSync(documentPath, scaffold, "utf8");
  fs.writeFileSync(
    path.join(root, "_decisions_log.md"),
    [
      "# _brainwave Decisions Log",
      "",
      "- timestamp: 2026-07-30",
      "- trigger: Scope review",
      "- decision: Keep the first release local and dependency-free.",
      "- rationale: Preserve a lightweight adoption path.",
      "- alternatives_considered: A hosted dashboard.",
      "- impact_on_dna: No DNA module selection change.",
      "- approved_by: Product owner",
      ""
    ].join("\n"),
    "utf8"
  );
  assert.equal(runEngine(root, "refresh").status, 0);

  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));
  const documentKey =
    "_documentation/_DNA-SAPP/00200_architecture/_DNA-SAPP-00201_system_context.md";
  assert.equal(manifest.framework.name, "_brainwave");
  assert.equal(manifest.framework.version, "0.1.0");
  assert.equal(manifest.implementation.totals.blocks, 1);
  assert.equal(manifest.implementation.totals.in_progress, 1);
  assert.equal(manifest.implementation.current.id, "_DNA-SAPP-00201.01");
  assert.equal(manifest.implementation.current.path.endsWith("_system_context.md"), true);
  assert.equal(
    manifest.implementation.current.details.direction,
    "Keep the system boundary explicit."
  );
  assert.equal(
    manifest.presentation.content.seed.markdown,
    "A deliberately distinctive immutable seed.\n"
  );
  assert.match(manifest.presentation.content.north_star.markdown, /Current direction/);
  assert.match(manifest.presentation.documents[documentKey].markdown, /system boundary explicit/);
  assert.equal(manifest.presentation.decisions.length, 1);
  assert.equal(
    manifest.presentation.decisions[0].decision,
    "Keep the first release local and dependency-free."
  );
  assert.equal(
    manifest.dna.modules["_DNA-SAPP"].nodes["00201"].intent,
    "Capture system boundaries."
  );
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

test("session hook is silent when DNA documentation is complete", (t) => {
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

test("records approved DNA module selection and qualified expression only in project state", (t) => {
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

test("allows up to 99 documents in one DNA document group", (t) => {
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

  assert.deepEqual(files, [
    "_DNA-BRND.yaml",
    "_DNA-COMM.yaml",
    "_DNA-GROW.yaml",
    "_DNA-LEGL.yaml",
    "_DNA-PDEX.yaml",
    "_DNA-PSTR.yaml",
    "_DNA-SAPP.yaml",
    "_DNA-SOPS.yaml"
  ]);
  for (const fileName of files) {
    const module = JSON.parse(
      fs.readFileSync(path.join(SOURCE_ROOT, "_dna", fileName), "utf8")
    );
    assert.equal("dna_id" in module, false);
    assert.equal(fileName, `_DNA-${module.dna_code}.yaml`);
  }
});

test("ships explicit module contracts, baseline semantics, and separated product domains", () => {
  const shipped = Object.fromEntries(
    ["BRND", "COMM", "GROW", "LEGL", "PDEX", "PSTR", "SAPP", "SOPS"].map((code) => [
      code,
      JSON.parse(
        fs.readFileSync(path.join(SOURCE_ROOT, "_dna", `_DNA-${code}.yaml`), "utf8")
      )
    ])
  );
  const {
    BRND: brand,
    COMM: commercial,
    GROW: growth,
    LEGL: legal,
    PDEX: experience,
    PSTR: strategy,
    SAPP: sapp,
    SOPS: service
  } = shipped;

  assert.equal(sapp.dna_version, "1.3.0");
  assert.equal(brand.dna_version, "1.3.0");
  assert.equal(experience.dna_version, "0.1.0");
  assert.equal(strategy.dna_version, "0.1.0");
  assert.equal(commercial.dna_version, "0.1.0");
  assert.equal(growth.dna_version, "0.1.0");
  assert.equal(legal.dna_version, "0.1.0");
  assert.equal(service.dna_version, "0.1.0");
  for (const module of Object.values(shipped)) {
    assert.equal(module.schema_version, "3.0.0");
    assert.equal(typeof module.module_contract.when_relevant, "string");
    assert.ok(module.module_contract.selection_signals.length > 0);
    assert.ok(module.module_contract.owns.length > 0);
    assert.ok(module.module_contract.does_not_own.length > 0);
    assert.ok(Array.isArray(module.module_contract.live_verification));
    assert.equal(typeof module.module_contract.timing.consider_early, "string");
    assert.equal(typeof module.module_contract.timing.can_defer_when, "string");
    assert.equal(typeof module.module_contract.timing.must_not_defer_when, "string");
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

  assert.equal(sapp.nodes["00100"].title, "Product Definition");
  assert.equal(sapp.nodes["00100"].baseline, true);
  assert.equal(sapp.nodes["00101"].title, "Product Scope and Completion");
  assert.equal(sapp.nodes["00101"].baseline, true);
  assert.match(sapp.nodes["00101"].intent, /included capabilities/);
  assert.equal("00204" in sapp.nodes, false);
  assert.equal(sapp.nodes["00203"].baseline, false);
  assert.equal(sapp.nodes["00405"].title, "Privacy Engineering");
  assert.match(sapp.nodes["00404"].intent, /Legal, Policy and Market Access DNA/);
  assert.equal(sapp.nodes["00600"].title, "Experience Implementation");
  assert.equal(
    sapp.nodes["00604"].title,
    "Accessibility and Localisation Implementation"
  );
  assert.equal(sapp.nodes["00604"].baseline, true);
  assert.equal(sapp.nodes["00704"].title, "Operational Readiness");
  assert.equal(sapp.nodes["01004"].title, "Product Analytics Instrumentation");
  assert.match(sapp.nodes["01004"].intent, /decision purpose/);
  assert.equal(sapp.nodes["01101"].title, "Performance and Scalability Model");
  assert.equal(sapp.nodes["01102"].title, "Technical Cost Model and Controls");
  assert.equal(sapp.nodes["01102"].baseline, true);
  assert.equal(experience.name, "Product Design and Experience DNA");
  assert.equal(experience.nodes["00104"].title, "Design Exploration and References");
  assert.match(experience.nodes["00104"].intent, /two materially different/);
  assert.equal(experience.nodes["00402"].title, "Interface Copy");
  assert.match(experience.nodes["00402"].intent, /developer notes/);
  assert.equal(experience.nodes["00501"].title, "Visual Hierarchy and Composition");
  assert.equal(experience.nodes["00601"].title, "Locale Strategy");
  assert.equal(experience.nodes["00701"].title, "Experience Acceptance Criteria");
  assert.equal(strategy.nodes["00101"].title, "Problem and Need Evidence");
  assert.equal(strategy.nodes["00402"].title, "Product Metrics");
  assert.equal(commercial.nodes["00501"].title, "Cost and Unit Economics");
  assert.match(commercial.module_contract.timing.consider_early, /venture-intent/);
  assert.equal(commercial.nodes["00301"].title, "Purchases, Subscriptions, Usage and Entitlements");
  assert.match(commercial.nodes["00502"].intent, /working capital.*runway/);
  assert.equal(commercial.nodes["00503"].baseline, true);
  assert.match(commercial.module_contract.live_verification.join(" "), /tax advice/);
  assert.equal(growth.nodes["00104"].title, "Responsible Growth Boundaries");
  assert.match(growth.nodes["00104"].intent, /deceptive or coercive conversion/);
  assert.equal(growth.nodes["00302"].title, "App Store Presence");
  assert.equal(growth.nodes["00701"].title, "Funnel and Channel Measurement");
  assert.equal(growth.nodes["00801"].title, "Sales Motion and Pipeline");
  assert.equal(growth.nodes["00802"].title, "Partnership Strategy");
  assert.doesNotMatch(growth.module_contract.does_not_own.join(" "), /Legal approval/);
  assert.match(growth.module_contract.does_not_own.join(" "), /Operational service-support communications owned by Service Operations/);
  assert.match(legal.description, /does not provide legal advice/);
  assert.match(legal.module_contract.live_verification.join(" "), /current primary or authoritative/);
  assert.match(legal.module_contract.timing.must_not_defer_when, /initial detection/);
  assert.match(legal.module_contract.does_not_own.join(" "), /specialist owners/);
  assert.equal(legal.nodes["00103"].baseline, false);
  assert.equal(legal.nodes["00205"].title, "Incident, Breach and Notification Requirements");
  assert.equal(legal.nodes["00500"].title, "Claims and Promotions");
  assert.equal(legal.nodes["00600"].baseline, false);
  assert.equal(legal.nodes["00700"].title, "Content, Data and Intellectual Property");
  assert.equal(service.nodes["00101"].title, "Service Blueprint");
  assert.equal(service.nodes["00302"].title, "Scheduling, Queues and Capacity");
  assert.match(service.module_contract.timing.must_not_defer_when, /depends on people or partners/);
  assert.match(service.module_contract.does_not_own.join(" "), /moderation-system governance/);
  assert.equal(service.nodes["00500"].baseline, false);
  assert.equal(service.nodes["00600"].baseline, false);
  assert.equal(service.nodes["00701"].title, "Customer Success Model");
  assert.match(service.module_contract.selection_signals.join(" "), /manage account success/);
  assert.match(service.module_contract.owns.join(" "), /proactive value realisation/);
});

test("rejects a DNA module without an explicit module contract", (t) => {
  const { root } = createWorkspace(t, { selected: false });
  const dnaPath = path.join(root, "_dna", "_DNA-SAPP.yaml");
  const dna = JSON.parse(fs.readFileSync(dnaPath, "utf8"));
  delete dna.module_contract;
  writeJson(dnaPath, dna);

  const result = runEngine(root, "dna");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must define module_contract/);
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
  dna.nodes["00201"].when_relevant = "This belongs on its DNA document group.";
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
  assert.match(agents, /all user-facing output must follow the accepted Product Design and Experience and Brand documentation/);
  assert.match(claudeGuide, /all user-facing output must follow the accepted Product Design and Experience and Brand documentation/);
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
  const sourceSettings = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "_settings.yaml"), "utf8")
  );
  assert.equal(sourceSettings.schema_version, "1.2.0");
  assert.equal(sourceSettings.guidance_mode, null);
  assert.equal(sourceSettings.build_outcome, null);
  assert.equal(sourceSettings.build_outcome_confirmed_at, null);
  assert.deepEqual(sourceSettings.allowed_values.guidance_mode, ["guided", "concise"]);
  assert.deepEqual(sourceSettings.allowed_values.build_outcome, [
    "demonstration",
    "usable_first_version",
    "complete_product",
    "custom"
  ]);
  assert.match(sourceSettings.onboarding_questions[0], /first time using _brainwave/);
  assert.equal(sourceSettings.onboarding_questions.some((question) => /build outcome/i.test(question)), false);
  const seedTemplate = fs.readFileSync(
    path.join(SOURCE_ROOT, "_templates", "my_brainwave_seed_template.md"),
    "utf8"
  );
  assert.doesNotMatch(seedTemplate, /^## /m);
  assert.match(seedTemplate, /Preserve the user's supplied wording and meaning/);
  const northStarTemplate = fs.readFileSync(
    path.join(SOURCE_ROOT, "_templates", "my_brainwave_north_star_template.md"),
    "utf8"
  );
  assert.match(northStarTemplate, /^## What We Are Building$/m);
  const sourcePackage = JSON.parse(
    fs.readFileSync(path.join(SOURCE_PROJECT_ROOT, "package.json"), "utf8")
  );
  assert.equal(sourcePackage.license, "MIT");
  const sourceReadme = fs.readFileSync(
    path.join(SOURCE_PROJECT_ROOT, "README.md"),
    "utf8"
  );
  assert.match(sourceReadme, /Use a prepared file/);
  assert.match(sourceReadme, /seed file exactly as written/);
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

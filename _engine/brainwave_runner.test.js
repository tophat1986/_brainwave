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
const SESSION_HOOK = path.join(SOURCE_ROOT, ".cursor", "hooks", "brainwave_session_start.js");

function hash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createWorkspace(t, options = {}) {
  const tempBase = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(tempBase, "brainwave-test-"));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert.ok(resolved.startsWith(`${tempBase}${path.sep}`));
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  const seedText = options.seedText || "A deliberately distinctive immutable seed.\n";
  const northStarStatus = options.northStarStatus || "agreed";
  const expressed = Boolean(options.expressed);
  fs.mkdirSync(path.join(root, "_engine"), { recursive: true });
  fs.copyFileSync(SOURCE_RUNNER, path.join(root, "_engine", "brainwave_runner.js"));
  fs.writeFileSync(path.join(root, "_my_brainwave_seed.md"), seedText, "utf8");
  fs.writeFileSync(
    path.join(root, "_my_brainwave_north_star.md"),
    `# North Star\n\nStatus: ${northStarStatus}\n\n## Direction\n\nCurrent direction.\n`,
    "utf8"
  );
  fs.writeFileSync(path.join(root, "_decisions_log.md"), "# Decisions\n", "utf8");
  fs.writeFileSync(path.join(root, "_dashboard.html"), "<body></body>\n", "utf8");

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
      rate_limit_ms: 1,
      max_context_chars: 32000,
      summary_char_budget: 1400,
      max_files_per_cycle: 10
    }
  });
  writeJson(path.join(root, "_brainwave_state.yaml"), {
    schema_version: "1.0.0",
    stage: options.stage || "building_architecture_documentation",
    stage_updated_at: "2026-07-23T00:00:00.000Z",
    seed: {
      path: "_my_brainwave_seed.md",
      captured_at: "2026-07-23T00:00:00.000Z",
      locked_sha256: hash(seedText)
    }
  });
  writeJson(path.join(root, "_dna.yaml"), {
    schema_version: "1.0.0",
    framework: "_brainwave",
    nodes: {
      "00200": {
        id: "00200",
        type: "directory",
        path: "00200_architecture",
        title: "Architecture",
        parent_id: null,
        required: true,
        expressed
      },
      "00201": {
        id: "00201",
        type: "file",
        path: "00200_architecture/00201_system_context.md",
        title: "System Context",
        intent: "Capture system boundaries.",
        parent_id: "00200",
        required: true,
        expressed
      }
    }
  });

  return { root, seedText };
}

function runEngine(root, ...args) {
  return spawnSync(process.execPath, [path.join(root, "_engine", "brainwave_runner.js"), ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

test("rejects a seed changed after capture", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  fs.appendFileSync(path.join(root, "_my_brainwave_seed.md"), "unauthorised change\n", "utf8");

  const result = runEngine(root, "run");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seed integrity failed/);
});

test("rejects architecture-documentation work before North Star agreement", (t) => {
  const { root } = createWorkspace(t, { expressed: true, northStarStatus: "shaping" });

  const result = runEngine(root, "run");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /North Star pre-check failed/);
});

test("does not express DNA from seed wording", (t) => {
  const { root } = createWorkspace(t, {
    seedText: "Architecture data security API UI deployment test monitoring scale recovery.\n",
    expressed: false
  });

  const result = runEngine(root, "run");
  const dna = JSON.parse(fs.readFileSync(path.join(root, "_dna.yaml"), "utf8"));

  assert.equal(result.status, 0);
  assert.equal(dna.nodes["00200"].expressed, false);
  assert.equal(dna.nodes["00201"].expressed, false);
  assert.equal(fs.existsSync(path.join(root, "00200_architecture")), false);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));
  assert.equal(manifest.progress.folders["00200"].available_files, 1);
  assert.equal(manifest.progress.folders["00200"].expressed_files, 0);
});

test("scaffolds only expressed documents without copying seed content", (t) => {
  const { root, seedText } = createWorkspace(t, { expressed: true });

  const result = runEngine(root, "run");
  const scaffold = fs.readFileSync(
    path.join(root, "00200_architecture", "00201_system_context.md"),
    "utf8"
  );

  assert.equal(result.status, 0);
  assert.match(scaffold, /Status: in_progress/);
  assert.match(scaffold, /_my_brainwave_north_star\.md/);
  assert.doesNotMatch(scaffold, new RegExp(seedText.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("uses explicit status instead of word count for completion", (t) => {
  const { root } = createWorkspace(t, { expressed: true });
  const documentPath = path.join(root, "00200_architecture", "00201_system_context.md");
  fs.mkdirSync(path.dirname(documentPath), { recursive: true });
  fs.writeFileSync(documentPath, `# Context\n\nStatus: in_progress\n\n${"detail ".repeat(200)}\n`, "utf8");

  const result = runEngine(root, "run");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_manifest.yaml"), "utf8"));

  assert.equal(result.status, 0);
  assert.equal(
    manifest.filesystem.tracked_files["00200_architecture/00201_system_context.md"].processing_status,
    "in_progress"
  );
});

test("session hook is silent when architecture documentation is complete", (t) => {
  const { root } = createWorkspace(t, {
    stage: "architecture_documentation_complete",
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
  const { root, seedText } = createWorkspace(t, { stage: "awaiting_seed" });
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
  const { root } = createWorkspace(t, { stage: "shaping_north_star", expressed: true });

  const result = runEngine(root, "transition", "building_architecture_documentation");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid stage transition/);
});

test("expresses agent-selected files and their parent without scaffolding during scoping", (t) => {
  const { root } = createWorkspace(t, {
    stage: "scoping_architecture_documentation",
    expressed: false
  });

  const expressResult = runEngine(root, "express", "00201");
  const dna = JSON.parse(fs.readFileSync(path.join(root, "_dna.yaml"), "utf8"));
  const documentPath = path.join(root, "00200_architecture", "00201_system_context.md");
  const transitionResult = runEngine(root, "transition", "building_architecture_documentation");
  const state = JSON.parse(fs.readFileSync(path.join(root, "_brainwave_state.yaml"), "utf8"));

  assert.equal(expressResult.status, 0);
  assert.equal(dna.nodes["00200"].expressed, true);
  assert.equal(dna.nodes["00201"].expressed, true);
  assert.equal(fs.existsSync(documentPath), false);
  assert.equal(transitionResult.status, 0);
  assert.equal(state.stage, "building_architecture_documentation");
});

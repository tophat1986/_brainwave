"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOT = path.resolve(__dirname, "..");
const SOURCE_PROJECT_ROOT = path.resolve(SOURCE_ROOT, "..");

test("ships a clean framework release template", () => {
  const governingDirective = fs.readFileSync(path.join(SOURCE_ROOT, "AGENTS.md"), "utf8");
  assert.match(governingDirective, /^## Canonical Name$/m);
  assert.match(governingDirective, /Always write it exactly as `_brainwave`/);

  const sourceState = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, "_brainwave_state.yaml"), "utf8")
  );
  assert.equal(sourceState.stage, "awaiting_seed");
  assert.equal(sourceState.seed.locked_sha256, null);
  assert.deepEqual(sourceState.experience_checkpoints, {
    dashboard_introduced_at: null,
    project_basics_checked_at: null
  });
  assert.deepEqual(sourceState.delivery_alignment, { last_review: null });
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
  assert.equal(sourceSettings.schema_version, "1.5.0");
  assert.equal(sourceSettings.guidance_mode, null);
  assert.equal(sourceSettings.build_outcome, null);
  assert.equal(sourceSettings.build_outcome_confirmed_at, null);
  assert.equal(sourceSettings.implementation_progress_updates, "track");
  assert.deepEqual(sourceSettings.allowed_values.guidance_mode, ["guided", "concise"]);
  assert.deepEqual(sourceSettings.allowed_values.build_outcome, [
    "demonstration",
    "usable_first_version",
    "complete_product",
    "custom"
  ]);
  assert.deepEqual(sourceSettings.allowed_values.implementation_progress_updates, [
    "silent",
    "track",
    "slice"
  ]);
  assert.equal(sourceSettings.project_profile.status, "not_asked");
  assert.equal(sourceSettings.project_profile.logo.path, null);
  assert.deepEqual(sourceSettings.project_profile.colors, []);
  assert.deepEqual(sourceSettings.project_profile.references, []);
  assert.equal(sourceSettings.assurance_tooling.component_ui.decision, "not_reviewed");
  assert.equal(sourceSettings.assurance_tooling.browser_journey.decision, "not_reviewed");
  assert.equal(fs.existsSync(path.join(SOURCE_ROOT, "_engine", "assurance.js")), true);
  assert.match(sourceSettings.onboarding_questions[0], /first time using _brainwave/);
  assert.equal(
    sourceSettings.onboarding_questions.some((question) => /build outcome/i.test(question)),
    false
  );

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
  assert.ok(sourcePackage.scripts["test:release"]);
  const sourceReadme = fs.readFileSync(path.join(SOURCE_PROJECT_ROOT, "README.md"), "utf8");
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
  const releaseText = textFiles
    .map((filePath) => fs.readFileSync(filePath, "utf8"))
    .join("\n");
  const retiredExamplePattern = new RegExp(["wish", "list"].join("\\s*"), "i");
  assert.doesNotMatch(releaseText, retiredExamplePattern);
});

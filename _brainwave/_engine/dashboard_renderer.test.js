"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const {
  renderDashboard,
  writeDashboard
} = require("./dashboard_renderer");

const PLACEHOLDERS = Object.freeze([
  "{{BRAINWAVE_STYLES}}",
  "{{BRAINWAVE_APP}}",
  "{{BRAINWAVE_STATE}}"
]);

function temporaryDirectory(t) {
  const tempBase = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(tempBase, "brainwave-dashboard-renderer-"));
  t.after(() => {
    const resolved = fs.realpathSync(directory);
    assert.ok(resolved.startsWith(`${tempBase}${path.sep}`));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

function shell() {
  return [
    "<!doctype html>",
    "<html><head>",
    "<style>{{BRAINWAVE_STYLES}}</style>",
    "</head><body>",
    '<script id="brainwave-state" type="application/json">{{BRAINWAVE_STATE}}</script>',
    "<script>{{BRAINWAVE_APP}}</script>",
    "</body></html>",
    ""
  ].join("\n");
}

function writeSource(root, { shellContent = shell(), styles = true, scripts = true } = {}) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "shell.html"), shellContent, "utf8");
  if (styles) {
    const stylesDirectory = path.join(root, "styles");
    fs.mkdirSync(stylesDirectory, { recursive: true });
    fs.writeFileSync(path.join(stylesDirectory, "20-second.css"), ".second { order: 2; }\n", "utf8");
    fs.writeFileSync(path.join(stylesDirectory, "10-first.css"), ".first { order: 1; }\n", "utf8");
  }
  if (scripts) {
    const scriptsDirectory = path.join(root, "scripts");
    fs.mkdirSync(scriptsDirectory, { recursive: true });
    fs.writeFileSync(path.join(scriptsDirectory, "20-second.js"), "const second = 2;\n", "utf8");
    fs.writeFileSync(path.join(scriptsDirectory, "10-first.js"), "const first = 1;\n", "utf8");
  }
}

function stateBlocks(html) {
  return [...html.matchAll(
    /<script id="brainwave-state" type="application\/json">([\s\S]*?)<\/script>/g
  )];
}

function setupFields(settings) {
  const helpers = fs.readFileSync(
    path.join(__dirname, "dashboard", "scripts", "10-helpers-and-model.js"), "utf8"
  );
  return JSON.parse(vm.runInNewContext(
    `${helpers}\nJSON.stringify(Object.fromEntries(setupFieldDefinitions.map((definition) => [definition.label, friendlySetting(definition)])));`,
    { settings, state: {}, stageDefinitions: [] }
  ));
}

test("presents separate working modes for shaping, documentation, and implementation", () => {
  const settings = {
    configured: true,
    shaping_mode: "thought_partner",
    documentation_mode: "fast_execution",
    implementation_mode: "autonomous"
  };
  const fields = setupFields(settings);

  assert.equal(fields["Shaping mode"], "Thought partner");
  assert.equal(fields["Documentation mode"], "Fast execution");
  assert.equal(fields["Implementation mode"], "Autonomous");
  assert.equal(Object.hasOwn(fields, "Working together"), false);
  assert.doesNotMatch(renderDashboard({ settings }), /Working together/);
});

test("shows unselected phase modes without inheriting another phase's autonomy", () => {
  const fields = setupFields({
    configured: true,
    shaping_mode: "autonomous",
    documentation_mode: null,
    implementation_mode: null,
    ideation_mode: "fast_execution"
  });

  assert.equal(fields["Shaping mode"], "Autonomous");
  assert.equal(fields["Documentation mode"], "Not chosen yet");
  assert.equal(fields["Implementation mode"], "Not chosen yet");
  const pending = setupFields({ configured: false, shaping_mode: "thought_partner" });
  assert.equal(pending["Shaping mode"], "Not chosen yet");
});

test("presents legacy implementation continuation without an autonomous mode", () => {
  const fields = setupFields({
    configured: true,
    shaping_mode: "fast_execution",
    documentation_mode: "fast_execution",
    implementation_mode: null,
    working_modes: {
      shaping: { source: "legacy", mode: "fast_execution", requires_selection: false },
      documentation: { source: "legacy", mode: "fast_execution", requires_selection: false },
      implementation: { source: "legacy", mode: null, delegated: false, requires_selection: false }
    }
  });

  assert.equal(fields["Shaping mode"], "Fast execution");
  assert.equal(fields["Documentation mode"], "Fast execution");
  assert.equal(fields["Implementation mode"], "Existing continuation policy");
  assert.doesNotMatch(fields["Implementation mode"], /autonomous/i);
});

test("invalid phase settings remain unselected in the dashboard", () => {
  const fields = setupFields({
    configured: true,
    shaping_mode: "constructor",
    documentation_mode: "autonomous",
    implementation_mode: null,
    working_modes: {
      documentation: { source: "invalid", mode: null, requires_selection: true },
      implementation: { source: "unselected", mode: null, requires_selection: true }
    }
  });

  for (const label of ["Shaping mode", "Documentation mode", "Implementation mode"]) {
    assert.equal(fields[label], "Not chosen yet");
  }
});

test("principles view distinguishes unreviewed and deliberately empty sets without filler", () => {
  const script = fs.readFileSync(path.join(__dirname, "dashboard", "scripts", "31-principles.js"), "utf8");
  const render = (principles) => {
    const nodes = { "principles-count": {}, "principles-list": {} };
    vm.runInNewContext(`${script}\nrenderPrinciples();`, {
      state: { principles }, document: { getElementById: (id) => nodes[id] }
    });
    return nodes;
  };
  assert.match(render({ status: "not_started" })["principles-list"].innerHTML, /take shape/);
  assert.match(render({ status: "ready", entries: [] })["principles-list"].innerHTML, /No principles needed yet/);
  assert.equal(render({ status: "ready", entries: [] })["principles-count"].textContent, "");
});

test("principles view safely displays the exact short wording with source disclosure", () => {
  const script = fs.readFileSync(path.join(__dirname, "dashboard", "scripts", "31-principles.js"), "utf8");
  const helpers = fs.readFileSync(path.join(__dirname, "dashboard", "scripts", "10-helpers-and-model.js"), "utf8");
  const nodes = { "principles-count": {}, "principles-list": {} };
  const entries = [
    { text: "Keep <intent> & meaning.", source: "_my_brainwave_seed.md#intent" },
    { text: "A distinct priority.", source: "_my_brainwave_north_star.md#priority" },
    { text: "Another accepted priority.", source: "_documentation/_DNA-SAPP/system.md#decision" }
  ];
  vm.runInNewContext(`${helpers}\n${script}\nrenderPrinciples();`, {
    state: { principles: { status: "ready", entries } }, settings: {}, stageDefinitions: [],
    document: { getElementById: (id) => nodes[id] }
  });
  const html = nodes["principles-list"].innerHTML;
  assert.match(html, /Keep &lt;intent&gt; &amp; meaning\./);
  assert.doesNotMatch(html, /Keep <intent>/);
  assert.match(html, /<details class="principle-source"><summary>Source<\/summary>/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /data-content="seed"/);
  assert.match(html, /data-content="north_star"/);
  assert.match(html, /data-action="document" data-path="_documentation\/_DNA-SAPP\/system\.md"/);
  assert.equal(nodes["principles-count"].textContent, "3 of 10 maximum");
});

test("switching to Principles hides other panels and maintains one selected keyboard tab", () => {
  const script = fs.readFileSync(path.join(__dirname, "dashboard", "scripts", "30-primary-views.js"), "utf8");
  const views = ["journey", "principles", "library", "references"];
  const nodes = Object.fromEntries(views.map((name) => [`${name}-view`, {}]));
  const buttons = views.map((name) => ({ dataset: { view: name }, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } }));
  vm.runInNewContext(`${script}\nsetView('principles');`, {
    document: { getElementById: (id) => nodes[id], querySelectorAll: () => buttons }
  });
  assert.deepEqual(views.filter((name) => !nodes[`${name}-view`].hidden), ["principles"]);
  assert.deepEqual(buttons.filter((button) => button.tabIndex === 0).map((button) => button.dataset.view), ["principles"]);
  assert.deepEqual(buttons.filter((button) => button.attrs["aria-selected"] === "true").map((button) => button.dataset.view), ["principles"]);
  const html = renderDashboard({});
  assert.match(html, /aria-controls="principles-view" data-view="principles"/);
  assert.match(html, /renderPrinciples\(\);/);
});

test("renders deterministically with fragments in lexical order", (t) => {
  const sourceRoot = path.join(temporaryDirectory(t), "source");
  writeSource(sourceRoot);
  const manifest = { schema_version: "3.0.0", project: "Example project" };

  const first = renderDashboard(manifest, { sourceRoot });
  const second = renderDashboard(manifest, { sourceRoot });

  assert.equal(first, second);
  assert.ok(first.indexOf(".first") < first.indexOf(".second"));
  assert.ok(first.indexOf("const first") < first.indexOf("const second"));
});

test("embeds exactly one escaped JSON state block without expanding dollar tokens", () => {
  const specialText = "<direction> > </script> $ $& $' $$";
  const html = renderDashboard({ project: "Example project", special_text: specialText });
  const blocks = stateBlocks(html);

  assert.equal(blocks.length, 1);
  assert.equal(JSON.parse(blocks[0][1]).special_text, specialText);
  assert.match(blocks[0][1], /\\u003cdirection\\u003e/);
  assert.match(blocks[0][1], /\\u003c\/script\\u003e/);
  assert.doesNotMatch(blocks[0][1], /[<>]/);
  assert.match(blocks[0][1], /\$ \$& \$' \$\$/);
});

test("assembles parseable inline JavaScript with no external script or stylesheet dependency", () => {
  const html = renderDashboard({ project: "Example project" });
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/type=["']application\/json["']/i.test(match[1]))
    .map((match) => match[2]);

  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b(?=[^>]*\brel\s*=\s*["']?stylesheet)[^>]*>/i);
  assert.doesNotMatch(html, /@import\s+(?:url\s*\()?/i);
});

test("includes compact assurance affordances in the existing dashboard surfaces", () => {
  const html = renderDashboard({
    assurance: { profiles: { experience: { id: "experience", title: "Experience", path: "_assurance/experience.yaml" } } },
    implementation: {
      slices: [{
        id: "SLICE-EXPERIENCE",
        assurance_summary: {
          applicable: true,
          status: "passed",
          profile_ids: ["experience"],
          open_findings_count: 0,
          evidence_links: []
        }
      }]
    }
  });

  assert.match(html, /const assuranceProfileById/);
  assert.match(html, /function roadmapQaSummary/);
  assert.match(html, /Assurance profiles/);
  assert.match(html, /QA: /);
  assert.match(html, /Fresh review/);
  assert.doesNotMatch(html, /assurance-gallery/);
});

test("includes the Reference Library as a searchable tabular view", () => {
  const html = renderDashboard({
    references: {
      totals: { items: 1, collections: 0, boards: 0 },
      items: [{ id: "ref-example", type: "item", kind: "image", title: "Example", summary: "A saved example.", roles: ["precedent"] }],
      collections: [],
      boards: [],
      validation: { errors: [], warnings: [] }
    }
  });

  assert.match(html, /id="references-view"/);
  assert.match(html, /class="reference-table"/);
  assert.match(html, /referenceRecords/);
  assert.match(html, /reference_item/);
  assert.match(html, /function openReference/);
  assert.ok(html.indexOf("const searchEntries = []") < html.indexOf("for (const reference of referenceRecords)"));
});

test("rejects missing and duplicate shell placeholders with clear errors", async (t) => {
  const root = temporaryDirectory(t);

  for (const [index, placeholder] of PLACEHOLDERS.entries()) {
    await t.test(`missing ${placeholder}`, () => {
      const sourceRoot = path.join(root, `missing-${index}`);
      writeSource(sourceRoot, { shellContent: shell().replace(placeholder, "") });
      assert.throws(
        () => renderDashboard({}, { sourceRoot }),
        (error) => error.message ===
          `Dashboard shell must contain exactly one ${placeholder} placeholder.`
      );
    });

    await t.test(`duplicate ${placeholder}`, () => {
      const sourceRoot = path.join(root, `duplicate-${index}`);
      writeSource(sourceRoot, { shellContent: shell().replace(placeholder, `${placeholder}${placeholder}`) });
      assert.throws(
        () => renderDashboard({}, { sourceRoot }),
        (error) => error.message ===
          `Dashboard shell must contain exactly one ${placeholder} placeholder.`
      );
    });
  }
});

test("rejects missing fragment directories with clear errors", async (t) => {
  const root = temporaryDirectory(t);

  await t.test("missing styles directory", () => {
    const sourceRoot = path.join(root, "missing-styles");
    writeSource(sourceRoot, { styles: false });
    assert.throws(
      () => renderDashboard({}, { sourceRoot }),
      /Dashboard source directory is missing: styles/
    );
  });

  await t.test("missing scripts directory", () => {
    const sourceRoot = path.join(root, "missing-scripts");
    writeSource(sourceRoot, { scripts: false });
    assert.throws(
      () => renderDashboard({}, { sourceRoot }),
      /Dashboard source directory is missing: scripts/
    );
  });
});

test("writeDashboard creates, preserves, and updates generated output only when needed", (t) => {
  const root = temporaryDirectory(t);
  const sourceRoot = path.join(root, "source");
  const outputPath = path.join(root, "generated", "_dashboard.html");
  writeSource(sourceRoot);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const initialManifest = { project: "Example project", revision: 1 };
  assert.equal(writeDashboard(outputPath, initialManifest, { sourceRoot }), true);
  assert.equal(fs.readFileSync(outputPath, "utf8"), renderDashboard(initialManifest, { sourceRoot }));

  const fixedTime = new Date("2001-01-01T00:00:00.000Z");
  fs.utimesSync(outputPath, fixedTime, fixedTime);
  const unchangedMtime = fs.statSync(outputPath).mtimeMs;
  assert.equal(writeDashboard(outputPath, initialManifest, { sourceRoot }), false);
  assert.equal(fs.statSync(outputPath).mtimeMs, unchangedMtime);

  const updatedManifest = { project: "Example project", revision: 2 };
  assert.equal(writeDashboard(outputPath, updatedManifest, { sourceRoot }), true);
  const updatedBlocks = stateBlocks(fs.readFileSync(outputPath, "utf8"));
  assert.equal(updatedBlocks.length, 1);
  assert.deepEqual(JSON.parse(updatedBlocks[0][1]), updatedManifest);
});

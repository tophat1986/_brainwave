"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  WORKING_MODES,
  phaseForStage,
  resolveWorkingMode,
  implementationExecutionPolicy,
  formatWorkingMode,
  formatImplementationExecutionPolicy
} = require("./working_modes");

const PHASES = ["shaping", "documentation", "implementation"];
const MODES = ["thought_partner", "fast_execution", "autonomous"];

test("routes lifecycle stages to their own working phase", () => {
  assert.deepEqual(WORKING_MODES, MODES);
  const expected = {
    awaiting_seed: "shaping",
    shaping_north_star: "shaping",
    selecting_dna: "shaping",
    scoping_brainwave_documentation: "shaping",
    building_brainwave_documentation: "documentation",
    reviewing_brainwave_documentation: "documentation",
    brainwave_documentation_complete: "implementation"
  };
  for (const [stage, phase] of Object.entries(expected)) {
    assert.equal(phaseForStage(stage), phase, stage);
  }
  for (const stage of [undefined, null, "", "unknown"]) {
    assert.equal(phaseForStage(stage), null);
  }
  assert.throws(() => resolveWorkingMode({}, "unknown"), /Unknown working phase/);
});

test("each explicit mode belongs only to its selected phase", () => {
  for (const shaping of MODES) {
    for (const documentation of MODES) {
      for (const implementation of MODES) {
        const settings = Object.freeze({
          schema_version: "1.7.0",
          shaping_mode: shaping,
          documentation_mode: documentation,
          implementation_mode: implementation,
          ideation_mode: "fast_execution"
        });
        for (const phase of PHASES) {
          const setting = `${phase}_mode`;
          assert.deepEqual(resolveWorkingMode(settings, phase), {
            phase, setting, mode: settings[setting], source: "explicit",
            delegated: settings[setting] === "autonomous", requires_selection: false, error: null
          });
        }
      }
    }
  }
});

test("an autonomous phase cannot select or delegate another phase", () => {
  for (const selectedPhase of PHASES) {
    const settings = { schema_version: "1.7.0", [`${selectedPhase}_mode`]: "autonomous" };
    for (const phase of PHASES.filter((candidate) => candidate !== selectedPhase)) {
      assert.deepEqual(resolveWorkingMode(settings, phase), {
        phase, setting: `${phase}_mode`, mode: null, source: "unselected",
        delegated: false, requires_selection: true, error: null
      });
    }
  }
});

test("old settings preserve shaping and documentation compatibility without delegation", () => {
  for (const schema of [undefined, "1.0.0", "1.6.0"]) {
    for (const mode of ["thought_partner", "fast_execution"]) {
      const settings = Object.freeze({ schema_version: schema, ideation_mode: mode });
      for (const phase of ["shaping", "documentation"]) {
        assert.deepEqual(resolveWorkingMode(settings, phase), {
          phase, setting: `${phase}_mode`, mode, source: "legacy",
          delegated: false, requires_selection: false, error: null
        });
      }
      assert.deepEqual(implementationExecutionPolicy(settings), {
        phase: "implementation", setting: "implementation_mode", mode: null,
        source: "legacy", delegated: false, requires_selection: false,
        error: null, continue_automatically: true
      });
      assert.equal(Object.hasOwn(settings, "documentation_mode"), false);
      assert.equal(Object.hasOwn(settings, "implementation_mode"), false);
    }
  }
});

test("new settings do not use ideation_mode as a phase selection", () => {
  for (const schema of ["1.7.0", "1.8.0", "2.0.0"]) {
    for (const legacyMode of MODES) {
      for (const phase of PHASES) {
        const policy = resolveWorkingMode({ schema_version: schema, ideation_mode: legacyMode }, phase);
        assert.equal(policy.source, "unselected");
        assert.equal(policy.mode, null);
        assert.equal(policy.delegated, false);
        assert.equal(policy.requires_selection, true);
      }
    }
  }
});

test("legacy autonomous values cannot grant phase authority", () => {
  const settings = { schema_version: "1.6.0", ideation_mode: "autonomous" };
  for (const phase of ["shaping", "documentation"]) {
    const policy = resolveWorkingMode(settings, phase);
    assert.equal(policy.source, "invalid");
    assert.equal(policy.mode, null);
    assert.equal(policy.delegated, false);
    assert.equal(policy.requires_selection, true);
    assert.match(policy.error, /Legacy ideation_mode cannot supply/);
  }
  const implementation = implementationExecutionPolicy(settings);
  assert.equal(implementation.source, "legacy");
  assert.equal(implementation.mode, null);
  assert.equal(implementation.delegated, false);
  assert.equal(implementation.continue_automatically, true);
});

test("explicit null and invalid phase values never fall back to legacy settings", () => {
  for (const phase of PHASES) {
    for (const value of [null, undefined, "", "automatic", true, 1, {}, ["autonomous"]]) {
      const settings = {
        schema_version: "1.6.0", ideation_mode: "fast_execution", [`${phase}_mode`]: value
      };
      const policy = resolveWorkingMode(settings, phase);
      assert.equal(policy.source, value === null ? "unselected" : "invalid");
      assert.equal(policy.mode, null);
      assert.equal(policy.delegated, false);
      assert.equal(policy.requires_selection, true);
      if (value === null) assert.equal(policy.error, null);
      else assert.match(policy.error, new RegExp(`Invalid ${phase}_mode`));
      if (phase === "implementation") {
        assert.equal(implementationExecutionPolicy(settings).continue_automatically, false);
      }
    }
  }
});

test("implementation continuation requires its own choice for new settings", () => {
  const settings = { schema_version: "1.7.0", shaping_mode: "autonomous", documentation_mode: "autonomous" };
  assert.equal(implementationExecutionPolicy(settings).continue_automatically, false);
  for (const mode of MODES) {
    const policy = implementationExecutionPolicy({ ...settings, implementation_mode: mode });
    assert.equal(policy.continue_automatically, true);
    assert.equal(policy.delegated, mode === "autonomous");
    assert.equal(policy.source, "explicit");
  }
});

test("progress-update frequency changes neither continuation nor decision authority", () => {
  const cases = [
    { schema_version: "1.6.0", ideation_mode: "fast_execution" },
    { schema_version: "1.7.0", implementation_mode: null },
    ...MODES.map((mode) => ({ schema_version: "1.7.0", implementation_mode: mode }))
  ];
  for (const settings of cases) {
    const expected = implementationExecutionPolicy(settings);
    for (const updates of ["silent", "track", "slice"]) {
      assert.deepEqual(
        implementationExecutionPolicy({ ...settings, implementation_progress_updates: updates }), expected
      );
    }
  }
});

test("formatted policies retain phase, plan, and safety boundaries", () => {
  for (const phase of PHASES) {
    const policy = resolveWorkingMode({ [`${phase}_mode`]: "autonomous" }, phase);
    const formatted = formatWorkingMode(policy);
    assert.match(formatted, new RegExp(`${phase}_mode`));
    assert.match(formatted, /delegated phase authority/);
    assert.match(formatted, /never invent facts or human approval/);
    assert.match(formatted, /evidence, verification, specialist or safety gates/);
  }
  const autonomous = formatImplementationExecutionPolicy(
    implementationExecutionPolicy({ implementation_mode: "autonomous" })
  );
  assert.match(autonomous, /acceptance of the exact reviewed plan in every mode/);
  assert.match(autonomous, /cannot rewrite product direction/);
  assert.match(autonomous, /Continue automatically across eligible slices and tracks/);
  const unselected = formatImplementationExecutionPolicy(
    implementationExecutionPolicy({ schema_version: "1.7.0", implementation_mode: null })
  );
  assert.match(unselected, /Do not start implementation until its working mode is selected/);
  assert.doesNotMatch(unselected, /Continue automatically across eligible/);
  const legacy = formatImplementationExecutionPolicy(implementationExecutionPolicy({}));
  assert.match(legacy, /No autonomous decision authority has been inferred/);
  assert.match(legacy, /existing continuation policy/);
});

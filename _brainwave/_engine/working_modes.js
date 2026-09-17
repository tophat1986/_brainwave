"use strict";

const WORKING_MODES = Object.freeze(["thought_partner", "fast_execution", "autonomous"]);
const PHASE_SETTINGS = Object.freeze({
  shaping: "shaping_mode", documentation: "documentation_mode", implementation: "implementation_mode"
});

function phaseForStage(stage) {
  if (stage === "brainwave_documentation_complete") return "implementation";
  if (["building_brainwave_documentation", "reviewing_brainwave_documentation"].includes(stage)) return "documentation";
  if (["awaiting_seed", "shaping_north_star", "selecting_dna", "scoping_brainwave_documentation"].includes(stage)) return "shaping";
  return null;
}

function resolveWorkingMode(settings = {}, phase) {
  const setting = PHASE_SETTINGS[phase];
  if (!setting) throw new Error(`Unknown working phase: ${phase}.`);
  const result = { phase, setting, mode: null, source: "unselected", delegated: false, requires_selection: true, error: null };
  if (Object.prototype.hasOwnProperty.call(settings, setting)) {
    const value = settings[setting];
    if (value === null) return result;
    if (!WORKING_MODES.includes(value)) {
      return { ...result, source: "invalid", error: `Invalid ${setting}: choose thought_partner, fast_execution, or autonomous.` };
    }
    return { ...result, mode: value, source: "explicit", delegated: value === "autonomous", requires_selection: false };
  }
  const [major = 0, minor = 0] = String(settings.schema_version || "0.0").split(".").map(Number);
  if (major > 1 || (major === 1 && minor >= 7)) return result;
  // Compatibility is read-only and never promotes a legacy setting into delegation.
  if (phase === "implementation") return { ...result, source: "legacy", requires_selection: false };
  if (["thought_partner", "fast_execution"].includes(settings.ideation_mode)) {
    return { ...result, mode: settings.ideation_mode, source: "legacy", requires_selection: false };
  }
  if (settings.ideation_mode != null) {
    return { ...result, source: "invalid", error: `Legacy ideation_mode cannot supply ${setting}; choose that phase's mode explicitly.` };
  }
  return result;
}

function formatWorkingMode(policy) {
  if (policy.requires_selection) {
    return `${policy.error || `Choose \`${policy.setting}\`: thought_partner, fast_execution, or autonomous.`} Ask when this phase is requested; do not begin its decision work until selected. Other phases grant no inherited mode or authority.`;
  }
  if (policy.source === "legacy" && policy.phase === "implementation") {
    return "Implementation retains its existing continuation policy. No autonomous decision authority has been inferred from legacy ideation_mode.";
  }
  const collaboration = policy.mode === "thought_partner"
    ? "Discuss material choices with a supported recommendation."
    : policy.mode === "fast_execution"
      ? "Propose the strongest supported direction directly. Advance reversible in-scope choices as labelled working assumptions without waiting; group only decisions requiring user input. Ask for consequential, hard-to-reverse or preference-dependent choices outside delegated authority."
      : "Resolve supported decisions within this phase's authorized mandate without routine approval. Record the basis and material assumptions as agent decisions under delegated phase authority; never invent facts or human approval.";
  const boundary = policy.phase === "shaping"
    ? `Seed capture and build-outcome confirmation remain user decisions. ${policy.delegated ? "Agree the North Star, select modules and scope documents within that confirmed brief under delegated shaping authority." : "Obtain agreement before accepting the North Star, module selection or document scope unless separately delegated."}`
    : policy.phase === "documentation"
      ? `${policy.delegated ? "Resolve in-scope details and accept the foundation after required review under delegated documentation authority." : "Obtain user acceptance of the reviewed foundation unless separate explicit delegation authorizes acceptance."} Foundation acceptance grants no authority to start implementation.`
      : "Implementation requires user acceptance of the exact reviewed plan in every mode. Decisions stay within accepted DNA and that approved plan; implementation cannot rewrite product direction.";
  return [
    `Working mode is \`${policy.mode}\` for ${policy.phase} (\`${policy.setting}\`; ${policy.source}).`,
    collaboration,
    "Ask with a supported recommendation and the consequence of the choice. Drafting does not accept a proposal. Exercise explicitly delegated in-scope authority without repeated approval; thought_partner and fast_execution grant no delegation by themselves.",
    boundary,
    "Changes to accepted direction or scope retain their approval requirements. Modes never expand the user's task or waive evidence, verification, specialist or safety gates. Enter another phase only when the task authorizes it, using that phase's own mode; do not repeat authorization already given."
  ].join(" ");
}

function implementationExecutionPolicy(settings = {}) {
  const policy = resolveWorkingMode(settings, "implementation");
  return { ...policy, continue_automatically: !policy.requires_selection };
}

function formatImplementationExecutionPolicy(policy) {
  return [
    formatWorkingMode(policy),
    policy.continue_automatically
      ? "Continue automatically across eligible slices and tracks within the approved task; progress updates never request permission."
      : "Do not start implementation until its working mode is selected.",
    "Pause when implementation authority is stale or invalid, for required safety authorization, or when required input, approval, access, an unresolved blocker, or an external gate leaves no other safe eligible work. Report when the approved implementation plan is complete."
  ].join(" ");
}

module.exports = {
  WORKING_MODES, PHASE_SETTINGS, phaseForStage, resolveWorkingMode,
  formatWorkingMode, implementationExecutionPolicy, formatImplementationExecutionPolicy
};

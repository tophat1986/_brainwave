"use strict";

const IMPLEMENTATION_PROGRESS_UPDATE_MODES = Object.freeze([
  "silent",
  "track",
  "slice"
]);

const UPDATE_BOUNDARIES = Object.freeze({
  silent: "No routine implementation progress updates.",
  track: "Give one concise progress update when every slice in an approved implementation track is verified.",
  slice: "Give one concise progress update whenever an implementation slice closes."
});

function normalizeImplementationProgressUpdates(settings = {}) {
  return IMPLEMENTATION_PROGRESS_UPDATE_MODES.includes(
    settings.implementation_progress_updates
  )
    ? settings.implementation_progress_updates
    : "track";
}

function implementationProgressPolicy(settings = {}) {
  const mode = normalizeImplementationProgressUpdates(settings);
  return {
    scope: "implementation_only",
    mode,
    update_boundary: UPDATE_BOUNDARIES[mode],
    continue_automatically: true,
    required_updates: [
      "stale_or_invalid_implementation_authority",
      "required_safety_authorization",
      "required_input_approval_or_access_when_no_other_safe_eligible_work_can_proceed",
      "unresolved_blocker_or_external_gate_when_no_other_safe_eligible_work_can_proceed",
      "approved_implementation_plan_complete"
    ]
  };
}

function formatImplementationProgressPolicy(policy) {
  return [
    `Implementation progress updates: ${policy.mode}.`,
    policy.update_boundary,
    "Progress updates are informational: continue automatically across eligible slices and tracks without asking for permission.",
    "Pause when implementation authority is stale or invalid, for required safety authorization, or when required user input, approval, access, an unresolved blocker, or an external gate leaves no other safe eligible work; report again when the approved implementation plan is complete."
  ].join(" ");
}

module.exports = {
  IMPLEMENTATION_PROGRESS_UPDATE_MODES,
  normalizeImplementationProgressUpdates,
  implementationProgressPolicy,
  formatImplementationProgressPolicy
};

#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  parseJson,
  readStdin,
  walkUpForBrainwaveRoot,
  isSeedEmpty,
  northStarStatus,
  brainwaveStage,
  isPassive,
  isSettingsConfigured
} = require("./brainwave_common");

function pickWorkingRoot(payload) {
  const workspaceRootSnake = Array.isArray(payload.workspace_roots) ? payload.workspace_roots[0] : null;
  const workspaceRootCamel = Array.isArray(payload.workspaceRoots) ? payload.workspaceRoots[0] : null;
  const workspaceRoot = workspaceRootSnake || workspaceRootCamel;
  const normalizedWorkspaceRoot = /^\/[A-Za-z]:[\\/]/.test(String(workspaceRoot || ""))
    ? String(workspaceRoot).slice(1)
    : workspaceRoot;
  return payload.cwd || normalizedWorkspaceRoot || process.cwd();
}

function buildAdditionalContext(stage, seedEmpty, northStarStatusValue, settingsReady) {
  const lines = [];
  lines.push(`Brainwave is active at stage \`${stage}\`. Follow \`AGENTS.md\` and \`_brainwave_handbook.md\`.`);
  lines.push("In the first assistant reply, state the current Brainwave stage in plain language.");
  if (!settingsReady) {
    lines.push(
      "The user profile is incomplete. Ask the three concise profile questions and update `_settings.yaml` automatically."
    );
  }
  if (stage === "awaiting_seed" || seedEmpty) {
    lines.push(
      "Help the user clarify the idea in natural language. Capture `_my_brainwave_seed.md` only after explicit instruction; it becomes immutable."
    );
  } else if (stage === "shaping_north_star") {
    lines.push(
      `The immutable seed exists and the North Star status is \`${northStarStatusValue}\`. Read the North Star first, use the seed only for provenance, and ask one to three material gap-filling questions at a time.`
    );
  } else if (stage === "scoping_architecture_documentation") {
    lines.push(
      "Use semantic judgment to propose proportionate DNA expression. Log the rationale and obtain explicit agreement before changing `_dna.yaml`."
    );
  } else if (stage === "building_architecture_documentation") {
    lines.push("Complete only the agreed architecture documentation, in coherent slices, using the North Star as direction.");
  } else if (stage === "reviewing_architecture_documentation") {
    lines.push("Review expressed architecture documentation for gaps, contradictions, unresolved material questions, and implementation readiness.");
  }
  return lines.join(" ");
}

function respondJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function main() {
  const payload = parseJson(readStdin());
  const cwd = pickWorkingRoot(payload);
  const root = walkUpForBrainwaveRoot(cwd) || walkUpForBrainwaveRoot(path.resolve(__dirname, "..", ".."));
  if (!root) {
    respondJson({ continue: true });
    return;
  }
  if (isPassive(root)) {
    respondJson({ continue: true });
    return;
  }
  const stage = brainwaveStage(root);
  const seedEmpty = isSeedEmpty(root);
  const settingsReady = isSettingsConfigured(root);
  const additionalContext = buildAdditionalContext(
    stage,
    seedEmpty,
    northStarStatus(root),
    settingsReady
  );
  respondJson({
    continue: true,
    additional_context: additionalContext,
    additionalContext
  });
}

main();

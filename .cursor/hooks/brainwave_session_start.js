#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  parseJson,
  readStdin,
  findFrameworkRoot,
  brainwaveArtifactPath,
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

function buildAdditionalContext(stage, seedEmpty, northStarStatusValue, settingsReady, root, cwd) {
  const agentsPath = brainwaveArtifactPath(root, cwd, "AGENTS.md");
  const handbookPath = brainwaveArtifactPath(root, cwd, "_brainwave_handbook.md");
  const settingsPath = brainwaveArtifactPath(root, cwd, "_settings.yaml");
  const seedPath = brainwaveArtifactPath(root, cwd, "_my_brainwave_seed.md");
  const northStarPath = brainwaveArtifactPath(root, cwd, "_my_brainwave_north_star.md");
  const dnaPath = brainwaveArtifactPath(root, cwd, "_dna/");
  const statePath = brainwaveArtifactPath(root, cwd, "_brainwave_state.yaml");
  const lines = [];
  lines.push(`_brainwave is active at stage \`${stage}\`. Follow \`${agentsPath}\` and \`${handbookPath}\`.`);
  lines.push("In the first assistant reply, state the current _brainwave stage in plain language.");
  if (!settingsReady) {
    lines.push(
      `The user profile is incomplete. Ask the three concise profile questions and update \`${settingsPath}\` automatically.`
    );
  }
  if (stage === "awaiting_seed" || seedEmpty) {
    lines.push(
      `Help the user clarify the idea in natural language. Capture \`${seedPath}\` only after explicit instruction; it becomes immutable.`
    );
  } else if (stage === "shaping_north_star") {
    lines.push(
      `The immutable seed exists and the North Star status is \`${northStarStatusValue}\`. Read \`${northStarPath}\` first, use \`${seedPath}\` only for provenance, and ask one to three material gap-filling questions at a time.`
    );
  } else if (stage === "selecting_dna") {
    lines.push(
      `Recommend one or more DNA modules from \`${dnaPath}\` using the conversation's meaning and each module's declared purpose. Explain the recommendation and obtain explicit user agreement before recording selection in \`${statePath}\`.`
    );
  } else if (stage === "scoping_brainwave_documentation") {
    lines.push(
      `Use semantic judgment and \`when_relevant\` guidance to propose proportionate entries within the selected DNA modules. Obtain explicit agreement before recording expression in \`${statePath}\`.`
    );
  } else if (stage === "building_brainwave_documentation") {
    lines.push("Complete only the agreed _brainwave documentation, in coherent dependency-aware slices, using the North Star as direction.");
  } else if (stage === "reviewing_brainwave_documentation") {
    lines.push("Review expressed _brainwave documentation for gaps, contradictions, unresolved material questions, and readiness for its intended downstream work.");
  }
  return lines.join(" ");
}

function respondJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function main() {
  const payload = parseJson(readStdin());
  const cwd = pickWorkingRoot(payload);
  const root = findFrameworkRoot(cwd) || findFrameworkRoot(path.resolve(__dirname, "..", ".."));
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
    settingsReady,
    root,
    cwd
  );
  respondJson({
    continue: true,
    additional_context: additionalContext,
    additionalContext
  });
}

main();

#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  parseJson,
  readStdin,
  walkUpForBrainwaveRoot,
  isSeedEmpty,
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

function buildAdditionalContext(seedEmpty, settingsReady) {
  const lines = [];
  lines.push("Brainwave orchestration is active. Follow `AGENTS.md` trigger sequence.");
  lines.push("Instruction: In your first assistant reply, explicitly acknowledge Brainwave mode and state the current stage.");
  if (seedEmpty) {
    lines.push(
      "Stage 1: Seed missing. Start with a short Brainwave intro, discuss concept with focused questions, and offer to write `_my_brainwave.md` directly from chat."
    );
  } else {
    lines.push("Stage 1: Seed present in `_my_brainwave.md`.");
  }
  if (!settingsReady) {
    lines.push(
      "Stage 2: Profile missing. Ask 2-3 profiling questions, then write `_settings.yaml` with `configured: true`, `onboarding_status: complete`, and `profile_last_updated`."
    );
  } else {
    lines.push("Stage 2: Profile configured.");
  }
  lines.push("Constraint: Do not mutate `_dna.yaml` or run engine until steering agreement is reached.");
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
  const seedEmpty = isSeedEmpty(root);
  const settingsReady = isSettingsConfigured(root);
  const additionalContext = buildAdditionalContext(seedEmpty, settingsReady);
  respondJson({
    continue: true,
    additional_context: additionalContext,
    additionalContext
  });
}

main();

#!/usr/bin/env node
"use strict";

const path = require("path");

const {
  parseJson,
  readStdin,
  findFrameworkRoot,
  brainwaveArtifactPath,
  isSeedEmpty,
  brainwaveStage,
  isPassive,
  readSettings,
  writeSettings,
  isSettingsConfigured
} = require("./brainwave_common");

function pickWorkingRoot(payload) {
  const workspaceRootSnake = Array.isArray(payload.workspace_roots) ? payload.workspace_roots[0] : null;
  const workspaceRootCamel = Array.isArray(payload.workspaceRoots) ? payload.workspaceRoots[0] : null;
  const workspaceRoot = workspaceRootSnake || workspaceRootCamel;
  const normalizedWorkspaceRoot = /^\/[A-Za-z]:[\\/]/.test(String(workspaceRoot || ""))
    ? String(workspaceRoot).slice(1)
    : workspaceRoot;
  const attachmentPath = Array.isArray(payload.attachments) ? payload.attachments[0]?.file_path : null;
  const attachmentDir = attachmentPath ? require("path").dirname(String(attachmentPath)) : null;
  return payload.cwd || normalizedWorkspaceRoot || attachmentDir || process.cwd();
}

function respondJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function parseProfileFromPrompt(prompt) {
  const text = String(prompt || "");
  const technical = text.match(/\b(beginner|intermediate|architect)\b/i)?.[1]?.toLowerCase() || null;
  const modeRaw = text.match(/\b(thought[_ -]?partner|fast[_ -]?execution)\b/i)?.[1]?.toLowerCase() || null;
  const verbosity = text.match(/\b(lean|standard|exhaustive)\b/i)?.[1]?.toLowerCase() || null;
  const mode = modeRaw ? modeRaw.replace(/[ -]/g, "_") : null;
  return {
    technical_proficiency: technical,
    ideation_mode: mode,
    verbosity_budget: verbosity
  };
}

function missingProfileFields(profile) {
  const missing = [];
  if (!profile.technical_proficiency) missing.push("technical_proficiency");
  if (!profile.ideation_mode) missing.push("ideation_mode");
  if (!profile.verbosity_budget) missing.push("verbosity_budget");
  return missing;
}

function applyProfileSettings(root, profile) {
  const settings = readSettings(root);
  if (!settings || typeof settings !== "object") return false;
  settings.technical_proficiency = profile.technical_proficiency;
  settings.ideation_mode = profile.ideation_mode;
  settings.verbosity_budget = profile.verbosity_budget;
  settings.configured = true;
  settings.onboarding_status = "complete";
  settings.profile_last_updated = new Date().toISOString();
  return writeSettings(root, settings);
}

function main() {
  const payload = parseJson(readStdin());
  const cwd = pickWorkingRoot(payload);
  const root = findFrameworkRoot(cwd) || findFrameworkRoot(path.resolve(__dirname, "..", ".."));
  if (!root) {
    respondJson({ continue: true });
    return;
  }
  const prompt = String(payload.prompt || payload.message || payload.text || "");
  const seedPath = brainwaveArtifactPath(root, cwd, "_my_brainwave_seed.md");
  const settingsPath = brainwaveArtifactPath(root, cwd, "_settings.yaml");
  const handbookPath = brainwaveArtifactPath(root, cwd, "_brainwave_handbook.md");
  const brainwaveIntent =
    /(?:_brainwave|\bbrainwave)\b/i.test(prompt) ||
    /\bbuild concept\b/i.test(prompt) ||
    /\bbrainwave_runner\.js\b/i.test(prompt);
  if (isPassive(root) && !brainwaveIntent) {
    respondJson({ continue: true });
    return;
  }

  const buildIntent =
    /\bbuild concept\b/i.test(prompt) ||
    /\bbrainwave:run\b/i.test(prompt) ||
    /\bbrainwave:watch\b/i.test(prompt) ||
    /\bbrainwave_runner\.js\s+(run|watch|dna|select-dna|express|unexpress|transition)\b/i.test(prompt);

  if (!isSettingsConfigured(root)) {
    const profile = parseProfileFromPrompt(prompt);
    const missing = missingProfileFields(profile);
    if (missing.length === 0) {
      const saved = applyProfileSettings(root, profile);
      if (!saved) {
        respondJson({
          continue: false,
          user_message:
            `_brainwave profile capture failed while writing \`${settingsPath}\`. Please try again with: \`intermediate, thought_partner, standard\`.`
        });
        return;
      }
    }
  }

  if (buildIntent && isSeedEmpty(root)) {
    respondJson({
      continue: false,
      user_message:
        `_brainwave is at \`awaiting_seed\`. Discuss the idea first, then explicitly ask the agent to capture it in the immutable \`${seedPath}\`.`
    });
    return;
  }

  if (buildIntent && !isSettingsConfigured(root)) {
    respondJson({
      continue: false,
      user_message:
        "Before progressing _brainwave, set profile dials in one message: `beginner|intermediate|architect`, " +
        "`thought_partner|fast_execution`, `lean|standard|exhaustive` " +
        "(example: `intermediate, thought_partner, standard`)."
    });
    return;
  }

  const additionalContext = brainwaveIntent
    ? `_brainwave stage: ${brainwaveStage(root)}. Follow the lifecycle and terminology in \`${handbookPath}\`.`
    : null;
  respondJson(
    additionalContext
      ? { continue: true, additional_context: additionalContext, additionalContext }
      : { continue: true }
  );
}

main();

"use strict";

const fs = require("fs");
const path = require("path");

const COMPLETE_STAGE = "brainwave_documentation_complete";

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (_) {
    return "";
  }
}

function parseJson(value) {
  const raw = String(value || "").replace(/\u0000/g, "").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function readJson(filePath) {
  try {
    return parseJson(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return {};
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (_) {
    return "";
  }
}

function frameworkRootFromAdapter(adapterDirectory) {
  return path.resolve(adapterDirectory, "..", "..");
}

function workingDirectory(payload) {
  const workspaceRoot =
    (Array.isArray(payload.workspace_roots) && payload.workspace_roots[0]) ||
    (Array.isArray(payload.workspaceRoots) && payload.workspaceRoots[0]);
  const normalizedRoot = /^\/[A-Za-z]:[\\/]/.test(String(workspaceRoot || ""))
    ? String(workspaceRoot).slice(1)
    : workspaceRoot;
  return path.resolve(payload.cwd || normalizedRoot || process.cwd());
}

function artifactPath(root, cwd, artifact) {
  const prefix = path.relative(cwd, root).replace(/\\/g, "/");
  return prefix ? `${prefix}/${artifact}` : artifact;
}

function hasAllowedValue(settings, key) {
  const allowed = settings.allowed_values?.[key];
  const value = settings[key];
  return Array.isArray(allowed) && allowed.length > 0
    ? allowed.includes(value)
    : Boolean(value);
}

function settingsAreConfigured(settings) {
  return Boolean(
    settings.configured === true &&
      (!settings.onboarding_status || settings.onboarding_status === "complete") &&
      hasAllowedValue(settings, "technical_proficiency") &&
      hasAllowedValue(settings, "ideation_mode") &&
      hasAllowedValue(settings, "verbosity_budget")
  );
}

function northStarStatus(content) {
  return (
    content.match(/^\s*status:\s*(shaping|agreed)\s*$/im)?.[1]?.toLowerCase() ||
    "missing"
  );
}

function loadRuntime(adapterDirectory, payload = {}) {
  const root = frameworkRootFromAdapter(adapterDirectory);
  const cwd = workingDirectory(payload);
  return {
    root,
    cwd,
    state: readJson(path.join(root, "_brainwave_state.yaml")),
    settings: readJson(path.join(root, "_settings.yaml")),
    seed: readText(path.join(root, "_my_brainwave_seed.md")),
    northStar: readText(path.join(root, "_my_brainwave_north_star.md"))
  };
}

function buildSessionContext(runtime) {
  const stage = runtime.state.stage || "awaiting_seed";
  if (stage === COMPLETE_STAGE) return null;

  const at = (artifact) => `\`${artifactPath(runtime.root, runtime.cwd, artifact)}\``;
  const lines = [
    `_brainwave is active at stage \`${stage}\`. Follow ${at("AGENTS.md")} and ${at("_brainwave_handbook.md")}.`,
    "State the current stage in plain language in the first assistant reply."
  ];

  if (!settingsAreConfigured(runtime.settings)) {
    lines.push(
      `The profile is incomplete. Ask the three concise profile questions and update ${at("_settings.yaml")} after the user answers. Do not infer profile values from keywords.`
    );
  }

  if (stage === "awaiting_seed" || !runtime.seed.trim()) {
    lines.push(
      `Discuss the idea naturally. Capture ${at("_my_brainwave_seed.md")} only after explicit instruction; it then becomes immutable.`
    );
  } else if (stage === "shaping_north_star") {
    lines.push(
      `The North Star status is \`${northStarStatus(runtime.northStar)}\`. Read ${at("_my_brainwave_north_star.md")} first, use the seed only for provenance, and ask one to three material questions at a time.`
    );
  } else if (stage === "selecting_dna") {
    lines.push(
      `Recommend modules from ${at("_dna/")} using semantic judgment. Explain the recommendation and obtain explicit agreement before recording selection.`
    );
  } else if (stage === "scoping_brainwave_documentation") {
    lines.push(
      `Propose only proportionate entries from the selected modules and obtain explicit agreement before recording scope in ${at("_brainwave_state.yaml")}.`
    );
  } else if (stage === "building_brainwave_documentation") {
    lines.push(
      "Complete only the agreed documentation in coherent, dependency-aware slices using the North Star as direction."
    );
  } else if (stage === "reviewing_brainwave_documentation") {
    lines.push(
      "Review every expressed document for gaps, contradictions, cross-module consistency, and downstream readiness."
    );
  }

  return lines.join(" ");
}

function hookInput(adapterDirectory) {
  const payload = parseJson(readStdin());
  return { payload, runtime: loadRuntime(adapterDirectory, payload) };
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

module.exports = {
  buildSessionContext,
  hookInput,
  writeJson
};

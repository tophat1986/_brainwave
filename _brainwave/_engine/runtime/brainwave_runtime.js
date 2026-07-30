"use strict";

const fs = require("fs");
const path = require("path");

const COMPLETE_STAGE = "brainwave_documentation_complete";
const STAGE_DISPLAY_LABELS = {
  awaiting_seed: "Capture the idea",
  shaping_north_star: "Agree the direction",
  selecting_dna: "Choose DNA modules",
  scoping_brainwave_documentation: "Scope DNA documents",
  building_brainwave_documentation: "Build DNA documentation",
  reviewing_brainwave_documentation: "Review the foundation",
  brainwave_documentation_complete: "Ready for implementation"
};

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

function settingsRequireGuidanceMode(settings) {
  const match = String(settings.schema_version || "").match(/^(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 1 || (major === 1 && minor >= 1);
}

function settingsAreConfigured(settings) {
  return Boolean(
    settings.configured === true &&
      (!settings.onboarding_status || settings.onboarding_status === "complete") &&
      (!settingsRequireGuidanceMode(settings) ||
        hasAllowedValue(settings, "guidance_mode")) &&
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
  const settingsConfigured = settingsAreConfigured(runtime.settings);
  const guidanceMode = hasAllowedValue(runtime.settings, "guidance_mode")
    ? runtime.settings.guidance_mode
    : "concise";
  const displayStage = STAGE_DISPLAY_LABELS[stage] || stage;
  const lines = [
    `_brainwave is active at stage \`${stage}\`. The exact user-facing label is "${displayStage}". Follow ${at("AGENTS.md")} and ${at("_brainwave_handbook.md")}.`,
    `Use "${displayStage}" when stating the current step in the first assistant reply; keep the lifecycle ID internal.`
  ];

  if (!settingsConfigured) {
    lines.push(
      `The profile is incomplete. Ask whether this is the user's first time with _brainwave before the other three concise profile questions. Map "Yes — guide me" to \`guided\` and "No — keep it concise" to \`concise\`, prefer the host's native structured-choice UI when available, and update ${at("_settings.yaml")} after the user answers. Do not infer profile values from keywords.`
    );
  } else if (guidanceMode === "guided") {
    lines.push(
      `Guidance mode is \`guided\`. At the first orientation, status requests, and lifecycle approval points, show the compact seven-step journey defined in ${at("AGENTS.md")}; state the exact next action and explain the next unfamiliar term in one concise sentence. Mention ${at("_brainwave_handbook.md")} and ${at("_dashboard.html")} once near the start. Do not repeat the journey during routine shaping questions.`
    );
  } else {
    lines.push(
      "Guidance mode is `concise`. State the current step and immediate next action without the full journey block; explain a term only when needed for the decision."
    );
  }

  if (stage === "awaiting_seed") {
    if (runtime.seed.trim()) {
      lines.push(
        `A prepared concept already exists in ${at("_my_brainwave_seed.md")}. Do not rewrite or restructure it. Ask the user to confirm that it should be used exactly as written, then transition to \`shaping_north_star\`, which locks its hash.`
      );
    } else {
      lines.push(
        `Offer two equal seed routes, preferably with the host's native structured-choice UI: discuss the concept naturally in chat, or use a prepared concept by pasting it for verbatim capture or saving it directly in ${at("_my_brainwave_seed.md")}. Capture only explicitly approved content, preserve the user's supplied wording and natural structure, and do not infer missing content or fit template headings. If materially paraphrasing or restructuring, show the exact proposed seed for approval before writing it.`
      );
    }
  } else if (!runtime.seed.trim()) {
    lines.push(
      `The seed is unexpectedly missing. Restore the approved content in ${at("_my_brainwave_seed.md")} before continuing.`
    );
  } else if (stage === "shaping_north_star") {
    lines.push(
      `The North Star status is \`${northStarStatus(runtime.northStar)}\`. Read ${at("_my_brainwave_north_star.md")} first, use the seed only for provenance, and ask one to three material questions at a time.`
    );
  } else if (stage === "selecting_dna") {
    lines.push(
      `Explain that DNA modules are curated catalogues of possible documentation for relevant domains. Recommend modules from ${at("_dna/")} using semantic judgment and obtain explicit agreement before recording selection.`
    );
  } else if (stage === "scoping_brainwave_documentation") {
    lines.push(
      `Propose only proportionate DNA documents from the selected DNA modules and obtain explicit agreement before recording DNA document scope in ${at("_brainwave_state.yaml")}.`
    );
  } else if (stage === "building_brainwave_documentation") {
    lines.push(
      "Build only the scoped DNA documentation and its traceable DNA blocks in coherent, dependency-aware slices using the North Star as direction."
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

"use strict";

const fs = require("fs");
const path = require("path");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch (error) {
    return "";
  }
}

function parseJson(value) {
  if (!value || !value.trim()) return {};
  const raw = String(value).replace(/\u0000/g, "").trim();
  try {
    return JSON.parse(raw);
  } catch (error) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch (innerError) {
        return {};
      }
    }
    return {};
  }
}

function walkUpForBrainwaveRoot(start) {
  let current = path.resolve(start || process.cwd());
  while (true) {
    const dna = path.join(current, "_dna.yaml");
    const engine = path.join(current, "_engine", "brainwave_runner.js");
    if (fs.existsSync(dna) && fs.existsSync(engine)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function readSeed(root) {
  if (!root) return "";
  const seedPath = path.join(root, "_my_brainwave_seed.md");
  try {
    return fs.readFileSync(seedPath, "utf8");
  } catch (error) {
    return "";
  }
}

function isSeedEmpty(root) {
  return readSeed(root).trim().length === 0;
}

function readNorthStar(root) {
  if (!root) return "";
  const northStarPath = path.join(root, "_my_brainwave_north_star.md");
  try {
    return fs.readFileSync(northStarPath, "utf8");
  } catch (error) {
    return "";
  }
}

function readState(root) {
  if (!root) return {};
  const statePath = path.join(root, "_brainwave_state.yaml");
  try {
    return parseJson(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    return {};
  }
}

function northStarStatus(root) {
  const content = readNorthStar(root);
  return content.match(/^\s*status:\s*(shaping|agreed)\s*$/im)?.[1]?.toLowerCase() || "missing";
}

function brainwaveStage(root) {
  return readState(root)?.stage || "awaiting_seed";
}

function isPassive(root) {
  return brainwaveStage(root) === "architecture_documentation_complete";
}

function readSettings(root) {
  if (!root) return {};
  const settingsPath = path.join(root, "_settings.yaml");
  try {
    const raw = fs.readFileSync(settingsPath, "utf8");
    return parseJson(raw);
  } catch (error) {
    return {};
  }
}

function writeSettings(root, settings) {
  if (!root || !settings || typeof settings !== "object") return false;
  const settingsPath = path.join(root, "_settings.yaml");
  try {
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return true;
  } catch (error) {
    return false;
  }
}

function hasAllowedValue(settings, key) {
  const allowed = settings?.allowed_values?.[key];
  const value = settings?.[key];
  if (!Array.isArray(allowed) || allowed.length === 0) return Boolean(value);
  return allowed.includes(value);
}

function isSettingsConfigured(root) {
  const settings = readSettings(root);
  if (!settings || typeof settings !== "object") return false;
  if (settings.configured !== true) return false;
  if (settings.onboarding_status && settings.onboarding_status !== "complete") return false;
  if (!hasAllowedValue(settings, "technical_proficiency")) return false;
  if (!hasAllowedValue(settings, "ideation_mode")) return false;
  if (!hasAllowedValue(settings, "verbosity_budget")) return false;
  return true;
}

module.exports = {
  parseJson,
  readStdin,
  walkUpForBrainwaveRoot,
  isSeedEmpty,
  readNorthStar,
  readState,
  northStarStatus,
  brainwaveStage,
  isPassive,
  readSettings,
  writeSettings,
  isSettingsConfigured
};

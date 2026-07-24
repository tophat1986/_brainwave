"use strict";

const fs = require("fs");
const path = require("path");

const BRIDGE_START = "<!-- _brainwave:project-bridge:start -->";
const BRIDGE_END = "<!-- _brainwave:project-bridge:end -->";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function parseJson(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    throw new Error(
      `${path.relative(path.dirname(path.dirname(filePath)), filePath).replace(/\\/g, "/")} must be JSON-compatible YAML. ${error.message}`
    );
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function bridgeBlock() {
  return [
    BRIDGE_START,
    "## _brainwave",
    "",
    "This project includes `_brainwave/` as its idea-to-documentation foundation.",
    "",
    "- Read `_brainwave/_brainwave_state.yaml` before project work.",
    "- Use `_brainwave/_my_brainwave_north_star.md` as current direction and the relevant files in `_brainwave/_documentation/` as detailed authority.",
    "- Follow `_brainwave/AGENTS.md` whenever the lifecycle is active or the user explicitly invokes `_brainwave`.",
    "- When the stage is `brainwave_documentation_complete`, keep the workflow passive during normal development while continuing to respect the accepted North Star and documentation.",
    "",
    BRIDGE_END
  ].join("\n");
}

function renderBridge(existing, fileName) {
  const start = existing.indexOf(BRIDGE_START);
  const end = existing.indexOf(BRIDGE_END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    throw new Error(`${fileName} contains an incomplete _brainwave project bridge.`);
  }
  const bridge = bridgeBlock();
  if (start >= 0) {
    return `${existing.slice(0, start)}${bridge}${existing.slice(end + BRIDGE_END.length)}`;
  }
  const prefix = existing.trimEnd();
  return `${prefix ? `${prefix}\n\n` : ""}${bridge}\n`;
}

function ensureHook(config, eventName, command) {
  if (!isObject(config.hooks)) config.hooks = {};
  if (config.hooks[eventName] === undefined) config.hooks[eventName] = [];
  if (!Array.isArray(config.hooks[eventName])) {
    throw new Error(`Host .cursor/hooks.json must define hooks.${eventName} as an array.`);
  }
  if (
    config.hooks[eventName].some(
      (entry) => isObject(entry) && entry.command === command
    )
  ) {
    return false;
  }
  config.hooks[eventName].push({ command });
  return true;
}

function integrateProjectRoot(frameworkRoot, workingDirectory = process.cwd()) {
  if (path.basename(frameworkRoot).toLowerCase() !== "_brainwave") {
    throw new Error(
      "Project integration requires this folder to be named `_brainwave` and placed directly inside the target repository."
    );
  }
  const projectRoot = path.dirname(frameworkRoot);
  if (path.resolve(workingDirectory) !== projectRoot) {
    throw new Error(
      "Run project integration from the target repository root: `node _brainwave/_engine/brainwave_runner.js integrate`."
    );
  }

  const hooksPath = path.join(projectRoot, ".cursor", "hooks.json");
  const hooks = fs.existsSync(hooksPath)
    ? parseJson(hooksPath)
    : { version: 1, hooks: {} };
  if (!isObject(hooks)) {
    throw new Error("Host .cursor/hooks.json must contain a JSON object.");
  }
  if (hooks.version === undefined) hooks.version = 1;
  const hooksChanged = [
    ensureHook(
      hooks,
      "sessionStart",
      "node _brainwave/.cursor/hooks/brainwave_session_start.js"
    ),
    ensureHook(
      hooks,
      "beforeSubmitPrompt",
      "node _brainwave/.cursor/hooks/brainwave_prompt_guard.js"
    )
  ].some(Boolean);

  const bridgeFiles = ["AGENTS.md", "CLAUDE.md"].map((fileName) => {
    const target = path.join(projectRoot, fileName);
    const existing = readText(target);
    return { fileName, target, existing, updated: renderBridge(existing, fileName) };
  });

  const changes = [];
  for (const entry of bridgeFiles) {
    if (entry.updated === entry.existing) continue;
    writeText(entry.target, entry.updated);
    changes.push(entry.fileName);
  }
  if (hooksChanged || !fs.existsSync(hooksPath)) {
    writeText(hooksPath, `${JSON.stringify(hooks, null, 2)}\n`);
    changes.push(".cursor/hooks.json");
  }
  return changes;
}

module.exports = { integrateProjectRoot };

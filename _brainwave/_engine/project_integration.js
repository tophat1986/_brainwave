"use strict";

const fs = require("fs");
const path = require("path");

const BRIDGE_START = "<!-- _brainwave:project-bridge:start -->";
const BRIDGE_END = "<!-- _brainwave:project-bridge:end -->";

const CURSOR_COMMAND = "node _brainwave/_engine/adapters/cursor.js session-start";
const CLAUDE_COMMAND =
  'node "${CLAUDE_PROJECT_DIR}/_brainwave/_engine/adapters/claude.js" session-start';
const CODEX_COMMAND =
  'node "$(git rev-parse --show-toplevel)/_brainwave/_engine/adapters/codex.js" session-start';
const CODEX_COMMAND_WINDOWS =
  "powershell -NoProfile -Command \"$projectRoot = git rev-parse --show-toplevel; & node (Join-Path $projectRoot '_brainwave/_engine/adapters/codex.js') session-start\"";

const MANAGED_COMMANDS = new Set([
  CURSOR_COMMAND,
  CLAUDE_COMMAND,
  CODEX_COMMAND,
  "node _brainwave/_engine/integrations/cursor/brainwave_session_start.js",
  "node _brainwave/_engine/integrations/cursor/brainwave_prompt_guard.js"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function parseJson(filePath, label) {
  try {
    return JSON.parse(readText(filePath));
  } catch (error) {
    throw new Error(`${label} must contain valid JSON. ${error.message}`);
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
    "- During downstream implementation, update only the status of DNA blocks directly affected by the work; do not create a separate implementation log.",
    "- Treat explicit maintenance of the `_brainwave/` framework itself as framework work, not as the project's concept workflow.",
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

function removeBridge(existing, fileName) {
  const start = existing.indexOf(BRIDGE_START);
  const end = existing.indexOf(BRIDGE_END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    throw new Error(`${fileName} contains an incomplete _brainwave project bridge.`);
  }
  if (start < 0) return existing;
  const before = existing.slice(0, start).trimEnd();
  const after = existing.slice(end + BRIDGE_END.length).trimStart();
  return `${[before, after].filter(Boolean).join("\n\n")}${before || after ? "\n" : ""}`;
}

function loadConfig(target, label, fallback) {
  const existing = readText(target);
  const config = existing ? parseJson(target, label) : fallback;
  if (!isObject(config)) throw new Error(`${label} must contain a JSON object.`);
  if (config.hooks === undefined) config.hooks = {};
  if (!isObject(config.hooks)) throw new Error(`${label} must define hooks as an object.`);
  return { target, label, existing, config };
}

function removeManagedCommands(config) {
  for (const [eventName, groups] of Object.entries(config.hooks)) {
    if (!Array.isArray(groups)) {
      throw new Error(`Hook event ${eventName} must be an array.`);
    }
    const retained = [];
    for (const group of groups) {
      if (!isObject(group)) {
        retained.push(group);
        continue;
      }
      if (typeof group.command === "string") {
        if (!MANAGED_COMMANDS.has(group.command)) retained.push(group);
        continue;
      }
      if (!Array.isArray(group.hooks)) {
        retained.push(group);
        continue;
      }
      const hooks = group.hooks.filter(
        (handler) => !isObject(handler) || !MANAGED_COMMANDS.has(handler.command)
      );
      if (hooks.length > 0) retained.push({ ...group, hooks });
    }
    if (retained.length > 0) config.hooks[eventName] = retained;
    else delete config.hooks[eventName];
  }
}

function ensureCursorHook(config) {
  if (config.version === undefined) config.version = 1;
  const eventName = "sessionStart";
  if (config.hooks[eventName] === undefined) config.hooks[eventName] = [];
  if (!Array.isArray(config.hooks[eventName])) {
    throw new Error(`.cursor/hooks.json must define hooks.${eventName} as an array.`);
  }
  if (
    !config.hooks[eventName].some(
      (entry) => isObject(entry) && entry.command === CURSOR_COMMAND
    )
  ) {
    config.hooks[eventName].push({ command: CURSOR_COMMAND });
  }
}

function ensureStandardHook(config, command, options = {}) {
  const eventName = "SessionStart";
  if (config.hooks[eventName] === undefined) config.hooks[eventName] = [];
  if (!Array.isArray(config.hooks[eventName])) {
    throw new Error(`hooks.${eventName} must be an array.`);
  }
  const exists = config.hooks[eventName].some(
    (group) =>
      isObject(group) &&
      Array.isArray(group.hooks) &&
      group.hooks.some((handler) => isObject(handler) && handler.command === command)
  );
  if (exists) return;

  const handler = {
    type: "command",
    command,
    timeout: 5,
    ...options.handler
  };
  config.hooks[eventName].push({
    matcher: options.matcher,
    hooks: [handler]
  });
}

function renderedConfig(entry) {
  return `${JSON.stringify(entry.config, null, 2)}\n`;
}

function projectRootFor(frameworkRoot, workingDirectory, command) {
  if (path.basename(frameworkRoot).toLowerCase() !== "_brainwave") {
    throw new Error(
      "Project integration requires this folder to be named `_brainwave` and placed directly inside the target repository."
    );
  }
  const projectRoot = path.dirname(frameworkRoot);
  if (path.resolve(workingDirectory) !== projectRoot) {
    throw new Error(
      `Run project integration from the target repository root: \`node _brainwave/_engine/brainwave_runner.js ${command}\`.`
    );
  }
  return projectRoot;
}

function loadProjectConfigs(projectRoot) {
  return {
    cursor: loadConfig(
      path.join(projectRoot, ".cursor", "hooks.json"),
      ".cursor/hooks.json",
      { version: 1, hooks: {} }
    ),
    claude: loadConfig(
      path.join(projectRoot, ".claude", "settings.json"),
      ".claude/settings.json",
      { hooks: {} }
    ),
    codex: loadConfig(
      path.join(projectRoot, ".codex", "hooks.json"),
      ".codex/hooks.json",
      { description: "_brainwave lifecycle context", hooks: {} }
    )
  };
}

function writeChangedConfigs(entries, changes) {
  for (const entry of entries) {
    const updated = renderedConfig(entry);
    if (updated === entry.existing) continue;
    writeText(entry.target, updated);
    changes.push(entry.label);
  }
}

function integrateProjectRoot(frameworkRoot, workingDirectory = process.cwd()) {
  const projectRoot = projectRootFor(frameworkRoot, workingDirectory, "integrate");
  const { cursor, claude, codex } = loadProjectConfigs(projectRoot);

  for (const entry of [cursor, claude, codex]) removeManagedCommands(entry.config);
  ensureCursorHook(cursor.config);
  ensureStandardHook(claude.config, CLAUDE_COMMAND, {
    matcher: "startup|resume|clear|compact|fork"
  });
  ensureStandardHook(codex.config, CODEX_COMMAND, {
    matcher: "startup|resume|clear|compact",
    handler: {
      commandWindows: CODEX_COMMAND_WINDOWS,
      statusMessage: "Loading _brainwave context"
    }
  });

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
  writeChangedConfigs([cursor, claude, codex], changes);
  return changes;
}

function removeProjectRootIntegration(frameworkRoot, workingDirectory = process.cwd()) {
  const projectRoot = projectRootFor(frameworkRoot, workingDirectory, "unintegrate");
  const { cursor, claude, codex } = loadProjectConfigs(projectRoot);
  for (const entry of [cursor, claude, codex]) removeManagedCommands(entry.config);

  const bridgeFiles = ["AGENTS.md", "CLAUDE.md"].map((fileName) => {
    const target = path.join(projectRoot, fileName);
    const existing = readText(target);
    return { fileName, target, existing, updated: removeBridge(existing, fileName) };
  });

  const changes = [];
  for (const entry of bridgeFiles) {
    if (entry.updated === entry.existing) continue;
    writeText(entry.target, entry.updated);
    changes.push(entry.fileName);
  }
  writeChangedConfigs([cursor, claude, codex], changes);
  return changes;
}

module.exports = { integrateProjectRoot, removeProjectRootIntegration };

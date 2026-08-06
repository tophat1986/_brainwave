"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_SOURCE_ROOT = path.join(__dirname, "dashboard");
const SOURCE_GROUPS = Object.freeze([
  { directory: "styles", extension: ".css", placeholder: "{{BRAINWAVE_STYLES}}" },
  { directory: "scripts", extension: ".js", placeholder: "{{BRAINWAVE_APP}}" }
]);
const STATE_PLACEHOLDER = "{{BRAINWAVE_STATE}}";

function readOrderedFragments(sourceRoot, group) {
  const directory = path.join(sourceRoot, group.directory);
  if (!fs.existsSync(directory)) {
    throw new Error(`Dashboard source directory is missing: ${group.directory}`);
  }

  const files = fs.readdirSync(directory)
    .filter((fileName) => fileName.endsWith(group.extension))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`Dashboard source directory has no ${group.extension} fragments: ${group.directory}`);
  }

  return files
    .map((fileName) => fs.readFileSync(path.join(directory, fileName), "utf8"))
    .join("");
}

function replaceUnique(source, placeholder, value) {
  const first = source.indexOf(placeholder);
  const last = source.lastIndexOf(placeholder);
  if (first < 0 || first !== last) {
    throw new Error(`Dashboard shell must contain exactly one ${placeholder} placeholder.`);
  }
  return `${source.slice(0, first)}${value}${source.slice(first + placeholder.length)}`;
}

function serializedManifest(manifest) {
  return JSON.stringify(manifest || {})
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

function renderDashboard(manifest, options = {}) {
  const sourceRoot = options.sourceRoot || DEFAULT_SOURCE_ROOT;
  const shellPath = path.join(sourceRoot, "shell.html");
  if (!fs.existsSync(shellPath)) {
    throw new Error("Dashboard shell is missing: shell.html");
  }

  let output = fs.readFileSync(shellPath, "utf8");
  for (const group of SOURCE_GROUPS) {
    output = replaceUnique(output, group.placeholder, readOrderedFragments(sourceRoot, group));
  }
  return replaceUnique(output, STATE_PLACEHOLDER, serializedManifest(manifest));
}

function writeDashboard(filePath, manifest, options = {}) {
  const rendered = renderDashboard(manifest, options);
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (current === rendered) return false;
  fs.writeFileSync(filePath, rendered, "utf8");
  return true;
}

module.exports = {
  DEFAULT_SOURCE_ROOT,
  renderDashboard,
  serializedManifest,
  writeDashboard
};

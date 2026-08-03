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

function settingsSchemaAtLeast(settings, minimumMajor, minimumMinor) {
  const match = String(settings.schema_version || "").match(/^(\d+)\.(\d+)/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > minimumMajor || (major === minimumMajor && minor >= minimumMinor);
}

function settingsRequireGuidanceMode(settings) {
  return settingsSchemaAtLeast(settings, 1, 1);
}

function settingsRequireBuildOutcome(settings) {
  return settingsSchemaAtLeast(settings, 1, 2);
}

function buildOutcomeIsReady(settings) {
  return Boolean(
    !settingsRequireBuildOutcome(settings) ||
      (hasAllowedValue(settings, "build_outcome") && settings.build_outcome_confirmed_at)
  );
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
  const ideationMode = hasAllowedValue(runtime.settings, "ideation_mode")
    ? runtime.settings.ideation_mode
    : null;
  const displayStage = STAGE_DISPLAY_LABELS[stage] || stage;
  const lines = [
    `_brainwave is active at stage \`${stage}\`. The exact user-facing label is "${displayStage}". Follow ${at("AGENTS.md")} and ${at("_brainwave_handbook.md")}.`,
    `Use "${displayStage}" when stating the current step in the first assistant reply; keep the lifecycle ID internal.`
  ];

  if (!settingsConfigured) {
    lines.push(
      `The profile is incomplete. Ask whether this is the user's first time with _brainwave before the other three concise profile questions. Map "Yes — guide me" to \`guided\` and "No — keep it concise" to \`concise\`, prefer the host's native structured-choice UI when available, and update ${at("_settings.yaml")} after the user answers. Apply the selected working mode immediately. Do not infer profile values from keywords.`
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
      `The North Star status is \`${northStarStatus(runtime.northStar)}\`. Read ${at("_my_brainwave_north_star.md")} first, use the seed only for provenance, and treat discovery as an adaptive conversation rather than a questionnaire. Interpret existing answers before asking one to three high-leverage questions, route follow-ups only where material, and give compact progress reflections at natural checkpoints. At the appropriate moment, resolve the smallest consequential branch across funding and economic sustainability, discovery and adoption, legal or policy exposure from users/data/claims/money/markets/distribution, and human service or support dependencies. Risk overrides an early project phase; record the reason and re-entry trigger for any material deferral. Proportional scope changes breadth, not the quality floor.`
    );
    if (settingsConfigured && ideationMode === "thought_partner") {
      lines.push(
        "Working mode is `thought_partner`. Interpret, challenge, and recommend rather than only reflect. Once core value, interaction, and natural assets are clear, run one silent opportunity scan before North Star agreement. Test whether data, content, entities, transactions, signals, workflows, or relationships could create disproportionate user, discovery, retention, commercial, partner, or learning value, including a useful public or partner-facing surface. Surface at most two model-generated hypotheses only when they reuse core assets, have a clear causal loop, could change direction, and have a small reversible test. State the upside, assumptions, risks, and test; ask the user to adopt, defer, or reject each one. Do not manufacture novelty or expand direction or scope without approval."
      );
    } else if (settingsConfigured && ideationMode === "fast_execution") {
      lines.push(
        "Working mode is `fast_execution`. Propose the strongest supported direction directly, use labelled working assumptions for reversible gaps, and ask only when a decision is consequential, difficult to reverse, preference-dependent, or requires approval. Present alternatives only when their trade-off is material or the user asks."
      );
    }
    if (settingsConfigured && !buildOutcomeIsReady(runtime.settings)) {
      lines.push(
        `Once the concept is understood well enough for the choice to be meaningful, ask "How far would you like us to take this idea?" Offer "Show me the idea" (\`demonstration\`), "Build a usable first version" (\`usable_first_version\`), and "Build the complete product" (\`complete_product\`), with the host's normal free-form choice for a custom outcome. Do not infer or default the answer. Explain what the choice means for this concept, obtain explicit confirmation, record it and its confirmation time in ${at("_settings.yaml")}, and capture the concise agreed interpretation under "What We Are Building" in the North Star before agreement.`
      );
    }
  } else if (stage === "selecting_dna") {
    lines.push(
      `Explain that DNA modules are curated catalogues of possible documentation for relevant domains. Silently review material coverage, read each module's complete \`module_contract\` including its timing and live-verification rules, and recommend modules from ${at("_dna/")} using semantic judgment rather than keywords. Explain material selections, omissions, and deferrals with re-entry triggers. Legal, policy, and service consequences can require early attention even for a small build. If a material concern requires specialist coverage not provided by the installed DNA—such as trust and safety, marketplace or network integrity, AI product assurance, or regulated-sector practice—state that coverage gap rather than distributing it across adjacent modules, then obtain agreement to add the specialist module or accept the explicit limitation. Obtain explicit agreement before recording selection.`
    );
  } else if (stage === "scoping_brainwave_documentation") {
    lines.push(
      `Propose only proportionate DNA documents from the selected DNA modules, grouping obvious related documents into concise approval slices so scoping does not become a long form. Obtain explicit agreement before recording DNA document scope in ${at("_brainwave_state.yaml")}.`
    );
  } else if (stage === "building_brainwave_documentation") {
    lines.push(
      "Build only the scoped DNA documentation and its traceable DNA blocks in coherent, dependency-aware slices using the North Star as direction. For user-facing output, require real-user copy, strong visual hierarchy, distinctive agreed direction, and rendered-experience verification; never permit development narration or generic agent defaults to leak into the product. In Legal, Policy and Market Access documentation, completion means the source-linked consequence screen and review route are documented, never legal approval or compliance; preserve jurisdiction, source dates, uncertainty, and qualified-review gates for every material issue."
    );
  } else if (stage === "reviewing_brainwave_documentation") {
    lines.push(
      "Review every expressed document for gaps, contradictions, cross-module consistency, and downstream readiness. Verify that product-facing criteria prevent verbose developer-facing copy, weak hierarchy, generic visual defaults, and untested claims of experience quality. When Legal, Policy and Market Access DNA is selected, reject claims of legal advice, approval, certification, or compliance; material obligations without jurisdiction and current authoritative sources and dates; hidden uncertainty; fabricated qualified-review outcomes; and launch-readiness claims while required review gates remain unresolved."
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

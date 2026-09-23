"use strict";

const fs = require("fs");
const path = require("path");
const { readPrinciples, formatPrinciples, INITIAL_PRINCIPLES_INSTRUCTION } = require("../principles");
const {
  implementationContextPayload,
  formatGuardedImplementationContext
} = require("../implementation_spine");
const {
  implementationProgressPolicy,
  formatImplementationProgressPolicy
} = require("../implementation_progress");

const {
  phaseForStage, resolveWorkingMode, formatWorkingMode,
  implementationExecutionPolicy, formatImplementationExecutionPolicy
} = require("../working_modes");

const COMPLETE_STAGE = "brainwave_documentation_complete";
const FRESH_ALIGNMENT_REVIEW_PROMPT = [
  "Run a fresh-context `_brainwave` implementation alignment review for this repository.",
  "Work from the accepted North Star and DNA documentation, not previous implementation claims.",
  "Do not change product code or DNA direction.",
  "Compare each applicable current DNA block with the implementation spine and inspectable evidence, and scan for material divergence in product behaviour, experience, data use, permissions, risk, launch dependencies, or system boundaries.",
  "Report gaps and uncertainty before suggesting fixes.",
  "Do not rewrite DNA direction. Update implementation-spine state and evidence only where supported, record the reviewed Git revision and result with `node _brainwave/_engine/brainwave_runner.js alignment-review <aligned|needs_attention|blocked> <revision>`, then refresh the dashboard."
].join(" ");
const STAGE_DISPLAY_LABELS = {
  awaiting_seed: "Capture the idea",
  shaping_north_star: "Agree the direction",
  selecting_dna: "Choose DNA modules",
  scoping_brainwave_documentation: "Scope DNA documents",
  building_brainwave_documentation: "Build DNA documentation",
  reviewing_brainwave_documentation: "Review the foundation",
  brainwave_documentation_complete: "Ready for implementation"
};
const DOCUMENTATION_DETAIL_INSTRUCTIONS = Object.freeze({
  lean:
    "Use minimum-sufficient content: compact decisions, essential boundaries, material unknowns, and the smallest useful verification criteria. Remove narrative setup, generic best practice, tutorials, decorative examples, rejected alternatives, and speculative future branches that do not change downstream behaviour or verification.",
  standard:
    "Be concise and complete, not near-exhaustive. State each material decision once with brief rationale, its main boundary or exception, and the verification consequence where relevant. Stop when downstream work can proceed without guessing; omit broad background, tutorials, long option catalogues, extensive examples, speculative branches, and comprehensive edge-case inventories unless they materially change a decision.",
  exhaustive:
    "Give deep treatment within the already agreed scope: cover material rationale, alternatives and trade-offs, assumptions, dependencies, scenarios, exceptions, failure and recovery behaviour, consequences, and verification. Do not pad, duplicate, speculate, add documents, or widen product direction merely to produce more content."
});

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

function settingsRequireExperienceProtocol(settings) {
  return settingsSchemaAtLeast(settings, 1, 3);
}

function settingsRequireStartingMaterialsBeforeSeed(settings) {
  return settingsSchemaAtLeast(settings, 1, 6);
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
      hasAllowedValue(settings, "verbosity_budget")
  );
}

function documentationDetailInstruction(settings) {
  const mode = hasAllowedValue(settings, "verbosity_budget")
    ? settings.verbosity_budget
    : "standard";
  return `Documentation detail is \`${mode}\`, read from the persistent \`_settings.yaml\` \`verbosity_budget\`. ${DOCUMENTATION_DETAIL_INSTRUCTIONS[mode]} This controls depth inside agreed outputs only; it never changes approved DNA document scope, material-risk coverage, factual confidence, verification quality, or the completion standard. Model capability, reasoning effort, context size, and available source volume do not authorize greater depth. During review, compress excess as well as filling material gaps.`;
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
  let principles;
  try { principles = readPrinciples(root); }
  catch (error) { principles = { status: "invalid", error: error.message }; }
  return {
    root,
    cwd,
    principles,
    state: readJson(path.join(root, "_brainwave_state.yaml")),
    settings: readJson(path.join(root, "_settings.yaml")),
    manifest: readJson(path.join(root, "_manifest.yaml")),
    implementationSpine: readJson(path.join(root, "_implementation.yaml")),
    seed: readText(path.join(root, "_my_brainwave_seed.md")),
    northStar: readText(path.join(root, "_my_brainwave_north_star.md"))
  };
}

function buildSessionContext(runtime) {
  const stage = runtime.state.stage || "awaiting_seed";
  const principles = runtime.principles || { status: "ready", entries: [], sha256: null };
  if (principles.error) return `STOP: ${principles.error} Run principles-validate after correcting _principles.md.`;
  const principleTexts = principles.entries.map((entry) => entry.text);
  const principleContext = formatPrinciples(principleTexts);
  if (stage === COMPLETE_STAGE) {
    if (principles.status !== "ready") return `STOP: ${INITIAL_PRINCIPLES_INSTRUCTION} For an existing foundation, review accepted direction without rewriting it, then run principles-validate.`;
    const at = (artifact) => `\`${artifactPath(runtime.root, runtime.cwd, artifact)}\``;
    const lines = [
      `_brainwave has accepted its foundation; the eighth user-facing step, Deliver the implementation, and ambient delivery alignment are active. Do not announce or restart the seven-stage foundation workflow during ordinary development. DNA documents in ${at("_documentation/")} are the authority for direction; ${at("_implementation.yaml")} is the sole authority for delivery state and evidence.`,
      `Read ${at("_my_brainwave_north_star.md")} before project work. Do not read the full DNA corpus. Use \`node _brainwave/_engine/brainwave_runner.js implementation-context\` to retrieve the current slice and only its owning DNA passages.`
    ];
    const executionPolicy = implementationExecutionPolicy(runtime.settings);
    if (principleContext && (executionPolicy.requires_selection ||
        !["approved", "active", "complete"].includes(runtime.implementationSpine?.plan_status))) {
      lines.unshift(principleContext);
    }
    lines.push(formatImplementationExecutionPolicy(executionPolicy));
    lines.push("Foundation acceptance alone does not authorize product work. Begin implementation only when requested; an existing end-to-end request need not be approved again.");
    if (executionPolicy.requires_selection) {
      lines.push(formatImplementationProgressPolicy(implementationProgressPolicy(runtime.settings)));
      return lines.join(" ");
    }
    const spine = runtime.implementationSpine;
    if (!spine?.schema_version) {
      lines.push(
        `The implementation spine has not been compiled. Before downstream product work, run \`node _brainwave/_engine/brainwave_runner.js implementation-compile\` (add \`--existing-build\` when adopting into an existing product), author the generated proposal from the North Star and project-specific outcome backbone, run \`implementation-synthesize <authored-by>\` and \`implementation-review\`, present the review, then obtain explicit user approval and run \`implementation-approve <approved-by>\`.`
      );
    } else if (spine.plan_status === "draft") {
      const synthesisStatus = spine.planning?.synthesis_status || "unknown";
      lines.push(`Implementation plan ${spine.plan_version || "unknown"} is still a draft at synthesis state ${synthesisStatus}. ${
        synthesisStatus === "inventory_ready"
          ? "Complete _implementation_proposal.yaml semantically; inspect current code and tests first when adoption mode is existing_build, then run implementation-synthesize <authored-by>."
          : synthesisStatus === "proposal_ready"
            ? "Run implementation-review and present _implementation_review.md to the user."
            : "Present the current human-readable review and obtain explicit approval before running implementation-approve <approved-by>."
      } Do not begin product implementation yet.`);
    } else {
      const payload = implementationContextPayload(spine, {
        source: { ...spine.source, principles_sha256: principles.sha256, principles: principleTexts },
        applicableBlockIds: Object.keys(spine.work_items || {})
      });
      if (runtime.manifest?.implementation?.source_stale) {
        payload.source_stale = true;
        payload.exact_next_command =
          "Run implementation-compile, repeat synthesis and human review, and obtain approval before continuing.";
      }
      // The required CLI context refresh supplies principles during approved delivery.
      // Retain the full payload's freshness and budget checks without injecting the list twice.
      lines.push(formatGuardedImplementationContext({ ...payload, principles: [] }));
      lines.push(
        payload.source_stale || payload.validation_errors?.length
          ? "Do not change product code until the implementation plan is current and structurally valid."
          : "Work only on the active or recommended slice. Record implementation and verification evidence through the implementation commands, run the slice check, close it at a clean Git checkpoint, then request the next compact packet."
      );
    }
    lines.push(
      "Treat semantic alignment as an evidence-backed assessment, not mathematical proof. Keep technical health, product coverage, external gates, and release readiness separate."
    );
    lines.push(
      "For the first user-interface slice that needs assurance, inspect existing tooling and require the capabilities needed for isolated component checks, browser journeys, and rendered comparison before recommending compatible tools such as Storybook or Playwright. Record the selected equivalent, explicit decline, or not-applicable decision in `_settings.yaml` `assurance_tooling`; applicable assurance packets repeat it. For consequential experience, security, architecture, or release assurance, prefer an independent-context reviewer: a fresh sub-agent where supported, otherwise a fresh task, chat, or human. Record same-context self-review as a limitation, not independent assurance."
    );
    lines.push(formatImplementationProgressPolicy(implementationProgressPolicy(runtime.settings)));
    lines.push(
      `Never silently rewrite accepted direction to match implementation. Editorial clarifications may update a block only when no reasonable downstream behaviour changes. For a user-approved local behavioural change, create a superseding block and recompile the spine. Reopen the appropriate lifecycle stage when the North Star, relevant domains, or DNA document scope changes.`
    );
    lines.push(
      `When the user asks about a release, pilot, major handoff, broad readiness, or overall alignment, recommend opening a fresh chat and give them this exact copyable prompt: ${FRESH_ALIGNMENT_REVIEW_PROMPT}`
    );
    return lines.join(" ");
  }

  const at = (artifact) => `\`${artifactPath(runtime.root, runtime.cwd, artifact)}\``;
  const settingsConfigured = settingsAreConfigured(runtime.settings);
  const guidanceMode = hasAllowedValue(runtime.settings, "guidance_mode")
    ? runtime.settings.guidance_mode
    : "concise";
  const workingMode = resolveWorkingMode(runtime.settings, phaseForStage(stage));
  const shapingMode = workingMode.phase === "shaping" ? workingMode.mode : null;
  const displayStage = STAGE_DISPLAY_LABELS[stage] || stage;
  const experienceRequired = settingsRequireExperienceProtocol(runtime.settings);
  const dashboardIntroduced = Boolean(
    runtime.state.experience_checkpoints?.dashboard_introduced_at
  );
  const projectBasicsChecked = Boolean(
    runtime.state.experience_checkpoints?.project_basics_checked_at &&
      runtime.settings.project_profile?.status &&
      runtime.settings.project_profile.status !== "not_asked"
  );
  const startingMaterialsRequired = settingsRequireStartingMaterialsBeforeSeed(runtime.settings);
  const startingMaterialsChecked = Boolean(
    runtime.state.experience_checkpoints?.project_basics_checked_at
  );
  const lines = [
    `_brainwave is active at stage \`${stage}\`. The exact user-facing label is "${displayStage}". Follow ${at("AGENTS.md")}; consult relevant sections of ${at("_brainwave_handbook.md")} when needed.`,
    `Use "${displayStage}" when stating the current step in the first assistant reply; keep the lifecycle ID internal.`
  ];
  if (principleContext) lines.unshift(principleContext);

  if (!settingsConfigured) {
    lines.push(
      `The profile is incomplete. Ask whether this is the user's first time with _brainwave before the other three concise profile questions. Map "Yes — guide me" to \`guided\` and "No — keep it concise" to \`concise\`, prefer the host's native structured-choice UI when available, and update ${at("_settings.yaml")} after the user answers. When asking documentation detail, describe \`lean\` as minimum sufficient, \`standard\` as concise and complete rather than near-exhaustive, and \`exhaustive\` as deep treatment within agreed scope. Immediately after that first answer, give the friendly dashboard introduction below before asking the other profile questions. Choose shaping_mode (thought_partner, fast_execution, or autonomous) during onboarding; choose documentation_mode and implementation_mode only when entering those phases. Apply the selected shaping mode immediately and apply the selected documentation detail immediately. Do not infer profile values from keywords or model capability.`
    );
  } else if (guidanceMode === "guided") {
    lines.push(
      `Guidance mode is \`guided\`. At the first orientation, status requests, and lifecycle approval points, show the compact eight-step journey defined in ${at("AGENTS.md")}; state the exact next action and explain the next unfamiliar term in one concise sentence. Mention ${at("_brainwave_handbook.md")} once near the start. Do not repeat the journey during routine shaping questions.`
    );
  } else {
    lines.push(
      "Guidance mode is `concise`. State the current step and immediate next action without the full journey block; explain a term only when needed for the decision."
    );
  }

  if (settingsConfigured) {
    lines.push(documentationDetailInstruction(runtime.settings));
    lines.push(formatWorkingMode(workingMode));
    if (workingMode.requires_selection) return lines.join(" ");
  }

  if (experienceRequired && !dashboardIntroduced) {
    lines.push(
      `Before the seed routes or any concept questions, tell the user in simple, friendly language: "You can follow your idea as it takes shape in the _brainwave dashboard. It gives you a clear visual view of the journey, decisions, documents and progress. You can open ${at("_dashboard.html")} now or anytime." Do not add technical caveats. After delivering it, record \`dashboard_introduced_at\` in ${at("_brainwave_state.yaml")}.`
    );
  } else if (!experienceRequired && guidanceMode === "guided") {
    lines.push(`Mention ${at("_dashboard.html")} once near the start as the visual way to follow progress.`);
  }

  if (
    stage === "awaiting_seed" &&
    startingMaterialsRequired &&
    settingsConfigured &&
    dashboardIntroduced &&
    !startingMaterialsChecked
  ) {
    lines.push(
      `Before offering the Seed routes, ask one optional bundled starting-materials question: "Before we capture your concept, do you already have anything you'd like _brainwave to carry forward—such as research, facts, links, Figma or other designs, screenshots, documents, recordings, examples, a name, logo, colours, or a general style direction? Share whatever you have, or say 'not yet'; references can also be added later." Do not split this into a questionnaire. Save project identity in ${at("_settings.yaml")} and capture reference material under ${at("_references/")} only after reading ${at("_reference_library_guide.md")}. Warn before copying private or restricted material into a repository that may be public. Existing project-profile references remain valid. Record the project_basics_checked_at checkpoint in ${at("_brainwave_state.yaml")} after the response. References may inform the discussion but must not be silently inserted into the Seed or treated as accepted direction.`
    );
  }

  if (stage === "awaiting_seed" && (!startingMaterialsRequired || startingMaterialsChecked)) {
    if (runtime.seed.trim()) {
      lines.push(
        `A prepared concept already exists in ${at("_my_brainwave_seed.md")}. Do not rewrite or restructure it. Ask the user to confirm that it should be used exactly as written, then transition to \`shaping_north_star\`, which locks its hash.`
      );
    } else {
      lines.push(
        `Offer two equal seed routes, preferably with the host's native structured-choice UI: discuss the concept naturally in chat, or use a prepared concept by pasting it for verbatim capture or saving it directly in ${at("_my_brainwave_seed.md")}. Capture only explicitly approved content, preserve the user's supplied wording and natural structure, and do not infer missing content or fit template headings. If materially paraphrasing or restructuring, show the exact proposed seed for approval before writing it.`
      );
    }
  } else if (stage !== "awaiting_seed" && !runtime.seed.trim()) {
    lines.push(
      `The seed is unexpectedly missing. Restore the approved content in ${at("_my_brainwave_seed.md")} before continuing.`
    );
  } else if (stage === "shaping_north_star") {
    if (experienceRequired && !startingMaterialsRequired && !projectBasicsChecked) {
      lines.push(
        `Read the Seed and any supplied materials first, then ask one optional bundled project-basics question without repeating known details: "Do you already have any project basics you'd like us to carry forward—such as a name, a short description or tagline, a logo, colours, a general style direction, or screenshots, sketches, mock-ups, or examples that show how you imagine it? Share whatever you have, or say 'not yet' and we can shape it later." Do not split this into separate questions. Save supplied details as working or confirmed in ${at("_settings.yaml")} \`project_profile\`; save actual files under a project-owned \`_assets/project_profile/\` folder and record their paths. For each colour, preserve its name, value, optional repeatable role, optional usage, and whether it should be featured in the dashboard; never force unique primary, secondary, or tertiary slots. Preserve supplied references in \`project_profile.references\` using a safe relative path, label, optional note, status, and content hash when available; do not classify their intended use because Product Design and Experience DNA owns that decision. Treat \`not_yet\` and \`deferred\` as complete answers, then record \`project_basics_checked_at\` in ${at("_brainwave_state.yaml")}.`
      );
    }
    lines.push(
      `The North Star status is \`${northStarStatus(runtime.northStar)}\`. Read ${at("_my_brainwave_north_star.md")} for current direction and ${at("_my_brainwave_seed.md")} for detailed intent; omission from the North Star does not discard concept detail, and explicit later decisions govern conflicts. Treat discovery as an adaptive conversation rather than a questionnaire, following shaping_mode. Interpret existing answers before asking one to three high-leverage questions when the mode requires input; route follow-ups only where material, and give compact progress reflections at natural checkpoints. At the appropriate moment, resolve the smallest consequential branch across funding and economic sustainability, discovery and adoption, legal or policy exposure from users/data/claims/money/markets/distribution, and human service or support dependencies. Risk overrides an early project phase; record the reason and re-entry trigger for any material deferral. Proportional scope changes breadth, not the quality floor.`
    );
    if (settingsConfigured && shapingMode === "thought_partner") {
      lines.push(
        "During shaping, interpret, challenge, and recommend rather than only reflect. Once core value, interaction, and natural assets are clear, run one silent opportunity scan before North Star agreement. Test whether data, content, entities, transactions, signals, workflows, or relationships could create disproportionate user, discovery, retention, commercial, partner, or learning value, including a useful public or partner-facing surface. Surface at most two model-generated hypotheses only when they reuse core assets, have a clear causal loop, could change direction, and have a small reversible test. State the upside, assumptions, risks, and test; ask the user to adopt, defer, or reject each one. Do not manufacture novelty or expand direction or scope without approval."
      );
    }
    if (settingsConfigured && workingMode.delegated) {
      lines.push("After Seed and build-outcome confirmation, agree the supported North Star within the supplied brief under delegated shaping authority and continue authorized shaping work. Preserve unresolved facts and external gates; do not claim human agreement.");
    }
    if (settingsConfigured && !buildOutcomeIsReady(runtime.settings)) {
      lines.push(
        `Once the concept is understood well enough for the choice to be meaningful, ask "How far would you like us to take this idea?" Offer "Show me the idea" (\`demonstration\`), "Build a usable first version" (\`usable_first_version\`), and "Build the complete product" (\`complete_product\`), with the host's normal free-form choice for a custom outcome. Do not infer or default the answer. Explain what the choice means for this concept, obtain explicit confirmation, record it and its confirmation time in ${at("_settings.yaml")}, and capture the concise agreed interpretation under "What We Are Building" in the North Star before agreement.`
      );
    }
  } else if (stage === "selecting_dna") {
    lines.push(
      `Explain that DNA modules are curated catalogues of possible documentation for relevant domains. Silently review material coverage, read each module's complete \`module_contract\` including its assurance profiles, timing, and live-verification rules, and recommend modules from ${at("_dna/")} using semantic judgment rather than keywords. Explain material selections, omissions, and deferrals with re-entry triggers. Legal, policy, and service consequences can require early attention even for a small build. If a material concern requires specialist coverage not provided by the installed DNA—such as trust and safety, marketplace or network integrity, AI product assurance, or regulated-sector practice—state that coverage gap rather than distributing it across adjacent modules, then obtain agreement to add the specialist module or accept the explicit limitation. ${settingsConfigured && workingMode.delegated ? "Record supported module selection within the confirmed brief without repeated approval." : "Obtain explicit agreement before recording selection unless that choice is separately delegated."}`
    );
  } else if (stage === "scoping_brainwave_documentation") {
    lines.push(
      `Choose proportionate DNA documents from the selected modules within the confirmed brief. ${settingsConfigured && workingMode.delegated ? "Record the supported scope and rationale under delegated shaping authority without repeated approval." : "Group related recommendations into concise approval slices and obtain explicit agreement before recording scope unless separately delegated."} Use ${at("_brainwave_state.yaml")} for scope. Select documentation_mode independently before authoring.`
    );
  } else if (stage === "building_brainwave_documentation") {
    lines.push(principles.status !== "ready" ? INITIAL_PRINCIPLES_INSTRUCTION :
      "At each DNA slice, apply relevant principles quietly from current context; reread only if missing or changed. Consult _brainwave_handbook.md#principles before revising the set for new source intent.");
    lines.push(
      "At each authoring slice start, resume or compaction, reload current direction, document status and relevant Document Open Questions. Choose one coherent decision or tightly coupled set; inspect concept headings and reference-collection metadata, then read only needed source passages and DNA dependencies. Split oversized work. Check source fidelity, consistency and implementability before moving on; continue other eligible work while awaiting input.",
      "Build only the scoped DNA documentation and its traceable DNA blocks in coherent, dependency-aware slices. Use the North Star as current direction and relevant Seed passages as detailed intent unless explicitly superseded. Inspect relevant reference sources and existing DNA before developing new answers; reuse applicable research. Distinguish evidence, implications, assumptions, proposals and accepted decisions; resolve material constraints, failures and dependencies. Cite material reference use in Reference Basis. Product Design and Experience interprets design references; other evidence follows its owning domain. Before pausing, preserve the pending decision, recommendation, source/dependency links, next action and whether an answer is awaited in Document Open Questions. Before completion, check that the relevant blocks and dependencies support implementation without inventing material product decisions. For user-facing output, require real-user copy, strong visual hierarchy, distinctive agreed direction, and rendered-experience verification; never permit development narration or generic agent defaults to leak into the product. In Legal, Policy and Market Access documentation, completion means the source-linked consequence screen and review route are documented, never legal approval or compliance; preserve jurisdiction, source dates, uncertainty, and qualified-review gates for every material issue."
    );
  } else if (stage === "reviewing_brainwave_documentation") {
    lines.push("Review principles for source fidelity, value across tasks, overlap and application in DNA. Follow _brainwave_handbook.md#principles for edits; run principles-validate before acceptance.");
    lines.push(
      settingsConfigured && workingMode.delegated
        ? "After the required readiness review passes, accept the foundation under delegated documentation authority and record that basis honestly. This does not authorize starting implementation."
        : "After readiness review, obtain explicit user acceptance before completing the foundation unless separate explicit delegation authorizes acceptance.",
      "Check relevant concept intent and cited reference implications against the authored decisions. Distinguish evidence from assumptions and proposals from accepted or explicitly delegated decisions. Resolve blocking choices; preserve non-blocking unknowns and deliberate implementation discretion. Confirm an implementer can act from the relevant blocks and dependencies without inventing material product decisions.",
      "Review every expressed document for gaps, contradictions, cross-module consistency, and downstream readiness. For software products, silently scan each included capability for its implied setup, everyday use, management, recovery, and exit or closure behaviour; require material gaps to be included, deliberately excluded, not applicable, or unresolved in the owning Software Application or Product Design and Experience document without adding features merely because they are conventional. Verify that product-facing criteria prevent verbose developer-facing copy, weak hierarchy, generic visual defaults, and untested claims of experience quality. When Legal, Policy and Market Access DNA is selected, reject claims of legal advice, approval, certification, or compliance; material obligations without jurisdiction and current authoritative sources and dates; hidden uncertainty; fabricated qualified-review outcomes; and launch-readiness claims while required review gates remain unresolved."
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

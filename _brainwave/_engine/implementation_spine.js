"use strict";

const crypto = require("node:crypto");

const SPINE_SCHEMA_VERSION = "0.2.0";
const PLAN_STATUSES = new Set(["draft", "approved", "active", "complete"]);
const SLICE_STATES = new Set([
  "queued",
  "ready",
  "active",
  "implemented",
  "verified",
  "blocked",
  "deferred"
]);
const WORK_ITEM_STATES = new Set([
  "not_started",
  "in_progress",
  "implemented",
  "verified",
  "blocked",
  "deferred"
]);
const ACCEPTANCE_STATES = new Set(["pending", "passed", "failed", "blocked"]);
const TECHNICAL_HEALTH_STATES = new Set(["unknown", "passing", "failing"]);
const PRODUCT_COVERAGE_STATES = new Set(["not_assessed", "incomplete", "partial", "checked"]);
const EXTERNAL_GATE_STATES = new Set(["unknown", "open", "clear", "blocked"]);
const RELEASE_READINESS_STATES = new Set(["not_assessed", "not_ready", "ready"]);
const EVIDENCE_KINDS = new Set([
  "code",
  "config",
  "migration",
  "automated_test",
  "rendered_journey",
  "inspection",
  "external_review"
]);
const PRIORITY_ORDER = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });
const SYNTHESIS_STATUSES = new Set(["inventory_ready", "proposal_ready", "reviewed"]);
const ADOPTION_MODES = new Set(["greenfield", "existing_build"]);
const SLICE_KINDS = new Set(["outcome", "foundation", "external_gate"]);
const EXISTING_BUILD_ASSESSMENTS = new Set([
  "not_assessed",
  "absent",
  "partial",
  "appears_implemented",
  "appears_verified"
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(values) {
  return [...new Set(values)];
}

function applicableDirectionBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).filter(
    (block) => !["superseded", "not_applicable"].includes(block.direction_status)
  );
}

function importedWorkItemState(block) {
  const status = block.legacy_delivery_status;
  return WORK_ITEM_STATES.has(status) ? status : "not_started";
}

function importedEvidence(markdown, owningDocument, blockId, type) {
  if (!text(markdown)) return [];
  return [
    {
      kind: "inspection",
      ref: `${owningDocument}#${blockId}`,
      note: `Imported from legacy DNA ${type} evidence; review before approval.`
    }
  ];
}

function legacyAssessment(block) {
  const status = text(block.legacy_delivery_status);
  if (status === "verified") return "appears_verified";
  if (status === "implemented") return "appears_implemented";
  if (status === "in_progress") return "partial";
  return "not_assessed";
}

function defaultWorkItem(block, adoptionMode) {
  const owningDocument = block.path || "";
  const state = importedWorkItemState(block);
  const implementationEvidence = importedEvidence(
    block.legacy_implementation_evidence,
    owningDocument,
    block.id,
    "implementation"
  );
  const verificationEvidence = importedEvidence(
    block.legacy_verification_evidence,
    owningDocument,
    block.id,
    "verification"
  );
  return {
    title: block.title || block.id,
    module_id: block.module_id || null,
    document_id: block.document_id || null,
    document_title: block.document_title || null,
    owning_document: owningDocument,
    primary_slice: null,
    applies_to: [],
    state,
    implementation_evidence: implementationEvidence,
    verification_evidence: verificationEvidence,
    last_checked: text(block.legacy_last_checked) || null,
    checked_revision: text(block.legacy_checked_revision) || null,
    hold: null,
    imported_legacy_status: text(block.legacy_delivery_status) || null,
    existing_build_assessment: {
      status: adoptionMode === "existing_build" ? legacyAssessment(block) : "not_assessed",
      refs: unique([
        ...implementationEvidence.map((entry) => entry.ref),
        ...verificationEvidence.map((entry) => entry.ref)
      ]),
      note: text(block.legacy_delivery_status)
        ? "Provisional legacy import; inspect the current build during reconciliation."
        : null
    }
  };
}

function buildImplementationSpine({ source, blocks, existing = null, now, adoptionMode = "greenfield" }) {
  if (!ADOPTION_MODES.has(adoptionMode)) throw new Error(`Invalid adoption mode: ${adoptionMode}.`);
  const applicableBlocks = applicableDirectionBlocks(blocks);
  const workItems = {};

  for (const block of applicableBlocks) {
    workItems[block.id] = defaultWorkItem(block, adoptionMode);
  }

  if (isObject(existing)) {
    for (const [id, item] of Object.entries(workItems)) {
      const previous = existing.work_items?.[id];
      if (!isObject(previous)) continue;
      workItems[id] = {
        ...item,
        state: previous.state || item.state,
        implementation_evidence: clone(previous.implementation_evidence || item.implementation_evidence),
        verification_evidence: clone(previous.verification_evidence || item.verification_evidence),
        last_checked: previous.last_checked || item.last_checked,
        checked_revision: previous.checked_revision || item.checked_revision,
        hold: clone(previous.hold || item.hold),
        existing_build_assessment: clone(
          previous.existing_build_assessment || item.existing_build_assessment
        ),
        title: item.title,
        module_id: item.module_id,
        document_id: item.document_id,
        document_title: item.document_title,
        owning_document: item.owning_document,
        primary_slice: null,
        applies_to: []
      };
    }
  }

  const priorPlanVersion = Number(existing?.plan_version || 0);
  const priorStateRevision = Number(existing?.state_revision || 0);
  return {
    schema_version: SPINE_SCHEMA_VERSION,
    plan_version: priorPlanVersion > 0 ? priorPlanVersion + 1 : 1,
    state_revision: priorStateRevision > 0 ? priorStateRevision + 1 : 0,
    plan_status: "draft",
    planning: {
      adoption_mode: adoptionMode,
      synthesis_status: "inventory_ready",
      synthesized_at: null,
      synthesized_by: null,
      synthesized_revision: null,
      synthesis_basis: [],
      proposal_fingerprint: null,
      review: {
        presented_at: null,
        proposal_fingerprint: null,
        artifact: null
      }
    },
    source: clone(source),
    approval: { approved_at: null, approved_by: null, git_revision: null },
    active_slice: null,
    readiness: {
      technical_health: "unknown",
      product_coverage: applicableBlocks.length ? "incomplete" : "not_assessed",
      external_gates: "unknown",
      release_readiness: "not_assessed"
    },
    tracks: [],
    slices: [],
    work_items: workItems,
    audit: {
      experiment_started_at: existing?.audit?.experiment_started_at || now,
      last_mutation_at: now,
      rejected_transitions: Number(existing?.audit?.rejected_transitions || 0)
    }
  };
}

function validateEvidence(entries, label, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  for (const [index, entry] of entries.entries()) {
    if (!isObject(entry)) {
      errors.push(`${label}[${index}] must be an object.`);
      continue;
    }
    if (!EVIDENCE_KINDS.has(entry.kind)) {
      errors.push(`${label}[${index}] has invalid kind ${entry.kind || "missing"}.`);
    }
    if (!text(entry.ref)) errors.push(`${label}[${index}] must define ref.`);
    if (!text(entry.note)) errors.push(`${label}[${index}] must define a concise note.`);
    if (text(entry.note).length > 240) errors.push(`${label}[${index}] note exceeds 240 characters.`);
  }
}

function dependencyCycle(slicesById) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (id, trail) => {
    if (visiting.has(id)) return [...trail, id];
    if (visited.has(id)) return null;
    visiting.add(id);
    const slice = slicesById.get(id);
    for (const dependency of Array.isArray(slice?.depends_on) ? slice.depends_on : []) {
      const cycle = visit(dependency, [...trail, id]);
      if (cycle) return cycle;
    }
    visiting.delete(id);
    visited.add(id);
    return null;
  };
  for (const id of slicesById.keys()) {
    const cycle = visit(id, []);
    if (cycle) return cycle;
  }
  return null;
}

function sourceIsStale(spine, source) {
  if (!isObject(spine?.source) || !isObject(source)) return true;
  return ["north_star_sha256", "dna_scope_sha256"].some(
    (key) => text(spine.source[key]) !== text(source[key])
  );
}

function proposalFingerprint(spine) {
  const proposal = {
    adoption_mode: spine?.planning?.adoption_mode || null,
    synthesis_basis: spine?.planning?.synthesis_basis || [],
    tracks: (spine?.tracks || []).map(({ id, title, order }) => ({ id, title, order })),
    slices: (spine?.slices || []).map((slice) => ({
      id: slice.id,
      track: slice.track,
      kind: slice.kind,
      title: slice.title,
      outcome: slice.outcome,
      justification: slice.justification || null,
      order: slice.order,
      priority: slice.priority,
      depends_on: slice.depends_on || [],
      blocking_gates: slice.blocking_gates || [],
      acceptance_checks: (slice.acceptance_checks || []).map(({ id, type, description }) => ({
        id,
        type,
        description
      }))
    })),
    mappings: Object.fromEntries(
      Object.entries(spine?.work_items || {}).map(([id, item]) => [id, {
        primary_slice: item.primary_slice || null,
        applies_to: item.applies_to || [],
        existing_build_assessment: item.existing_build_assessment || null
      }])
    )
  };
  return crypto.createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
}

function buildImplementationProposalTemplate(spine) {
  return {
    proposal_version: "0.1.0",
    adoption_mode: spine?.planning?.adoption_mode || "greenfield",
    synthesis_basis: [
      {
        ref: "_my_brainwave_north_star.md",
        role: "Current product direction; add the project-specific journey, priority, delivery, acceptance, architecture, and gate documents that actually shape this proposal."
      }
    ],
    tracks: [],
    slices: [],
    work_items: Object.fromEntries(
      Object.keys(spine?.work_items || {}).map((id) => [id, {
        primary_slice: null,
        applies_to: [],
        existing_build_assessment: {
          status: spine.work_items[id].existing_build_assessment?.status || "not_assessed",
          refs: spine.work_items[id].existing_build_assessment?.refs || [],
          note: spine.work_items[id].existing_build_assessment?.note || null
        }
      }])
    )
  };
}

function applyImplementationProposal(spine, proposal) {
  if (!isObject(proposal)) throw new Error("The implementation proposal must be an object.");
  if (proposal.proposal_version !== "0.1.0") {
    throw new Error(`implementation proposal_version must be 0.1.0; found ${proposal.proposal_version || "missing"}.`);
  }
  if (proposal.adoption_mode !== spine.planning?.adoption_mode) {
    throw new Error("The proposal adoption_mode must match the compiled inventory.");
  }
  if (!Array.isArray(proposal.tracks) || !Array.isArray(proposal.slices) || !isObject(proposal.work_items)) {
    throw new Error("The proposal must define tracks, slices, and work_items.");
  }
  const unknownWorkItems = Object.keys(proposal.work_items).filter((id) => !spine.work_items?.[id]);
  if (unknownWorkItems.length) {
    throw new Error(`The proposal references unknown DNA blocks: ${unknownWorkItems.join(", ")}.`);
  }
  const updated = clone(spine);
  updated.planning.synthesis_basis = clone(proposal.synthesis_basis || []);
  updated.tracks = proposal.tracks.map(({ id, title, order }) => ({ id, title, order }));
  updated.slices = proposal.slices.map((slice) => ({
    id: slice.id,
    track: slice.track,
    kind: slice.kind,
    title: slice.title,
    outcome: slice.outcome,
    justification: slice.justification || null,
    state: "queued",
    order: slice.order,
    priority: slice.priority,
    depends_on: clone(slice.depends_on || []),
    blocking_gates: clone(slice.blocking_gates || []),
    requires_refinement: false,
    refinement_note: null,
    acceptance_checks: (slice.acceptance_checks || []).map(({ id, type, description }) => ({
      id,
      type,
      description,
      status: "pending",
      evidence: []
    })),
    started_at: null,
    closed_at: null,
    checked_revision: null
  }));
  for (const [id, item] of Object.entries(updated.work_items)) {
    const proposed = proposal.work_items[id];
    if (!isObject(proposed)) continue;
    item.primary_slice = proposed.primary_slice || null;
    item.applies_to = clone(proposed.applies_to || []);
    item.existing_build_assessment = clone(
      proposed.existing_build_assessment || item.existing_build_assessment
    );
  }
  return updated;
}

function validateImplementationSpine(spine, { source = null, applicableBlockIds = [] } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(spine)) {
    return { errors: ["_implementation.yaml must contain an object."], warnings, stale: true };
  }
  if (spine.schema_version !== SPINE_SCHEMA_VERSION) {
    errors.push(
      `_implementation.yaml schema_version must be ${SPINE_SCHEMA_VERSION}; found ${spine.schema_version || "missing"}.`
    );
  }
  if (!Number.isInteger(spine.plan_version) || spine.plan_version < 1) {
    errors.push("plan_version must be a positive integer.");
  }
  if (!Number.isInteger(spine.state_revision) || spine.state_revision < 0) {
    errors.push("state_revision must be a non-negative integer.");
  }
  if (!PLAN_STATUSES.has(spine.plan_status)) {
    errors.push(`plan_status is invalid: ${spine.plan_status || "missing"}.`);
  }
  const planning = spine.planning;
  if (!isObject(planning)) {
    errors.push("planning must be an object.");
  } else {
    if (!ADOPTION_MODES.has(planning.adoption_mode)) {
      errors.push(`planning.adoption_mode is invalid: ${planning.adoption_mode || "missing"}.`);
    }
    if (!SYNTHESIS_STATUSES.has(planning.synthesis_status)) {
      errors.push(`planning.synthesis_status is invalid: ${planning.synthesis_status || "missing"}.`);
    }
    if (!Array.isArray(planning.synthesis_basis)) {
      errors.push("planning.synthesis_basis must be an array.");
    } else if (planning.synthesis_status !== "inventory_ready" && planning.synthesis_basis.length === 0) {
      errors.push("A synthesized plan must identify the project-specific direction used as its outcome backbone.");
    } else {
      for (const [index, entry] of planning.synthesis_basis.entries()) {
        if (!isObject(entry) || !text(entry.ref) || !text(entry.role)) {
          errors.push(`planning.synthesis_basis[${index}] must define ref and role.`);
        }
      }
    }
  }
  const mappingRequired = planning?.synthesis_status !== "inventory_ready" || spine.plan_status !== "draft";
  if (!isObject(spine.readiness)) {
    errors.push("readiness must be an object.");
  } else {
    for (const [field, allowed] of [
      ["technical_health", TECHNICAL_HEALTH_STATES],
      ["product_coverage", PRODUCT_COVERAGE_STATES],
      ["external_gates", EXTERNAL_GATE_STATES],
      ["release_readiness", RELEASE_READINESS_STATES]
    ]) {
      if (!allowed.has(spine.readiness[field])) {
        errors.push(`readiness.${field} is invalid: ${spine.readiness[field] || "missing"}.`);
      }
    }
  }

  const tracks = Array.isArray(spine.tracks) ? spine.tracks : [];
  const trackIds = new Set();
  const trackOrders = new Set();
  for (const track of tracks) {
    if (!isObject(track) || !text(track.id)) {
      errors.push("Every track must define an id.");
      continue;
    }
    if (trackIds.has(track.id)) errors.push(`Track ${track.id} is duplicated.`);
    trackIds.add(track.id);
    if (!text(track.title)) errors.push(`Track ${track.id} must define a title.`);
    if (!Number.isInteger(track.order) || track.order < 1) {
      errors.push(`Track ${track.id} must define a positive integer order.`);
    }
    if (trackOrders.has(track.order)) errors.push(`Track order ${track.order} is duplicated.`);
    trackOrders.add(track.order);
  }

  const slices = Array.isArray(spine.slices) ? spine.slices : [];
  const slicesById = new Map();
  const sliceOrders = new Set();
  for (const slice of slices) {
    if (!isObject(slice) || !text(slice.id)) {
      errors.push("Every slice must define an id.");
      continue;
    }
    if (slicesById.has(slice.id)) errors.push(`Slice ${slice.id} is duplicated.`);
    slicesById.set(slice.id, slice);
    if (!trackIds.has(slice.track)) errors.push(`Slice ${slice.id} references unknown track ${slice.track}.`);
    if (!text(slice.title)) errors.push(`Slice ${slice.id} must define a title.`);
    if (!text(slice.outcome)) errors.push(`Slice ${slice.id} must define an observable outcome.`);
    if (!SLICE_KINDS.has(slice.kind)) errors.push(`Slice ${slice.id} has invalid kind ${slice.kind || "missing"}.`);
    if (["foundation", "external_gate"].includes(slice.kind) && !text(slice.justification)) {
      errors.push(`Slice ${slice.id} must justify why it is not an outcome slice.`);
    }
    if (!Number.isInteger(slice.order) || slice.order < 1) {
      errors.push(`Slice ${slice.id} must define a positive integer order.`);
    }
    const orderKey = `${slice.track}:${slice.order}`;
    if (sliceOrders.has(orderKey)) errors.push(`Slice order ${slice.order} is duplicated in track ${slice.track}.`);
    sliceOrders.add(orderKey);
    if (!SLICE_STATES.has(slice.state)) errors.push(`Slice ${slice.id} has invalid state ${slice.state}.`);
    if (!(slice.priority in PRIORITY_ORDER)) {
      errors.push(`Slice ${slice.id} has invalid priority ${slice.priority || "missing"}.`);
    }
    if (!Array.isArray(slice.depends_on)) {
      errors.push(`Slice ${slice.id} depends_on must be an array.`);
    } else {
      for (const dependency of slice.depends_on) {
        if (dependency === slice.id) errors.push(`Slice ${slice.id} cannot depend on itself.`);
      }
    }
    if (mappingRequired && slice.requires_refinement) {
      errors.push(`Slice ${slice.id} still requires semantic refinement.`);
    }
    if (!Array.isArray(slice.acceptance_checks) || slice.acceptance_checks.length === 0) {
      errors.push(`Slice ${slice.id} must define at least one acceptance check.`);
    } else {
      const checkIds = new Set();
      for (const check of slice.acceptance_checks) {
        if (!isObject(check) || !text(check.id)) {
          errors.push(`Slice ${slice.id} has an acceptance check without an id.`);
          continue;
        }
        if (checkIds.has(check.id)) errors.push(`Slice ${slice.id} repeats check ${check.id}.`);
        checkIds.add(check.id);
        if (!EVIDENCE_KINDS.has(check.type)) {
          errors.push(`Acceptance check ${check.id} has invalid type ${check.type || "missing"}.`);
        }
        if (!text(check.description)) errors.push(`Acceptance check ${check.id} needs a description.`);
        if (!ACCEPTANCE_STATES.has(check.status)) {
          errors.push(`Acceptance check ${check.id} has invalid status ${check.status || "missing"}.`);
        }
        validateEvidence(check.evidence || [], `Acceptance check ${check.id} evidence`, errors);
        if (check.status === "passed" && !(check.evidence || []).length) {
          errors.push(`Acceptance check ${check.id} is passed without evidence.`);
        }
      }
    }
  }
  for (const slice of slices) {
    for (const dependency of Array.isArray(slice.depends_on) ? slice.depends_on : []) {
      if (!slicesById.has(dependency)) {
        errors.push(`Slice ${slice.id} references unknown dependency ${dependency}.`);
      }
    }
    if (slice.state === "ready" && !dependenciesSatisfied({ slices }, slice)) {
      errors.push(`Slice ${slice.id} is ready before all dependencies are verified.`);
    }
  }
  const cycle = dependencyCycle(slicesById);
  if (cycle) errors.push(`Slice dependency cycle detected: ${cycle.join(" -> ")}.`);

  const activeSlices = slices.filter((slice) => slice.state === "active");
  if (activeSlices.length > 1) errors.push("Only one slice may be active.");
  if (spine.active_slice) {
    if (!slicesById.has(spine.active_slice)) {
      errors.push(`active_slice references unknown slice ${spine.active_slice}.`);
    } else if (slicesById.get(spine.active_slice).state !== "active") {
      errors.push(`active_slice ${spine.active_slice} is not marked active.`);
    }
  } else if (activeSlices.length) {
    errors.push(`Slice ${activeSlices[0].id} is active but active_slice is empty.`);
  }

  const workItems = isObject(spine.work_items) ? spine.work_items : {};
  const expectedIds = new Set(applicableBlockIds);
  for (const expectedId of expectedIds) {
    if (!workItems[expectedId]) errors.push(`Applicable DNA block ${expectedId} is unmapped.`);
  }
  for (const [id, item] of Object.entries(workItems)) {
    if (!isObject(item)) {
      errors.push(`Work item ${id} must be an object.`);
      continue;
    }
    if (expectedIds.size && !expectedIds.has(id)) warnings.push(`Work item ${id} is no longer applicable.`);
    if (mappingRequired && !slicesById.has(item.primary_slice)) {
      errors.push(`Work item ${id} references unknown primary slice ${item.primary_slice || "none"}.`);
    }
    if (!Array.isArray(item.applies_to)) {
      errors.push(`Work item ${id} applies_to must be an array.`);
    } else {
      if (unique(item.applies_to).length !== item.applies_to.length) {
        errors.push(`Work item ${id} repeats a slice in applies_to.`);
      }
      for (const sliceId of item.applies_to) {
        if (!slicesById.has(sliceId)) errors.push(`Work item ${id} applies to unknown slice ${sliceId}.`);
        if (sliceId === item.primary_slice) errors.push(`Work item ${id} repeats its primary slice in applies_to.`);
      }
    }
    if (!WORK_ITEM_STATES.has(item.state)) {
      errors.push(`Work item ${id} has invalid state ${item.state || "missing"}.`);
    }
    const assessment = item.existing_build_assessment;
    if (!isObject(assessment) || !EXISTING_BUILD_ASSESSMENTS.has(assessment.status)) {
      errors.push(`Work item ${id} has an invalid existing_build_assessment.`);
    } else {
      if (!Array.isArray(assessment.refs)) errors.push(`Work item ${id} assessment refs must be an array.`);
      if (
        planning?.adoption_mode === "existing_build" &&
        mappingRequired &&
        assessment.status === "not_assessed"
      ) {
        errors.push(`Work item ${id} has not been reconciled against the existing build.`);
      }
      if (["partial", "appears_implemented", "appears_verified"].includes(assessment.status)) {
        if (!(assessment.refs || []).length || !text(assessment.note)) {
          errors.push(`Work item ${id} assessment ${assessment.status} needs refs and a concise note.`);
        }
      }
    }
    if (
      item.state === "in_progress" &&
      spine.plan_status !== "draft" &&
      item.primary_slice !== spine.active_slice
    ) {
      errors.push(`Work item ${id} is in progress outside the active slice.`);
    }
    validateEvidence(item.implementation_evidence || [], `${id} implementation_evidence`, errors);
    validateEvidence(item.verification_evidence || [], `${id} verification_evidence`, errors);
    if (["implemented", "verified"].includes(item.state) && !(item.implementation_evidence || []).length) {
      errors.push(`Work item ${id} is ${item.state} without implementation evidence.`);
    }
    if (item.state === "verified") {
      if (!(item.verification_evidence || []).length) {
        errors.push(`Work item ${id} is verified without verification evidence.`);
      }
      if (!text(item.last_checked)) errors.push(`Work item ${id} is verified without last_checked.`);
      if (!text(item.checked_revision)) errors.push(`Work item ${id} is verified without checked_revision.`);
    }
    if (["blocked", "deferred"].includes(item.state)) {
      if (!isObject(item.hold)) {
        errors.push(`Work item ${id} is ${item.state} without a hold.`);
      } else {
        for (const field of ["reason", "reopen_when", "owner"]) {
          if (!text(item.hold[field])) errors.push(`Work item ${id} hold must define ${field}.`);
        }
      }
    }
  }

  for (const slice of slices) {
    const primaryItems = Object.entries(workItems).filter(([, item]) => item.primary_slice === slice.id);
    if (!primaryItems.length) errors.push(`Slice ${slice.id} has no primary DNA blocks.`);
    const owningDocuments = unique(primaryItems.map(([, item]) => item.owning_document).filter(Boolean));
    if (primaryItems.length > 25) warnings.push(`Slice ${slice.id} references ${primaryItems.length} blocks; split or record an override.`);
    if (owningDocuments.length > 10) warnings.push(`Slice ${slice.id} references ${owningDocuments.length} documents; split or record an override.`);
    if (slice.state === "implemented") {
      const open = primaryItems.filter(([, item]) => !["implemented", "verified"].includes(item.state));
      if (open.length) errors.push(`Slice ${slice.id} is implemented while ${open.length} primary work items remain open.`);
    }
    if (slice.state === "verified") {
      const unchecked = primaryItems.filter(([, item]) => item.state !== "verified");
      if (unchecked.length) errors.push(`Slice ${slice.id} is verified while ${unchecked.length} primary work items remain unchecked.`);
      const unpassed = (slice.acceptance_checks || []).filter((check) => check.status !== "passed");
      if (unpassed.length) errors.push(`Slice ${slice.id} is verified with ${unpassed.length} acceptance checks not passed.`);
    }
  }

  if (mappingRequired && slices.length === 0) errors.push("A synthesized plan must contain at least one slice.");
  if (mappingRequired && tracks.length === 0) errors.push("A synthesized plan must contain at least one track.");

  if (["proposal_ready", "reviewed"].includes(planning?.synthesis_status)) {
    const currentFingerprint = proposalFingerprint(spine);
    if (text(planning.proposal_fingerprint) !== currentFingerprint) {
      errors.push("The synthesized proposal changed after validation; run implementation-synthesize again.");
    }
  }
  if (planning?.synthesis_status === "reviewed") {
    if (!text(planning.review?.presented_at) || !text(planning.review?.artifact)) {
      errors.push("The synthesized plan has not been presented in a human-readable review.");
    }
    if (text(planning.review?.proposal_fingerprint) !== proposalFingerprint(spine)) {
      errors.push("The reviewed proposal no longer matches the current plan.");
    }
  }

  if (["approved", "active", "complete"].includes(spine.plan_status)) {
    if (!text(spine.approval?.approved_at) || !text(spine.approval?.approved_by)) {
      errors.push(`Plan status ${spine.plan_status} requires approval metadata.`);
    }
  }
  if (spine.plan_status === "complete") {
    const incompleteSlices = slices.filter((slice) => slice.state !== "verified");
    if (incompleteSlices.length) {
      errors.push(`A complete plan still has ${incompleteSlices.length} unverified slices.`);
    }
  }
  if (spine.readiness?.release_readiness === "ready") {
    const uncheckedItems = Object.values(workItems).filter((item) => item.state !== "verified");
    if (
      spine.plan_status !== "complete" ||
      uncheckedItems.length > 0 ||
      spine.readiness.technical_health !== "passing" ||
      spine.readiness.external_gates !== "clear"
    ) {
      errors.push(
        "Release readiness cannot be ready until the plan is complete, every applicable work item is verified, technical health is passing, and external gates are clear."
      );
    }
  }
  const stale = source ? sourceIsStale(spine, source) : false;
  if (stale) warnings.push("The implementation spine is stale against the accepted North Star or DNA scope.");
  return { errors, warnings, stale };
}

function summarizeImplementationSpine(spine, validation = { errors: [] }) {
  const items = Object.values(spine?.work_items || {});
  const totals = {
    blocks: items.length,
    not_started: 0,
    in_progress: 0,
    implemented: 0,
    verified: 0,
    blocked: 0,
    deferred: 0,
    invalid: validation.errors?.length || 0
  };
  for (const item of items) {
    if (Object.prototype.hasOwnProperty.call(totals, item.state)) totals[item.state] += 1;
  }
  const built = totals.implemented + totals.verified;
  const checked = totals.verified;
  const applicable = totals.blocks;
  const readiness = {
    technical_health: spine?.readiness?.technical_health || "unknown",
    product_coverage:
      applicable > 0 && checked === applicable
        ? "checked"
        : built > 0
          ? "partial"
          : "incomplete",
    external_gates:
      totals.blocked > 0
        ? "blocked"
        : totals.deferred > 0
          ? "open"
          : spine?.readiness?.external_gates || "unknown",
    release_readiness:
      spine?.readiness?.release_readiness === "ready" &&
      (spine?.plan_status !== "complete" ||
        checked !== applicable ||
        totals.blocked > 0 ||
        totals.deferred > 0 ||
        spine?.readiness?.technical_health !== "passing" ||
        spine?.readiness?.external_gates !== "clear")
        ? "not_ready"
        : spine?.readiness?.release_readiness || "not_assessed"
  };
  return {
    totals,
    coverage: {
      applicable,
      built,
      checked,
      underway: totals.in_progress,
      pending_check: totals.implemented,
      not_started: totals.not_started,
      blocked: totals.blocked,
      deferred: totals.deferred,
      invalid: totals.invalid,
      built_pct: applicable ? Math.round((built / applicable) * 100) : 0,
      checked_pct: applicable ? Math.round((checked / applicable) * 100) : 0
    },
    slices: {
      total: Array.isArray(spine?.slices) ? spine.slices.length : 0,
      verified: (spine?.slices || []).filter((slice) => slice.state === "verified").length,
      active: spine?.active_slice || null
    },
    readiness
  };
}

function sliceOrder(spine, left, right) {
  const tracks = new Map((spine.tracks || []).map((track) => [track.id, Number(track.order || 0)]));
  return (
    (tracks.get(left.track) || 0) - (tracks.get(right.track) || 0) ||
    Number(left.order || 0) - Number(right.order || 0) ||
    (PRIORITY_ORDER[left.priority] ?? 2) - (PRIORITY_ORDER[right.priority] ?? 2) ||
    left.id.localeCompare(right.id)
  );
}

function dependenciesSatisfied(spine, slice) {
  const slices = new Map((spine.slices || []).map((entry) => [entry.id, entry]));
  return (slice.depends_on || []).every((id) => slices.get(id)?.state === "verified");
}

function nextImplementationSlice(spine) {
  if (spine.active_slice) return (spine.slices || []).find((slice) => slice.id === spine.active_slice) || null;
  return (spine.slices || [])
    .filter(
      (slice) => ["queued", "ready", "implemented"].includes(slice.state) && dependenciesSatisfied(spine, slice)
    )
    .sort((a, b) => sliceOrder(spine, a, b))[0] || null;
}

function mutate(spine, now, callback) {
  const updated = clone(spine);
  callback(updated);
  updated.state_revision = Number(updated.state_revision || 0) + 1;
  updated.audit = isObject(updated.audit) ? updated.audit : {};
  updated.audit.last_mutation_at = now;
  return updated;
}

function assertMutablePlan(spine, source) {
  if (!["approved", "active"].includes(spine.plan_status)) {
    throw new Error("The implementation plan must be approved before delivery state can change.");
  }
  if (sourceIsStale(spine, source)) {
    throw new Error("The implementation spine is stale. Recompile and review it before continuing.");
  }
}

function finalizeImplementationSynthesis(
  spine,
  { synthesizedBy, revision, now, source, applicableBlockIds }
) {
  if (spine.plan_status !== "draft") throw new Error("Only a draft plan can be synthesized.");
  if (!text(synthesizedBy)) throw new Error("Provide who authored the slice synthesis.");
  if (sourceIsStale(spine, source)) throw new Error("The implementation inventory is stale and must be recompiled.");
  const candidate = clone(spine);
  candidate.planning.synthesis_status = "proposal_ready";
  candidate.planning.synthesized_at = now;
  candidate.planning.synthesized_by = text(synthesizedBy);
  candidate.planning.synthesized_revision = text(revision) || null;
  candidate.planning.review = {
    presented_at: null,
    proposal_fingerprint: null,
    artifact: null
  };
  candidate.planning.proposal_fingerprint = proposalFingerprint(candidate);
  const validation = validateImplementationSpine(candidate, { source, applicableBlockIds });
  if (validation.errors.length) {
    throw new Error(`Slice synthesis is invalid: ${validation.errors.join(" ")}`);
  }
  return mutate(candidate, now, () => {});
}

function markImplementationReview(
  spine,
  { artifact, now, source, applicableBlockIds }
) {
  if (spine.plan_status !== "draft") throw new Error("Only a draft plan can be reviewed.");
  if (spine.planning?.synthesis_status !== "proposal_ready") {
    throw new Error("Run implementation-synthesize before presenting the plan review.");
  }
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  if (validation.errors.length) {
    throw new Error(`Implementation proposal is invalid: ${validation.errors.join(" ")}`);
  }
  return mutate(spine, now, (updated) => {
    updated.planning.synthesis_status = "reviewed";
    updated.planning.review = {
      presented_at: now,
      proposal_fingerprint: proposalFingerprint(updated),
      artifact: text(artifact)
    };
  });
}

function buildImplementationReview(spine, { source, applicableBlockIds, generatedAt }) {
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  const items = Object.entries(spine.work_items || {});
  const assessmentCounts = Object.fromEntries(
    [...EXISTING_BUILD_ASSESSMENTS].map((status) => [
      status,
      items.filter(([, item]) => item.existing_build_assessment?.status === status).length
    ])
  );
  const lines = [
    "# _brainwave Implementation Spine Review",
    "",
    `- Generated: ${generatedAt}`,
    `- Plan version: ${spine.plan_version}`,
    `- Adoption mode: ${spine.planning?.adoption_mode || "unknown"}`,
    `- Applicable DNA blocks: ${items.length}`,
    `- Proposed tracks: ${(spine.tracks || []).length}`,
    `- Proposed slices: ${(spine.slices || []).length}`,
    `- Source revision: ${spine.source?.git_revision || "not recorded"}`,
    "",
    "## What approval means",
    "",
    "Approval accepts this outcome grouping, primary block ownership, cross-cutting applicability, working order, dependencies, gates, and acceptance checks as the delivery roadmap. It does not approve product completion or waive evidence requirements.",
    "",
    "## Synthesis basis",
    "",
    "The proposal must be authored semantically from the accepted North Star and project-specific backbone documents such as user journeys, capability or outcome priorities, delivery phases, acceptance criteria, architecture boundaries, and risk or external-gate direction where those documents exist. DNA document boundaries alone are not slice boundaries.",
    "",
    ...(spine.planning?.synthesis_basis || []).map((entry) => `- ${entry.ref} — ${entry.role}`),
    ""
  ];
  if (spine.planning?.adoption_mode === "existing_build") {
    lines.push(
      "## Existing-build reconciliation",
      "",
      `- Absent: ${assessmentCounts.absent}`,
      `- Partial: ${assessmentCounts.partial}`,
      `- Appears implemented: ${assessmentCounts.appears_implemented}`,
      `- Appears verified: ${assessmentCounts.appears_verified}`,
      `- Not assessed: ${assessmentCounts.not_assessed}`,
      "",
      "These are planning observations, not delivery proof. Slices must still record current implementation and verification evidence through guarded commands.",
      ""
    );
  }
  lines.push("## Proposed working order", "");
  const orderedTracks = [...(spine.tracks || [])].sort(
    (left, right) => Number(left.order) - Number(right.order) || left.id.localeCompare(right.id)
  );
  for (const track of orderedTracks) {
    lines.push(`### ${track.order}. ${track.title} (${track.id})`, "");
    const slices = (spine.slices || [])
      .filter((slice) => slice.track === track.id)
      .sort((left, right) => sliceOrder(spine, left, right));
    for (const slice of slices) {
      const primary = items.filter(([, item]) => item.primary_slice === slice.id).map(([id]) => id);
      const crossCutting = items.filter(([, item]) => item.applies_to?.includes(slice.id)).map(([id]) => id);
      lines.push(
        `#### ${track.order}.${slice.order} ${slice.title} (${slice.id})`,
        "",
        `- Kind: ${slice.kind}`,
        `- Priority: ${slice.priority}`,
        `- Observable outcome: ${slice.outcome}`,
        `- Primary DNA blocks (${primary.length}): ${primary.join(", ")}`,
        `- Cross-cutting DNA blocks (${crossCutting.length}): ${crossCutting.join(", ") || "none"}`,
        `- Dependencies: ${(slice.depends_on || []).join(", ") || "none"}`,
        `- Blocking gates: ${(slice.blocking_gates || []).join(", ") || "none"}`,
        `- Acceptance checks: ${(slice.acceptance_checks || []).map((check) => `${check.id} [${check.type}] ${check.description}`).join(" | ")}`
      );
      if (text(slice.justification)) lines.push(`- Non-outcome justification: ${slice.justification}`);
      lines.push("");
    }
  }
  lines.push("## Validation", "");
  lines.push(...(validation.errors.length ? validation.errors.map((entry) => `- ERROR: ${entry}`) : ["- No structural errors."]));
  lines.push(...validation.warnings.map((entry) => `- WARNING: ${entry}`));
  lines.push(
    "",
    "## Decision",
    "",
    "Review the proposed outcomes and order above. Request corrections if any grouping, ownership, dependency, gate, or check is wrong. Approve only when this is an acceptable working roadmap.",
    "",
    "After explicit approval: `node _brainwave/_engine/brainwave_runner.js implementation-approve <approved-by>`",
    ""
  );
  return lines.join("\n");
}

function approveImplementationSpine(spine, { approvedBy, revision, now, source, applicableBlockIds }) {
  if (spine.plan_status !== "draft") throw new Error("Only a draft implementation plan can be approved.");
  if (spine.planning?.synthesis_status !== "reviewed") {
    throw new Error("Present the human-readable implementation review before requesting approval.");
  }
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  if (validation.errors.length) throw new Error(`Implementation plan is invalid: ${validation.errors.join(" ")}`);
  if (validation.stale) throw new Error("The implementation plan is stale and must be recompiled.");
  if (!text(approvedBy)) throw new Error("Provide who approved the implementation plan.");
  return mutate(spine, now, (updated) => {
    updated.plan_status = "approved";
    updated.approval = {
      approved_at: now,
      approved_by: text(approvedBy),
      git_revision: text(revision) || null
    };
  });
}

function startImplementationSlice(spine, { sliceId, now, source }) {
  assertMutablePlan(spine, source);
  if (spine.active_slice) throw new Error(`Slice ${spine.active_slice} is already active.`);
  const slice = (spine.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) throw new Error(`Unknown implementation slice: ${sliceId}.`);
  if (!["queued", "ready", "implemented", "blocked", "deferred"].includes(slice.state)) {
    throw new Error(`Slice ${sliceId} cannot start from ${slice.state}.`);
  }
  if (!dependenciesSatisfied(spine, slice)) throw new Error(`Slice ${sliceId} has unverified dependencies.`);
  return mutate(spine, now, (updated) => {
    updated.plan_status = "active";
    updated.active_slice = sliceId;
    const target = updated.slices.find((entry) => entry.id === sliceId);
    target.state = "active";
    target.started_at = target.started_at || now;
    for (const item of Object.values(updated.work_items)) {
      if (item.primary_slice === sliceId && item.state === "not_started") item.state = "in_progress";
    }
  });
}

function evidenceEntry({ kind, ref, note }) {
  if (!EVIDENCE_KINDS.has(kind)) throw new Error(`Invalid evidence kind: ${kind || "missing"}.`);
  if (!text(ref)) throw new Error("Evidence must provide a reference.");
  if (!text(note)) throw new Error("Evidence must provide a concise note.");
  if (text(note).length > 240) throw new Error("Evidence note must not exceed 240 characters.");
  return { kind, ref: text(ref), note: text(note) };
}

function recordWorkItemEvidence(
  spine,
  { blockId, targetState, kind, ref, note, revision, now, source }
) {
  assertMutablePlan(spine, source);
  if (!["implemented", "verified"].includes(targetState)) {
    throw new Error("Work-item evidence target must be `implemented` or `verified`.");
  }
  const item = spine.work_items?.[blockId];
  if (!item) throw new Error(`Unknown implementation work item: ${blockId}.`);
  if (item.primary_slice !== spine.active_slice) {
    throw new Error(`Work item ${blockId} does not belong to the active slice.`);
  }
  const entry = evidenceEntry({ kind, ref, note });
  return mutate(spine, now, (updated) => {
    const target = updated.work_items[blockId];
    if (targetState === "implemented") {
      target.implementation_evidence.push(entry);
      target.state = "implemented";
      target.hold = null;
    } else {
      if (!target.implementation_evidence.length) {
        throw new Error(`Work item ${blockId} needs implementation evidence before verification.`);
      }
      target.verification_evidence.push(entry);
      target.state = "verified";
      target.last_checked = now;
      target.checked_revision = text(revision) || null;
      target.hold = null;
    }
  });
}

function holdWorkItem(spine, { blockId, state, reason, reopenWhen, owner, now, source }) {
  assertMutablePlan(spine, source);
  if (!["blocked", "deferred"].includes(state)) {
    throw new Error("A work-item hold must be `blocked` or `deferred`.");
  }
  const item = spine.work_items?.[blockId];
  if (!item) throw new Error(`Unknown implementation work item: ${blockId}.`);
  if (item.primary_slice !== spine.active_slice) {
    throw new Error(`Work item ${blockId} does not belong to the active slice.`);
  }
  for (const [label, value] of [
    ["reason", reason],
    ["reopen condition", reopenWhen],
    ["owner", owner]
  ]) {
    if (!text(value)) throw new Error(`Provide the hold ${label}.`);
  }
  return mutate(spine, now, (updated) => {
    const target = updated.work_items[blockId];
    target.state = state;
    target.hold = { reason: text(reason), reopen_when: text(reopenWhen), owner: text(owner) };
  });
}

function recordAcceptanceCheck(
  spine,
  { sliceId, checkId, status, kind, ref, note, now, source }
) {
  assertMutablePlan(spine, source);
  if (sliceId !== spine.active_slice) throw new Error(`Slice ${sliceId} is not active.`);
  if (!["passed", "failed", "blocked"].includes(status)) {
    throw new Error("Acceptance status must be `passed`, `failed`, or `blocked`.");
  }
  const slice = (spine.slices || []).find((entry) => entry.id === sliceId);
  const check = slice?.acceptance_checks?.find((entry) => entry.id === checkId);
  if (!check) throw new Error(`Unknown acceptance check: ${checkId}.`);
  const entry = evidenceEntry({ kind, ref, note });
  return mutate(spine, now, (updated) => {
    const targetSlice = updated.slices.find((entrySlice) => entrySlice.id === sliceId);
    const targetCheck = targetSlice.acceptance_checks.find((entryCheck) => entryCheck.id === checkId);
    targetCheck.status = status;
    targetCheck.evidence.push(entry);
  });
}

function checkImplementationSlice(spine, sliceId) {
  const slice = (spine.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) throw new Error(`Unknown implementation slice: ${sliceId}.`);
  const items = Object.entries(spine.work_items || {}).filter(([, item]) => item.primary_slice === sliceId);
  const errors = [];
  for (const [id, item] of items) {
    if (["implemented", "verified"].includes(item.state) && !item.implementation_evidence?.length) {
      errors.push(`${id} has no implementation evidence.`);
    }
    if (item.state === "verified") {
      if (!item.verification_evidence?.length) errors.push(`${id} has no verification evidence.`);
      if (!text(item.checked_revision)) errors.push(`${id} has no checked revision.`);
    }
  }
  const pendingChecks = (slice.acceptance_checks || []).filter((check) => check.status !== "passed");
  return {
    slice,
    work_items: items.map(([id, item]) => ({ id, ...item })),
    errors,
    pending_checks: pendingChecks
  };
}

function closeImplementationSlice(spine, { sliceId, revision, now, source }) {
  assertMutablePlan(spine, source);
  if (sliceId !== spine.active_slice) throw new Error(`Slice ${sliceId} is not active.`);
  const check = checkImplementationSlice(spine, sliceId);
  if (check.errors.length) throw new Error(`Slice ${sliceId} evidence is invalid: ${check.errors.join(" ")}`);
  const states = check.work_items.map((item) => item.state);
  let targetState;
  if (states.some((state) => state === "blocked")) targetState = "blocked";
  else if (states.some((state) => state === "deferred")) targetState = "deferred";
  else if (states.every((state) => state === "verified") && check.pending_checks.length === 0) {
    targetState = "verified";
  } else if (states.every((state) => ["implemented", "verified"].includes(state))) {
    targetState = "implemented";
  } else {
    throw new Error(`Slice ${sliceId} still has open work items.`);
  }
  return mutate(spine, now, (updated) => {
    const target = updated.slices.find((entry) => entry.id === sliceId);
    target.state = targetState;
    target.closed_at = now;
    target.checked_revision = text(revision) || null;
    updated.active_slice = null;
    const allVerified = updated.slices.every((entry) => entry.state === "verified");
    updated.plan_status = allVerified ? "complete" : "active";
    updated.readiness.product_coverage = allVerified ? "checked" : "incomplete";
  });
}

function previousImplementationSlice(spine) {
  return (spine.slices || [])
    .filter((slice) => text(slice.closed_at))
    .sort((a, b) => String(b.closed_at).localeCompare(String(a.closed_at)))[0] || null;
}

function implementationContextPayload(spine, { source, applicableBlockIds, sliceOverride = null } = {}) {
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  const summary = summarizeImplementationSpine(spine, validation);
  const selectedSlice = sliceOverride
    ? (spine.slices || []).find((slice) => slice.id === sliceOverride) || null
    : ["approved", "active", "complete"].includes(spine.plan_status)
      ? nextImplementationSlice(spine)
      : null;
  const workItems = selectedSlice
    ? Object.entries(spine.work_items || {})
        .filter(([, item]) => item.primary_slice === selectedSlice.id || item.applies_to?.includes(selectedSlice.id))
        .map(([id, item]) => ({
          id,
          title: item.title,
          state: item.state,
          primary: item.primary_slice === selectedSlice.id,
          owning_document: item.owning_document,
          hold: item.hold || null
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];
  const previous = previousImplementationSlice(spine);
  const exactNextCommand = validation.stale
    ? "Run implementation-compile, repeat slice synthesis and review, and obtain approval before continuing."
    : validation.errors.length
      ? "Resolve the reported spine validation errors before delivery work."
      : spine.plan_status === "draft"
        ? spine.planning?.synthesis_status === "inventory_ready"
          ? "Inspect the accepted product direction and, for existing-build adoption, the current code and tests. Complete _implementation_proposal.yaml with outcome-led slices and mappings, then run implementation-synthesize <authored-by>."
          : spine.planning?.synthesis_status === "proposal_ready"
            ? "Run implementation-review and present _implementation_review.md before asking for approval."
            : "Present the generated implementation review, resolve requested changes through a new synthesis/review pass, or obtain explicit approval and run implementation-approve <approved-by>."
        : !selectedSlice
          ? "No ready slice. Review blockers, dependencies, or plan completion."
          : spine.active_slice === selectedSlice.id
            ? `Continue ${selectedSlice.id}; record evidence, run implementation-check ${selectedSlice.id}, then implementation-close ${selectedSlice.id}.`
            : `node _brainwave/_engine/brainwave_runner.js implementation-start ${selectedSlice.id}`;
  return {
    schema_version: spine.schema_version,
    plan_version: spine.plan_version,
    state_revision: spine.state_revision,
    plan_status: spine.plan_status,
    planning: clone(spine.planning || {}),
    source_git_revision: spine.source?.git_revision || null,
    source_stale: validation.stale,
    validation_errors: validation.errors,
    validation_warnings: validation.warnings,
    coverage: summary.coverage,
    readiness: summary.readiness,
    previous_slice: previous
      ? { id: previous.id, title: previous.title, state: previous.state, checked_revision: previous.checked_revision }
      : null,
    current_or_next_slice: selectedSlice
      ? {
          id: selectedSlice.id,
          title: selectedSlice.title,
          outcome: selectedSlice.outcome,
          state: selectedSlice.state,
          priority: selectedSlice.priority,
          depends_on: selectedSlice.depends_on || [],
          blocking_gates: selectedSlice.blocking_gates || [],
          acceptance_checks: selectedSlice.acceptance_checks || []
        }
      : null,
    work_items: workItems,
    owning_documents: unique(workItems.map((item) => item.owning_document).filter(Boolean)),
    exact_next_command: exactNextCommand
  };
}

function formatImplementationContext(payload) {
  const coverage = payload.coverage || {};
  const lines = [
    `_brainwave implementation spine v${payload.plan_version}, state ${payload.state_revision} (${payload.plan_status}).`,
    `Planning: ${payload.planning?.synthesis_status || "unknown"}; adoption mode ${payload.planning?.adoption_mode || "unknown"}.`,
    `DNA direction coverage: built ${coverage.built || 0}/${coverage.applicable || 0}; checked ${coverage.checked || 0}/${coverage.applicable || 0}; blocked ${coverage.blocked || 0}; deferred ${coverage.deferred || 0}.`
  ];
  if (payload.readiness) {
    lines.push(
      `Separate gates: technical health ${payload.readiness.technical_health}; product coverage ${payload.readiness.product_coverage}; external gates ${payload.readiness.external_gates}; release readiness ${payload.readiness.release_readiness}.`
    );
  }
  if (payload.source_stale) lines.push("STOP: the spine is stale against the accepted North Star or DNA scope.");
  if (payload.validation_errors?.length) {
    lines.push(`STOP: ${payload.validation_errors.length} spine validation error(s). Run implementation-check before delivery work.`);
  }
  if (payload.previous_slice) {
    lines.push(
      `Previous: ${payload.previous_slice.id} - ${payload.previous_slice.title} (${payload.previous_slice.state}, ${payload.previous_slice.checked_revision || "revision not recorded"}).`
    );
  }
  const slice = payload.current_or_next_slice;
  if (slice) {
    lines.push(`Current/next: ${slice.id} - ${slice.title} [${slice.state}, ${slice.priority}].`);
    lines.push(`Outcome: ${slice.outcome}`);
    if (slice.depends_on.length) lines.push(`Dependencies: ${slice.depends_on.join(", ")}.`);
    if (slice.blocking_gates.length) lines.push(`Gates: ${slice.blocking_gates.join(", ")}.`);
    lines.push(
      `DNA blocks: ${payload.work_items.map((item) => `${item.id} (${item.state})`).join(", ") || "none"}.`
    );
    lines.push(`Read only: ${payload.owning_documents.join(", ") || "no owning documents"}.`);
    lines.push(
      `Acceptance: ${slice.acceptance_checks.map((check) => `${check.id} ${check.status} - ${check.description}`).join(" | ") || "none"}.`
    );
  }
  lines.push(`Next command: ${payload.exact_next_command}`);
  return lines.join("\n");
}

function buildImplementationAudit(spine, { source, applicableBlockIds, currentRevision, generatedAt }) {
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  const summary = summarizeImplementationSpine(spine, validation);
  const packets = (spine.slices || []).map((slice) =>
    formatImplementationContext(
      implementationContextPayload(spine, { source, applicableBlockIds, sliceOverride: slice.id })
    )
  );
  const maxPacket = packets.reduce((maximum, packet) => Math.max(maximum, packet.length), 0);
  const attempted = (spine.slices || []).filter((slice) => slice.started_at).length;
  const completed = (spine.slices || []).filter((slice) => slice.state === "verified").length;
  const recommendation = validation.errors.length
    ? "revise"
    : summary.coverage.applicable > 0 && summary.coverage.checked === summary.coverage.applicable
      ? "adopt"
      : "continue_experiment";
  return [
    "# _brainwave Implementation Spine Audit",
    "",
    `- Generated: ${generatedAt}`,
    `- Schema version: ${spine.schema_version}`,
    `- Plan version: ${spine.plan_version}`,
    `- State revision: ${spine.state_revision}`,
    `- Experiment start revision: ${spine.source?.git_revision || "not recorded"}`,
    `- Audit revision: ${currentRevision || "not recorded"}`,
    `- Plan status: ${spine.plan_status}`,
    `- Recommendation: ${recommendation}`,
    "",
    "## Coverage",
    "",
    `- Applicable blocks: ${summary.coverage.applicable}`,
    `- Implemented or verified: ${summary.coverage.built}`,
    `- Verified: ${summary.coverage.checked}`,
    `- Blocked: ${summary.coverage.blocked}`,
    `- Deferred: ${summary.coverage.deferred}`,
    `- Invalid conditions: ${summary.coverage.invalid}`,
    "",
    "## Execution",
    "",
    `- Slices attempted: ${attempted}`,
    `- Slices verified: ${completed}`,
    `- Largest generated context packet: ${maxPacket} characters`,
    `- Rejected transitions recorded: ${Number(spine.audit?.rejected_transitions || 0)}`,
    `- Source state: ${validation.stale ? "stale" : "current"}`,
    "",
    "## Validation",
    "",
    ...(validation.errors.length ? validation.errors.map((error) => `- ERROR: ${error}`) : ["- No structural errors."]),
    ...validation.warnings.map((warning) => `- WARNING: ${warning}`),
    "",
    "## Human review",
    "",
    "- Human interventions and reasons: Not yet recorded.",
    "- Fresh-context audit result: Not yet recorded.",
    ""
  ].join("\n");
}

function recordRejectedTransition(spine, now) {
  return mutate(spine, now, (updated) => {
    updated.audit = isObject(updated.audit) ? updated.audit : {};
    updated.audit.rejected_transitions = Number(updated.audit.rejected_transitions || 0) + 1;
  });
}

module.exports = {
  SPINE_SCHEMA_VERSION,
  buildImplementationSpine,
  buildImplementationProposalTemplate,
  applyImplementationProposal,
  validateImplementationSpine,
  summarizeImplementationSpine,
  nextImplementationSlice,
  proposalFingerprint,
  finalizeImplementationSynthesis,
  markImplementationReview,
  buildImplementationReview,
  approveImplementationSpine,
  startImplementationSlice,
  recordWorkItemEvidence,
  holdWorkItem,
  recordAcceptanceCheck,
  checkImplementationSlice,
  closeImplementationSlice,
  implementationContextPayload,
  formatImplementationContext,
  buildImplementationAudit,
  recordRejectedTransition,
  sourceIsStale
};

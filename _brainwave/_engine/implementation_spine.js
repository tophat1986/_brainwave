"use strict";

const SPINE_SCHEMA_VERSION = "0.1.0";
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

function safeIdPart(value) {
  return String(value || "")
    .replace(/^_DNA-/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
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

function defaultTrack(block) {
  const moduleCode = safeIdPart(block.module_id || "GENERAL");
  return {
    id: `TRACK-${moduleCode}`,
    title: block.module_name || block.module_id || "Implementation",
    order: 100
  };
}

function defaultSlice(block) {
  const documentPart = safeIdPart(block.document_id || block.id.split(".")[0]);
  const id = `SLICE-${documentPart}`;
  return {
    id,
    track: defaultTrack(block).id,
    title: block.document_title || block.document_id || "Implementation slice",
    outcome: `Implement and verify the accepted direction in ${block.document_title || block.document_id}.`,
    state: "queued",
    priority: "normal",
    depends_on: [],
    blocking_gates: [],
    requires_refinement: true,
    refinement_note:
      "Replace this document-based draft with a coherent journey or outcome slice before approval.",
    acceptance_checks: [
      {
        id: `${id}-AC01`,
        type: "inspection",
        description: "Verify the implemented outcome against every referenced DNA direction.",
        status: "pending",
        evidence: []
      }
    ],
    started_at: null,
    closed_at: null,
    checked_revision: null
  };
}

function defaultWorkItem(block) {
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
    primary_slice: defaultSlice(block).id,
    applies_to: [],
    state,
    implementation_evidence: implementationEvidence,
    verification_evidence: verificationEvidence,
    last_checked: text(block.legacy_last_checked) || null,
    checked_revision: text(block.legacy_checked_revision) || null,
    hold: null,
    imported_legacy_status: text(block.legacy_delivery_status) || null
  };
}

function buildImplementationSpine({ source, blocks, existing = null, now }) {
  const applicableBlocks = applicableDirectionBlocks(blocks);
  const tracksById = new Map();
  const slicesById = new Map();
  const workItems = {};

  for (const block of applicableBlocks) {
    const track = defaultTrack(block);
    const slice = defaultSlice(block);
    tracksById.set(track.id, track);
    slicesById.set(slice.id, slice);
    workItems[block.id] = defaultWorkItem(block);
  }

  if (isObject(existing)) {
    const existingTracks = new Map(
      (Array.isArray(existing.tracks) ? existing.tracks : [])
        .filter((track) => text(track.id))
        .map((track) => [track.id, clone(track)])
    );
    const existingSlices = new Map(
      (Array.isArray(existing.slices) ? existing.slices : [])
        .filter((slice) => text(slice.id))
        .map((slice) => [slice.id, clone(slice)])
    );

    for (const [id, item] of Object.entries(workItems)) {
      const previous = existing.work_items?.[id];
      if (!isObject(previous)) continue;
      const preservedSlice = existingSlices.get(previous.primary_slice);
      workItems[id] = {
        ...item,
        ...clone(previous),
        title: item.title,
        module_id: item.module_id,
        document_id: item.document_id,
        document_title: item.document_title,
        owning_document: item.owning_document
      };
      if (preservedSlice) {
        slicesById.set(preservedSlice.id, preservedSlice);
        const preservedTrack = existingTracks.get(preservedSlice.track);
        if (preservedTrack) tracksById.set(preservedTrack.id, preservedTrack);
      }
    }
  }

  const usedSliceIds = new Set(Object.values(workItems).map((item) => item.primary_slice));
  const slices = [...slicesById.values()]
    .filter((slice) => usedSliceIds.has(slice.id))
    .sort((a, b) => text(a.id).localeCompare(text(b.id)));
  const usedTrackIds = new Set(slices.map((slice) => slice.track));
  const tracks = [...tracksById.values()]
    .filter((track) => usedTrackIds.has(track.id))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.id.localeCompare(b.id));

  const priorPlanVersion = Number(existing?.plan_version || 0);
  const priorStateRevision = Number(existing?.state_revision || 0);
  return {
    schema_version: SPINE_SCHEMA_VERSION,
    plan_version: priorPlanVersion > 0 ? priorPlanVersion + 1 : 1,
    state_revision: priorStateRevision > 0 ? priorStateRevision + 1 : 0,
    plan_status: "draft",
    source: clone(source),
    approval: { approved_at: null, approved_by: null, git_revision: null },
    active_slice: null,
    readiness: {
      technical_health: "unknown",
      product_coverage: applicableBlocks.length ? "incomplete" : "not_assessed",
      external_gates: "unknown",
      release_readiness: "not_assessed"
    },
    tracks,
    slices,
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
  for (const track of tracks) {
    if (!isObject(track) || !text(track.id)) {
      errors.push("Every track must define an id.");
      continue;
    }
    if (trackIds.has(track.id)) errors.push(`Track ${track.id} is duplicated.`);
    trackIds.add(track.id);
    if (!text(track.title)) errors.push(`Track ${track.id} must define a title.`);
  }

  const slices = Array.isArray(spine.slices) ? spine.slices : [];
  const slicesById = new Map();
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
    if (slice.requires_refinement && spine.plan_status !== "draft") {
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
    if (!slicesById.has(item.primary_slice)) {
      errors.push(`Work item ${id} references unknown primary slice ${item.primary_slice}.`);
    }
    if (!Array.isArray(item.applies_to)) {
      errors.push(`Work item ${id} applies_to must be an array.`);
    } else {
      for (const sliceId of item.applies_to) {
        if (!slicesById.has(sliceId)) errors.push(`Work item ${id} applies to unknown slice ${sliceId}.`);
        if (sliceId === item.primary_slice) errors.push(`Work item ${id} repeats its primary slice in applies_to.`);
      }
    }
    if (!WORK_ITEM_STATES.has(item.state)) {
      errors.push(`Work item ${id} has invalid state ${item.state || "missing"}.`);
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
    (PRIORITY_ORDER[left.priority] ?? 2) - (PRIORITY_ORDER[right.priority] ?? 2) ||
    (tracks.get(left.track) || 0) - (tracks.get(right.track) || 0) ||
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

function approveImplementationSpine(spine, { approvedBy, revision, now, source, applicableBlockIds }) {
  if (spine.plan_status !== "draft") throw new Error("Only a draft implementation plan can be approved.");
  const validation = validateImplementationSpine(spine, { source, applicableBlockIds });
  if (validation.errors.length) throw new Error(`Implementation plan is invalid: ${validation.errors.join(" ")}`);
  if (validation.stale) throw new Error("The implementation plan is stale and must be recompiled.");
  if ((spine.slices || []).some((slice) => slice.requires_refinement)) {
    throw new Error("Every generated slice must be semantically refined before approval.");
  }
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
    : nextImplementationSlice(spine);
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
    ? "Run implementation-compile, refine the changed plan, and obtain approval before continuing."
    : validation.errors.length
      ? "Resolve the reported spine validation errors before delivery work."
      : spine.plan_status === "draft"
        ? "Refine the provisional slices, obtain explicit user approval, then run implementation-approve <approved-by>."
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
  validateImplementationSpine,
  summarizeImplementationSpine,
  nextImplementationSlice,
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

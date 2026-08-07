"use strict";

const crypto = require("node:crypto");

const ASSURANCE_PACKET_VERSION = "0.1.0";
const ASSURANCE_PACKET_MAX_CHARS = 12000;
const ASSURANCE_MAX_FINDINGS_PER_REVIEW = 25;
const ASSURANCE_MAX_LIVE_FINDINGS = 100;

const ASSURANCE_PROFILE_CATALOG = Object.freeze({
  product_direction: Object.freeze({ title: "Product direction", methods: ["inspection", "external_review"] }),
  experience: Object.freeze({ title: "Product experience", methods: ["inspection", "integration", "end_to_end", "render_review", "external_review"] }),
  accessibility: Object.freeze({ title: "Accessibility", methods: ["inspection", "integration", "end_to_end", "render_review", "external_review"] }),
  content_integrity: Object.freeze({ title: "Content integrity", methods: ["inspection", "integration", "end_to_end", "render_review", "external_review"] }),
  brand: Object.freeze({ title: "Brand", methods: ["inspection", "render_review", "external_review"] }),
  software_quality: Object.freeze({ title: "Software quality", methods: ["inspection", "unit", "property", "integration", "contract", "end_to_end", "benchmark", "load_test", "migration_rehearsal", "reconciliation", "recovery_exercise", "external_review"] }),
  security: Object.freeze({ title: "Security", methods: ["inspection", "unit", "property", "integration", "contract", "end_to_end", "security_assessment", "external_review"] }),
  data: Object.freeze({ title: "Data integrity", methods: ["inspection", "unit", "property", "integration", "contract", "migration_rehearsal", "reconciliation", "external_review"] }),
  performance: Object.freeze({ title: "Performance", methods: ["inspection", "integration", "end_to_end", "benchmark", "load_test", "external_review"] }),
  reliability: Object.freeze({ title: "Reliability", methods: ["inspection", "unit", "property", "integration", "end_to_end", "recovery_exercise", "external_review"] }),
  commercial_validity: Object.freeze({ title: "Commercial validity", methods: ["inspection", "integration", "end_to_end", "external_review"] }),
  growth_integrity: Object.freeze({ title: "Growth integrity", methods: ["inspection", "integration", "end_to_end", "external_review"] }),
  legal_review: Object.freeze({ title: "Legal review", methods: ["inspection", "external_review"] }),
  service_operations: Object.freeze({ title: "Service operations", methods: ["inspection", "integration", "end_to_end", "benchmark", "load_test", "recovery_exercise", "external_review"] }),
  specialist_review: Object.freeze({ title: "Specialist review", methods: ["inspection", "external_review"] })
});
const ASSURANCE_PROFILE_LEVEL_CONTRACTS = Object.freeze({
  product_direction: Object.freeze({
    direction: Object.freeze({ required_methods: ["inspection"], review: "self_allowed" })
  }),
  experience: Object.freeze({
    component: Object.freeze({ required_methods: ["render_review"], review: "self_allowed" }),
    surface: Object.freeze({ required_methods: ["render_review", "end_to_end"], review: "self_allowed" }),
    journey: Object.freeze({ required_methods: ["render_review", "end_to_end"], review: "fresh_context_required" })
  }),
  accessibility: Object.freeze({
    component: Object.freeze({ required_methods: ["integration"], review: "self_allowed" }),
    surface: Object.freeze({ required_methods: ["end_to_end"], review: "self_allowed" }),
    journey: Object.freeze({ required_methods: ["end_to_end"], review: "fresh_context_required" })
  }),
  content_integrity: Object.freeze({
    surface: Object.freeze({ required_methods: ["inspection"], review: "self_allowed" }),
    journey: Object.freeze({ required_methods: ["end_to_end"], review: "fresh_context_required" })
  }),
  brand: Object.freeze({
    identity: Object.freeze({ required_methods: ["inspection"], review: "self_allowed" }),
    surface: Object.freeze({ required_methods: ["render_review"], review: "self_allowed" })
  }),
  software_quality: Object.freeze({
    slice: Object.freeze({ required_methods: ["inspection"], review: "self_allowed" }),
    logic: Object.freeze({ required_methods: ["unit"], review: "self_allowed" }),
    boundary: Object.freeze({ required_methods: ["integration"], review: "self_allowed" }),
    outcome: Object.freeze({ required_methods: ["end_to_end"], review: "self_allowed" })
  }),
  security: Object.freeze({
    boundary: Object.freeze({ required_methods: ["security_assessment"], review: "fresh_context_required" }),
    release: Object.freeze({ required_methods: ["security_assessment", "external_review"], review: "fresh_context_required" })
  }),
  data: Object.freeze({
    invariant: Object.freeze({ required_methods: ["unit"], review: "self_allowed" }),
    boundary: Object.freeze({ required_methods: ["integration"], review: "self_allowed" }),
    migration: Object.freeze({ required_methods: ["migration_rehearsal", "reconciliation"], review: "fresh_context_required" })
  }),
  performance: Object.freeze({
    request_path: Object.freeze({ required_methods: ["benchmark"], review: "self_allowed" }),
    load: Object.freeze({ required_methods: ["load_test"], review: "self_allowed" })
  }),
  reliability: Object.freeze({
    recovery: Object.freeze({ required_methods: ["recovery_exercise"], review: "self_allowed" })
  }),
  commercial_validity: Object.freeze({
    calculation: Object.freeze({ required_methods: ["unit"], review: "self_allowed" }),
    entitlement: Object.freeze({ required_methods: ["integration"], review: "self_allowed" }),
    outcome: Object.freeze({ required_methods: ["end_to_end"], review: "self_allowed" })
  }),
  growth_integrity: Object.freeze({
    measurement: Object.freeze({ required_methods: ["integration"], review: "self_allowed" }),
    journey: Object.freeze({ required_methods: ["end_to_end"], review: "fresh_context_required" })
  }),
  legal_review: Object.freeze({
    qualified: Object.freeze({ required_methods: ["external_review"], review: "fresh_context_required" })
  }),
  service_operations: Object.freeze({
    operation: Object.freeze({ required_methods: ["inspection"], review: "self_allowed" }),
    recovery: Object.freeze({ required_methods: ["recovery_exercise"], review: "self_allowed" })
  }),
  specialist_review: Object.freeze({
    qualified: Object.freeze({ required_methods: ["external_review"], review: "fresh_context_required" })
  })
});
const ASSURANCE_METHOD_EVIDENCE_CONTRACTS = Object.freeze({
  inspection: Object.freeze(["inspection_record"]),
  unit: Object.freeze(["test_report"]),
  property: Object.freeze(["test_report"]),
  integration: Object.freeze(["test_report"]),
  contract: Object.freeze(["test_report"]),
  end_to_end: Object.freeze(["journey_trace"]),
  render_review: Object.freeze(["rendered_surface"]),
  benchmark: Object.freeze(["benchmark_report"]),
  load_test: Object.freeze(["benchmark_report"]),
  security_assessment: Object.freeze(["security_report"]),
  migration_rehearsal: Object.freeze(["migration_report"]),
  reconciliation: Object.freeze(["reconciliation_report"]),
  recovery_exercise: Object.freeze(["recovery_report"]),
  external_review: Object.freeze(["external_review"])
});
const ASSURANCE_ORDERED_LEVELS = Object.freeze({
  experience: Object.freeze(["component", "surface", "journey"]),
  accessibility: Object.freeze(["component", "surface", "journey"]),
  content_integrity: Object.freeze(["surface", "journey"])
});
const ASSURANCE_PROFILE_IDS = Object.freeze(Object.keys(ASSURANCE_PROFILE_CATALOG));
const ASSURANCE_METHOD_IDS = Object.freeze([
  "inspection",
  "unit",
  "property",
  "integration",
  "contract",
  "end_to_end",
  "render_review",
  "benchmark",
  "load_test",
  "security_assessment",
  "migration_rehearsal",
  "reconciliation",
  "recovery_exercise",
  "external_review"
]);
const ASSURANCE_EVIDENCE_KIND_IDS = Object.freeze([
  "inspection_record",
  "test_report",
  "rendered_surface",
  "journey_trace",
  "benchmark_report",
  "security_report",
  "migration_report",
  "reconciliation_report",
  "recovery_report",
  "review_record",
  "external_review"
]);
const ASSURANCE_REVIEW_REQUIREMENTS = Object.freeze(["self_allowed", "fresh_context_required"]);
const ASSURANCE_APPROVAL_REQUIREMENTS = Object.freeze(["none", "human", "specialist"]);
const ASSURANCE_FINDING_STATUSES = Object.freeze([
  "open",
  "recheck_required",
  "resolved",
  "needs_reconciliation"
]);
const ASSURANCE_CHECK_STATES = Object.freeze(["pending", "passed", "failed", "blocked"]);

const PROFILE_SET = new Set(ASSURANCE_PROFILE_IDS);
const METHOD_SET = new Set(ASSURANCE_METHOD_IDS);
const EVIDENCE_KIND_SET = new Set(ASSURANCE_EVIDENCE_KIND_IDS);
const REVIEW_REQUIREMENT_SET = new Set(ASSURANCE_REVIEW_REQUIREMENTS);
const APPROVAL_REQUIREMENT_SET = new Set(ASSURANCE_APPROVAL_REQUIREMENTS);
const FINDING_STATUS_SET = new Set(ASSURANCE_FINDING_STATUSES);
const CHECK_STATE_SET = new Set(ASSURANCE_CHECK_STATES);
const REVIEWER_MODES = new Set(["self", "fresh_context_ai", "human", "specialist", "external"]);
const FINDING_KINDS = new Set(["defect", "omission", "scope"]);
const FINDING_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const EXPERIENCE_TOOLING_PROFILES = new Set(["experience", "accessibility", "brand", "content_integrity"]);
const RESOLVED_TOOLING_DECISIONS = new Set(["selected", "declined", "not_applicable"]);

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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/i.test(text(value));
}

function isRegisteredAssuranceProfile(id) {
  const value = text(id);
  return PROFILE_SET.has(value);
}

function isRegisteredAssuranceLevel(profile, level) {
  return Boolean(ASSURANCE_PROFILE_LEVEL_CONTRACTS[text(profile)]?.[text(level)]);
}

function assuranceLevelSatisfies(profile, actual, minimum) {
  const profileId = text(profile);
  const actualLevel = text(actual);
  const minimumLevel = text(minimum);
  if (!isRegisteredAssuranceLevel(profileId, actualLevel) || !isRegisteredAssuranceLevel(profileId, minimumLevel)) {
    return false;
  }
  const order = ASSURANCE_ORDERED_LEVELS[profileId];
  if (!order) return actualLevel === minimumLevel;
  return order.indexOf(actualLevel) >= order.indexOf(minimumLevel);
}

function assuranceProfileTitle(id) {
  const value = text(id);
  if (ASSURANCE_PROFILE_CATALOG[value]) return ASSURANCE_PROFILE_CATALOG[value].title;
  return value.includes(":") ? value.split(":").at(-1).replace(/[_-]+/g, " ") : value;
}

function isRegisteredAssuranceMethod(id) {
  return METHOD_SET.has(text(id));
}

function isRegisteredAssuranceEvidenceKind(id) {
  return EVIDENCE_KIND_SET.has(text(id));
}

function experienceToolingErrors(tooling) {
  if (!isObject(tooling)) return ["Experience assurance tooling decisions must be recorded before preparing review."];
  const errors = [];
  for (const key of ["component_ui", "browser_journey"]) {
    const decision = tooling[key];
    if (!isObject(decision) || !RESOLVED_TOOLING_DECISIONS.has(text(decision.decision))) {
      errors.push(`Experience assurance tooling ${key} must be selected, declined, or not_applicable.`);
      continue;
    }
    if (decision.decision === "selected") {
      if (!text(decision.adapter)) errors.push(`Selected experience assurance tooling ${key} must name an adapter.`);
      if (!Array.isArray(decision.capabilities) || decision.capabilities.length === 0 || decision.capabilities.some((entry) => !text(entry))) {
        errors.push(`Selected experience assurance tooling ${key} must define at least one capability.`);
      }
    } else if (!text(decision.note)) {
      errors.push(`Experience assurance tooling ${key} decision ${decision.decision} must include a concise note.`);
    }
  }
  return errors;
}

function createAssuranceRoot(existing = null, { recompile = false } = {}) {
  const findings = {};
  if (isObject(existing?.findings)) {
    for (const [id, finding] of Object.entries(existing.findings)) {
      if (!isObject(finding)) continue;
      const copied = clone(finding);
      if (recompile && ["open", "recheck_required"].includes(copied.status)) {
        copied.status = "needs_reconciliation";
      }
      findings[id] = copied;
    }
  }
  const maximumId = Object.keys(findings).reduce((maximum, id) => {
    const match = /^QF-(\d+)$/.exec(id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return {
    next_finding_number: Math.max(Number(existing?.next_finding_number || 1), maximumId + 1),
    active_packet: null,
    findings,
    resolved_count: Number(existing?.resolved_count || 0)
  };
}

function gateProfileIds(gate) {
  return isObject(gate?.profiles) ? Object.keys(gate.profiles) : [];
}

function validateAssuranceGate(gate, { requiredProfiles = [] } = {}) {
  const errors = [];
  if (!isObject(gate)) return ["assurance_gate must be an object."];
  if (!isObject(gate.profiles) || Object.keys(gate.profiles).length === 0) {
    errors.push("assurance_gate.profiles must contain at least one profile.");
  } else {
    for (const [profile, contract] of Object.entries(gate.profiles)) {
      if (!isRegisteredAssuranceProfile(profile)) {
        errors.push(`assurance_gate has unregistered profile ${profile}.`);
      }
      if (!isObject(contract)) {
        errors.push(`assurance_gate profile ${profile} must define a contract.`);
        continue;
      }
      const level = text(contract.level);
      const levelContract = ASSURANCE_PROFILE_LEVEL_CONTRACTS[profile]?.[level];
      if (!level) errors.push(`assurance_gate profile ${profile} must define level.`);
      else if (!levelContract) {
        errors.push(`assurance_gate profile ${profile} has invalid level ${level}.`);
      }
      if (!REVIEW_REQUIREMENT_SET.has(contract.review)) {
        errors.push(`assurance_gate profile ${profile} has invalid review ${contract.review || "missing"}.`);
      } else if (levelContract?.review === "fresh_context_required" && contract.review !== "fresh_context_required") {
        errors.push(`assurance_gate profile ${profile} level ${level} requires fresh_context_required review.`);
      }
    }
  }
  if (!APPROVAL_REQUIREMENT_SET.has(gate.approval)) {
    errors.push(`assurance_gate approval is invalid: ${gate.approval || "missing"}.`);
  }
  if (!Array.isArray(gate.references)) {
    errors.push("assurance_gate.references must be an array.");
  } else {
    if (gate.references.length > 3) errors.push("assurance_gate.references must contain no more than 3 records.");
    if (unique(gate.references).length !== gate.references.length) {
      errors.push("assurance_gate.references must not repeat records.");
    }
    for (const ref of gate.references) {
      if (!text(ref)) errors.push("assurance_gate.references must contain non-empty reference IDs.");
    }
  }
  const available = new Set(gateProfileIds(gate));
  for (const profile of unique(requiredProfiles)) {
    if (!available.has(profile)) errors.push(`assurance_gate omits inherited profile ${profile}.`);
  }
  return errors;
}

function validateReviewer(reviewer, label, errors) {
  if (!isObject(reviewer)) {
    errors.push(`${label} must define reviewer provenance.`);
    return;
  }
  if (!REVIEWER_MODES.has(reviewer.mode)) errors.push(`${label} has invalid reviewer mode ${reviewer.mode || "missing"}.`);
  if (!text(reviewer.ref)) errors.push(`${label} reviewer must define ref.`);
}

function validateAssuranceEvidence(entries, label, errors, { revision = null } = {}) {
  if (!Array.isArray(entries)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  for (const [index, entry] of entries.entries()) {
    const entryLabel = `${label}[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${entryLabel} must be an object.`);
      continue;
    }
    if (!isRegisteredAssuranceEvidenceKind(entry.kind)) {
      errors.push(`${entryLabel} has invalid kind ${entry.kind || "missing"}.`);
    }
    if (!text(entry.ref)) errors.push(`${entryLabel} must define ref.`);
    if (!text(entry.note)) errors.push(`${entryLabel} must define a concise note.`);
    if (text(entry.note).length > 240) errors.push(`${entryLabel} note exceeds 240 characters.`);
    if (!text(entry.revision)) errors.push(`${entryLabel} must define revision.`);
    if (revision && text(entry.revision) !== text(revision)) {
      errors.push(`${entryLabel} is bound to ${entry.revision || "no revision"}, not ${revision}.`);
    }
    if (entry.sha256 !== undefined && entry.sha256 !== null && !isSha256(entry.sha256)) {
      errors.push(`${entryLabel} sha256 must be a 64-character digest when provided.`);
    }
    if (entry.kind === "rendered_surface") {
      if (!text(entry.target) || !text(entry.state) || !text(entry.viewport)) {
        errors.push(`${entryLabel} rendered_surface must define target, state, and viewport.`);
      }
      if (entry.reference_ids !== undefined && (
        !Array.isArray(entry.reference_ids) || entry.reference_ids.some((id) => !text(id))
      )) {
        errors.push(`${entryLabel} reference_ids must be an array of non-empty IDs when provided.`);
      }
    }
    if (entry.kind === "journey_trace" && (!text(entry.target) || !text(entry.entry_point))) {
      errors.push(`${entryLabel} journey_trace must define target and entry_point.`);
    }
  }
}

function validateExperienceJourneyEvidence(entries, label, errors) {
  for (const [index, entry] of (entries || []).entries()) {
    if (entry.kind !== "journey_trace") continue;
    if (!text(entry.expected_destination) || !text(entry.expected_return) || !text(entry.retained_context)) {
      errors.push(
        `${label}[${index}] journey_trace must define expected_destination, expected_return, and retained_context.`
      );
    }
  }
}

function validateAssuranceCheck(check, gate, { runtime = true } = {}) {
  const errors = [];
  if (!isObject(check)) return ["Acceptance check must be an object."];
  const label = `Acceptance check ${text(check.id) || "without id"}`;
  if (!text(check.id)) errors.push("Acceptance check must define id.");
  if (!text(check.description)) errors.push(`${label} needs a description.`);
  if (!isObject(check.assurance)) {
    errors.push(`${label} must define assurance profile, method, and required_evidence.`);
  } else {
    if (!isRegisteredAssuranceProfile(check.assurance.profile)) {
      errors.push(`${label} has unregistered profile ${check.assurance.profile || "missing"}.`);
    } else if (isObject(gate?.profiles) && !gate.profiles[check.assurance.profile]) {
      errors.push(`${label} profile ${check.assurance.profile} is not present in its sealed gate.`);
    }
    if (!isRegisteredAssuranceMethod(check.assurance.method)) {
      errors.push(`${label} has invalid method ${check.assurance.method || "missing"}.`);
    } else if (
      ASSURANCE_PROFILE_CATALOG[check.assurance.profile] &&
      !ASSURANCE_PROFILE_CATALOG[check.assurance.profile].methods.includes(check.assurance.method)
    ) {
      errors.push(`${label} method ${check.assurance.method} is incompatible with profile ${check.assurance.profile}.`);
    }
    if (!Array.isArray(check.assurance.required_evidence) || check.assurance.required_evidence.length === 0) {
      errors.push(`${label} must define at least one required evidence kind.`);
    } else {
      if (unique(check.assurance.required_evidence).length !== check.assurance.required_evidence.length) {
        errors.push(`${label} repeats a required evidence kind.`);
      }
      for (const kind of check.assurance.required_evidence) {
        if (!isRegisteredAssuranceEvidenceKind(kind)) {
          errors.push(`${label} has invalid required evidence kind ${kind}.`);
        }
      }
      for (const kind of ASSURANCE_METHOD_EVIDENCE_CONTRACTS[check.assurance.method] || []) {
        if (!check.assurance.required_evidence.includes(kind)) {
          errors.push(`${label} method ${check.assurance.method} requires ${kind} evidence.`);
        }
      }
    }
  }
  if (!runtime) return errors;
  if (!CHECK_STATE_SET.has(check.status)) errors.push(`${label} has invalid status ${check.status || "missing"}.`);
  validateAssuranceEvidence(check.evidence || [], `${label} evidence`, errors);
  if (check.assurance?.profile === "experience" && check.assurance?.method === "end_to_end") {
    validateExperienceJourneyEvidence(check.evidence || [], `${label} evidence`, errors);
  }
  if (check.status !== "pending") {
    if (!text(check.checked_at)) errors.push(`${label} must define checked_at after review.`);
    if (!text(check.checked_revision)) errors.push(`${label} must define checked_revision after review.`);
    validateReviewer(check.reviewer, label, errors);
    if (!isSha256(check.packet_sha256)) errors.push(`${label} must define a valid packet_sha256 after review.`);
  }
  if (check.status === "passed") {
    const present = new Set((check.evidence || []).map((entry) => entry.kind));
    for (const kind of check.assurance?.required_evidence || []) {
      if (!present.has(kind)) errors.push(`${label} passed without required ${kind} evidence.`);
    }
  }
  return errors;
}

function validateAssuranceSliceState(slice) {
  const errors = [];
  const methodsByProfile = new Map();
  for (const check of slice.acceptance_checks || []) {
    const profile = check.assurance?.profile;
    if (!profile) continue;
    if (!methodsByProfile.has(profile)) methodsByProfile.set(profile, new Set());
    if (check.assurance?.method) methodsByProfile.get(profile).add(check.assurance.method);
  }
  for (const [profile, contract] of Object.entries(slice.assurance_gate?.profiles || {})) {
    const levelContract = ASSURANCE_PROFILE_LEVEL_CONTRACTS[profile]?.[contract.level];
    const present = methodsByProfile.get(profile) || new Set();
    for (const method of levelContract?.required_methods || []) {
      if (!present.has(method)) {
        errors.push(`Slice ${slice.id} profile ${profile} level ${contract.level} requires ${method}.`);
      }
    }
  }
  if (slice.assurance_scope_review !== null && slice.assurance_scope_review !== undefined) {
    const scope = slice.assurance_scope_review;
    if (!isObject(scope) || !["sufficient", "insufficient"].includes(scope.status)) {
      errors.push(`Slice ${slice.id} has invalid assurance_scope_review.`);
    } else {
      if (!text(scope.note) || !text(scope.checked_at) || !text(scope.checked_revision) || !isSha256(scope.packet_sha256)) {
        errors.push(`Slice ${slice.id} assurance_scope_review must define note, time, revision, and packet hash.`);
      }
      validateReviewer(scope.reviewer, `Slice ${slice.id} assurance_scope_review`, errors);
    }
  }
  if (slice.assurance_approval !== null && slice.assurance_approval !== undefined) {
    const approval = slice.assurance_approval;
    if (
      !isObject(approval) || approval.status !== "approved" ||
      !["human", "specialist"].includes(approval.mode) || approval.mode !== slice.assurance_gate?.approval ||
      !text(approval.approved_by) || !text(approval.ref) || !text(approval.approved_at) || !text(approval.checked_revision)
    ) {
      errors.push(`Slice ${slice.id} has invalid assurance_approval.`);
    }
  }
  return errors;
}

function reviewerSatisfies(reviewRequirement, reviewerMode) {
  if (reviewRequirement === "self_allowed") return REVIEWER_MODES.has(reviewerMode);
  return ["fresh_context_ai", "human", "specialist", "external"].includes(reviewerMode);
}

function findingBlocksClosure(finding) {
  return finding.status !== "resolved";
}

function sliceFindings(spine, sliceId) {
  return Object.entries(spine?.assurance?.findings || {})
    .filter(([, finding]) => finding.slice_id === sliceId)
    .map(([id, finding]) => ({ id, ...finding }));
}

function deriveSliceAssuranceSummary(spine, sliceId, { revision = null } = {}) {
  const slice = (spine?.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) throw new Error(`Unknown implementation slice: ${sliceId}.`);
  const checks = slice.acceptance_checks || [];
  const findings = sliceFindings(spine, sliceId);
  const liveFindings = findings.filter((finding) => finding.status !== "resolved");
  const blockingFindings = liveFindings.filter(findingBlocksClosure);
  const scope = slice.assurance_scope_review || null;
  const targetRevision = text(revision);
  const checkedRevisions = unique(checks.map((check) => text(check.checked_revision)).filter(Boolean));
  const stale = Boolean(
    targetRevision && (
      checks.some((check) => check.status !== "pending" && text(check.checked_revision) !== targetRevision) ||
      (scope && text(scope.checked_revision) !== targetRevision)
    )
  );
  let status = "not_started";
  if (spine?.assurance?.active_packet?.slice_id === sliceId) status = "in_review";
  else if (stale) status = "stale";
  else if (scope?.status === "insufficient" || checks.some((check) => check.status === "failed") || blockingFindings.length) {
    status = "changes_required";
  } else if (checks.some((check) => check.status === "blocked")) status = "blocked";
  else if (scope?.status === "sufficient" && checks.length && checks.every((check) => check.status === "passed")) status = "passed";
  else if (checks.some((check) => check.status !== "pending")) status = "in_review";

  const profiles = {};
  for (const profile of gateProfileIds(slice.assurance_gate)) {
    const profileChecks = checks.filter((check) => check.assurance?.profile === profile);
    let result = "pending";
    if (profileChecks.some((check) => check.status === "failed")) result = "failed";
    else if (profileChecks.some((check) => check.status === "blocked")) result = "blocked";
    else if (profileChecks.length && profileChecks.every((check) => check.status === "passed")) result = "passed";
    profiles[profile] = {
      result,
      check_ids: profileChecks.map((check) => check.id),
      checked_revision: unique(profileChecks.map((check) => text(check.checked_revision)).filter(Boolean)).length === 1
        ? text(profileChecks[0]?.checked_revision)
        : null
    };
  }
  const requiredApproval = slice.assurance_gate?.approval || "none";
  const approval = requiredApproval === "none"
    ? { status: "not_required", mode: "none", checked_revision: null }
    : slice.assurance_approval && (!targetRevision || slice.assurance_approval.checked_revision === targetRevision)
      ? clone(slice.assurance_approval)
      : { status: slice.assurance_approval ? "stale" : "pending", mode: requiredApproval, checked_revision: slice.assurance_approval?.checked_revision || null };
  return {
    status,
    checked_revision: checkedRevisions.length === 1 ? checkedRevisions[0] : null,
    scope_preflight: scope ? clone(scope) : null,
    profiles,
    approval,
    open_finding_count: liveFindings.length,
    blocking_finding_count: blockingFindings.length,
    finding_ids: liveFindings.map((finding) => finding.id)
  };
}

function assurancePacketHash(packet) {
  const copy = clone(packet);
  delete copy.packet_sha256;
  return sha256(JSON.stringify(copy));
}

function mutate(spine, now, callback) {
  const updated = clone(spine);
  callback(updated);
  updated.state_revision = Number(updated.state_revision || 0) + 1;
  updated.audit = isObject(updated.audit) ? updated.audit : {};
  updated.audit.last_mutation_at = now;
  return updated;
}

function assertActiveSlice(spine, sliceId) {
  if (spine.active_slice !== sliceId) throw new Error(`Slice ${sliceId} is not active.`);
  const slice = (spine.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) throw new Error(`Unknown implementation slice: ${sliceId}.`);
  return slice;
}

function prepareAssuranceReview(
  spine,
  { sliceId, revision, now, directionExcerpts = [], referenceRecords = [], tooling = null }
) {
  const slice = assertActiveSlice(spine, sliceId);
  if (!text(revision)) throw new Error("Assurance review must bind to a Git revision.");
  if (spine.assurance?.active_packet) {
    throw new Error(`Assurance packet ${spine.assurance.active_packet.packet_sha256} is already active.`);
  }
  const gateErrors = validateAssuranceGate(slice.assurance_gate);
  if (gateErrors.length) throw new Error(`Slice ${sliceId} assurance gate is invalid: ${gateErrors.join(" ")}`);
  const checkErrors = (slice.acceptance_checks || []).flatMap((check) =>
    validateAssuranceCheck(check, slice.assurance_gate, { runtime: true })
  );
  if (checkErrors.length) throw new Error(`Slice ${sliceId} assurance checks are invalid: ${checkErrors.join(" ")}`);
  const primaryItems = Object.entries(spine.work_items || {}).filter(([, item]) => item.primary_slice === sliceId);
  const unfinished = primaryItems.filter(([, item]) => !["implemented", "verified"].includes(item.state));
  if (unfinished.length) {
    throw new Error(`Slice ${sliceId} has ${unfinished.length} primary work items not ready for assurance review.`);
  }
  if (!Array.isArray(directionExcerpts)) throw new Error("directionExcerpts must be an array.");
  if (!Array.isArray(referenceRecords)) throw new Error("referenceRecords must be an array.");
  if (tooling !== null && !isObject(tooling)) throw new Error("Assurance tooling must be an object or null.");
  const needsExperienceTooling = gateProfileIds(slice.assurance_gate)
    .some((profile) => EXPERIENCE_TOOLING_PROFILES.has(profile));
  if (needsExperienceTooling) {
    const toolingErrors = experienceToolingErrors(tooling);
    if (toolingErrors.length) throw new Error(`Slice ${sliceId} experience assurance tooling is unresolved: ${toolingErrors.join(" ")}`);
  }
  if (referenceRecords.length > 3) throw new Error("Assurance packet may contain no more than 3 reference records.");
  const expectedReferences = new Set(slice.assurance_gate.references || []);
  for (const record of referenceRecords) {
    if (!isObject(record) || !text(record.id)) throw new Error("Every assurance reference record must define id.");
    if (!expectedReferences.has(record.id)) throw new Error(`Reference ${record.id} is not sealed into the slice gate.`);
  }
  for (const expected of expectedReferences) {
    if (!referenceRecords.some((record) => record.id === expected)) {
      throw new Error(`Assurance packet omits sealed reference ${expected}.`);
    }
  }
  const nextStateRevision = Number(spine.state_revision || 0) + 1;
  const packet = {
    packet_version: ASSURANCE_PACKET_VERSION,
    plan_version: spine.plan_version,
    state_revision: nextStateRevision,
    slice_id: sliceId,
    revision: text(revision),
    prepared_at: now,
    assurance_gate: clone(slice.assurance_gate),
    checks: (slice.acceptance_checks || []).map((check) => ({
      id: check.id,
      description: check.description,
      assurance: clone(check.assurance),
      current_status: check.status,
      current_revision: check.checked_revision || null
    })),
    direction_excerpts: clone(directionExcerpts),
    references: clone(referenceRecords),
    tooling: tooling === null ? null : clone(tooling),
    live_findings: sliceFindings(spine, sliceId).filter((finding) => finding.status !== "resolved"),
    review_protocol: {
      scope: "Challenge whether the sealed profiles, levels, methods, and references cover the implemented change; do not remove the sealed minimum.",
      conformance: "Evaluate every sealed check against accepted direction and current evidence.",
      discovery: "Inspect the assembled outcome for credible defects or omissions the sealed checks did not anticipate."
    },
    result_contract: {
      scope_preflight: "required: sufficient|insufficient plus concise note",
      reviewer: "required: mode and ref",
      checks: "one result per sealed acceptance-check ID",
      finding_rechecks: "one explicit result per live non-scope finding",
      findings: "new findings omit IDs; the engine allocates QF-* identities"
    }
  };
  packet.packet_sha256 = assurancePacketHash(packet);
  if (JSON.stringify(packet).length > ASSURANCE_PACKET_MAX_CHARS) {
    throw new Error(`Assurance packet exceeds the ${ASSURANCE_PACKET_MAX_CHARS}-character hard limit.`);
  }
  const updated = mutate(spine, now, (candidate) => {
    candidate.assurance = isObject(candidate.assurance) ? candidate.assurance : createAssuranceRoot();
    candidate.assurance.active_packet = {
      slice_id: sliceId,
      packet_sha256: packet.packet_sha256,
      revision: text(revision),
      state_revision: nextStateRevision,
      prepared_at: now
    };
  });
  return { spine: updated, packet };
}

function validateResultEvidence(check, result, revision, errors) {
  validateAssuranceEvidence(result.evidence, `Result for ${check.id} evidence`, errors, { revision });
  if (check.assurance?.profile === "experience" && check.assurance?.method === "end_to_end") {
    validateExperienceJourneyEvidence(result.evidence || [], `Result for ${check.id} evidence`, errors);
  }
  if (result.status === "passed") {
    const present = new Set((result.evidence || []).map((entry) => entry.kind));
    for (const kind of check.assurance.required_evidence) {
      if (!present.has(kind)) errors.push(`Result for ${check.id} lacks required ${kind} evidence.`);
    }
  }
}

function allocateFindingId(root) {
  let number = Math.max(1, Number(root.next_finding_number || 1));
  let id = `QF-${String(number).padStart(4, "0")}`;
  while (root.findings[id]) {
    number += 1;
    id = `QF-${String(number).padStart(4, "0")}`;
  }
  root.next_finding_number = number + 1;
  return id;
}

function submitAssuranceReview(spine, { sliceId, revision, now, packet, result }) {
  const slice = assertActiveSlice(spine, sliceId);
  const active = spine.assurance?.active_packet;
  if (!isObject(active) || active.slice_id !== sliceId) throw new Error(`Slice ${sliceId} has no active assurance packet.`);
  if (!isObject(packet) || packet.slice_id !== sliceId) throw new Error("Assurance packet does not match the active slice.");
  const packetHash = assurancePacketHash(packet);
  if (!isSha256(packet.packet_sha256) || packet.packet_sha256 !== packetHash || active.packet_sha256 !== packetHash) {
    throw new Error("Assurance packet hash does not match the prepared packet.");
  }
  if (
    active.state_revision !== spine.state_revision ||
    packet.state_revision !== spine.state_revision ||
    active.revision !== text(revision) ||
    packet.revision !== text(revision)
  ) {
    throw new Error("Assurance packet is stale against the current spine state or Git revision.");
  }
  if (!isObject(result)) throw new Error("Assurance result must be an object.");
  if (result.packet_sha256 !== packetHash || result.slice_id !== sliceId || text(result.revision) !== text(revision)) {
    throw new Error("Assurance result is not bound to the active packet, slice, and revision.");
  }
  const errors = [];
  validateReviewer(result.reviewer, "Assurance result", errors);
  if (!isObject(result.scope_preflight) || !["sufficient", "insufficient"].includes(result.scope_preflight.status)) {
    errors.push("Assurance result must define scope_preflight as sufficient or insufficient.");
  }
  if (!text(result.scope_preflight?.note)) errors.push("Assurance scope_preflight must include a concise note.");
  if (text(result.scope_preflight?.note).length > 240) errors.push("Assurance scope_preflight note exceeds 240 characters.");
  for (const [profile, contract] of Object.entries(slice.assurance_gate.profiles || {})) {
    if (!reviewerSatisfies(contract.review, result.reviewer?.mode)) {
      errors.push(`Profile ${profile} requires ${contract.review}; reviewer mode ${result.reviewer?.mode || "missing"} is insufficient.`);
    }
  }
  if (!Array.isArray(result.checks)) errors.push("Assurance result checks must be an array.");
  const resultChecks = new Map();
  for (const entry of result.checks || []) {
    if (!isObject(entry) || !text(entry.id)) {
      errors.push("Every assurance check result must define id.");
      continue;
    }
    if (resultChecks.has(entry.id)) errors.push(`Assurance result repeats check ${entry.id}.`);
    resultChecks.set(entry.id, entry);
  }
  const sealedIds = new Set((slice.acceptance_checks || []).map((check) => check.id));
  for (const id of resultChecks.keys()) {
    if (!sealedIds.has(id)) errors.push(`Assurance result references unsealed check ${id}.`);
  }
  for (const check of slice.acceptance_checks || []) {
    const entry = resultChecks.get(check.id);
    if (!entry) {
      errors.push(`Assurance result omits check ${check.id}.`);
      continue;
    }
    if (!["passed", "failed", "blocked"].includes(entry.status)) {
      errors.push(`Result for ${check.id} has invalid status ${entry.status || "missing"}.`);
    }
    validateResultEvidence(check, entry, revision, errors);
    if (entry.status === "blocked" && !text(entry.blocked_reason)) {
      errors.push(`Blocked result for ${check.id} must define blocked_reason.`);
    }
  }
  const reviewedReferenceIds = new Set(
    [...resultChecks.values()].flatMap((entry) =>
      (entry.evidence || []).flatMap((evidence) => evidence.reference_ids || [])
    )
  );
  for (const referenceId of slice.assurance_gate.references || []) {
    if (!reviewedReferenceIds.has(referenceId)) {
      errors.push(`Assurance result does not compare sealed reference ${referenceId}.`);
    }
  }
  if (!Array.isArray(result.findings)) errors.push("Assurance result findings must be an array.");
  if ((result.findings || []).length > ASSURANCE_MAX_FINDINGS_PER_REVIEW) {
    errors.push(`Assurance result exceeds the ${ASSURANCE_MAX_FINDINGS_PER_REVIEW}-finding review limit.`);
  }
  for (const [index, finding] of (result.findings || []).entries()) {
    const label = `New finding ${index + 1}`;
    if (!isObject(finding)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (finding.id !== undefined) errors.push(`${label} must not provide an ID; the engine allocates QF-* identities.`);
    if (!sealedIds.has(finding.check_id)) errors.push(`${label} references unknown check ${finding.check_id || "missing"}.`);
    if (!FINDING_KINDS.has(finding.kind) || finding.kind === "scope") errors.push(`${label} has invalid kind ${finding.kind || "missing"}.`);
    if (!FINDING_SEVERITIES.has(finding.severity)) errors.push(`${label} has invalid severity ${finding.severity || "missing"}.`);
    if (!text(finding.summary)) errors.push(`${label} must define summary.`);
    if (text(finding.summary).length > 240) errors.push(`${label} summary exceeds 240 characters.`);
    if (!text(finding.evidence_ref)) errors.push(`${label} must define evidence_ref.`);
  }
  for (const check of slice.acceptance_checks || []) {
    const entry = resultChecks.get(check.id);
    if (entry?.status === "failed") {
      const newFinding = (result.findings || []).some((finding) => finding.check_id === check.id);
      const liveFinding = sliceFindings(spine, sliceId).some(
        (finding) => finding.check_id === check.id && finding.status !== "resolved"
      );
      if (!newFinding && !liveFinding) errors.push(`Failed result for ${check.id} must have a stable finding.`);
    }
  }
  if (!Array.isArray(result.finding_rechecks)) errors.push("Assurance result finding_rechecks must be an array.");
  const rechecks = new Map();
  for (const entry of result.finding_rechecks || []) {
    if (!isObject(entry) || !text(entry.finding_id)) {
      errors.push("Every finding recheck must define finding_id.");
      continue;
    }
    if (rechecks.has(entry.finding_id)) errors.push(`Finding recheck repeats ${entry.finding_id}.`);
    rechecks.set(entry.finding_id, entry);
    if (!["open", "resolved"].includes(entry.status)) errors.push(`Finding recheck ${entry.finding_id} has invalid status.`);
    if (!text(entry.note)) errors.push(`Finding recheck ${entry.finding_id} must define note.`);
  }
  const liveNonScope = sliceFindings(spine, sliceId).filter(
    (finding) => finding.status !== "resolved" && finding.kind !== "scope"
  );
  for (const finding of liveNonScope) {
    if (!rechecks.has(finding.id)) errors.push(`Assurance result omits live finding recheck ${finding.id}.`);
  }
  for (const [id, recheck] of rechecks.entries()) {
    const finding = spine.assurance?.findings?.[id];
    if (!finding || finding.slice_id !== sliceId || finding.status === "resolved") {
      errors.push(`Finding recheck ${id} does not reference a live finding in ${sliceId}.`);
      continue;
    }
    if (recheck.status === "resolved" && finding.check_id) {
      if (resultChecks.get(finding.check_id)?.status !== "passed") {
        errors.push(`Finding ${id} cannot resolve until check ${finding.check_id} passes.`);
      }
    }
  }
  if (errors.length) throw new Error(`Assurance result is invalid: ${errors.join(" ")}`);

  return mutate(spine, now, (updated) => {
    const targetSlice = updated.slices.find((entry) => entry.id === sliceId);
    for (const targetCheck of targetSlice.acceptance_checks || []) {
      const entry = resultChecks.get(targetCheck.id);
      targetCheck.status = entry.status;
      targetCheck.checked_at = now;
      targetCheck.checked_revision = text(revision);
      targetCheck.reviewer = clone(result.reviewer);
      targetCheck.evidence = clone(entry.evidence || []);
      targetCheck.packet_sha256 = packetHash;
      targetCheck.blocked_reason = entry.status === "blocked" ? text(entry.blocked_reason) : null;
    }
    targetSlice.assurance_scope_review = {
      status: result.scope_preflight.status,
      note: text(result.scope_preflight.note),
      reviewer: clone(result.reviewer),
      checked_at: now,
      checked_revision: text(revision),
      packet_sha256: packetHash
    };
    if (targetSlice.assurance_approval?.checked_revision !== text(revision)) {
      targetSlice.assurance_approval = null;
    }
    const root = updated.assurance;
    for (const [id, recheck] of rechecks.entries()) {
      const finding = root.findings[id];
      finding.status = recheck.status;
      finding.last_checked_at = now;
      finding.last_checked_revision = text(revision);
      finding.recheck_note = text(recheck.note);
      if (text(recheck.evidence_ref)) finding.evidence_ref = text(recheck.evidence_ref);
      if (recheck.status === "resolved") {
        finding.resolved_at = now;
        finding.resolved_revision = text(revision);
        root.resolved_count = Number(root.resolved_count || 0) + 1;
      }
    }
    for (const finding of result.findings || []) {
      const id = allocateFindingId(root);
      const check = targetSlice.acceptance_checks.find((entry) => entry.id === finding.check_id);
      root.findings[id] = {
        slice_id: sliceId,
        check_id: finding.check_id,
        profile: check.assurance.profile,
        kind: finding.kind,
        severity: finding.severity,
        summary: text(finding.summary),
        evidence_ref: text(finding.evidence_ref),
        status: "open",
        opened_at: now,
        opened_revision: text(revision),
        remediation: null,
        resolved_at: null,
        resolved_revision: null
      };
    }
    const existingScope = Object.entries(root.findings).find(([, finding]) =>
      finding.slice_id === sliceId && finding.kind === "scope" && finding.status !== "resolved"
    );
    if (result.scope_preflight.status === "insufficient") {
      if (existingScope) {
        existingScope[1].status = "open";
        existingScope[1].summary = text(result.scope_preflight.note);
        existingScope[1].evidence_ref = null;
        existingScope[1].last_checked_at = now;
        existingScope[1].last_checked_revision = text(revision);
      } else {
        const id = allocateFindingId(root);
        root.findings[id] = {
          slice_id: sliceId,
          check_id: null,
          profile: null,
          kind: "scope",
          severity: "high",
          summary: text(result.scope_preflight.note),
          evidence_ref: null,
          status: "open",
          opened_at: now,
          opened_revision: text(revision),
          remediation: null,
          resolved_at: null,
          resolved_revision: null
        };
      }
    } else if (existingScope) {
      existingScope[1].status = "resolved";
      existingScope[1].resolved_at = now;
      existingScope[1].resolved_revision = text(revision);
      root.resolved_count = Number(root.resolved_count || 0) + 1;
    }
    const liveCount = Object.values(root.findings).filter((finding) => finding.status !== "resolved").length;
    if (liveCount > ASSURANCE_MAX_LIVE_FINDINGS) {
      throw new Error(`Assurance root exceeds the ${ASSURANCE_MAX_LIVE_FINDINGS}-finding live limit.`);
    }
    root.active_packet = null;
  });
}

function remediateAssuranceFinding(spine, { findingId, revision, ref, note, now }) {
  const finding = spine.assurance?.findings?.[findingId];
  if (!finding) throw new Error(`Unknown assurance finding: ${findingId}.`);
  if (!["open", "needs_reconciliation"].includes(finding.status)) {
    throw new Error(`Finding ${findingId} cannot be remediated from ${finding.status}.`);
  }
  if (!text(revision) || !text(ref) || !text(note)) {
    throw new Error("Finding remediation must define revision, ref, and note.");
  }
  if (text(note).length > 240) throw new Error("Finding remediation note must not exceed 240 characters.");
  return mutate(spine, now, (updated) => {
    const target = updated.assurance.findings[findingId];
    target.status = "recheck_required";
    target.remediation = {
      revision: text(revision),
      ref: text(ref),
      note: text(note),
      recorded_at: now
    };
    const slice = updated.slices.find((entry) => entry.id === target.slice_id);
    if (slice?.assurance_approval) slice.assurance_approval = null;
  });
}

function reconcileAssuranceFinding(spine, { findingId, sliceId, checkId = null, ref, note, now }) {
  const finding = spine.assurance?.findings?.[findingId];
  if (!finding) throw new Error(`Unknown assurance finding: ${findingId}.`);
  if (finding.status !== "needs_reconciliation") {
    throw new Error(`Finding ${findingId} does not need reconciliation.`);
  }
  const slice = (spine.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) throw new Error(`Unknown replacement slice: ${sliceId}.`);
  const check = checkId === null ? null : (slice.acceptance_checks || []).find((entry) => entry.id === checkId);
  if (finding.kind === "scope" && checkId !== null) throw new Error(`Scope finding ${findingId} must remain slice-level.`);
  if (finding.kind !== "scope" && !check) throw new Error(`Finding ${findingId} needs a valid replacement check.`);
  if (!text(ref) || !text(note)) throw new Error("Finding reconciliation must define ref and note.");
  return mutate(spine, now, (updated) => {
    const target = updated.assurance.findings[findingId];
    target.slice_id = sliceId;
    target.check_id = checkId;
    target.profile = check?.assurance?.profile || null;
    target.status = "open";
    target.reconciliation = { ref: text(ref), note: text(note), recorded_at: now };
  });
}

function assuranceClosureErrors(spine, sliceId, revision) {
  const errors = [];
  const slice = (spine?.slices || []).find((entry) => entry.id === sliceId);
  if (!slice) return [`Unknown implementation slice: ${sliceId}.`];
  const currentRevision = text(revision);
  if (!currentRevision) errors.push(`Slice ${sliceId} closure must bind to a Git revision.`);
  if (spine.assurance?.active_packet?.slice_id === sliceId) {
    errors.push(`Slice ${sliceId} still has an active assurance review packet.`);
  }
  const gateErrors = validateAssuranceGate(slice.assurance_gate);
  errors.push(...gateErrors.map((entry) => `Slice ${sliceId}: ${entry}`));
  const checkProfiles = new Set();
  for (const check of slice.acceptance_checks || []) {
    errors.push(...validateAssuranceCheck(check, slice.assurance_gate, { runtime: true }));
    if (check.assurance?.profile) checkProfiles.add(check.assurance.profile);
    if (check.status !== "passed") errors.push(`Acceptance check ${check.id} has not passed.`);
    if (text(check.checked_revision) !== currentRevision) {
      errors.push(`Acceptance check ${check.id} is not checked at revision ${currentRevision || "missing"}.`);
    }
    const profileContract = slice.assurance_gate?.profiles?.[check.assurance?.profile];
    if (profileContract && !reviewerSatisfies(profileContract.review, check.reviewer?.mode)) {
      errors.push(`Acceptance check ${check.id} reviewer does not satisfy ${profileContract.review}.`);
    }
    for (const evidence of check.evidence || []) {
      if (text(evidence.revision) !== currentRevision) {
        errors.push(`Acceptance check ${check.id} evidence is stale against revision ${currentRevision || "missing"}.`);
      }
    }
  }
  for (const profile of gateProfileIds(slice.assurance_gate)) {
    if (!checkProfiles.has(profile)) errors.push(`Slice ${sliceId} has no acceptance check for profile ${profile}.`);
  }
  const reviewedReferenceIds = new Set(
    (slice.acceptance_checks || []).flatMap((check) =>
      (check.evidence || []).flatMap((evidence) => evidence.reference_ids || [])
    )
  );
  for (const referenceId of slice.assurance_gate?.references || []) {
    if (!reviewedReferenceIds.has(referenceId)) {
      errors.push(`Slice ${sliceId} has no current comparison evidence for reference ${referenceId}.`);
    }
  }
  const scope = slice.assurance_scope_review;
  if (!scope || scope.status !== "sufficient") errors.push(`Slice ${sliceId} assurance scope is not sufficient.`);
  else if (text(scope.checked_revision) !== currentRevision) errors.push(`Slice ${sliceId} assurance scope review is stale.`);
  const live = sliceFindings(spine, sliceId).filter(findingBlocksClosure);
  if (live.length) errors.push(`Slice ${sliceId} has ${live.length} unresolved blocking assurance finding(s).`);
  const approval = slice.assurance_gate?.approval || "none";
  if (approval !== "none") {
    if (
      slice.assurance_approval?.status !== "approved" ||
      slice.assurance_approval?.mode !== approval ||
      text(slice.assurance_approval?.checked_revision) !== currentRevision
    ) {
      errors.push(`Slice ${sliceId} requires current ${approval} assurance approval.`);
    }
  }
  return unique(errors);
}

function approveSliceAssurance(spine, { sliceId, revision, approvalMode, approvedBy, ref, now }) {
  const slice = assertActiveSlice(spine, sliceId);
  const required = slice.assurance_gate?.approval || "none";
  if (required === "none") throw new Error(`Slice ${sliceId} does not require assurance approval.`);
  if (approvalMode !== required) throw new Error(`Slice ${sliceId} requires ${required} approval, not ${approvalMode || "missing"}.`);
  if (!text(approvedBy) || !text(ref) || !text(revision)) {
    throw new Error("Assurance approval must define approver, ref, and revision.");
  }
  const closureErrors = assuranceClosureErrors(
    { ...spine, slices: (spine.slices || []).map((entry) => entry.id === sliceId
      ? { ...entry, assurance_approval: { status: "approved", mode: required, checked_revision: text(revision) } }
      : entry) },
    sliceId,
    revision
  );
  if (closureErrors.length) throw new Error(`Slice ${sliceId} cannot be approved: ${closureErrors.join(" ")}`);
  return mutate(spine, now, (updated) => {
    const target = updated.slices.find((entry) => entry.id === sliceId);
    target.assurance_approval = {
      status: "approved",
      mode: approvalMode,
      approved_by: text(approvedBy),
      ref: text(ref),
      approved_at: now,
      checked_revision: text(revision)
    };
  });
}

function validateAssuranceRoot(root, { slices = [], stateRevision = null } = {}) {
  const errors = [];
  if (!isObject(root)) return ["assurance root must be an object."];
  if (!Number.isInteger(root.next_finding_number) || root.next_finding_number < 1) {
    errors.push("assurance.next_finding_number must be a positive integer.");
  }
  if (root.active_packet !== null) {
    const active = root.active_packet;
    if (!isObject(active) || !text(active.slice_id) || !isSha256(active.packet_sha256) || !text(active.revision)) {
      errors.push("assurance.active_packet is invalid.");
    } else {
      if (stateRevision !== null && active.state_revision !== stateRevision) {
        errors.push("assurance.active_packet is stale against state_revision.");
      }
      if (slices.length && !slices.some((slice) => slice.id === active.slice_id)) {
        errors.push(`assurance.active_packet references unknown slice ${active.slice_id}.`);
      }
    }
  }
  if (!isObject(root.findings)) {
    errors.push("assurance.findings must be an object.");
    return errors;
  }
  const sliceMap = new Map(slices.map((slice) => [slice.id, slice]));
  let maximumId = 0;
  for (const [id, finding] of Object.entries(root.findings)) {
    const match = /^QF-(\d+)$/.exec(id);
    if (!match) errors.push(`Assurance finding ID ${id} is invalid.`);
    else maximumId = Math.max(maximumId, Number(match[1]));
    if (!isObject(finding)) {
      errors.push(`Assurance finding ${id} must be an object.`);
      continue;
    }
    if (!FINDING_STATUS_SET.has(finding.status)) errors.push(`Assurance finding ${id} has invalid status ${finding.status || "missing"}.`);
    if (!FINDING_KINDS.has(finding.kind)) errors.push(`Assurance finding ${id} has invalid kind ${finding.kind || "missing"}.`);
    if (!FINDING_SEVERITIES.has(finding.severity)) errors.push(`Assurance finding ${id} has invalid severity ${finding.severity || "missing"}.`);
    if (!text(finding.slice_id) || !text(finding.summary)) {
      errors.push(`Assurance finding ${id} must define slice_id and summary.`);
    }
    if (finding.kind === "scope" && finding.check_id !== null) errors.push(`Scope finding ${id} must have check_id null.`);
    if (finding.kind !== "scope" && (!text(finding.check_id) || !text(finding.evidence_ref))) {
      errors.push(`Assurance finding ${id} must define check_id and evidence_ref.`);
    }
    const slice = sliceMap.get(finding.slice_id);
    if (slice && finding.check_id && !(slice.acceptance_checks || []).some((check) => check.id === finding.check_id)) {
      errors.push(`Assurance finding ${id} references unknown check ${finding.check_id}.`);
    }
  }
  if (Number(root.next_finding_number || 0) <= maximumId) {
    errors.push("assurance.next_finding_number must be greater than every allocated finding ID.");
  }
  return errors;
}

module.exports = {
  ASSURANCE_PACKET_VERSION,
  ASSURANCE_PACKET_MAX_CHARS,
  ASSURANCE_PROFILE_CATALOG,
  ASSURANCE_PROFILE_LEVEL_CONTRACTS,
  ASSURANCE_METHOD_EVIDENCE_CONTRACTS,
  ASSURANCE_PROFILE_IDS,
  ASSURANCE_METHOD_IDS,
  ASSURANCE_EVIDENCE_KIND_IDS,
  ASSURANCE_REVIEW_REQUIREMENTS,
  ASSURANCE_APPROVAL_REQUIREMENTS,
  ASSURANCE_FINDING_STATUSES,
  ASSURANCE_CHECK_STATES,
  isRegisteredAssuranceProfile,
  isRegisteredAssuranceLevel,
  assuranceLevelSatisfies,
  assuranceProfileTitle,
  isRegisteredAssuranceMethod,
  isRegisteredAssuranceEvidenceKind,
  createAssuranceRoot,
  gateProfileIds,
  validateAssuranceGate,
  validateAssuranceCheck,
  validateAssuranceSliceState,
  validateAssuranceEvidence,
  validateAssuranceRoot,
  deriveSliceAssuranceSummary,
  assurancePacketHash,
  prepareAssuranceReview,
  submitAssuranceReview,
  remediateAssuranceFinding,
  reconcileAssuranceFinding,
  approveSliceAssurance,
  assuranceClosureErrors
};

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildImplementationSpine,
  buildImplementationProposalTemplate,
  applyImplementationProposal,
  finalizeImplementationSynthesis,
  markImplementationReview,
  approveImplementationSpine,
  validateImplementationSpine,
  summarizeImplementationSpine,
  startImplementationSlice,
  holdWorkItem,
  closeImplementationSlice,
  implementationContextPayload,
  formatImplementationContext,
  formatGuardedImplementationContext,
  proposalFingerprint,
  deriveSliceAssuranceSummary,
  prepareAssuranceReview,
  submitAssuranceReview,
  remediateAssuranceFinding,
  reconcileAssuranceFinding,
  approveSliceAssurance,
  assuranceClosureErrors,
  ASSURANCE_PROFILE_CATALOG
} = require("./implementation_spine");
const {
  implementationProgressPolicy,
  formatImplementationProgressPolicy
} = require("./implementation_progress");

function authoredProposal(spine, blocks, sliceCount = 1) {
  const proposal = buildImplementationProposalTemplate(spine);
  proposal.synthesis_basis.push({
    ref: "_documentation/_DNA-SAPP/example.md",
    role: "Project-specific outcome and journey backbone."
  });
  proposal.tracks = [{ id: "TRACK-OUTCOMES", title: "Product outcomes", order: 1 }];
  proposal.slices = Array.from({ length: sliceCount }, (_, index) => ({
    id: `SLICE-OUTCOME-${index + 1}`,
    track: "TRACK-OUTCOMES",
    kind: "outcome",
    title: `Outcome ${index + 1}`,
    outcome: `A user can complete observable outcome ${index + 1}.`,
    order: index + 1,
    priority: index === 0 ? "high" : "normal",
    depends_on: index === 0 ? [] : [`SLICE-OUTCOME-${index}`],
    blocking_gates: [],
    assurance_gate: {
      profiles: { software_quality: { level: "slice", review: "self_allowed" } },
      approval: "none",
      references: []
    },
    acceptance_checks: [{
      id: `SLICE-OUTCOME-${index + 1}-AC01`,
      description: `Verify observable outcome ${index + 1}.`,
      assurance: {
        profile: "software_quality",
        method: "inspection",
        required_evidence: ["inspection_record"]
      }
    }]
  }));
  blocks.forEach((block, index) => {
    proposal.work_items[block.id].primary_slice = `SLICE-OUTCOME-${(index % sliceCount) + 1}`;
  });
  return applyImplementationProposal(spine, proposal);
}

function source(overrides = {}) {
  return {
    generated_at: "2026-08-05T12:00:00.000Z",
    git_revision: "abc1234",
    north_star_sha256: "north-star",
    dna_scope_sha256: "dna-scope",
    applicable_block_count: 1,
    ...overrides
  };
}

function directionBlock(index, { document = 1, module = "SAPP" } = {}) {
  const documentId = `_DNA-${module}-${String(document).padStart(5, "0")}`;
  const id = `${documentId}.${String(index).padStart(2, "0")}`;
  return {
    id,
    title: `Direction ${id}`,
    direction_status: "active",
    supersedes: "none",
    superseded_by: null,
    contract_errors: [],
    module_id: `_DNA-${module}`,
    module_name: `${module} DNA`,
    document_id: documentId,
    document_title: `Document ${document}`,
    path: `_documentation/_DNA-${module}/${documentId}.md`,
    assurance_profiles: ["software_quality"],
    details: { direction: `Accepted direction ${id}.` }
  };
}

function activeAssuranceSpine({
  profile = "software_quality",
  method = "inspection",
  requiredEvidence = ["inspection_record"],
  review = "self_allowed",
  approval = "none",
  level = profile === "experience" ? "component" : "slice",
  references = []
} = {}) {
  const block = directionBlock(1);
  block.assurance_profiles = [profile];
  const inputSource = source();
  const inventory = buildImplementationSpine({
    source: inputSource,
    blocks: [block],
    now: "2026-08-05T12:00:00.000Z"
  });
  const planned = authoredProposal(inventory, [block]);
  planned.slices[0].assurance_gate = {
    profiles: { [profile]: { level, review } },
    approval,
    references
  };
  planned.slices[0].acceptance_checks[0].assurance = {
    profile,
    method,
    required_evidence: requiredEvidence
  };
  planned.plan_status = "approved";
  planned.approval = {
    approved_at: "2026-08-05T12:01:00.000Z",
    approved_by: "reviewer",
    git_revision: "abc1234"
  };
  const active = startImplementationSlice(planned, {
    sliceId: planned.slices[0].id,
    now: "2026-08-05T12:02:00.000Z",
    source: inputSource
  });
  const item = active.work_items[block.id];
  item.state = "implemented";
  item.implementation_evidence = [{ kind: "code", ref: "src/outcome.js", note: "Outcome implementation." }];
  return { spine: active, block, source: inputSource, sliceId: active.slices[0].id };
}

function assuranceResult(packet, {
  reviewerMode = "self",
  scopeStatus = "sufficient",
  checkStatus = "passed",
  evidence = null,
  findings = [],
  findingRechecks = []
} = {}) {
  const defaultKind = packet.checks[0].assurance.required_evidence[0];
  const defaultEvidence = {
    kind: defaultKind,
    ref: "test-results/review.json",
    revision: packet.revision,
    note: "Current review evidence."
  };
  if (defaultKind === "rendered_surface") {
    Object.assign(defaultEvidence, {
      target: "primary surface",
      state: "populated",
      viewport: "compact",
      reference_ids: packet.assurance_gate.references || []
    });
  }
  if (defaultKind === "journey_trace") {
    Object.assign(defaultEvidence, {
      target: "critical journey",
      entry_point: "supported entry",
      expected_destination: "intended destination",
      expected_return: "return to the prior context",
      retained_context: "the user's active entity and progress remain intact"
    });
  }
  return {
    packet_sha256: packet.packet_sha256,
    slice_id: packet.slice_id,
    revision: packet.revision,
    reviewer: { mode: reviewerMode, ref: `review:${reviewerMode}` },
    scope_preflight: { status: scopeStatus, note: scopeStatus === "sufficient" ? "The sealed scope is sufficient." : "The sealed scope omits a material risk." },
    checks: [{
      id: packet.checks[0].id,
      status: checkStatus,
      evidence: evidence === null
        ? [defaultEvidence]
        : evidence,
      ...(checkStatus === "blocked" ? { blocked_reason: "Required environment is unavailable." } : {})
    }],
    findings,
    finding_rechecks: findingRechecks
  };
}

test("keeps implementation progress cadence separate from delivery state", () => {
  assert.deepEqual(
    ["silent", "track", "slice"].map((mode) => implementationProgressPolicy({
      implementation_progress_updates: mode
    }).mode),
    ["silent", "track", "slice"]
  );
  assert.equal(implementationProgressPolicy({}).mode, "track");
  assert.match(
    implementationProgressPolicy({ implementation_progress_updates: "track" }).update_boundary,
    /every slice.*verified/
  );
  assert.match(
    formatImplementationProgressPolicy(implementationProgressPolicy({})),
    /continue automatically across eligible slices and tracks/
  );
});

test("refuses to close a held slice while another primary item remains open", () => {
  const blocks = [directionBlock(1), directionBlock(2)];
  const inputSource = source({ applicable_block_count: blocks.length });
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  Object.assign(spine, authoredProposal(spine, blocks));
  spine.slices[0].requires_refinement = false;
  spine.plan_status = "approved";
  spine.approval = {
    approved_at: "2026-08-05T12:01:00.000Z",
    approved_by: "reviewer",
    git_revision: "abc1234"
  };
  const sliceId = spine.slices[0].id;
  const active = startImplementationSlice(spine, {
    sliceId,
    now: "2026-08-05T12:02:00.000Z",
    source: inputSource
  });
  const held = holdWorkItem(active, {
    blockId: blocks[0].id,
    state: "blocked",
    reason: "External decision required.",
    reopenWhen: "The decision is recorded.",
    owner: "user",
    now: "2026-08-05T12:03:00.000Z",
    source: inputSource
  });

  assert.throws(
    () => closeImplementationSlice(held, {
      sliceId,
      revision: "abc1234",
      now: "2026-08-05T12:04:00.000Z",
      source: inputSource
    }),
    /still has open work items/
  );
});

test("keeps a 720-block implementation inventory out of the active context packet", () => {
  const blocks = [];
  for (let document = 1; document <= 120; document += 1) {
    for (let index = 1; index <= 6; index += 1) {
      blocks.push(directionBlock(index, { document }));
    }
  }
  const inputSource = source({ applicable_block_count: blocks.length });
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  const applicableBlockIds = blocks.map((block) => block.id);
  const validation = validateImplementationSpine(spine, {
    source: inputSource,
    applicableBlockIds
  });
  const summary = summarizeImplementationSpine(spine, validation);
  const payload = implementationContextPayload(spine, {
    source: inputSource,
    applicableBlockIds
  });
  const packet = formatImplementationContext(payload);

  assert.equal(summary.coverage.applicable, 720);
  assert.equal(spine.slices.length, 0);
  assert.equal(payload.work_items.length, 0);
  assert.ok(packet.length < 10000);
  assert.match(packet, /DNA direction coverage: built 0\/720/);
  assert.doesNotMatch(packet, new RegExp(blocks.at(-1).id.replace(/[.]/g, "\\.")));
});

test("measures a synthesized 720-block plan's effective cross-linked scope and blocks approval", () => {
  const blocks = [];
  for (let document = 1; document <= 72; document += 1) {
    for (let index = 1; index <= 10; index += 1) {
      blocks.push(directionBlock(index, { document }));
    }
  }
  const inputSource = source({ applicable_block_count: blocks.length });
  const applicableBlockIds = blocks.map((block) => block.id);
  const inventory = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  const proposal = buildImplementationProposalTemplate(inventory);
  proposal.synthesis_basis.push({ ref: "journeys.md", role: "Outcome backbone." });
  proposal.tracks = [{ id: "TRACK-OUTCOMES", title: "Outcomes", order: 1 }];
  proposal.slices = Array.from({ length: 72 }, (_, index) => ({
    id: `SLICE-${index + 1}`,
    track: "TRACK-OUTCOMES",
    kind: "outcome",
    title: `Outcome ${index + 1}`,
    outcome: `Deliver outcome ${index + 1}.`,
    order: index + 1,
    priority: "normal",
    depends_on: [],
    blocking_gates: [],
    assurance_gate: {
      profiles: { software_quality: { level: "slice", review: "self_allowed" } },
      approval: "none",
      references: []
    },
    acceptance_checks: [{
      id: `SLICE-${index + 1}-AC01`,
      description: `Inspect outcome ${index + 1}.`,
      assurance: {
        profile: "software_quality",
        method: "inspection",
        required_evidence: ["inspection_record"]
      }
    }]
  }));
  blocks.forEach((block, index) => {
    proposal.work_items[block.id].primary_slice = `SLICE-${Math.floor(index / 10) + 1}`;
    if (index >= 10) proposal.work_items[block.id].applies_to = ["SLICE-1"];
  });

  const synthesized = finalizeImplementationSynthesis(
    applyImplementationProposal(inventory, proposal),
    {
      synthesizedBy: "Agent",
      revision: "abc1234",
      now: "2026-08-05T12:01:00.000Z",
      source: inputSource,
      applicableBlockIds
    }
  );
  const validation = validateImplementationSpine(synthesized, {
    source: inputSource,
    applicableBlockIds
  });
  const oversized = validation.slice_contexts.find((entry) => entry.slice_id === "SLICE-1");

  assert.deepEqual(
    {
      primary: oversized.primary_blocks,
      crossCutting: oversized.cross_cutting_blocks,
      effective: oversized.effective_blocks,
      documents: oversized.documents
    },
    { primary: 10, crossCutting: 710, effective: 720, documents: 72 }
  );
  assert.ok(oversized.packet_chars > 10000);
  assert.match(validation.approval_blockers.join(" "), /effective blocks/);
  assert.match(validation.approval_blockers.join(" "), /effective documents/);
  assert.match(validation.approval_blockers.join(" "), /context-packet characters/);

  const reviewed = markImplementationReview(synthesized, {
    artifact: "_implementation_review.md",
    now: "2026-08-05T12:02:00.000Z",
    source: inputSource,
    applicableBlockIds
  });
  assert.throws(
    () => approveImplementationSpine(reviewed, {
      approvedBy: "reviewer",
      revision: "abc1234",
      now: "2026-08-05T12:03:00.000Z",
      source: inputSource,
      applicableBlockIds
    }),
    /hard limit/
  );

  const payload = implementationContextPayload(synthesized, {
    source: inputSource,
    applicableBlockIds,
    sliceOverride: "SLICE-1"
  });
  const guarded = formatGuardedImplementationContext(payload);
  assert.match(guarded, /STOP: the selected slice exceeds/);
  assert.ok(guarded.length < 3000);
  assert.doesNotMatch(guarded, new RegExp(blocks.at(-1).id.replace(/[.]/g, "\\.")));
});

test("detects dependency cycles and multiple active slices before approval", () => {
  const blocks = [
    directionBlock(1, { document: 1 }),
    directionBlock(1, { document: 2 })
  ];
  const inputSource = source({ applicable_block_count: 2 });
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  Object.assign(spine, authoredProposal(spine, blocks, 2));
  spine.slices[0].depends_on = [spine.slices[1].id];
  spine.slices[1].depends_on = [spine.slices[0].id];
  spine.slices[0].state = "active";
  spine.slices[1].state = "active";
  spine.active_slice = spine.slices[0].id;

  const validation = validateImplementationSpine(spine, {
    source: inputSource,
    applicableBlockIds: blocks.map((block) => block.id)
  });
  assert.match(validation.errors.join(" "), /dependency cycle/i);
  assert.match(validation.errors.join(" "), /Only one slice may be active/);
});

test("does not direct delivery work from a draft or stale context", () => {
  const blocks = [directionBlock(1)];
  const inputSource = source();
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  const applicableBlockIds = blocks.map((block) => block.id);
  const draft = implementationContextPayload(spine, { source: inputSource, applicableBlockIds });
  const stale = implementationContextPayload(spine, {
    source: { ...inputSource, dna_scope_sha256: "changed" },
    applicableBlockIds
  });

  assert.match(draft.exact_next_command, /Complete _implementation_proposal\.yaml/);
  assert.doesNotMatch(draft.exact_next_command, /implementation-start/);
  assert.match(stale.exact_next_command, /implementation-compile/);
});

test("allows an explicitly selected held slice to resume after its reopen condition is met", () => {
  const blocks = [directionBlock(1)];
  const inputSource = source();
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  Object.assign(spine, authoredProposal(spine, blocks));
  const sliceId = spine.slices[0].id;
  spine.slices[0].requires_refinement = false;
  spine.slices[0].state = "blocked";
  spine.plan_status = "active";
  spine.approval = {
    approved_at: "2026-08-05T12:01:00.000Z",
    approved_by: "reviewer",
    git_revision: "abc1234"
  };
  spine.work_items[blocks[0].id].state = "blocked";
  spine.work_items[blocks[0].id].hold = {
    reason: "Waiting for a decision.",
    reopen_when: "The decision is recorded.",
    owner: "user"
  };

  const resumed = startImplementationSlice(spine, {
    sliceId,
    now: "2026-08-05T12:02:00.000Z",
    source: inputSource
  });

  assert.equal(resumed.active_slice, sliceId);
  assert.equal(resumed.slices[0].state, "active");
  assert.equal(resumed.work_items[blocks[0].id].state, "blocked");
});

test("rejects a release-ready claim while delivery or independent gates remain open", () => {
  const blocks = [directionBlock(1)];
  const inputSource = source();
  const spine = buildImplementationSpine({
    source: inputSource,
    blocks,
    now: "2026-08-05T12:00:00.000Z"
  });
  spine.readiness.release_readiness = "ready";

  const validation = validateImplementationSpine(spine, {
    source: inputSource,
    applicableBlockIds: blocks.map((block) => block.id)
  });
  const summary = summarizeImplementationSpine(spine, validation);

  assert.match(validation.errors.join(" "), /Release readiness cannot be ready/);
  assert.equal(summary.readiness.release_readiness, "not_ready");
});

test("requires complete existing-build reconciliation and binds review to the sealed proposal", () => {
  const blocks = [directionBlock(1), directionBlock(2)];
  const inputSource = source({ applicable_block_count: 2 });
  const inventory = buildImplementationSpine({
    source: inputSource,
    blocks,
    adoptionMode: "existing_build",
    now: "2026-08-05T12:00:00.000Z"
  });
  const proposal = buildImplementationProposalTemplate(inventory);
  proposal.synthesis_basis.push({ ref: "journeys.md", role: "Critical outcome backbone." });
  proposal.tracks = [{ id: "TRACK-OUTCOMES", title: "Outcomes", order: 1 }];
  proposal.slices = [{
    id: "SLICE-OUTCOME",
    track: "TRACK-OUTCOMES",
    kind: "outcome",
    title: "Observable outcome",
    outcome: "A user can complete the intended journey.",
    order: 1,
    priority: "high",
    depends_on: [],
    blocking_gates: [],
    state: "verified",
    assurance_gate: {
      profiles: { software_quality: { level: "slice", review: "self_allowed" } },
      approval: "none",
      references: []
    },
    acceptance_checks: [{
      id: "SLICE-OUTCOME-AC01",
      description: "Inspect it.",
      assurance: {
        profile: "software_quality",
        method: "inspection",
        required_evidence: ["inspection_record"]
      }
    }]
  }];
  for (const item of Object.values(proposal.work_items)) item.primary_slice = "SLICE-OUTCOME";
  let candidate = applyImplementationProposal(inventory, proposal);
  assert.equal(candidate.slices[0].state, "queued");
  assert.throws(
    () => finalizeImplementationSynthesis(candidate, {
      synthesizedBy: "Agent",
      revision: "abc1234",
      now: "2026-08-05T12:01:00.000Z",
      source: inputSource,
      applicableBlockIds: blocks.map((block) => block.id)
    }),
    /not been reconciled/
  );

  for (const item of Object.values(proposal.work_items)) {
    item.existing_build_assessment = { status: "absent", refs: [], note: null };
  }
  candidate = applyImplementationProposal(inventory, proposal);
  const synthesized = finalizeImplementationSynthesis(candidate, {
    synthesizedBy: "Agent",
    revision: "abc1234",
    now: "2026-08-05T12:02:00.000Z",
    source: inputSource,
    applicableBlockIds: blocks.map((block) => block.id)
  });
  const reviewed = markImplementationReview(synthesized, {
    artifact: "_implementation_review.md",
    now: "2026-08-05T12:03:00.000Z",
    source: inputSource,
    applicableBlockIds: blocks.map((block) => block.id)
  });
  reviewed.slices[0].outcome = "A changed unreviewed outcome.";
  const validation = validateImplementationSpine(reviewed, {
    source: inputSource,
    applicableBlockIds: blocks.map((block) => block.id)
  });
  assert.match(validation.errors.join(" "), /changed after validation|no longer matches/);
});

test("seals inherited profiles and separates profile, method, and evidence contracts", () => {
  const block = directionBlock(1);
  const inputSource = source();
  const inventory = buildImplementationSpine({
    source: inputSource,
    blocks: [block],
    now: "2026-08-05T12:00:00.000Z"
  });
  const planned = authoredProposal(inventory, [block]);
  const originalFingerprint = proposalFingerprint(planned);
  planned.slices[0].assurance_gate.profiles.software_quality.review = "fresh_context_required";
  assert.notEqual(proposalFingerprint(planned), originalFingerprint);
  assert.equal(buildImplementationProposalTemplate(inventory).proposal_version, "0.2.0");
  assert.equal(ASSURANCE_PROFILE_CATALOG.software_quality.title, "Software quality");

  planned.slices[0].assurance_gate = {
    profiles: { experience: { level: "surface", review: "self_allowed" } },
    approval: "none",
    references: []
  };
  planned.slices[0].acceptance_checks[0].assurance = {
    profile: "experience",
    method: "unit",
    required_evidence: ["test_report"]
  };
  const validation = validateImplementationSpine(planned, {
    source: inputSource,
    applicableBlockIds: [block.id]
  });
  assert.match(validation.errors.join(" "), /omits inherited profile software_quality/);
  assert.match(validation.errors.join(" "), /method unit is incompatible with profile experience/);
  assert.match(validation.errors.join(" "), /profile experience level surface requires render_review/);
  assert.match(validation.errors.join(" "), /profile experience level surface requires end_to_end/);

  planned.slices[0].acceptance_checks[0].assurance = {
    profile: "experience",
    method: "render_review",
    required_evidence: ["review_record"]
  };
  const weakEvidence = validateImplementationSpine(planned, {
    source: inputSource,
    applicableBlockIds: [block.id]
  });
  assert.match(weakEvidence.errors.join(" "), /method render_review requires rendered_surface evidence/);
});

test("prevents slices from weakening inherited minimum assurance levels", () => {
  const block = directionBlock(1, { module: "PDEX" });
  block.assurance_profiles = ["experience"];
  block.assurance_levels_min = { experience: "journey" };
  const inputSource = source();
  const inventory = buildImplementationSpine({
    source: inputSource,
    blocks: [block],
    now: "2026-08-05T12:00:00.000Z"
  });
  const planned = authoredProposal(inventory, [block]);
  planned.slices[0].assurance_gate = {
    profiles: { experience: { level: "component", review: "self_allowed" } },
    approval: "none",
    references: []
  };
  planned.slices[0].acceptance_checks[0].assurance = {
    profile: "experience",
    method: "render_review",
    required_evidence: ["rendered_surface"]
  };
  const validation = validateImplementationSpine(planned, {
    source: inputSource,
    applicableBlockIds: [block.id]
  });
  assert.match(validation.errors.join(" "), /profile experience must be at least journey; found component/);
});

test("requires resolved UI harness decisions before experience assurance review", () => {
  const setup = activeAssuranceSpine({
    profile: "experience",
    method: "render_review",
    requiredEvidence: ["rendered_surface"]
  });
  assert.throws(
    () => prepareAssuranceReview(setup.spine, {
      sliceId: setup.sliceId,
      revision: "visual-a",
      now: "2026-08-05T12:03:00.000Z"
    }),
    /experience assurance tooling is unresolved/
  );
  const prepared = prepareAssuranceReview(setup.spine, {
    sliceId: setup.sliceId,
    revision: "visual-a",
    now: "2026-08-05T12:03:00.000Z",
    tooling: {
      component_ui: { decision: "declined", adapter: null, capabilities: [], note: "The route harness covers this small surface." },
      browser_journey: { decision: "selected", adapter: "playwright", capabilities: ["viewport_capture"] }
    }
  });
  assert.equal(prepared.packet.tooling.browser_journey.adapter, "playwright");
});

test("requires semantic navigation expectations in experience journey evidence", () => {
  const setup = activeAssuranceSpine({
    profile: "experience",
    method: "end_to_end",
    requiredEvidence: ["journey_trace"]
  });
  const prepared = prepareAssuranceReview(setup.spine, {
    sliceId: setup.sliceId,
    revision: "journey-a",
    now: "2026-08-05T12:03:00.000Z",
    tooling: {
      component_ui: { decision: "not_applicable", adapter: null, capabilities: [], note: "No reusable component states changed." },
      browser_journey: { decision: "selected", adapter: "playwright", capabilities: ["interaction_trace"] }
    }
  });
  const result = assuranceResult(prepared.packet);
  delete result.checks[0].evidence[0].expected_destination;
  assert.throws(
    () => submitAssuranceReview(prepared.spine, {
      sliceId: setup.sliceId,
      revision: "journey-a",
      now: "2026-08-05T12:04:00.000Z",
      packet: prepared.packet,
      result
    }),
    /expected_destination, expected_return, and retained_context/
  );
});

test("keeps finding IDs stable through remediation and a later revision-bound recheck", () => {
  const setup = activeAssuranceSpine();
  const prepared = prepareAssuranceReview(setup.spine, {
    sliceId: setup.sliceId,
    revision: "rev-a",
    now: "2026-08-05T12:03:00.000Z",
    directionExcerpts: [{ block_id: setup.block.id, direction: "Deliver the outcome.", verification: "Inspect it." }]
  });
  const failed = submitAssuranceReview(prepared.spine, {
    sliceId: setup.sliceId,
    revision: "rev-a",
    now: "2026-08-05T12:04:00.000Z",
    packet: prepared.packet,
    result: assuranceResult(prepared.packet, {
      checkStatus: "failed",
      evidence: [],
      findings: [{
        check_id: prepared.packet.checks[0].id,
        kind: "defect",
        severity: "high",
        summary: "The assembled outcome does not match the accepted behaviour.",
        evidence_ref: "test-results/review.json"
      }]
    })
  });
  assert.equal(deriveSliceAssuranceSummary(failed, setup.sliceId).status, "changes_required");
  assert.ok(failed.assurance.findings["QF-0001"]);

  const recompiled = buildImplementationSpine({
    source: setup.source,
    blocks: [setup.block],
    existing: failed,
    now: "2026-08-05T12:04:30.000Z"
  });
  assert.equal(recompiled.assurance.findings["QF-0001"].status, "needs_reconciliation");
  const replacement = authoredProposal(recompiled, [setup.block]);
  const reconciled = reconcileAssuranceFinding(replacement, {
    findingId: "QF-0001",
    sliceId: replacement.slices[0].id,
    checkId: replacement.slices[0].acceptance_checks[0].id,
    ref: "_implementation_review.md",
    note: "Mapped to the replacement slice and check.",
    now: "2026-08-05T12:04:45.000Z"
  });
  assert.equal(reconciled.assurance.findings["QF-0001"].status, "open");

  const remediated = remediateAssuranceFinding(failed, {
    findingId: "QF-0001",
    revision: "rev-b",
    ref: "src/outcome.js",
    note: "Corrected the assembled outcome.",
    now: "2026-08-05T12:05:00.000Z"
  });
  assert.equal(remediated.assurance.findings["QF-0001"].status, "recheck_required");
  const recheckPacket = prepareAssuranceReview(remediated, {
    sliceId: setup.sliceId,
    revision: "rev-b",
    now: "2026-08-05T12:06:00.000Z"
  });
  const passed = submitAssuranceReview(recheckPacket.spine, {
    sliceId: setup.sliceId,
    revision: "rev-b",
    now: "2026-08-05T12:07:00.000Z",
    packet: recheckPacket.packet,
    result: assuranceResult(recheckPacket.packet, {
      findingRechecks: [{ finding_id: "QF-0001", status: "resolved", note: "The corrected outcome now passes." }]
    })
  });
  assert.equal(passed.assurance.findings["QF-0001"].status, "resolved");
  assert.equal(deriveSliceAssuranceSummary(passed, setup.sliceId, { revision: "rev-b" }).status, "passed");

  const readyToClose = JSON.parse(JSON.stringify(passed));
  const item = readyToClose.work_items[setup.block.id];
  item.state = "verified";
  item.verification_evidence = [{ kind: "inspection", ref: "test-results/review.json", note: "Verified outcome." }];
  item.last_checked = "2026-08-05T12:07:00.000Z";
  item.checked_revision = "rev-b";
  const closed = closeImplementationSlice(readyToClose, {
    sliceId: setup.sliceId,
    revision: "rev-b",
    now: "2026-08-05T12:08:00.000Z",
    source: setup.source
  });
  assert.equal(closed.slices[0].state, "verified");
});

test("blocks insufficient scope, stale packets, weak reviewer provenance, and missing approval", () => {
  const scopeSetup = activeAssuranceSpine();
  const prepared = prepareAssuranceReview(scopeSetup.spine, {
    sliceId: scopeSetup.sliceId,
    revision: "scope-a",
    now: "2026-08-05T12:03:00.000Z"
  });
  const tampered = JSON.parse(JSON.stringify(prepared.packet));
  tampered.checks[0].description = "Tampered contract.";
  assert.throws(
    () => submitAssuranceReview(prepared.spine, {
      sliceId: scopeSetup.sliceId,
      revision: "scope-a",
      now: "2026-08-05T12:04:00.000Z",
      packet: tampered,
      result: assuranceResult(tampered)
    }),
    /packet hash/
  );
  const insufficient = submitAssuranceReview(prepared.spine, {
    sliceId: scopeSetup.sliceId,
    revision: "scope-a",
    now: "2026-08-05T12:04:00.000Z",
    packet: prepared.packet,
    result: assuranceResult(prepared.packet, { scopeStatus: "insufficient" })
  });
  assert.equal(insufficient.assurance.findings["QF-0001"].kind, "scope");
  assert.match(assuranceClosureErrors(insufficient, scopeSetup.sliceId, "scope-a").join(" "), /scope is not sufficient|unresolved blocking/);

  const approvalSetup = activeAssuranceSpine({
    profile: "experience",
    method: "render_review",
    requiredEvidence: ["rendered_surface"],
    review: "fresh_context_required",
    approval: "human",
    references: ["REF-HOME-01"]
  });
  const approvalPacket = prepareAssuranceReview(approvalSetup.spine, {
    sliceId: approvalSetup.sliceId,
    revision: "visual-a",
    now: "2026-08-05T12:03:00.000Z",
    tooling: {
      component_ui: { decision: "selected", adapter: "storybook", capabilities: ["isolated_states"] },
      browser_journey: { decision: "selected", adapter: "playwright", capabilities: ["interaction_trace"] }
    },
    referenceRecords: [{ id: "REF-HOME-01", path: "_assets/project_profile/references/home.png", sha256: "a".repeat(64) }]
  });
  assert.equal(approvalPacket.packet.tooling.browser_journey.adapter, "playwright");
  const missingComparison = assuranceResult(approvalPacket.packet, { reviewerMode: "fresh_context_ai" });
  delete missingComparison.checks[0].evidence[0].reference_ids;
  assert.throws(
    () => submitAssuranceReview(approvalPacket.spine, {
      sliceId: approvalSetup.sliceId,
      revision: "visual-a",
      now: "2026-08-05T12:04:00.000Z",
      packet: approvalPacket.packet,
      result: missingComparison
    }),
    /does not compare sealed reference REF-HOME-01/
  );
  assert.throws(
    () => submitAssuranceReview(approvalPacket.spine, {
      sliceId: approvalSetup.sliceId,
      revision: "visual-a",
      now: "2026-08-05T12:04:00.000Z",
      packet: approvalPacket.packet,
      result: assuranceResult(approvalPacket.packet, { reviewerMode: "self" })
    }),
    /reviewer mode self is insufficient/
  );
  const reviewed = submitAssuranceReview(approvalPacket.spine, {
    sliceId: approvalSetup.sliceId,
    revision: "visual-a",
    now: "2026-08-05T12:04:00.000Z",
    packet: approvalPacket.packet,
    result: assuranceResult(approvalPacket.packet, { reviewerMode: "fresh_context_ai" })
  });
  assert.match(assuranceClosureErrors(reviewed, approvalSetup.sliceId, "visual-a").join(" "), /requires current human/);
  const approved = approveSliceAssurance(reviewed, {
    sliceId: approvalSetup.sliceId,
    revision: "visual-a",
    approvalMode: "human",
    approvedBy: "product owner",
    ref: "review:visual-a",
    now: "2026-08-05T12:05:00.000Z"
  });
  assert.equal(deriveSliceAssuranceSummary(approved, approvalSetup.sliceId, { revision: "visual-a" }).approval.status, "approved");
  assert.deepEqual(assuranceClosureErrors(approved, approvalSetup.sliceId, "visual-a"), []);
});

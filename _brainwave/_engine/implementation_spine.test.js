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
  implementationContextPayload,
  formatImplementationContext,
  formatGuardedImplementationContext
} = require("./implementation_spine");

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
    acceptance_checks: [{
      id: `SLICE-OUTCOME-${index + 1}-AC01`,
      type: "inspection",
      description: `Verify observable outcome ${index + 1}.`
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
    details: { direction: `Accepted direction ${id}.` }
  };
}

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
    acceptance_checks: [{
      id: `SLICE-${index + 1}-AC01`,
      type: "inspection",
      description: `Inspect outcome ${index + 1}.`
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
    acceptance_checks: [{ id: "SLICE-OUTCOME-AC01", type: "inspection", description: "Inspect it." }]
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

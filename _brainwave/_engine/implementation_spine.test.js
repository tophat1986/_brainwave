"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildImplementationSpine,
  validateImplementationSpine,
  summarizeImplementationSpine,
  startImplementationSlice,
  implementationContextPayload,
  formatImplementationContext
} = require("./implementation_spine");

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
  assert.equal(spine.slices.length, 120);
  assert.equal(payload.work_items.length, 6);
  assert.ok(packet.length < 10000);
  assert.match(packet, /DNA direction coverage: built 0\/720/);
  assert.doesNotMatch(packet, new RegExp(blocks.at(-1).id.replace(/[.]/g, "\\.")));
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
  for (const slice of spine.slices) slice.requires_refinement = false;
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

  assert.match(draft.exact_next_command, /Refine the provisional slices/);
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
  const sliceId = spine.slices[0].id;
  spine.slices[0].requires_refinement = false;
  spine.slices[0].state = "blocked";
  spine.plan_status = "active";
  spine.approval = {
    approved_at: "2026-08-05T12:01:00.000Z",
    approved_by: "Jonny",
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

      // Implementation roadmap
      function roadmapSliceState(state) {
        return {
          queued: { label: "Planned", tone: "muted" },
          ready: { label: "Ready next", tone: "ready" },
          active: { label: "In progress", tone: "active" },
          implemented: { label: "Ready to check", tone: "working" },
          verified: { label: "Checked", tone: "complete" },
          blocked: { label: "Waiting", tone: "waiting" },
          deferred: { label: "Deferred", tone: "muted" }
        }[state] || { label: titleCase(state || "Unknown"), tone: "muted" };
      }

      function roadmapWorkItemState(state) {
        return {
          not_started: { label: "Planned", tone: "empty", progress: 0, glyph: "" },
          in_progress: { label: "In progress", tone: "working", progress: 45, glyph: "" },
          implemented: { label: "Ready to check", tone: "working", progress: 75, glyph: "" },
          verified: { label: "Checked", tone: "complete", progress: 100, glyph: "✓" },
          blocked: { label: "Waiting", tone: "muted", progress: 0, glyph: "" },
          deferred: { label: "Deferred", tone: "muted", progress: 0, glyph: "" },
          invalid: { label: "Needs correction", tone: "issue", progress: 0, glyph: "!" }
        }[state] || { label: "Not recorded", tone: "empty", progress: 0, glyph: "" };
      }

      function roadmapImplementationRing(state) {
        const display = roadmapWorkItemState(state);
        return `<span class="block-progress-ring ${esc(display.tone)}" style="--block-progress:${display.progress}" role="img" aria-label="${esc(display.label)}"><span>${esc(display.glyph)}</span></span>`;
      }

      function implementationStatusKey() {
        const rows = [
          ["not_started", "Planned"],
          ["in_progress", "In progress"],
          ["implemented", "Ready to check"],
          ["verified", "Checked"],
          ["blocked", "Waiting"],
          ["deferred", "Deferred"]
        ];
        return `<div class="block-map-tools"><details class="status-key"><summary><span class="ui-icon key" aria-hidden="true"></span><span>Status key</span><span class="chevron" aria-hidden="true"></span></summary><div class="status-key-panel implementation-status-key">${rows.map(([state, label]) => `<div class="status-key-row">${roadmapImplementationRing(state)}<span><strong>${esc(label)}</strong></span></div>`).join("")}</div></details></div>`;
      }

      function roadmapSliceItems(slice) {
        const items = implementationWorkItems.filter((item) =>
          item.primary_slice === slice.id || item.applies_to?.includes(slice.id)
        );
        return [...new Map(items.map((item) => [item.id, item])).values()];
      }

      function roadmapDnaMap(slice) {
        const byDocument = new Map();
        for (const item of roadmapSliceItems(slice)) {
          const documentId = item.document_id || blockById.get(item.id)?.document_id || "DNA document";
          if (!byDocument.has(documentId)) byDocument.set(documentId, []);
          byDocument.get(documentId).push(item);
        }
        if (!byDocument.size) return "";

        return `<div class="roadmap-dna-map">${[...byDocument.entries()].map(([documentId, items]) => {
          const document = expressedDocumentById.get(documentId);
          const firstBlock = blockById.get(items[0]?.id);
          const moduleId = document?.moduleId || firstBlock?.module_id;
          const documentNodeId = document?.id || documentId.split("-").at(-1);
          const title = document?.title || firstBlock?.document_title || documentId;
          const documentComplete = items.every((item) => item.state === "verified");
          const headingContents = `<span class="document-title ${documentComplete ? "complete" : ""}">${esc(title)}</span><span class="document-id">${esc(documentId)}</span>`;
          const heading = moduleId && documentNodeId
            ? `<button class="roadmap-document-heading" type="button" data-action="module-document" data-module="${esc(moduleId)}" data-document="${esc(documentNodeId)}">${headingContents}</button>`
            : `<div class="document-heading">${headingContents}</div>`;
          return `<div class="implementation-document roadmap-dna-document">
            ${heading}
            <div class="blocks">${items.map((item) => {
              const block = blockById.get(item.id);
              const display = roadmapWorkItemState(item.state);
              const stateClass = item.state === "blocked" ? "waiting" : item.state;
              return `<button class="dna-block roadmap-dna-block ${esc(stateClass || "not_started")}" type="button" data-action="block" data-block="${esc(item.id)}" title="${esc(`${item.id}: ${display.label}`)}">
                <span class="block-copy"><span class="block-slice">${esc(item.id)}</span><span class="block-title">${esc(item.direction?.title || item.title || block?.title || item.id)}</span><span class="roadmap-block-state">${esc(display.label)}</span></span>
                ${roadmapImplementationRing(item.state)}
              </button>`;
            }).join("")}</div>
          </div>`;
        }).join("")}</div>`;
      }

      function roadmapSlice(slice) {
        const stateDisplay = roadmapSliceState(slice.state);
        const dependencies = (slice.depends_on || []).map((id) => implementationSliceById.get(id) || { id, title: id });
        const gates = Array.isArray(slice.blocking_gates) ? slice.blocking_gates : [];
        const checks = Array.isArray(slice.acceptance_checks) ? slice.acceptance_checks : [];
        const passedChecks = checks.filter((check) => ["passed", "verified", "complete"].includes(check.status)).length;
        return `<details class="implementation-document roadmap-slice ${esc(stateDisplay.tone)}">
          <summary class="roadmap-slice-heading">
            <span class="document-title ${stateDisplay.tone === "complete" ? "complete" : ""}">${esc(slice.title)}<span class="roadmap-state ${esc(stateDisplay.tone)}">${esc(stateDisplay.label)}</span></span>
            <span class="roadmap-slice-reference"><span class="document-id">${esc(slice.id)}</span><span class="chevron" aria-hidden="true"></span></span>
          </summary>
          <div class="roadmap-slice-body">
            ${dependencies.length || gates.length ? `<div class="roadmap-sequence">${dependencies.length ? `<span><strong>After</strong>${dependencies.map((dependency) => esc(dependency.title)).join(" · ")}</span>` : ""}${gates.length ? `<span><strong>Waiting for</strong>${gates.map((gate) => esc(typeof gate === "string" ? gate : gate.title || gate.id || "Gate")).join(" · ")}</span>` : ""}</div>` : ""}
            ${roadmapDnaMap(slice)}
            ${checks.length ? `<details class="roadmap-checks"><summary>Acceptance checks <strong>${passedChecks}/${checks.length}</strong><span class="chevron" aria-hidden="true"></span></summary><ul>${checks.map((check) => `<li><span class="acceptance-state ${esc(check.status || "pending")}">${esc(["passed", "verified", "complete"].includes(check.status) ? "✓" : "○")}</span><span>${esc(check.description)}</span></li>`).join("")}</ul></details>` : ""}
          </div>
        </details>`;
      }

      function implementationRoadmap() {
        if (!implementationSlices.length) return "";
        const tracks = [...(implementation.tracks || [])].sort((left, right) => left.order - right.order);
        return `<section class="implementation-roadmap">
          ${implementationStatusKey()}
          <div class="roadmap-tracks">${tracks.map((track) => {
            const slices = implementationSlices.filter((slice) => slice.track === track.id).sort((left, right) => left.order - right.order);
            return `<section class="roadmap-track"><div class="module-section-head block-module-title roadmap-track-head"><span class="module-section-identity"><span class="module-mark" aria-hidden="true">${esc(String(track.order).padStart(2, "0"))}</span><span class="module-section-title">${esc(track.title)}</span></span><span class="module-section-count">${slices.length} slice${slices.length === 1 ? "" : "s"}</span></div><div class="roadmap-slices">${slices.map((slice) => roadmapSlice(slice)).join("")}</div></section>`;
          }).join("")}</div>
        </section>`;
      }

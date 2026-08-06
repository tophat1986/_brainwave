      // Implementation roadmap
      function roadmapSliceState(state) {
        return {
          queued: { label: "", tone: "empty" },
          ready: { label: "", tone: "empty" },
          active: { label: "Slice active", tone: "active" },
          implemented: { label: "Ready to verify", tone: "working" },
          verified: { label: "Slice verified", tone: "complete" },
          blocked: { label: "Slice blocked", tone: "muted" },
          deferred: { label: "Slice deferred", tone: "muted" }
        }[state] || { label: "", tone: "empty" };
      }

      function roadmapWorkItemState(state) {
        return {
          queued: { label: "", tone: "empty", progress: 0, glyph: "" },
          ready: { label: "", tone: "empty", progress: 0, glyph: "" },
          active: { label: "In active slice", tone: "working", progress: 45, glyph: "" },
          not_started: { label: "", tone: "empty", progress: 0, glyph: "" },
          in_progress: { label: "In active slice", tone: "working", progress: 45, glyph: "" },
          implemented: { label: "Ready to verify", tone: "working", progress: 75, glyph: "" },
          verified: { label: "Verified", tone: "complete", progress: 100, glyph: "✓" },
          blocked: { label: "Blocked", tone: "muted", progress: 0, glyph: "" },
          deferred: { label: "Deferred", tone: "muted", progress: 0, glyph: "" },
          invalid: { label: "Needs correction", tone: "issue", progress: 0, glyph: "!" }
        }[state] || { label: "Not recorded", tone: "empty", progress: 0, glyph: "" };
      }

      function roadmapImplementationRing(state, className = "", sequence = "") {
        const display = roadmapWorkItemState(state);
        const ariaLabel = display.tone === "complete" ? "Complete" : display.label || "Incomplete";
        return `<span class="block-progress-ring ${esc(display.tone)} ${esc(className)}" style="--block-progress:${display.progress}" role="img" aria-label="${esc(`${sequence ? `${sequence}: ` : ""}${ariaLabel}`)}"><span>${esc(display.glyph || sequence)}</span></span>`;
      }

      function implementationStatusKey() {
        const rows = [
          ["verified", "Verified"],
          ["implemented", "Ready to verify"],
          ["in_progress", "In active slice"],
          ["not_started", "Not started"]
        ];
        return statusKeyControl(rows.map(([state, label]) => ({
          visual: roadmapImplementationRing(state, "status-key-ring"),
          label
        })), "implementation-status-key");
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
              return `<button class="dna-block roadmap-dna-block ${esc(stateClass || "not_started")}" type="button" data-action="block" data-block="${esc(item.id)}" title="${esc(`${item.id}: ${display.tone === "complete" ? "Complete" : display.label || "Incomplete"}`)}">
                <span class="block-copy"><span class="block-slice">${esc(item.id)}</span><span class="block-title">${esc(item.direction?.title || item.title || block?.title || item.id)}</span></span>
                ${roadmapImplementationRing(item.state)}
              </button>`;
            }).join("")}</div>
          </div>`;
        }).join("")}</div>`;
      }

      function roadmapSlice(slice, track) {
        const stateDisplay = roadmapSliceState(slice.state);
        const sequence = `${track.order}.${slice.order}`;
        return `<details class="implementation-document roadmap-slice ${esc(stateDisplay.tone)}" ${slice.state === "active" ? "open" : ""}>
          <summary class="roadmap-slice-heading">
            ${roadmapImplementationRing(slice.state, "roadmap-slice-ring", sequence)}
            <span class="document-title">${esc(slice.title)}${stateDisplay.label ? `<span class="roadmap-state ${esc(stateDisplay.tone)}">${esc(stateDisplay.label)}</span>` : ""}</span>
            <span class="roadmap-slice-reference"><span class="document-id">${esc(slice.id)}</span><span class="chevron" aria-hidden="true"></span></span>
          </summary>
          <div class="roadmap-slice-body">
            ${roadmapDnaMap(slice)}
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
            const active = slices.some((slice) => slice.state === "active");
            return `<details class="roadmap-track ${active ? "active" : ""}" ${active ? "open" : ""}><summary class="module-section-head roadmap-track-head"><span class="module-section-identity"><span class="module-mark roadmap-track-mark" aria-hidden="true">${esc(String(track.order).padStart(2, "0"))}</span><span class="module-section-title">${esc(track.title)}</span></span><span class="roadmap-track-reference"><span class="module-section-count">${slices.length} slice${slices.length === 1 ? "" : "s"}</span><span class="chevron" aria-hidden="true"></span></span></summary><div class="roadmap-track-body"><div class="roadmap-slices">${slices.map((slice) => roadmapSlice(slice, track)).join("")}</div></div></details>`;
          }).join("")}</div>
        </section>`;
      }

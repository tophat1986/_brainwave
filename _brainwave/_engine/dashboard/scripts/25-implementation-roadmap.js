      // Implementation roadmap
      function roadmapSliceState(state) {
        return {
          queued: { label: "Planned", tone: "muted" },
          ready: { label: "Ready next", tone: "ready" },
          active: { label: "In progress", tone: "active" },
          implemented: { label: "Built · check", tone: "working" },
          verified: { label: "Checked", tone: "complete" },
          blocked: { label: "Blocked", tone: "issue" },
          deferred: { label: "Deferred", tone: "muted" }
        }[state] || { label: titleCase(state || "Unknown"), tone: "muted" };
      }

      function roadmapBlockButton(blockId, primary) {
        const item = implementationItemByBlockId.get(blockId);
        const title = item?.direction?.title || item?.title || blockId;
        return `<button class="roadmap-block" type="button" data-action="block" data-block="${esc(blockId)}"><span>${esc(blockId)}</span><strong>${esc(title)}</strong><em>${primary ? "Primary" : "Shared"}</em></button>`;
      }

      function roadmapMapping(slice) {
        const primary = implementationWorkItems
          .filter((item) => item.primary_slice === slice.id)
          .map((item) => item.id)
          .sort();
        const shared = implementationWorkItems
          .filter((item) => item.applies_to?.includes(slice.id))
          .map((item) => item.id)
          .sort();
        return `<details class="roadmap-mapping"><summary>DNA directions · ${primary.length + shared.length}</summary><div class="roadmap-block-list">${primary.map((id) => roadmapBlockButton(id, true)).join("")}${shared.map((id) => roadmapBlockButton(id, false)).join("")}</div></details>`;
      }

      function roadmapSlice(slice, trackOrder) {
        const context = implementationContextBySliceId.get(slice.id) || {};
        const stateDisplay = roadmapSliceState(slice.state);
        const dependencies = (slice.depends_on || []).map((id) => implementationSliceById.get(id) || { id, title: id });
        const gates = Array.isArray(slice.blocking_gates) ? slice.blocking_gates : [];
        const checks = Array.isArray(slice.acceptance_checks) ? slice.acceptance_checks : [];
        const passedChecks = checks.filter((check) => ["passed", "verified", "complete"].includes(check.status)).length;
        const notices = [
          ...(implementationValidation.errors || []),
          ...(implementationValidation.approval_blockers || []),
          ...(implementationValidation.warnings || [])
        ].filter((message) => String(message).includes(slice.id));
        const supportingRows = [
          dependencies.length
            ? `<div class="roadmap-detail-row"><span>After</span><strong>${dependencies.map((dependency) => esc(dependency.title)).join(" · ")}</strong></div>`
            : "",
          gates.length
            ? `<div class="roadmap-detail-row attention"><span>Waiting on</span><strong>${gates.map((gate) => esc(typeof gate === "string" ? gate : gate.title || gate.id || "Gate")).join(" · ")}</strong></div>`
            : ""
        ].filter(Boolean).join("");
        return `<details class="roadmap-slice ${esc(stateDisplay.tone)}">
          <summary>
            <span class="roadmap-order">${esc(`${trackOrder}.${slice.order}`)}</span>
            <span class="roadmap-slice-heading"><strong>${esc(slice.title)}</strong><em class="roadmap-state ${esc(stateDisplay.tone)}">${esc(stateDisplay.label)}</em></span>
            <span class="roadmap-slice-context">${esc(context.effective_blocks || 0)} DNA</span>
            <span class="chevron" aria-hidden="true"></span>
          </summary>
          <div class="roadmap-slice-body">
            <p class="roadmap-outcome">${esc(slice.outcome)}</p>
            ${supportingRows ? `<div class="roadmap-detail-list">${supportingRows}</div>` : ""}
            ${checks.length ? `<div class="roadmap-checks"><h5>Checks <span>${passedChecks}/${checks.length}</span></h5><ul>${checks.map((check) => `<li><span class="acceptance-state ${esc(check.status || "pending")}">${esc(["passed", "verified", "complete"].includes(check.status) ? "✓" : "○")}</span><span>${esc(check.description)}</span></li>`).join("")}</ul></div>` : ""}
            ${notices.length ? `<div class="roadmap-slice-notice"><strong>Note</strong><span>${esc(notices[0])}</span></div>` : ""}
            ${roadmapMapping(slice)}
          </div>
        </details>`;
      }

      function implementationRoadmap() {
        if (!implementationSlices.length) return "";
        const tracks = [...(implementation.tracks || [])].sort((left, right) => left.order - right.order);
        const errors = implementationValidation.errors || [];
        const warnings = implementationValidation.warnings || [];
        const blockers = implementationValidation.approval_blockers || [];
        const noticeTotal = errors.length + blockers.length + warnings.length;
        const notices = noticeTotal
          ? `<details class="roadmap-notices"><summary>${noticeTotal} plan note${noticeTotal === 1 ? "" : "s"}</summary><div>${errors.map((message) => `<p><strong>Fix</strong>${esc(message)}</p>`).join("")}${blockers.map((message) => `<p><strong>Blocked</strong>${esc(message)}</p>`).join("")}${warnings.map((message) => `<p><strong>Review</strong>${esc(message)}</p>`).join("")}</div></details>`
          : "";
        return `<section class="implementation-roadmap">
          <header class="roadmap-head"><div><span class="alignment-kicker">Implementation plan</span><h3>Delivery slices</h3></div><strong>${dashboardStats.verifiedSlices}/${implementationSlices.length} checked</strong></header>
          ${notices}
          <div class="roadmap-tracks">${tracks.map((track) => {
            const slices = implementationSlices.filter((slice) => slice.track === track.id).sort((left, right) => left.order - right.order);
            return `<section class="roadmap-track"><header><h4>${esc(track.title)}</h4><span>${slices.length}</span></header><div class="roadmap-slices">${slices.map((slice) => roadmapSlice(slice, track.order)).join("")}</div></section>`;
          }).join("")}</div>
        </section>`;
      }

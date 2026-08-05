      // Implementation roadmap
      function roadmapSliceState(state) {
        return {
          queued: { label: "Planned", tone: "muted" },
          ready: { label: "Ready next", tone: "ready" },
          active: { label: "In progress", tone: "active" },
          implemented: { label: "Built · checks remain", tone: "working" },
          verified: { label: "Checked", tone: "complete" },
          blocked: { label: "Blocked", tone: "issue" },
          deferred: { label: "Deferred", tone: "muted" }
        }[state] || { label: titleCase(state || "Unknown"), tone: "muted" };
      }

      function roadmapBlockButton(blockId, primary) {
        const item = implementationItemByBlockId.get(blockId);
        const title = item?.direction?.title || item?.title || blockId;
        return `<button class="roadmap-block" type="button" data-action="block" data-block="${esc(blockId)}"><span>${esc(blockId)}</span><strong>${esc(title)}</strong><em>${primary ? "Primary" : "Cross-cutting"}</em></button>`;
      }

      function roadmapMapping(slice) {
        const primary = implementationWorkItems
          .filter((item) => item.primary_slice === slice.id)
          .map((item) => item.id)
          .sort();
        const crossCutting = implementationWorkItems
          .filter((item) => item.applies_to?.includes(slice.id))
          .map((item) => item.id)
          .sort();
        return `<details class="roadmap-mapping"><summary>DNA mapping · ${primary.length} primary · ${crossCutting.length} cross-cutting</summary><div class="roadmap-block-list">${primary.map((id) => roadmapBlockButton(id, true)).join("")}${crossCutting.map((id) => roadmapBlockButton(id, false)).join("")}</div></details>`;
      }

      function roadmapMetric(label, value, detail = "") {
        return `<div class="roadmap-metric"><span>${esc(label)}</span><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</div>`;
      }

      function roadmapSlice(slice, trackOrder) {
        const context = implementationContextBySliceId.get(slice.id) || {};
        const stateDisplay = roadmapSliceState(slice.state);
        const dependencies = (slice.depends_on || []).map((id) => implementationSliceById.get(id) || { id, title: id });
        const gates = Array.isArray(slice.blocking_gates) ? slice.blocking_gates : [];
        const checks = Array.isArray(slice.acceptance_checks) ? slice.acceptance_checks : [];
        const notices = [
          ...(implementationValidation.errors || []),
          ...(implementationValidation.approval_blockers || []),
          ...(implementationValidation.warnings || [])
        ].filter((message) => String(message).includes(slice.id));
        const contextSize = Number(context.packet_chars || 0);
        return `<details class="roadmap-slice ${esc(stateDisplay.tone)}" ${slice.state === "active" ? "open" : ""}>
          <summary>
            <span class="roadmap-order">${esc(`${trackOrder}.${slice.order}`)}</span>
            <span class="roadmap-slice-copy"><span class="roadmap-slice-heading"><strong>${esc(slice.title)}</strong><em class="roadmap-state ${esc(stateDisplay.tone)}">${esc(stateDisplay.label)}</em></span><span>${esc(slice.outcome)}</span></span>
            <span class="roadmap-slice-context">${esc(context.effective_blocks || 0)} directions</span>
            <span class="chevron" aria-hidden="true"></span>
          </summary>
          <div class="roadmap-slice-body">
            <div class="roadmap-metrics">
              ${roadmapMetric("Primary directions", context.primary_blocks || 0)}
              ${roadmapMetric("Cross-cutting", context.cross_cutting_blocks || 0)}
              ${roadmapMetric("Total loaded", context.effective_blocks || 0, "effective directions")}
              ${roadmapMetric("Documents", context.documents || 0)}
              ${roadmapMetric("Approx. context", contextSize.toLocaleString(), "characters")}
            </div>
            <div class="roadmap-detail-grid">
              <section><h4>Dependencies</h4>${dependencies.length ? `<ul>${dependencies.map((dependency) => `<li><span>${esc(dependency.title)}</span><small>${esc(dependency.id)}</small></li>`).join("")}</ul>` : '<p class="roadmap-none">None</p>'}</section>
              <section><h4>Blocking gates</h4>${gates.length ? `<ul>${gates.map((gate) => `<li><span>${esc(typeof gate === "string" ? gate : gate.title || gate.id || "Gate")}</span></li>`).join("")}</ul>` : '<p class="roadmap-none">None</p>'}</section>
              <section class="roadmap-checks"><h4>Acceptance checks</h4>${checks.length ? `<ul>${checks.map((check) => `<li><span class="acceptance-state ${esc(check.status || "pending")}">${esc(titleCase(check.status || "pending"))}</span><span>${esc(check.description)}</span></li>`).join("")}</ul>` : '<p class="roadmap-none">None recorded</p>'}</section>
            </div>
            ${notices.length ? `<div class="roadmap-slice-notice"><strong>Plan check</strong><span>${esc(notices[0])}</span>${notices.length > 1 ? `<small>${notices.length - 1} more notice${notices.length === 2 ? "" : "s"}</small>` : ""}</div>` : ""}
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
        const planLabel = implementation.plan_status === "draft" ? "Proposed roadmap" : "Implementation roadmap";
        const planSummary = implementation.plan_status === "draft"
          ? "Review the proposed outcomes, sequence, dependencies, gates, checks, and context size before approving the implementation plan."
          : "This is the working implementation sequence. Each slice carries only the DNA direction needed for its outcome.";
        const noticeTotal = errors.length + blockers.length + warnings.length;
        const notices = noticeTotal
          ? `<details class="roadmap-notices" ${errors.length || blockers.length ? "open" : ""}><summary>${errors.length ? `${errors.length} issue${errors.length === 1 ? "" : "s"} to fix` : blockers.length ? `${blockers.length} approval blocker${blockers.length === 1 ? "" : "s"}` : `${warnings.length} planning warning${warnings.length === 1 ? "" : "s"}`}</summary><div>${errors.map((message) => `<p><strong>Must fix</strong>${esc(message)}</p>`).join("")}${blockers.map((message) => `<p><strong>Blocks approval</strong>${esc(message)}</p>`).join("")}${warnings.map((message) => `<p><strong>Review</strong>${esc(message)}</p>`).join("")}</div></details>`
          : "";
        return `<section class="implementation-roadmap">
          <header class="roadmap-head"><div><span class="alignment-kicker">${esc(planLabel)}</span><h3>Outcome-led delivery slices</h3><p>${esc(planSummary)}</p></div><div class="roadmap-plan-meta"><strong>${implementationSlices.length}</strong><span>slice${implementationSlices.length === 1 ? "" : "s"}</span><small>${tracks.length} track${tracks.length === 1 ? "" : "s"}</small></div></header>
          ${notices}
          <div class="roadmap-tracks">${tracks.map((track) => {
            const slices = implementationSlices.filter((slice) => slice.track === track.id).sort((left, right) => left.order - right.order);
            return `<section class="roadmap-track"><header><span>${esc(String(track.order).padStart(2, "0"))}</span><div><h4>${esc(track.title)}</h4><small>${slices.length} slice${slices.length === 1 ? "" : "s"}</small></div></header><div class="roadmap-slices">${slices.map((slice) => roadmapSlice(slice, track.order)).join("")}</div></section>`;
          }).join("")}</div>
        </section>`;
      }

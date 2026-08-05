      // Inspector
      function renderInspectorView(view) {
        document.getElementById("inspector-eyebrow").textContent = view.eyebrow;
        document.getElementById("inspector-title").textContent = view.title;
        document.getElementById("inspector-meta").textContent = view.meta || "";
        const body = document.getElementById("inspector-body");
        body.innerHTML = view.html;
        body.scrollTop = 0;
        document.getElementById("inspector-foot").innerHTML = view.sourcePath
          ? `<a class="source-link" href="${esc(safeHref(view.sourcePath))}" target="_blank" rel="noopener">Open source ↗</a>`
          : "";
        document.querySelector(".back-button").hidden = inspectorHistory.length === 0;
      }

      function openInspector(view, { remember = false, syncRoute = true } = {}) {
        const inspector = document.getElementById("inspector");
        const wasOpen = inspector.classList.contains("open");
        if (!wasOpen) {
          inspectorReturnFocus = document.activeElement;
          inspectorHistory = [];
        } else if (remember && inspectorView) {
          inspectorHistory.push(inspectorView);
        }
        inspectorView = view;
        renderInspectorView(view);
        inspector.classList.add("open");
        inspector.setAttribute("aria-hidden", "false");
        document.getElementById("scrim").classList.add("open");
        document.querySelector(".shell").inert = true;
        (inspectorHistory.length ? inspector.querySelector(".back-button") : inspector.querySelector(".close-button")).focus();
        if (syncRoute) setBlockRoute(view.blockId || null, { replace: !view.blockId });
      }

      function backInspector() {
        const previousView = inspectorHistory.pop();
        if (!previousView) return;
        inspectorView = previousView;
        renderInspectorView(previousView);
        setBlockRoute(previousView.blockId || null, { replace: true });
        (inspectorHistory.length ? document.querySelector(".back-button") : document.querySelector(".close-button")).focus();
      }

      function closeInspector({ syncRoute = true } = {}) {
        const inspector = document.getElementById("inspector");
        inspector.classList.remove("open");
        inspector.setAttribute("aria-hidden", "true");
        document.getElementById("scrim").classList.remove("open");
        document.querySelector(".shell").inert = false;
        inspectorHistory = [];
        inspectorView = null;
        if (inspectorReturnFocus && typeof inspectorReturnFocus.focus === "function") {
          inspectorReturnFocus.focus();
        }
        if (syncRoute) setBlockRoute(null, { replace: true });
      }

      function openContent(key) {
        const content = presentationContent[key] || {};
        openInspector({
          eyebrow: key === "seed" ? "Stage · 01" : key === "north_star" ? "Stage · 02" : "Reference",
          title: content.title || titleCase(key),
          meta: content.path || "",
          html: content.markdown?.trim()
            ? `<div class="reader">${markdownToHtml(content.markdown)}</div>`
            : emptyReader(key === "decisions" ? "history" : ""),
          sourcePath: content.path
        });
      }

      function openDecisions() {
        const decisions = Array.isArray(presentation.decisions) ? presentation.decisions : [];
        const content = presentationContent.decisions || {};
        const html = decisions.length
          ? `<div class="decision-list">${decisions.slice().reverse().map((decision) =>
              `<article class="decision-card"><div class="decision-time">${esc(decision.timestamp || "Decision")}</div><div class="decision-title">${esc(decision.decision || decision.trigger || "Steering decision")}</div>${decision.rationale ? `<div class="decision-rationale">${esc(decision.rationale)}</div>` : ""}</article>`
            ).join("")}</div>`
          : emptyReader("history");
        openInspector({
          eyebrow: "Project record",
          title: content.title || "Decision history",
          meta: decisions.length ? `${decisions.length} steering decision${decisions.length === 1 ? "" : "s"}` : "",
          html,
          sourcePath: content.path
        });
      }

      function openState() {
        const snapshot = state.generated_at ? new Date(state.generated_at).toLocaleString() : "—";
        const colors = profileColors();
        const setupRows = setupFieldDefinitions.map((definition) =>
          `<div class="state-row"><span>${esc(definition.label)}</span><strong>${esc(friendlySetting(definition))}</strong></div>`
        ).join("");
        const colorsByRole = colors.reduce((groups, color) => {
          const role = color.role || "Unassigned";
          if (!groups.has(role)) groups.set(role, []);
          groups.get(role).push(color);
          return groups;
        }, new Map());
        const colorMarkup = colors.length
          ? `<span class="profile-color-groups">${[...colorsByRole.entries()].map(([role, roleColors]) => `<span class="profile-color-group"><span class="profile-color-role">${esc(role)}</span><span class="profile-colors">${roleColors.map((color) => `<span class="profile-color" title="${esc(color.usage || "")}">${color.safeValue ? `<i style="background:${esc(color.safeValue)}"></i>` : ""}${esc(color.name || color.value)}${color.featured ? '<em class="profile-color-featured">Featured</em>' : ""}</span>`).join("")}</span></span>`).join("")}</span>`
          : "Not added yet";
        const logoStatus = projectProfile.logo?.path
          ? `${projectProfile.logo.exists === false ? "File not found" : "Added"} · ${titleCase(projectProfile.logo.status || "working")}`
          : "Not added yet";
        const projectRows = [
          ["Profile", projectStatusLabels[projectProfile.status] || "Not discussed yet"],
          ["Project name", projectProfile.name || "Not added yet"],
          ["Short description", projectProfile.short_description || "Not added yet"],
          ["Tagline", projectProfile.tagline || "Not added yet"],
          ["Logo", logoStatus],
          ["Colours", colorMarkup],
          ["Style direction", projectProfile.style_direction || "Not added yet"]
        ].map(([label, value]) =>
          `<div class="state-row"><span>${esc(label)}</span><strong>${label === "Colours" ? value : esc(value)}</strong></div>`
        ).join("");
        const dashboardReady = Boolean(experienceCheckpoints.dashboard_introduced_at);
        const basicsReady = Boolean(experienceCheckpoints.project_basics_checked_at);
        const implementationProgress = (() => {
          if (!foundationComplete) return "Starts after foundation";
          if (implementation.mode === "not_compiled") return "Plan not compiled";
          if (implementation.source_stale) return "Plan needs refreshing";
          const total = implementationSlices.length;
          if (implementation.plan_status === "draft") {
            const synthesis = implementation.planning?.synthesis_status || "inventory_ready";
            if (synthesis === "inventory_ready") return "Inventory ready";
            return `${total} slice${total === 1 ? "" : "s"} ready for approval`;
          }
          return `${dashboardStats.verifiedSlices}/${total} slices complete`;
        })();
        openInspector({
          eyebrow: "Your project",
          title: projectProfile.name || presentation.project_title || "Project basics",
          meta: projectStatusLabels[projectProfile.status] || "Your setup and progress",
          html: `<div class="state-sections">
            <section class="state-section"><h3 class="state-section-title">Your setup</h3><div class="state-grid">${setupRows}</div></section>
            <section class="state-section"><h3 class="state-section-title">Project basics</h3><div class="state-grid">${projectRows}</div></section>
            <section class="state-section"><h3 class="state-section-title">Getting started</h3><div class="state-grid">
              <div class="state-row"><span>Dashboard</span><strong><span class="checkpoint-value ${dashboardReady ? "complete" : ""}">${dashboardReady ? "Introduced" : "Still to introduce"}</span></strong></div>
              <div class="state-row"><span>Project basics</span><strong><span class="checkpoint-value ${basicsReady ? "complete" : ""}">${basicsReady ? "Checked" : "Still to discuss"}</span></strong></div>
            </div></section>
            <section class="state-section"><h3 class="state-section-title">Progress</h3><div class="state-grid">
              <div class="state-row"><span>Current step</span><strong>${esc(currentDefinition.action)}</strong></div>
              <div class="state-row"><span>Idea</span><strong>${esc(state.seed?.integrity === "unchanged" ? "Saved ✓" : titleCase(state.seed?.integrity || "Waiting"))}</strong></div>
              <div class="state-row"><span>North Star</span><strong>${esc(titleCase(state.north_star?.status || "Waiting"))}</strong></div>
              <div class="state-row"><span>DNA modules</span><strong>${esc(dashboardStats.selectedModuleNames.join(" · ") || "—")}</strong></div>
              <div class="state-row"><span>DNA documents</span><strong>${dashboardStats.completeDocuments}/${dashboardStats.expressedDocuments}</strong></div>
              <div class="state-row"><span>Implementation</span><strong>${esc(implementationProgress)}</strong></div>
            </div></section>
            <details class="technical-details"><summary>Technical details</summary><div class="state-grid">
              <div class="state-row"><span>Updated</span><strong>${esc(snapshot)}</strong></div>
              <div class="state-row"><span>Profile updated</span><strong>${esc(settings.profile_last_updated || "—")}</strong></div>
              <div class="state-row"><span>State file</span><strong>${esc(state.lifecycle?.path || "_brainwave_state.yaml")}</strong></div>
            </div></details>
          </div>`
        });
      }

      function openModule(moduleId, { remember = false } = {}) {
        const module = modules[moduleId];
        if (!module) return;
        const nodes = Object.values(module.nodes || {});
        const contract = module.module_contract || {};
        const groups = nodes.filter((node) => node.type === "directory" && !node.parent_id).sort((a, b) => a.id.localeCompare(b.id));
        const timing = contract.timing || {};
        const timingMarkup = timing.consider_early || timing.can_defer_when || timing.must_not_defer_when
          ? `<div><strong>Timing</strong><ul>${timing.consider_early ? `<li><b>Consider early:</b> ${esc(timing.consider_early)}</li>` : ""}${timing.can_defer_when ? `<li><b>Can wait:</b> ${esc(timing.can_defer_when)}</li>` : ""}${timing.must_not_defer_when ? `<li><b>Cannot wait:</b> ${esc(timing.must_not_defer_when)}</li>` : ""}</ul></div>`
          : "";
        const boundary = contract.when_relevant
          ? `<details class="module-boundary"><summary>Domain boundary</summary><div class="module-boundary-body"><p><strong>Use when:</strong> ${esc(contract.when_relevant)}</p>${timingMarkup}${Array.isArray(contract.owns) && contract.owns.length ? `<div><strong>Owns</strong><ul>${contract.owns.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : ""}${Array.isArray(contract.does_not_own) && contract.does_not_own.length ? `<div><strong>Does not own</strong><ul>${contract.does_not_own.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>` : ""}</div></details>`
          : "";
        const html = `<div class="module-detail-head" data-tone="${moduleTone(moduleId)}"><span class="module-mark">${esc(moduleCode(moduleId))}</span><div><div class="module-detail-description">${esc(module.description)}</div></div></div>
          ${boundary}<div class="module-detail-groups">${groups.map((group) => {
            const documents = nodes.filter((node) => node.type === "file" && node.parent_id === group.id).sort((a, b) => a.id.localeCompare(b.id));
            return `<section class="module-detail-group"><h3><span>${esc(group.title)}</span><small>${esc(group.qualified_id)}</small></h3>${group.when_relevant ? `<p>${esc(group.when_relevant)}</p>` : ""}<div class="module-doc-list">${documents.map((document) =>
              `<button class="module-doc" type="button" data-action="module-document" data-module="${esc(moduleId)}" data-document="${esc(document.id)}"><span><strong>${esc(document.title)}</strong><small>${esc(document.qualified_id)}</small></span><span class="module-doc-indicator">${document.baseline ? '<span class="ui-icon flag" aria-label="Baseline" title="Baseline"></span>' : ""}</span></button>`
            ).join("")}</div></section>`;
          }).join("")}</div>`;
        openInspector({
          eyebrow: `${module.selected ? "Selected" : "Installed"} · ${module.canonical_id}`,
          title: module.name,
          meta: `v${module.version} · ${module.totals?.files || 0} documents`,
          html
        }, { remember });
      }

      function openModuleDocument(moduleId, documentId) {
        const module = modules[moduleId];
        const document = module?.nodes?.[documentId];
        if (!module || !document) return;
        const path = trackedPathByQualifiedId.get(document.qualified_id) || null;
        const renderedDocument = path ? presentationDocuments[path] : null;
        const preview = renderedDocument?.markdown?.trim()
          ? `<div class="reader">${markdownToHtml(renderedDocument.markdown)}</div>`
          : `<div class="block-section"><div class="block-section-label">${document.baseline ? "Baseline" : "Optional"}</div><div class="reader"><p>${inlineMarkdown(document.intent || "Available when this DNA document is relevant to the concept.")}</p></div></div>`;
        const content = `<div class="document-identity">${esc(document.qualified_id)}</div>${preview}`;
        openInspector({
          eyebrow: module.name,
          title: document.title,
          meta: document.qualified_id,
          html: content,
          sourcePath: path
        }, { remember: true });
      }

      function openDocument(path) {
        const document = presentationDocuments[path];
        if (!document) return;
        openInspector({
          eyebrow: document.module_name || "Documentation",
          title: document.title,
          meta: document.id || "",
          html: `<div class="reader">${markdownToHtml(document.markdown)}</div>`,
          sourcePath: path
        });
      }

      function openBlock(blockId, { remember = false, syncRoute = true } = {}) {
        const block = blockById.get(blockId);
        if (!block) return;
        const document = expressedDocumentById.get(block.document_id);
        const showingAlignment = currentStage === "brainwave_documentation_complete";
        const workItem = implementationItemByBlockId.get(blockId);
        const status = showingAlignment
          ? (block.contract_errors?.length
              ? "invalid"
              : workItem?.state || (implementation.mode === "not_compiled" ? "not_started" : "invalid"))
          : blockDocumentationStatus(block, document);
        const statusLabel = showingAlignment
          ? alignmentState(status).label
          : documentationState(status).ringLabel;
        const detailLabels = [
          ["context", "Context"],
          ["direction", "Direction"],
          ["rationale", "Why"],
          ["alternatives_considered", "Alternatives"],
          ["consequences", "Consequences"],
          ["future_fit", "Future fit"],
          ["verification", "Verification"],
          ["former_direction", "Former direction"]
        ];
        const sections = detailLabels.filter(([key]) => block.details?.[key]).map(([key, label]) =>
          `<section class="block-section"><div class="block-section-label">${label}</div><div class="reader">${markdownToHtml(block.details[key])}</div></section>`
        ).join("");
        const evidenceSections = showingAlignment && workItem
          ? [["implementation_evidence", "Implementation evidence"], ["verification_evidence", "Verification evidence"]].map(([key, label]) => {
              const evidence = Array.isArray(workItem[key]) ? workItem[key] : [];
              if (!evidence.length) return "";
              return `<section class="block-section"><div class="block-section-label">${label}</div><div class="reader"><ul>${evidence.map((entry) => `<li><code>${esc(entry.ref)}</code> — ${esc(entry.note)}</li>`).join("")}</ul></div></section>`;
            }).join("")
          : "";
        const checked = showingAlignment && workItem && (workItem.last_checked || workItem.checked_revision)
          ? `<div class="block-check-meta"><span>Last checked: ${esc(workItem.last_checked || "Not yet")}</span><span>Revision: ${esc(workItem.checked_revision || "Not recorded")}</span></div>`
          : "";
        const plannedSlice = implementationSliceById.get(workItem?.primary_slice);
        openInspector({
          eyebrow: block.document_title || "DNA block",
          title: block.title,
          meta: statusLabel,
          html: `<div class="block-identity"><span class="status-dot ${esc(status)}"></span>${esc(block.id)}</div>${plannedSlice ? `<div class="block-check-meta"><span>Planned in: ${esc(plannedSlice.title)}</span><span>${esc(plannedSlice.id)}</span></div>` : ""}${checked}<div class="block-sections">${sections || emptyReader()}${evidenceSections}</div>`,
          sourcePath: block.path,
          blockId: block.id
        }, { remember, syncRoute });
      }

      function syncInspectorFromRoute() {
        const blockId = routedBlockId();
        if (blockId && blockById.has(blockId)) {
          if (inspectorView?.blockId !== blockId) openBlock(blockId, { syncRoute: false });
          return;
        }
        if (blockId) setBlockRoute(null, { replace: true });
        if (inspectorView?.blockId) closeInspector({ syncRoute: false });
      }

      async function copyAlignmentReviewPrompt(button) {
        const status = document.getElementById("copy-review-status");
        if (!alignmentReviewPrompt) {
          if (status) status.textContent = "Prompt unavailable";
          return;
        }
        let copied = false;
        try {
          await navigator.clipboard.writeText(alignmentReviewPrompt);
          copied = true;
        } catch (_) {
          const textarea = document.createElement("textarea");
          textarea.value = alignmentReviewPrompt;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
          textarea.remove();
        }
        if (copied) {
          button.textContent = "Prompt copied";
          if (status) status.textContent = "Open a new chat and paste the prompt.";
          window.setTimeout(() => { button.textContent = "Copy review prompt"; }, 2400);
          return;
        }
        document.querySelector(".alignment-prompt")?.setAttribute("open", "");
        if (status) status.textContent = "Copy was unavailable. The prompt is open below.";
      }

      // Journey content
      function quietEmpty(label) {
        const cards = Array.from({ length: 3 }, () => '<span class="quiet-empty-card"></span>').join("");
        return `<div class="quiet-empty" aria-label="${esc(label)}">${cards}</div>`;
      }

      function artifactIcon(contentKey) {
        if (contentKey === "seed") {
          return seedIcon("small");
        }
        return '<span class="artifact-symbol direction"></span>';
      }

      function seedIcon(size = "small") {
        return `<svg class="seed-icon ${esc(size)}" viewBox="0 0 32 32" aria-hidden="true"><path class="seed-body" d="M26.1 5.7C17 6.4 9.2 11.2 6.7 18.2c-1.5 4.3 1.8 8.1 6.2 7.3 7.6-1.5 12.8-9.7 13.2-19.8Z"></path><path class="seed-seam" d="M10.5 22.1c3.1-4.2 6.8-8 11.1-11.2"></path></svg>`;
      }

      function artifactCard(contentKey) {
        const content = presentationContent[contentKey] || {};
        const markdown = content.markdown || "";
        if (!markdown.trim()) return "";
        return `<button class="artifact-card" type="button" data-action="content" data-content="${esc(contentKey)}">
          <span class="artifact-icon" aria-hidden="true">${artifactIcon(contentKey)}</span>
          <span class="artifact-copy"><span class="artifact-title">${esc(content.title)}</span><span class="artifact-note">${esc(firstReadableLine(markdown))}</span></span>
          <span class="eye" aria-hidden="true"></span>
        </button>`;
      }

      function moduleMiniGrid() {
        const cards = moduleEntries.map(([moduleId, module]) => {
          const maturity = moduleMaturity(moduleId, module);
          return (
          `<button class="module-mini" type="button" data-action="module" data-module="${esc(moduleId)}" data-tone="${moduleTone(moduleId)}" title="${esc(`${module.name}: ${maturity.detail}`)}">
            <span class="module-mark" aria-hidden="true">${esc(moduleCode(moduleId))}</span>
            ${module.selected ? '<span class="module-selected" aria-label="Selected">✓</span>' : ""}
            <div class="module-mini-title">${esc(module.name)}</div>
            <div class="module-mini-state">${esc(maturity.label)}</div>
            <div class="module-mini-status" aria-label="${esc(maturity.detail)}">
              <div class="module-strand">${maturity.cells.map((cell) => `<span class="strand-cell ${esc(cell)}" aria-hidden="true"></span>`).join("")}</div>
              <div class="module-mini-summary"><span>${esc(maturity.detail)}</span><span>${esc(moduleCode(moduleId))}</span></div>
            </div>
          </button>`
          );
        }).join("");
        return `<div class="module-mini-grid">${cards}<div class="module-mini module-add" aria-disabled="true"><span class="plus-icon" aria-hidden="true"></span><small>More DNA modules coming soon</small></div></div>`;
      }

      function moduleSectionHeading(moduleId, moduleName, documentCount, className = "") {
        const classes = ["module-section-head", className].filter(Boolean).join(" ");
        const countLabel = `${documentCount} DNA document${documentCount === 1 ? "" : "s"}`;
        return `<div class="${classes}" data-tone="${moduleTone(moduleId)}"><span class="module-section-identity"><span class="module-mark" aria-hidden="true">${esc(moduleCode(moduleId))}</span><span class="module-section-title">${esc(moduleName)}</span></span><span class="module-section-count">${esc(countLabel)}</span></div>`;
      }

      function scopeContent() {
        if (!expressedDocuments.length) {
          return quietEmpty("DNA documents have not been scoped");
        }
        const byModule = new Map();
        for (const document of expressedDocuments) {
          if (!byModule.has(document.moduleId)) byModule.set(document.moduleId, []);
          byModule.get(document.moduleId).push(document);
        }
        return `<div class="scope-stack">${[...byModule.entries()].map(([moduleId, docs]) =>
          `<div class="scope-module">${moduleSectionHeading(moduleId, modules[moduleId]?.name || moduleId, docs.length)}<div class="scope-docs">${docs.map((document) => {
            const status = documentDocumentationStatus(document);
            return `<span class="scope-doc ${esc(status)}" aria-label="${esc(`${document.title}: ${documentationState(status).ringLabel}`)}">${esc(document.title)}</span>`;
          }).join("")}</div></div>`
        ).join("")}</div>`;
      }

      function skeletonBlocks(count = 4) {
        return Array.from({ length: count }, () => '<span class="skeleton-block"></span>').join("");
      }

      function documentationStatusKey() {
        const rows = [
          ["not_started", "Not started", "No substantive documentation"],
          ["in_progress", "In progress", "Documentation has been drafted"],
          ["complete", "Complete", "The DNA document is complete"],
          ["issue", "Needs attention", "Documentation requires correction"]
        ];
        return `<div class="block-map-tools"><details class="status-key"><summary><span class="ui-icon key" aria-hidden="true"></span><span>Status key</span><span class="chevron" aria-hidden="true"></span></summary><div class="status-key-panel">${rows.map(([status, label, detail]) =>
          `<div class="status-key-row">${documentationRing(status, "status-key-ring", true)}<span><strong>${esc(label)}</strong>${esc(detail)}</span></div>`
        ).join("")}</div></details></div>`;
      }

      function blockMap() {
        if (!expressedDocuments.length && !blocks.length) {
          return quietEmpty("DNA blocks will appear once the DNA documents are scoped");
        }

        const allDocuments = expressedDocuments.length
          ? expressedDocuments
          : [...blocksByDocument.entries()].map(([documentId, documentBlocks]) => ({
              qualified_id: documentId,
              title: documentBlocks[0]?.document_title || documentId,
              moduleId: documentBlocks[0]?.module_id,
              moduleName: documentBlocks[0]?.module_name
            }));

        const documentCountsByModule = allDocuments.reduce((counts, document) => {
          counts.set(document.moduleId, (counts.get(document.moduleId) || 0) + 1);
          return counts;
        }, new Map());

        return `<div class="block-map-shell">${documentationStatusKey()}<div class="block-map">${allDocuments.map((document, index) => {
          const documentBlocks = blocksByDocument.get(document.qualified_id) || [];
          const moduleChanged = index === 0 || allDocuments[index - 1]?.moduleId !== document.moduleId;
          const documentStatus = documentDocumentationStatus(document);
          return `${moduleChanged ? moduleSectionHeading(document.moduleId, document.moduleName || modules[document.moduleId]?.name || document.moduleId, documentCountsByModule.get(document.moduleId) || 0, "block-module-title") : ""}
          <div class="implementation-document">
            <div class="document-heading"><div class="document-title ${esc(documentStatus)}">${esc(document.title)}</div><div class="document-id">${esc(document.qualified_id)}</div></div>
            <div class="blocks">${documentBlocks.length ? documentBlocks.map((block) => {
              const status = blockDocumentationStatus(block, document);
              return `<button class="dna-block ${esc(status)}" type="button" data-action="block" data-block="${esc(block.id)}" title="${esc(`${block.id}: ${block.title}`)}">
                <span class="block-copy"><span class="block-slice">.${esc(block.slice)}</span><span class="block-title">${esc(block.title)}</span></span>
                ${documentationRing(status)}
              </button>`;
            }).join("") : skeletonBlocks(3)}</div>
          </div>`;
        }).join("")}</div></div>`;
      }

      function reviewContent() {
        return `<div class="review-card">
          <div class="progress-ring" style="--progress:${dashboardStats.documentationCompletion}"><strong>${dashboardStats.documentationCompletion}%</strong></div>
          <div><div class="review-title">${dashboardStats.documentationCompletion === 100 && dashboardStats.expressedDocuments ? "Foundation assembled" : "Foundation review"}</div>
            <div class="review-metrics">
              <span class="metric">✓ ${dashboardStats.completeDocuments}/${dashboardStats.expressedDocuments} DNA documents</span>
              ${dashboardStats.contractErrors ? `<span class="metric warn">× ${dashboardStats.contractErrors}</span>` : ""}
            </div>
          </div>
        </div>`;
      }

      function alignmentState(status) {
        return alignmentStates[status] || alignmentStates.invalid;
      }

      function alignmentBlockMap() {
        if (!blocks.length) return quietEmpty("DNA directions will appear here once their blocks are complete");

        const documents = [...blocksByDocument.entries()].map(([documentId, documentBlocks]) => ({
          qualified_id: documentId,
          title: documentBlocks[0]?.document_title || documentId,
          moduleId: documentBlocks[0]?.module_id,
          moduleName: documentBlocks[0]?.module_name
        }));
        const documentCountsByModule = documents.reduce((counts, document) => {
          counts.set(document.moduleId, (counts.get(document.moduleId) || 0) + 1);
          return counts;
        }, new Map());

        return `<div class="alignment-matrix"><div class="alignment-matrix-head"><div><span class="alignment-kicker">Direction coverage</span><h3>DNA blocks</h3></div><span>${esc(alignmentCoverage.applicable || 0)} applicable</span></div><div class="block-map">${documents.map((document, index) => {
          const documentBlocks = blocksByDocument.get(document.qualified_id) || [];
          const moduleChanged = index === 0 || documents[index - 1]?.moduleId !== document.moduleId;
          return `${moduleChanged ? moduleSectionHeading(document.moduleId, document.moduleName || modules[document.moduleId]?.name || document.moduleId, documentCountsByModule.get(document.moduleId) || 0, "block-module-title") : ""}
          <div class="implementation-document">
            <div class="document-heading"><div class="document-title">${esc(document.title)}</div><div class="document-id">${esc(document.qualified_id)}</div></div>
            <div class="blocks">${documentBlocks.map((block) => {
              const workItem = implementationItemByBlockId.get(block.id);
              const status = block.contract_errors?.length
                ? "invalid"
                : workItem?.state || (implementation.mode === "not_compiled" ? "not_started" : "invalid");
              const display = alignmentState(status);
              const plannedSlice = implementationSliceById.get(workItem?.primary_slice);
              return `<button class="dna-block ${esc(status)}" type="button" data-action="block" data-block="${esc(block.id)}" title="${esc(`${block.id}: ${display.label}`)}">
                <span class="block-copy"><span class="block-slice">.${esc(block.slice)}</span><span class="block-title">${esc(block.title)}</span><span class="alignment-status-tag ${esc(display.tone)}">${esc(display.label)}</span>${plannedSlice ? `<small>Planned in: ${esc(plannedSlice.title)}</small>` : ""}</span>
              </button>`;
            }).join("")}</div>
          </div>`;
        }).join("")}</div></div>`;
      }

      function alignmentReviewCard() {
        const resultLabels = {
          aligned: "Aligned",
          needs_attention: "Needs attention",
          blocked: "Blocked"
        };
        const lastReview = lastAlignmentReview
          ? `<div class="alignment-last-review"><span>Latest fresh-context review</span><strong>${esc(resultLabels[lastAlignmentReview.result] || titleCase(lastAlignmentReview.result))}</strong><small>${esc(lastAlignmentReview.revision || "Revision not recorded")} · ${esc(lastAlignmentReview.reviewed_at ? new Date(lastAlignmentReview.reviewed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date not recorded")}</small></div>`
          : `<div class="alignment-last-review empty"><span>Latest fresh-context review</span><strong>Not run yet</strong><small>Recommended before a release, pilot, major handoff, or broad readiness claim.</small></div>`;
        return `<section class="alignment-review-card">
          <div class="alignment-review-copy"><span class="alignment-kicker">Fresh perspective</span><h3>Run a fresh alignment review</h3><p>Open a new chat and paste this prepared prompt. The separate context reduces anchoring and gives you an inspectable review transcript.</p></div>
          ${lastReview}
          <div class="alignment-review-actions"><button class="copy-review-prompt" type="button" data-action="copy-alignment-prompt">Copy review prompt</button><span class="copy-review-status" id="copy-review-status" role="status" aria-live="polite"></span></div>
          <details class="alignment-prompt"><summary>View the prompt</summary><div id="alignment-review-prompt">${esc(alignmentReviewPrompt)}</div></details>
        </section>`;
      }

      function implementationPlanCard() {
        if (implementation.mode === "not_compiled") {
          return `<section class="alignment-review-card"><div class="alignment-review-copy"><span class="alignment-kicker">Implementation spine</span><h3>Compile the delivery inventory</h3><p>The accepted DNA is ready. Compile its block inventory, then let the planning agent synthesize a reviewable outcome sequence before product work begins.</p></div><div class="alignment-last-review empty"><span>Delivery state</span><strong>Not compiled</strong><small>DNA direction remains unchanged.</small></div></section>`;
        }
        if (implementation.plan_status === "draft") {
          const synthesis = implementation.planning?.synthesis_status || "inventory_ready";
          const message = synthesis === "inventory_ready"
            ? "The DNA-block inventory is ready for semantic outcome synthesis. Existing builds must be reconciled against current code and tests."
            : synthesis === "proposal_ready"
              ? "The proposal is structurally valid. Generate and present the human-readable review before asking for approval."
              : "The human-readable proposal review is ready. Approval accepts its grouping, ownership, order, dependencies, gates, and checks—not product completion.";
          return `<section class="alignment-review-card"><div class="alignment-review-copy"><span class="alignment-kicker">Implementation spine</span><h3>${synthesis === "reviewed" ? "Review the proposed sequence" : "Prepare the proposed sequence"}</h3><p>${esc(message)}</p></div><div class="alignment-last-review empty"><span>Plan ${esc(implementation.plan_version || "")}</span><strong>${esc(synthesis.replaceAll("_", " "))}</strong><small>${esc(implementationSlices.length)} synthesized slices</small></div></section>`;
        }
        if (implementation.source_stale) {
          return `<section class="alignment-review-card"><div class="alignment-review-copy"><span class="alignment-kicker">Implementation spine</span><h3>Refresh the delivery plan</h3><p>The accepted North Star or DNA direction changed after this plan was compiled. Recompile, review, and approve the sequence before starting more work.</p></div><div class="alignment-last-review empty"><span>Plan ${esc(implementation.plan_version || "")}</span><strong>Source changed</strong><small>No new slice should start yet.</small></div></section>`;
        }
        const focus = implementation.current || implementation.next;
        const focusLabel = implementation.current ? "Active slice" : "Next slice";
        const readiness = implementation.readiness || {};
        const gates = `Technical health: ${titleCase(readiness.technical_health || "unknown")} · Product coverage: ${titleCase(readiness.product_coverage || "not assessed")} · External gates: ${titleCase(readiness.external_gates || "unknown")} · Release readiness: ${titleCase(readiness.release_readiness || "not assessed")}`;
        return `<section class="alignment-review-card"><div class="alignment-review-copy"><span class="alignment-kicker">Implementation spine</span><h3>${esc(focus?.title || "No ready slice")}</h3><p>${esc(focus?.outcome || "Review dependencies, blockers, or completed coverage before selecting more work.")}</p><small>${esc(gates)}</small></div><div class="alignment-last-review"><span>${esc(focusLabel)}</span><strong>${esc(focus?.id || "None")}</strong><small>Plan ${esc(implementation.plan_version || "—")} · state ${esc(implementation.state_revision ?? "—")}${implementation.source_stale ? " · source changed" : ""}</small></div></section>`;
      }

      function readyContent() {
        const ready = currentStage === "brainwave_documentation_complete";
        if (!ready) {
          return `<div class="review-card"><div class="progress-ring" style="--progress:0"><strong>○</strong></div><div><div class="review-title">Ready after review</div></div></div>`;
        }

        const applicable = Number(alignmentCoverage.applicable || 0);
        const built = Number(alignmentCoverage.built || 0);
        const checked = Number(alignmentCoverage.checked || 0);
        const underway = Number(alignmentCoverage.underway || 0);
        const pendingCheck = Number(alignmentCoverage.pending_check || 0);
        const blocked = Number(alignmentCoverage.blocked || 0);
        const deferred = Number(alignmentCoverage.deferred || 0);
        const invalid = Number(alignmentCoverage.invalid || 0);
        const title = implementation.mode === "not_compiled"
          ? "A delivery plan is needed"
          : implementation.plan_status === "draft"
            ? "The implementation sequence needs review"
            : implementation.source_stale
              ? "The delivery plan needs refreshing"
            : blocked || invalid
          ? "Alignment needs attention"
          : applicable && checked === applicable
            ? "Documented directions checked"
            : applicable && built === applicable
              ? "The build is recorded; checks remain"
              : "Implementation alignment underway";
        const summary = implementation.mode === "not_compiled"
          ? `${applicable} applicable DNA directions are accepted. Implementation coverage will begin after the spine is compiled and approved.`
          : implementation.source_stale
            ? "The accepted direction changed after this plan was compiled. Existing evidence remains visible, but no new slice should start until the plan is recompiled and approved."
          : applicable
          ? `${checked} of ${applicable} applicable DNA directions are aligned and checked. This is direction coverage, not an estimate of overall product completion or release readiness.`
          : "The accepted foundation is ready. Direction coverage will appear as implementation evidence is recorded.";

        return `<div class="alignment-shell">
          <section class="alignment-hero ${blocked || invalid ? "attention" : ""}">
            <div class="alignment-hero-copy"><span class="alignment-kicker">Ambient delivery alignment</span><h2>${esc(title)}</h2><p>${esc(summary)}</p></div>
            <div class="alignment-coverage-grid">
              <div class="alignment-stat"><strong>${built}<small>/${applicable}</small></strong><span>Built</span><em>${esc(alignmentCoverage.built_pct || 0)}% coverage</em></div>
              <div class="alignment-stat checked"><strong>${checked}<small>/${applicable}</small></strong><span>Checked</span><em>${esc(alignmentCoverage.checked_pct || 0)}% coverage</em></div>
              <div class="alignment-stat"><strong>${underway}</strong><span>Underway</span><em>Work in progress</em></div>
              <div class="alignment-stat ${blocked || invalid ? "attention" : ""}"><strong>${blocked + invalid}</strong><span>Needs attention</span><em>${deferred} deferred · ${pendingCheck} check pending</em></div>
            </div>
            ${blocked || invalid ? `<div class="alignment-alert"><strong>${blocked + invalid} direction${blocked + invalid === 1 ? "" : "s"} need attention.</strong><span>Resolve these before making a broad readiness claim, regardless of the coverage percentage.</span></div>` : ""}
          </section>
          ${implementationPlanCard()}
          ${alignmentReviewCard()}
          ${alignmentBlockMap()}
        </div>`;
      }

      function stageBody(index) {
        if (index === 0) {
          return artifactCard("seed") ||
            `<div class="first-step"><div><div class="idea-prompt-icon" aria-hidden="true">${seedIcon("large")}</div><span>Tell your agent what you want to shape.</span></div></div>`;
        }
        if (index === 1) {
          return artifactCard("north_star") ||
            '<div class="first-step"><div><div class="direction-icon" aria-hidden="true"><span class="artifact-symbol direction"></span></div><span>Direction takes shape here.</span></div></div>';
        }
        if (index === 2) return moduleMiniGrid();
        if (index === 3) return scopeContent();
        if (index === 4) return blockMap();
        if (index === 5) return reviewContent();
        return readyContent();
      }

      function stageBadge(index) {
        if (index === 2) {
          return `${dashboardStats.selectedModules}/${dashboardStats.availableModules} modules`;
        }
        if (index === 3) {
          return dashboardStats.documentTotal
            ? `${dashboardStats.documentTotal} DNA documents scoped`
            : dashboardStats.expressedDocuments ? `${dashboardStats.expressedDocuments} DNA documents scoped` : "";
        }
        if (index === 4) {
          return dashboardStats.documentTotal
            ? `${dashboardStats.scopedCompleteDocuments} of ${dashboardStats.documentTotal} DNA documents complete`
            : "";
        }
        if (index === 6 && currentStage === "brainwave_documentation_complete" && dashboardStats.blockTotal) {
          return `${alignmentCoverage.checked || 0} of ${alignmentCoverage.applicable || 0} directions checked`;
        }
        return "";
      }

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
        const reviewStatus = lastAlignmentReview
          ? `${resultLabels[lastAlignmentReview.result] || titleCase(lastAlignmentReview.result)} · ${lastAlignmentReview.reviewed_at ? new Date(lastAlignmentReview.reviewed_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "date not recorded"}`
          : "Not run yet";
        return `<section class="implementation-action">
          <div><span class="alignment-kicker">Independent check</span><h3>Run a fresh alignment review</h3><small>${esc(reviewStatus)}</small></div>
          <div class="alignment-review-actions"><button class="copy-review-prompt" type="button" data-action="copy-alignment-prompt">Copy review prompt</button><span class="copy-review-status" id="copy-review-status" role="status" aria-live="polite"></span></div>
          <details class="alignment-prompt"><summary>View the prompt</summary><div id="alignment-review-prompt">${esc(alignmentReviewPrompt)}</div></details>
        </section>`;
      }

      function implementationPlanCard() {
        if (implementation.mode === "not_compiled") {
          return `<section class="implementation-plan-note"><div><strong>Delivery plan needed</strong><span>Compile the accepted DNA into slices before product work begins.</span></div><em>Not compiled</em></section>`;
        }
        if (implementation.plan_status === "draft") {
          const synthesis = implementation.planning?.synthesis_status || "inventory_ready";
          const reviewLink = implementation.planning?.review_artifact
            ? `<a class="roadmap-review-link" href="${esc(safeHref(implementation.planning.review_artifact))}" target="_blank" rel="noopener">Review plan ↗</a>`
            : "";
          return `<section class="implementation-plan-note"><div><strong>${synthesis === "reviewed" ? "Delivery plan ready to review" : "Delivery plan in preparation"}</strong><span>${esc(implementationSlices.length)} proposed slice${implementationSlices.length === 1 ? "" : "s"}</span></div>${reviewLink || `<em>${esc(synthesis.replaceAll("_", " "))}</em>`}</section>`;
        }
        if (implementation.source_stale) {
          return `<section class="implementation-plan-note attention"><div><strong>Delivery plan needs refreshing</strong><span>The accepted direction changed. Do not start another slice yet.</span></div><em>Source changed</em></section>`;
        }
        return "";
      }

      function alignmentCoverageDisclosure() {
        const applicable = Number(alignmentCoverage.applicable || 0);
        const checked = Number(alignmentCoverage.checked || 0);
        return `<details class="implementation-detail"><summary><span>DNA direction coverage</span><strong>${checked}/${applicable} checked</strong><span class="chevron" aria-hidden="true"></span></summary><div>${alignmentBlockMap()}</div></details>`;
      }

      function foundationReadyContent() {
        if (!foundationComplete) {
          return `<div class="review-card"><div class="progress-ring" style="--progress:0"><strong>○</strong></div><div><div class="review-title">Ready after review</div></div></div>`;
        }
        return `<div class="review-card"><div class="progress-ring" style="--progress:100"><strong>✓</strong></div><div><div class="review-title">Foundation accepted</div><div class="review-metrics"><span class="metric">${dashboardStats.completeDocuments}/${dashboardStats.expressedDocuments} DNA documents</span><span class="metric">${alignmentCoverage.applicable || 0} applicable directions</span></div></div></div>`;
      }

      function implementationContent() {
        if (!foundationComplete) {
          return `<div class="review-card"><div class="progress-ring" style="--progress:0"><strong>○</strong></div><div><div class="review-title">Available after foundation acceptance</div></div></div>`;
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
          ? "Delivery plan needed"
          : implementation.plan_status === "draft"
            ? "Delivery plan needs review"
            : implementation.source_stale
              ? "Delivery plan needs refreshing"
            : blocked || invalid
          ? `${blocked + invalid} direction${blocked + invalid === 1 ? "" : "s"} need attention`
          : applicable && checked === applicable
            ? "All documented directions checked"
            : applicable && built === applicable
              ? "Built; checks remain"
              : "Implementation underway";
        const ringProgress = applicable ? Math.round((checked / applicable) * 100) : 0;

        return `<div class="alignment-shell">
          <div class="review-card implementation-summary ${blocked || invalid ? "attention" : ""}"><div class="progress-ring" style="--progress:${ringProgress}"><strong>${checked}/${applicable}</strong></div><div><div class="review-title">${esc(title)}</div><div class="review-metrics"><span class="metric">${built} built</span><span class="metric">${underway} underway</span>${pendingCheck ? `<span class="metric">${pendingCheck} check pending</span>` : ""}${blocked || invalid ? `<span class="metric warn">${blocked + invalid} need attention</span>` : ""}${deferred ? `<span class="metric">${deferred} deferred</span>` : ""}</div></div></div>
          ${implementationPlanCard()}
          ${implementationRoadmap()}
          ${alignmentReviewCard()}
          ${alignmentCoverageDisclosure()}
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
        if (index === 6) return foundationReadyContent();
        return implementationContent();
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
        if (index === 6 && foundationComplete) {
          return "Foundation accepted";
        }
        if (index === 7 && foundationComplete && implementationSlices.length) {
          return `${dashboardStats.verifiedSlices} of ${implementationSlices.length} slices checked`;
        }
        if (index === 7 && foundationComplete && dashboardStats.blockTotal) {
          return `${alignmentCoverage.checked || 0} of ${alignmentCoverage.applicable || 0} directions checked`;
        }
        return "";
      }

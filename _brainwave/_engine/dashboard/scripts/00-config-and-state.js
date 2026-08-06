
    (() => {
      // Configuration
      const stageDefinitions = [
        { id: "awaiting_seed", label: "_brainwave Seed", action: "Capture the idea" },
        { id: "shaping_north_star", label: "North Star", action: "Agree the direction" },
        { id: "selecting_dna", label: "DNA modules", action: "Choose DNA modules" },
        { id: "scoping_brainwave_documentation", label: "DNA documents", action: "Scope DNA documents" },
        { id: "building_brainwave_documentation", label: "DNA documents and blocks", action: "Build DNA documentation" },
        { id: "reviewing_brainwave_documentation", label: "Foundation", action: "Review the foundation" },
        { id: "brainwave_documentation_complete", label: "Foundation ready", action: "Ready for implementation" },
        { id: "implementation", label: "Implementation", action: "Deliver the implementation" }
      ];

      const documentationStates = Object.freeze({
        not_started: { progress: 0, ringTone: "empty", ringGlyph: "", ringLabel: "Documentation not written" },
        in_progress: { progress: 55, ringTone: "working", ringGlyph: "", ringLabel: "Documentation being written" },
        complete: { progress: 100, ringTone: "complete", ringGlyph: "✓", ringLabel: "Document ready for foundation review" },
        issue: { progress: 100, ringTone: "issue", ringGlyph: "!", ringLabel: "Documentation needs attention" }
      });
      const defaultDocumentationState = documentationStates.not_started;
      const alignmentStates = Object.freeze({
        not_started: { label: "Not addressed", detail: "No implementation evidence yet", tone: "empty" },
        in_progress: { label: "Underway", detail: "This direction is currently being implemented", tone: "working" },
        implemented: { label: "Ready to check", detail: "Implementation evidence exists; verification is pending", tone: "working" },
        verified: { label: "Complete", detail: "Implementation and verification evidence are recorded", tone: "complete" },
        blocked: { label: "Blocked", detail: "This item has a recorded blocker or gate", tone: "muted" },
        deferred: { label: "Deferred", detail: "Work is intentionally held until its recorded reopening condition", tone: "muted" },
        invalid: { label: "State needs correction", detail: "The direction or implementation-spine contract is invalid", tone: "issue" }
      });

      // Embedded snapshot and derived indexes
      const stateElement = document.getElementById("brainwave-state");
      let state = {};
      try { state = JSON.parse(stateElement.textContent || "{}"); } catch (_) {}

      const dna = state.dna || {};
      const dnaTotals = dna.totals || {};
      const progress = state.progress || {};
      const progressModules = Object.values(progress.modules || {});
      const direction = state.direction || {};
      const implementation = state.implementation || {};
      const implementationTotals = implementation.totals || {};
      const implementationSlices = Array.isArray(implementation.slices) ? implementation.slices : [];
      const implementationSliceById = new Map(implementationSlices.map((slice) => [slice.id, slice]));
      const implementationWorkItems = Array.isArray(implementation.work_items) ? implementation.work_items : [];
      const implementationItemByBlockId = new Map(implementationWorkItems.map((item) => [item.id, item]));
      const implementationValidation = implementation.validation || {};
      const implementationSliceContexts = Array.isArray(implementationValidation.slice_contexts)
        ? implementationValidation.slice_contexts
        : [];
      const implementationContextBySliceId = new Map(
        implementationSliceContexts.map((context) => [context.slice_id, context])
      );
      const deliveryAlignment = state.delivery_alignment || {};
      const alignmentCoverage = deliveryAlignment.coverage || {};
      const alignmentReviewPrompt = deliveryAlignment.review_prompt || "";
      const lastAlignmentReview = deliveryAlignment.last_review || null;
      const modules = dna.modules || {};
      const moduleEntries = Object.entries(modules);
      const trackedFiles = state.filesystem?.tracked_files || {};
      const trackedFileEntries = Object.entries(trackedFiles);
      const blocks = Array.isArray(direction.blocks) ? direction.blocks : [];
      const presentation = state.presentation || {};
      const presentationContent = presentation.content || {};
      const presentationDocuments = presentation.documents || {};
      const settings = state.settings || {};
      const projectProfile = presentation.project_profile || settings.project_profile || {};
      const experienceCheckpoints = state.experience?.checkpoints || {};
      const trackedPathByQualifiedId = new Map(
        trackedFileEntries.map(([path, meta]) => [meta.qualified_node_id, path])
      );
      const blockById = new Map(blocks.map((block) => [block.id, block]));
      const blocksByDocument = new Map();
      for (const block of blocks) {
        if (!blocksByDocument.has(block.document_id)) blocksByDocument.set(block.document_id, []);
        blocksByDocument.get(block.document_id).push(block);
      }
      const expressedDocuments = moduleEntries.flatMap(([moduleId, module]) =>
        Object.values(module.nodes || {})
          .filter((node) => node.type === "file" && node.expressed)
          .map((node) => ({
            ...node,
            moduleId,
            moduleName: module.name,
            path: trackedPathByQualifiedId.get(node.qualified_id) || null
          }))
      ).sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.id.localeCompare(b.id));
      const expressedDocumentById = new Map(
        expressedDocuments.map((document) => [document.qualified_id, document])
      );
      const selectedDocumentationTotals = progressModules.reduce(
        (summary, moduleProgress) => {
          if (!moduleProgress.selected) return summary;
          summary.complete += Number(moduleProgress.completed_files || 0);
          summary.total += Number(moduleProgress.expressed_files || 0);
          return summary;
        },
        { complete: 0, total: 0 }
      );
      const dashboardStats = Object.freeze({
        availableModules: Number(dnaTotals.available_modules || moduleEntries.length || 0),
        selectedModules: Number(dnaTotals.selected_modules || 0),
        selectedModuleNames: moduleEntries.filter(([, module]) => module.selected).map(([, module]) => module.name),
        expressedDocuments: Number(dnaTotals.expressed_files || 0),
        completeDocuments: progressModules.reduce((sum, moduleProgress) => sum + Number(moduleProgress.completed_files || 0), 0),
        scopedCompleteDocuments: selectedDocumentationTotals.complete,
        documentTotal: selectedDocumentationTotals.total,
        documentationCompletion: Number(progress.documentation_completion_pct || 0),
        contractErrors: trackedFileEntries.reduce((sum, [, file]) => sum + (file.contract_errors?.length || 0), 0),
        blockTotal: Number(implementationTotals.blocks || 0),
        completeBlocks: Number(implementationTotals.implemented || 0) + Number(implementationTotals.verified || 0),
        blockedBlocks: Number(implementationTotals.blocked || 0),
        verifiedBlocks: Number(implementationTotals.verified || 0),
        verifiedSlices: implementationSlices.filter((slice) => slice.state === "verified").length
      });
      const searchEntries = [];
      for (const [moduleId, module] of moduleEntries) {
        searchEntries.push({
          kind: "module",
          id: module.canonical_id || moduleId,
          title: module.name || moduleId,
          context: `${module.totals?.files || 0} documents`,
          moduleId
        });
        for (const node of Object.values(module.nodes || {})) {
          searchEntries.push({
            kind: node.type === "directory" ? "group" : "document",
            id: node.qualified_id,
            title: node.title || node.qualified_id,
            context: module.name || moduleId,
            moduleId,
            documentId: node.id
          });
        }
      }
      for (const block of blocks) {
        searchEntries.push({
          kind: "block",
          id: block.id,
          title: block.title || block.id,
          context: block.document_title || block.module_name || "DNA block",
          moduleId: block.module_id || String(block.id || "").match(/^(_DNA-[A-Z0-9]{4})-/)?.[1] || "",
          blockId: block.id
        });
      }
      searchEntries.forEach((entry, index) => {
        entry.index = index;
        entry.searchText = `${entry.id} ${entry.title} ${entry.context}`.toLowerCase();
        entry.searchCompact = entry.searchText.replace(/[^a-z0-9]+/g, "");
      });
      let inspectorReturnFocus = null;
      let inspectorHistory = [];
      let inspectorView = null;
      let searchQuery = "";

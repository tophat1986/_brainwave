      // Primary views
      function renderJourney() {
        document.getElementById("journey").innerHTML = stageDefinitions.map((definition, index) => {
          const implementationComplete = index === 7 && implementation.plan_status === "complete" && !implementation.source_stale;
          const status = implementationComplete
            ? "complete"
            : index < currentJourneyIndex
              ? "complete"
              : index === currentJourneyIndex ? "current" : "future";
          const expanded = expandedStages.has(index);
          const contentAvailable =
            (index === 0 && presentationContent.seed?.markdown?.trim()) ||
            (index === 1 && presentationContent.north_star?.markdown?.trim());
          const previewKey = index === 0 ? "seed" : index === 1 ? "north_star" : null;
          const badge = stageBadge(index);
          return `<article class="stage ${status} ${expanded ? "expanded" : ""}" data-stage-index="${index}">
            <button class="stage-node" type="button" data-action="stage" data-stage="${index}" aria-label="${expanded ? "Collapse" : "Expand"} ${esc(definition.label)}" aria-expanded="${expanded}">${status === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</button>
            <div class="stage-card">
              <button class="stage-toggle" type="button" data-action="stage" data-stage="${index}" aria-expanded="${expanded}">
                <span><span class="stage-label">${esc(definition.label)}${status === "current" ? '<span class="now-mark">Now</span>' : ""}</span><span class="stage-subtitle">${esc(definition.action)}</span></span>
                <span class="stage-actions">${badge ? `<span class="stage-count">${esc(badge)}</span>` : ""}<span class="chevron" aria-hidden="true"></span></span>
              </button>
              ${contentAvailable && !expanded ? `<button class="preview-button" style="position:absolute;right:56px;top:22px;z-index:3" type="button" data-action="content" data-content="${previewKey}" aria-label="Preview ${esc(definition.label)}"><span class="eye" aria-hidden="true"></span></button>` : ""}
              ${expanded ? `<div class="stage-body">${stageBody(index)}</div>` : ""}
            </div>
          </article>`;
        }).join("");
      }

      function renderLibrary() {
        const cards = moduleEntries.map(([moduleId, module]) => {
          const groups = Object.values(module.nodes || {}).filter((node) => node.type === "directory" && !node.parent_id).slice(0, 5);
          return `<button class="library-card" type="button" data-action="module" data-module="${esc(moduleId)}" data-tone="${moduleTone(moduleId)}">
            <span class="module-mark" aria-hidden="true">${esc(moduleCode(moduleId))}</span>
            <span class="library-status"><span class="installed">✓ Installed</span><span class="library-version">v${esc(module.version)}</span></span>
            <div class="library-title">${esc(module.name)}</div>
            <div class="library-groups">${groups.map((group) => `<span class="library-group">${esc(group.title)}</span>`).join("")}</div>
            <div class="library-count">${esc(module.totals?.files || 0)} documents</div>
          </button>`;
        }).join("");
        document.getElementById("library").innerHTML =
          `${cards}<div class="library-card library-add" aria-disabled="true"><span class="plus-icon" aria-hidden="true"></span><small>More DNA modules coming soon</small></div>`;
      }

      function setView(view) {
        const isJourney = view === "journey";
        document.getElementById("journey-view").hidden = !isJourney;
        document.getElementById("library-view").hidden = isJourney;
        document.querySelectorAll("[data-view]").forEach((button) => {
          const selected = button.dataset.view === view;
          button.setAttribute("aria-selected", String(selected));
          button.tabIndex = selected ? 0 : -1;
        });
      }

      function searchResultsMarkup(query, matches) {
        if (!String(query || "").trim()) {
          return '<div class="search-empty"><span class="ui-icon search" aria-hidden="true"></span></div>';
        }
        if (!matches.length) return '<div class="search-empty">No matches</div>';
        return matches.map((entry) =>
          `<button class="search-result" type="button" data-action="search-result" data-search-index="${entry.index}">
            <span class="search-result-main"><span class="search-result-title">${esc(entry.title)}</span><span class="search-result-id">${esc(entry.id)}</span></span>
            <span class="search-result-tags">
              ${entry.moduleId ? `<span class="search-result-module" data-tone="${moduleTone(entry.moduleId)}">${esc(moduleCode(entry.moduleId))}</span>` : ""}
              <span class="search-result-kind">${esc(searchKindLabels[entry.kind] || entry.kind)}</span>
            </span>
          </button>`
        ).join("");
      }

      function buildSearchView(query = "") {
        const matches = matchingSearchEntries(query);
        const resultsHtml = searchResultsMarkup(query, matches);
        const meta = String(query || "").trim()
          ? `${matches.length} match${matches.length === 1 ? "" : "es"}`
          : `${searchEntries.length} indexed items`;
        return {
          eyebrow: "Dashboard",
          title: "Search",
          meta,
          html: `<div class="search-panel">
            <label class="search-field"><span class="ui-icon search" aria-hidden="true"></span><input class="search-input" id="dashboard-search" type="search" value="${esc(query)}" placeholder="Search by ID or title" aria-label="Search by ID or title" autocomplete="off" spellcheck="false"></label>
            <div class="search-results" id="search-results" aria-live="polite">${resultsHtml}</div>
          </div>`,
          resultsHtml
        };
      }

      function openSearch() {
        openInspector(buildSearchView(searchQuery));
        const input = document.getElementById("dashboard-search");
        input?.focus();
        input?.select();
      }

      function updateSearch(query) {
        searchQuery = query;
        const view = buildSearchView(query);
        inspectorView = view;
        document.getElementById("inspector-meta").textContent = view.meta;
        const results = document.getElementById("search-results");
        if (results) results.innerHTML = view.resultsHtml;
      }

      function openSearchResult(index) {
        const entry = searchEntries[index];
        if (!entry) return;
        if (entry.kind === "block") openBlock(entry.blockId, { remember: true });
        else if (entry.kind === "document") openModuleDocument(entry.moduleId, entry.documentId);
        else openModule(entry.moduleId, { remember: true });
      }

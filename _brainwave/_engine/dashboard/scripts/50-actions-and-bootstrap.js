      // Interaction and initial render
      document.addEventListener("click", (event) => {
        const openStatusKey = document.querySelector(".status-key[open]");
        if (openStatusKey && !event.target.closest(".status-key")) openStatusKey.open = false;
        const target = event.target.closest("[data-view], [data-action]");
        if (!target) return;
        if (target.dataset.view) {
          setView(target.dataset.view);
          return;
        }
        const action = target.dataset.action;
        if (action === "stage") {
          const index = Number(target.dataset.stage);
          if (expandedStages.has(index)) expandedStages.delete(index);
          else expandedStages.add(index);
          renderJourney();
        } else if (action === "search") openSearch();
        else if (action === "search-result") openSearchResult(Number(target.dataset.searchIndex));
        else if (action === "content") openContent(target.dataset.content);
        else if (action === "decisions") openDecisions();
        else if (action === "handbook") openContent("handbook");
        else if (action === "state") openState();
        else if (action === "refresh") window.location.reload();
        else if (action === "module") openModule(target.dataset.module);
        else if (action === "module-document") openModuleDocument(target.dataset.module, target.dataset.document);
        else if (action === "document") openDocument(target.dataset.path);
        else if (action === "block") openBlock(target.dataset.block);
        else if (action === "copy-alignment-prompt") copyAlignmentReviewPrompt(target);
        else if (action === "inspector-back") backInspector();
        else if (action === "close-inspector") closeInspector();
      });

      document.addEventListener("input", (event) => {
        if (event.target.id === "dashboard-search") updateSearch(event.target.value);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          const openStatusKey = document.querySelector(".status-key[open]");
          if (openStatusKey) {
            openStatusKey.open = false;
            openStatusKey.querySelector("summary")?.focus();
            return;
          }
        }
        if (event.key === "Escape" && document.getElementById("inspector").classList.contains("open")) {
          closeInspector();
          return;
        }
        if (
          (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          event.target.matches("[data-view]")
        ) {
          const tabs = [...document.querySelectorAll("[data-view]")];
          const currentIndex = tabs.indexOf(event.target);
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const next = tabs[(currentIndex + direction + tabs.length) % tabs.length];
          setView(next.dataset.view);
          next.focus();
        }
      });

      document.getElementById("snapshot").textContent = state.generated_at
        ? `Updated ${new Date(state.generated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
        : "";
      document.getElementById("framework-version").textContent =
        state.framework?.version ? `v${state.framework.version}` : "";
      document.title = presentation.project_title ? `${presentation.project_title} · _brainwave` : "_brainwave";

      renderProjectOverview();
      renderJourney();
      renderLibrary();
      window.addEventListener("popstate", syncInspectorFromRoute);
      window.addEventListener("hashchange", syncInspectorFromRoute);
      syncInspectorFromRoute();
    })();

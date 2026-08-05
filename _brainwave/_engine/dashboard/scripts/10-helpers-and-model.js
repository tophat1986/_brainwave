      // Formatting and safety helpers
      const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

      const titleCase = (value) => String(value || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());

      const setupFieldDefinitions = Object.freeze([
        { key: "onboarding_status", label: "Setup", values: { complete: "Complete", pending: "In progress" } },
        { key: "guidance_mode", label: "Level of guidance", values: { guided: "Guide me", concise: "Keep it concise" } },
        { key: "technical_proficiency", label: "Technical comfort", values: { beginner: "Beginner-friendly", intermediate: "Comfortable", architect: "Architect-level" } },
        { key: "ideation_mode", label: "Working together", values: { thought_partner: "Thought partner", fast_execution: "Fast execution" } },
        { key: "verbosity_budget", label: "Level of detail", values: { lean: "Lean", standard: "Standard", exhaustive: "Exhaustive" } },
        { key: "build_outcome", label: "Build goal", values: { demonstration: "Show me the idea", usable_first_version: "Build a usable first version", complete_product: "Build the complete product", custom: "Custom outcome" } }
      ]);

      const projectStatusLabels = Object.freeze({
        not_asked: "Not discussed yet",
        not_yet: "To shape later",
        working: "Working direction",
        confirmed: "Confirmed",
        deferred: "Saved for later"
      });

      function friendlySetting(definition) {
        const value = settings[definition.key];
        if (definition.key !== "onboarding_status" && settings.configured !== true) {
          return "Not chosen yet";
        }
        return definition.values?.[value] || (value ? titleCase(value) : "Not chosen yet");
      }

      function safeHex(value) {
        const color = String(value || "").trim();
        if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) return color;
        return window.CSS?.supports?.("color", color) ? color : null;
      }

      function profileColors() {
        return (Array.isArray(projectProfile.colors) ? projectProfile.colors : [])
          .map((color) => typeof color === "string"
            ? { name: null, value: color, role: null, usage: null, featured: false }
            : { ...color, name: color?.name || color?.label || null })
          .map((color) => ({ ...color, safeValue: safeHex(color?.value) }))
      }

      function visibleProfileColors() {
        return profileColors().filter((color) => color.safeValue);
      }

      function overviewProfileColors() {
        return visibleProfileColors()
          .map((color, index) => {
            const role = String(color.role || "").trim().toLowerCase();
            const rank = color.featured === true
              ? 0
              : role === "primary"
                ? 1
                : ["secondary", "accent"].includes(role) ? 2 : 3;
            return { ...color, index, rank };
          })
          .sort((a, b) => a.rank - b.rank || a.index - b.index);
      }

      function projectMonogram(name) {
        return String(name || "Project").trim().match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() || "P";
      }

      function renderProjectOverview() {
        const colors = overviewProfileColors();
        const primary = colors[0]?.safeValue || "#06b6d4";
        const secondary = colors[1]?.safeValue || colors[0]?.safeValue || "#0284c7";
        const name = projectProfile.name || presentation.project_title || "Your project";
        const sourceSummary = firstReadableLine(
          presentationContent.north_star?.markdown || presentationContent.seed?.markdown || ""
        );
        const summary = projectProfile.short_description || projectProfile.tagline || sourceSummary ||
          "Project basics will appear here as your idea takes shape.";
        const logo = projectProfile.logo || {};
        const logoMarkup = logo.path && logo.exists !== false
          ? `<img src="${esc(safeHref(logo.path))}" alt="${esc(logo.alt_text || `${name} logo`)}">`
          : esc(projectMonogram(name));
        const palette = colors.length
          ? `<span class="project-palette" aria-label="Project colours">${colors.slice(0, 6).map((color) => `<i class="project-swatch" style="background:${esc(color.safeValue)}" title="${esc([color.name || color.value || "Project colour", color.role, color.usage].filter(Boolean).join(" · "))}"></i>`).join("")}</span>`
          : "";
        const status = projectStatusLabels[projectProfile.status] || "Project overview";
        const element = document.getElementById("project-overview");
        element.style.cssText = `--project-primary:${primary};--project-secondary:${secondary}`;
        element.innerHTML = `<div class="project-overview-inner">
          <div class="project-logo" aria-hidden="${logo.path ? "false" : "true"}">${logoMarkup}</div>
          <div class="project-overview-copy"><div class="project-overview-kicker">${esc(status)}</div><h2 class="project-overview-title">${esc(name)}</h2><p class="project-overview-summary">${esc(summary)}</p></div>
          <div class="project-overview-meta">${palette}<button class="project-overview-action" type="button" data-action="state">Project basics</button></div>
        </div>`;
      }

      function documentDocumentationStatus(document) {
        if (document?.processing_status === "invalid" || document?.contract_errors?.length) return "issue";
        if (document?.processing_status === "complete") return "complete";
        if (document?.processing_status === "in_progress") return "in_progress";
        return "not_started";
      }

      function blockDocumentationStatus(block, document) {
        if (block?.direction_status === "invalid" || block?.contract_errors?.length || documentDocumentationStatus(document) === "issue") return "issue";
        if (documentDocumentationStatus(document) === "complete") return "complete";
        const hasContent = Object.values(block?.details || {}).some((value) => String(value || "").trim());
        return hasContent ? "in_progress" : "not_started";
      }

      const documentationState = (status) => documentationStates[status] || defaultDocumentationState;

      function documentationRing(status, className = "", ariaHidden = false) {
        const ring = documentationState(status);
        const accessibility = ariaHidden
          ? 'aria-hidden="true"'
          : `role="img" aria-label="${esc(ring.ringLabel)}"`;
        return `<span class="block-progress-ring ${esc(ring.ringTone)} ${esc(className)}" style="--block-progress:${ring.progress}" ${accessibility}><span>${esc(ring.ringGlyph)}</span></span>`;
      }

      function statusKeyControl(rows, panelClass = "") {
        return `<div class="block-map-tools"><details class="status-key"><summary><span class="ui-icon key" aria-hidden="true"></span><span>Status key</span><span class="chevron" aria-hidden="true"></span></summary><div class="status-key-panel ${esc(panelClass)}">${rows.map((row) => `<div class="status-key-row">${row.visual}<span><strong>${esc(row.label)}</strong>${row.detail ? esc(row.detail) : ""}</span></div>`).join("")}</div></details></div>`;
      }
      const searchKindLabels = Object.freeze({
        module: "Module",
        group: "Doc group",
        document: "Document",
        block: "Block"
      });

      const currentStage = state.lifecycle?.stage || "awaiting_seed";
      const lifecycleStageIndex = Math.max(0, stageDefinitions.findIndex((stage) => stage.id === currentStage));
      const foundationComplete = currentStage === "brainwave_documentation_complete";
      const currentJourneyIndex = foundationComplete ? stageDefinitions.length - 1 : lifecycleStageIndex;
      const currentDefinition = stageDefinitions[currentJourneyIndex] || stageDefinitions[0];
      const expandedStages = new Set([currentJourneyIndex]);

      function safeHref(value) {
        const href = String(value || "").trim();
        if (!href || /^(?:javascript|data|vbscript):/i.test(href)) return "#";
        return href;
      }

      function routedBlockId() {
        return new URLSearchParams(window.location.hash.slice(1)).get("block");
      }

      function setBlockRoute(blockId, { replace = false } = {}) {
        const base = window.location.href.split("#")[0];
        const next = blockId ? `${base}#block=${encodeURIComponent(blockId)}` : base;
        if (window.location.href === next) return;
        try {
          window.history[replace ? "replaceState" : "pushState"](null, "", next);
        } catch (_) {
          window.location.hash = blockId ? `block=${encodeURIComponent(blockId)}` : "";
        }
      }

      function normalizedSearch(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      }

      function matchingSearchEntries(query) {
        const normalized = normalizedSearch(query);
        if (!normalized) return [];
        const terms = normalized.split(/\s+/);
        const compact = normalized.replaceAll(" ", "");
        return searchEntries
          .map((entry) => {
            const id = String(entry.id || "").toLowerCase();
            const idCompact = id.replace(/[^a-z0-9]+/g, "");
            const title = String(entry.title || "").toLowerCase();
            const matches = terms.every((term) => entry.searchText.includes(term)) || entry.searchCompact.includes(compact);
            if (!matches) return null;
            const score = idCompact === compact
              ? 0
              : idCompact.startsWith(compact)
                ? 1
                : idCompact.includes(compact)
                  ? 2
                  : title.startsWith(normalized)
                    ? 3
                    : 4;
            return { entry, score };
          })
          .filter(Boolean)
          .sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id))
          .slice(0, 24)
          .map(({ entry }) => entry);
      }

      function inlineMarkdown(value) {
        let output = esc(value);
        output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
        output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        output = output.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
          `<a href="${esc(safeHref(href))}" target="_blank" rel="noopener">${label}</a>`
        );
        return output;
      }

      function tableCells(line) {
        return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      }

      function markdownToHtml(markdown) {
        const lines = String(markdown || "").replace(/\r/g, "").split("\n");
        const html = [];
        let index = 0;
        let listType = null;

        const closeList = () => {
          if (listType) html.push(`</${listType}>`);
          listType = null;
        };

        while (index < lines.length) {
          const line = lines[index];
          if (/^```/.test(line)) {
            closeList();
            const language = line.slice(3).trim();
            const code = [];
            index += 1;
            while (index < lines.length && !/^```/.test(lines[index])) {
              code.push(lines[index]);
              index += 1;
            }
            html.push(`<pre${language ? ` data-language="${esc(language)}"` : ""}><code>${esc(code.join("\n"))}</code></pre>`);
            index += 1;
            continue;
          }

          if (
            line.includes("|") &&
            index + 1 < lines.length &&
            /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])
          ) {
            closeList();
            const headers = tableCells(line);
            index += 2;
            const rows = [];
            while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
              rows.push(tableCells(lines[index]));
              index += 1;
            }
            html.push(`<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
            continue;
          }

          const heading = line.match(/^(#{1,4})\s+(.+)$/);
          if (heading) {
            closeList();
            const level = heading[1].length;
            html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
            index += 1;
            continue;
          }

          if (/^\s*[-*]\s+/.test(line)) {
            if (listType !== "ul") {
              closeList();
              listType = "ul";
              html.push("<ul>");
            }
            html.push(`<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
            index += 1;
            continue;
          }

          if (/^\s*\d+\.\s+/.test(line)) {
            if (listType !== "ol") {
              closeList();
              listType = "ol";
              html.push("<ol>");
            }
            html.push(`<li>${inlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>`);
            index += 1;
            continue;
          }

          closeList();
          if (/^\s*>\s?/.test(line)) {
            html.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
            index += 1;
            continue;
          }
          if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
            html.push("<hr>");
            index += 1;
            continue;
          }
          if (!line.trim()) {
            index += 1;
            continue;
          }

          const paragraph = [line.trim()];
          index += 1;
          while (
            index < lines.length &&
            lines[index].trim() &&
            !/^(?:#{1,4}\s+|```|\s*[-*]\s+|\s*\d+\.\s+|\s*>\s?)/.test(lines[index])
          ) {
            paragraph.push(lines[index].trim());
            index += 1;
          }
          html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        }
        closeList();
        return html.join("");
      }

      function emptyReader(iconName = "") {
        const icon = iconName
          ? `<div class="empty-icon"><span class="ui-icon ${esc(iconName)}" aria-hidden="true"></span></div>`
          : "";
        return `<div class="empty-reader ${iconName ? "" : "compact"}"><div>${icon}<div class="empty-lines"><span class="skeleton-line"></span><span class="skeleton-line"></span><span class="skeleton-line"></span></div></div></div>`;
      }

      function firstReadableLine(markdown) {
        const line = String(markdown || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !/^#|^Status:|^Last updated:|^Source seed:/.test(line)) || "";
        return line
          .replace(/^(\*\*|__)(.+)\1$/, "$2")
          .replace(/^`(.+)`$/, "$1");
      }

      function moduleTone(moduleId) {
        if (moduleId.includes("BRND")) return "brand";
        if (moduleId.includes("PDEX")) return "experience";
        if (moduleId.includes("PSTR")) return "product";
        if (moduleId.includes("COMM")) return "commercial";
        if (moduleId.includes("GROW")) return "growth";
        if (moduleId.includes("LEGL")) return "legal";
        if (moduleId.includes("SOPS")) return "operations";
        return "software";
      }

      function moduleCode(moduleId) {
        return String(moduleId || "").replace(/^_DNA-/, "").slice(0, 4) || "DNA";
      }

      function documentMaturity(node) {
        if (!node.expressed) return "empty";
        const path = trackedPathByQualifiedId.get(node.qualified_id);
        const file = path ? trackedFiles[path] : null;
        const status = file?.processing_status || node.processing_status;
        if (file?.contract_errors?.length || status === "invalid" || status === "blocked") return "issue";
        if (status === "complete") return "complete";
        if (status === "in_progress") return "drafting";
        if (file?.exists) return "scoped";
        return "empty";
      }

      function documentStatusCells(counts) {
        const priorities = ["issue", "complete", "drafting", "scoped", "empty"];
        return priorities.flatMap((status) =>
          Array.from({ length: counts[status] || 0 }, () => status)
        );
      }

      function moduleMaturity(moduleId, module) {
        const fileNodes = Object.values(module.nodes || {})
          .filter((node) => node.type === "file")
          .sort((a, b) => a.id.localeCompare(b.id));
        const selectedTotal = fileNodes.filter((node) => node.expressed).length;
        const total = module.selected ? selectedTotal : fileNodes.length;
        const counts = { empty: 0, scoped: 0, drafting: 0, complete: 0, issue: 0 };
        for (const node of fileNodes) {
          if (module.selected && !node.expressed) continue;
          counts[documentMaturity(node)] += 1;
        }
        const label = !module.selected
          ? "Installed"
          : total === 0
            ? "Selected"
            : counts.issue
              ? "Needs attention"
              : counts.complete === total
                ? "Complete"
                : counts.drafting || counts.scoped
                  ? "Drafting"
                  : "Scoped";
        const detail = module.selected && total
          ? `${counts.complete} of ${total} complete`
          : `${fileNodes.length} available`;
        return {
          ...counts,
          total,
          label,
          detail,
          cells: documentStatusCells(counts)
        };
      }

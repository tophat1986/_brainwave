      // Reference Library
      function referenceTypeLabel(reference) {
        if (reference.type === "item") return titleCase(reference.kind || "reference");
        return titleCase(reference.type);
      }

      function referenceSourceLabel(reference) {
        if (reference.source?.provider) return titleCase(reference.source.provider);
        if (reference.source?.citation) return reference.source.citation;
        if (reference.source?.url) return "Web";
        if (reference.representation?.path) return "Local file";
        return reference.storage === "link_only" ? "Linked" : "Saved";
      }

      function referencePills(values, className = "") {
        return (values || []).map((value) =>
          `<span class="reference-pill ${esc(className)}">${esc(titleCase(value))}</span>`
        ).join("");
      }

      function referenceGroupCard(reference) {
        const count = reference.type === "board"
          ? (reference.members || []).length
          : referenceItems.filter((item) => item.collection === reference.id).length;
        const memberLabel = reference.type === "board"
          ? `linked ${count === 1 ? "entry" : "entries"}`
          : `linked item${count === 1 ? "" : "s"}`;
        return `<button class="reference-group-card" type="button" data-action="reference" data-reference="${esc(reference.id)}">
          <span class="reference-group-type">${esc(titleCase(reference.type))}</span>
          <strong>${esc(reference.title)}</strong>
          <span>${esc(reference.summary)}</span>
          <small>${count} ${memberLabel}</small>
        </button>`;
      }

      function renderReferences() {
        const root = document.getElementById("reference-library");
        const summary = document.getElementById("reference-summary");
        if (!root || !summary) return;
        const totals = references.totals || {};
        const validation = references.validation || {};
        const issueCount = (validation.errors || []).length + (validation.warnings || []).length;
        summary.innerHTML = `<span>${Number(totals.items || 0)} items</span><span>${Number(totals.collections || 0)} collections</span><span>${Number(totals.boards || 0)} boards</span>`;

        if (!referenceRecords.length) {
          root.innerHTML = `<div class="reference-empty">
            <span class="reference-empty-mark" aria-hidden="true">+</span>
            <h2>No references saved yet</h2>
            <p>When useful material appears, an AI agent can capture it in <code>_references/</code> without adding it to the Seed.</p>
            <a href="_reference_library_guide.md" target="_blank" rel="noopener">Open the capture guide ↗</a>
          </div>`;
          return;
        }

        const groups = [...referenceBoards, ...referenceCollections];
        const groupMarkup = groups.length
          ? `<section class="reference-groups" aria-label="Reference boards and collections">${groups.map(referenceGroupCard).join("")}</section>`
          : "";
        const validationMarkup = issueCount
          ? `<div class="reference-notice ${validation.errors?.length ? "issue" : ""}"><strong>${issueCount} library note${issueCount === 1 ? "" : "s"}</strong><span>Run <code>references-validate</code> for details.</span></div>`
          : "";
        const rows = referenceItems.map((reference) => {
          const collection = referenceById.get(reference.collection);
          return `<tr>
            <td><button class="reference-row-title" type="button" data-action="reference" data-reference="${esc(reference.id)}"><strong>${esc(reference.title)}</strong><span>${esc(reference.summary)}</span><code>${esc(reference.id)}</code></button></td>
            <td><span class="reference-kind">${esc(referenceTypeLabel(reference))}</span></td>
            <td><span class="reference-role-list">${referencePills(reference.roles)}</span></td>
            <td>${esc(collection?.title || "—")}</td>
            <td>${esc(referenceSourceLabel(reference))}</td>
            <td><span class="reference-status ${esc(reference.status || "working")}">${esc(titleCase(reference.status || "working"))}</span></td>
          </tr>`;
        }).join("");
        const table = referenceItems.length
          ? `<div class="reference-table-wrap"><table class="reference-table">
              <thead><tr><th>Reference</th><th>Kind</th><th>Role</th><th>Collection</th><th>Source</th><th>Status</th></tr></thead>
              <tbody>${rows}</tbody>
            </table></div>`
          : `<div class="reference-table-empty">Boards or collections exist, but no reference items have been captured.</div>`;
        root.innerHTML = `${validationMarkup}${groupMarkup}${table}`;
      }

      function referenceActionLink(href, label) {
        return href
          ? `<a class="reference-action-link" href="${esc(safeHref(href))}" target="_blank" rel="noopener">${esc(label)} ↗</a>`
          : "";
      }

      function linkedReferenceButton(reference, note = "") {
        if (!reference) return "";
        return `<button class="reference-related" type="button" data-action="reference" data-reference="${esc(reference.id)}">
          <span><strong>${esc(reference.title)}</strong><small>${esc(referenceTypeLabel(reference))}</small></span>
          ${note ? `<em>${esc(note)}</em>` : ""}
        </button>`;
      }

      function openReference(referenceId, { remember = false } = {}) {
        const reference = referenceById.get(referenceId);
        if (!reference) return;
        const representationPath = reference.representation?.path;
        const previewPath = reference.representation?.thumbnail || representationPath;
        const imagePreview = reference.kind === "image" && previewPath && reference.representation?.[reference.representation?.thumbnail ? "thumbnail_exists" : "path_exists"] !== false
          ? `<figure class="reference-preview"><img src="${esc(safeHref(previewPath))}" alt="${esc(reference.title)}"></figure>`
          : "";
        const primaryText = reference.kind === "claim" && reference.claim
          ? `<blockquote class="reference-primary-text">${esc(reference.claim)}</blockquote>`
          : reference.kind === "quote" && reference.quote
            ? `<blockquote class="reference-primary-text">${esc(reference.quote)}${reference.attribution ? `<cite>${esc(reference.attribution)}</cite>` : ""}</blockquote>`
            : "";
        const facts = [
          ["Source", referenceSourceLabel(reference)],
          ["Locator", reference.source?.locator],
          ["Citation", reference.source?.citation],
          ["Design state", reference.design_status ? titleCase(reference.design_status) : null],
          ["Captured", reference.source?.captured_at || reference.source?.retrieved_at],
          ["Sensitivity", reference.sensitivity ? titleCase(reference.sensitivity) : null],
          ["Storage", reference.storage ? titleCase(reference.storage) : null]
        ].filter(([, value]) => value);
        const collection = referenceById.get(reference.collection);
        const links = (reference.links || []).map((link) =>
          linkedReferenceButton(referenceById.get(link.ref), [titleCase(link.relationship), link.note].filter(Boolean).join(" · "))
        ).join("");
        const boardMemberships = referenceBoards.filter((board) =>
          (board.members || []).some((member) => member.ref === reference.id || member.ref === reference.collection)
        );
        const contained = reference.type === "board"
          ? (reference.members || []).map((member) => linkedReferenceButton(referenceById.get(member.ref), member.note)).join("")
          : reference.type === "collection"
            ? referenceItems.filter((item) => item.collection === reference.id).map((item) => linkedReferenceButton(item)).join("")
            : "";
        const contextLinks = [
          collection ? linkedReferenceButton(collection, "Collection") : "",
          ...boardMemberships.map((board) => linkedReferenceButton(board, "Board")),
          links
        ].filter(Boolean).join("");
        const dnaLinks = (reference.dna_links || []).map((link) =>
          `<button class="reference-related" type="button" data-action="block" data-block="${esc(link.block_id)}"><span><strong>${esc(link.block_id)}</strong><small>${esc(titleCase(link.relationship))}</small></span>${link.note ? `<em>${esc(link.note)}</em>` : ""}</button>`
        ).join("");
        const actions = [
          referenceActionLink(reference.source?.url, "Open original"),
          referenceActionLink(representationPath, "Open saved material"),
          referenceActionLink(reference.representation?.transcript_path, "Open transcript")
        ].filter(Boolean).join("");
        const html = `${imagePreview}<div class="reference-detail">
          <div class="reference-detail-pills">${referencePills([referenceTypeLabel(reference)], "kind")}${referencePills(reference.roles)}</div>
          ${primaryText}
          <section><h3>Summary</h3><p>${esc(reference.summary)}</p></section>
          ${reference.why_saved ? `<section><h3>Why it matters</h3><p>${esc(reference.why_saved)}</p></section>` : ""}
          ${facts.length ? `<dl class="reference-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : ""}
          ${reference.tags?.length ? `<section><h3>Tags</h3><div class="reference-detail-pills">${referencePills(reference.tags)}</div></section>` : ""}
          ${actions ? `<div class="reference-actions">${actions}</div>` : ""}
          ${contained ? `<section><h3>Contents</h3><div class="reference-related-list">${contained}</div></section>` : ""}
          ${contextLinks ? `<section><h3>Library context</h3><div class="reference-related-list">${contextLinks}</div></section>` : ""}
          ${dnaLinks ? `<section><h3>DNA connections</h3><div class="reference-related-list">${dnaLinks}</div></section>` : ""}
        </div>`;
        openInspector({
          eyebrow: reference.type === "item" ? "Reference item" : `Reference ${reference.type}`,
          title: reference.title,
          meta: reference.id,
          html,
          sourcePath: reference.source_file
        }, { remember });
      }

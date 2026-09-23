      function renderPrinciples() {
        const principles = state.principles || {};
        const entries = principles.entries || [];
        document.getElementById("principles-count").textContent = entries.length
          ? `${entries.length} of 10 maximum` : "";
        document.getElementById("principles-list").innerHTML = entries.length
          ? `<ol class="principles-list">${entries.map((entry, index) => {
            const sourcePath = entry.source.split("#")[0];
            const contentKey = sourcePath === "_my_brainwave_seed.md" ? "seed"
              : sourcePath === "_my_brainwave_north_star.md" ? "north_star" : null;
            const action = contentKey ? `data-action="content" data-content="${contentKey}"`
              : `data-action="document" data-path="${esc(sourcePath)}"`;
            return `<li class="principle">
              <span class="principle-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
              <div><p class="principle-text">${esc(entry.text)}</p>
                <details class="principle-source"><summary>Source</summary>
                  <button type="button" ${action}>${esc(entry.source)}</button>
                </details>
              </div>
            </li>`;
          }).join("")}</ol>`
          : `<p class="principles-empty">${principles.status === "ready"
            ? "No principles needed yet. Only distinctive project priorities earn a place."
            : "Principles take shape as your DNA documentation is developed."}</p>`;
      }

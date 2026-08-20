import { CHEVRON_ICON_SVG, EDIT_ICON_SVG, LOAD_ICON_SVG } from "./icons.js";
import { formatSize, listSizePresets } from "./api.js";
import { makeAspectPreview } from "./styles.js";
import { openInputPopup, openPopup } from "./popup.js";
import { renameCategory } from "./api.js";

const UNCATEGORISED = "Uncategorised";

function makePresetCard(preset, { onLoad }) {
  const card = document.createElement("div");
  card.className = "sp-preset-item";

  const head = document.createElement("div");
  head.className = "sp-preset-head";

  head.appendChild(makeAspectPreview(preset.width, preset.height));

  const name = document.createElement("div");
  name.className = "sp-preset-name";
  name.textContent = formatSize(preset.width, preset.height);

  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.className = "sp-preset-load";
  loadBtn.title = "Load";
  loadBtn.innerHTML = LOAD_ICON_SVG;
  loadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onLoad?.(preset);
  });

  head.append(name, loadBtn);
  card.appendChild(head);

  card.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    onLoad?.(preset);
  });

  return card;
}

function groupPresets(presets) {
  const folders = new Map();
  const uncategorised = [];
  for (const preset of presets) {
    const folder = String(preset.category || "").trim();
    if (!folder) {
      uncategorised.push(preset);
      continue;
    }
    const list = folders.get(folder) || [];
    list.push(preset);
    folders.set(folder, list);
  }
  const named = [...folders.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return { uncategorised, named, folders };
}

function makeFolder({ title, presets, expanded, onLoad, onRenameCategory }) {
  const folder = document.createElement("div");
  folder.className = "sp-preset-folder";
  if (!expanded) folder.classList.add("collapsed");

  const head = document.createElement("div");
  head.className = "sp-preset-folder-head sp-mgr-folder-head";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "sp-mgr-folder-toggle";

  const chevron = document.createElement("span");
  chevron.className = "sp-preset-folder-chevron";
  chevron.innerHTML = CHEVRON_ICON_SVG;

  const label = document.createElement("span");
  label.className = "sp-preset-folder-name";
  label.textContent = title;

  const count = document.createElement("span");
  count.className = "sp-preset-folder-count";
  count.textContent = String(presets.length);

  toggle.append(chevron, label, count);

  const actions = document.createElement("div");
  actions.className = "sp-mgr-folder-actions";

  if (title.toLowerCase() !== UNCATEGORISED.toLowerCase()) {
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "sp-mgr-icon-btn";
    renameBtn.title = "Rename category";
    renameBtn.innerHTML = EDIT_ICON_SVG;
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onRenameCategory?.(title, renameBtn);
    });
    actions.appendChild(renameBtn);
  }

  head.append(toggle, actions);

  const body = document.createElement("div");
  body.className = "sp-preset-folder-body";
  for (const preset of presets) {
    body.appendChild(makePresetCard(preset, { onLoad }));
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const collapsed = folder.classList.toggle("collapsed");
    toggle.title = collapsed ? "Expand" : "Collapse";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });

  folder.append(head, body);
  return folder;
}

function matchesPreset(preset, query) {
  if (!query) return true;
  const haystack = [
    preset.category || UNCATEGORISED,
    String(preset.width),
    String(preset.height),
    formatSize(preset.width, preset.height),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function paintPresetList(list, presets, query, onLoad, refresh) {
  const q = (query || "").trim().toLowerCase();
  const matched = presets.filter((preset) => matchesPreset(preset, q));
  list.replaceChildren();
  if (!matched.length) {
    const empty = document.createElement("div");
    empty.className = "sp-popup-message";
    empty.textContent = q ? "No presets" : "No saved presets yet.";
    list.appendChild(empty);
    return;
  }

  const grouped = groupPresets(matched);
  const searching = Boolean(q);

  function renameCategoryHandler(categoryName, anchor) {
    openInputPopup({
      nested: true,
      anchor,
      title: "Rename category",
      placeholder: "category name",
      initialValue: categoryName,
      confirmLabel: "Rename",
      validate: (value) => (!value.trim() ? "Name is required" : ""),
      onSubmit: async (value) => {
        const result = await renameCategory({ name: categoryName, newName: value.trim() });
        if (!result.ok) return;
        refresh?.();
      },
    });
  }

  if (grouped.uncategorised.length) {
    list.appendChild(
      makeFolder({
        title: UNCATEGORISED,
        presets: grouped.uncategorised,
        expanded: true,
        onLoad,
        onRenameCategory: renameCategoryHandler,
      }),
    );
  }
  for (const name of grouped.named) {
    list.appendChild(
      makeFolder({
        title: name,
        presets: grouped.folders.get(name) || [],
        expanded: searching,
        onLoad,
        onRenameCategory: renameCategoryHandler,
      }),
    );
  }
}

export function openLoadPresetPopup({ anchor, onPick }) {
  return openPopup({
    anchor,
    title: "Load preset",
    width: 340,
    render(body, { close, reposition }) {
      const status = document.createElement("div");
      status.className = "sp-popup-message";
      status.textContent = "Loading…";
      body.appendChild(status);

      listSizePresets()
        .then((result) => {
          const presets = result.presets || [];
          if (!result.ok) {
            status.textContent = result.error || "Failed to load presets";
            reposition?.();
            return;
          }
          if (!presets.length) {
            status.textContent = "No saved presets yet.";
            reposition?.();
            return;
          }
          status.remove();

          const search = document.createElement("input");
          search.className = "sp-popup-input";
          search.type = "text";
          search.placeholder = "search category or size";

          const list = document.createElement("div");
          list.className = "sp-preset-list";

          const onLoad = (picked) => {
            close();
            onPick?.(picked);
          };

          async function refresh() {
            const next = await listSizePresets();
            if (!next.ok) return;
            presets.length = 0;
            presets.push(...(next.presets || []));
            paintPresetList(list, presets, search.value, onLoad, refresh);
            reposition?.();
          }

          search.addEventListener("input", () => {
            paintPresetList(list, presets, search.value, onLoad, refresh);
            reposition?.();
          });

          paintPresetList(list, presets, "", onLoad, refresh);
          body.append(search, list);
          reposition?.();
          requestAnimationFrame(() => search.focus());
        })
        .catch((err) => {
          status.textContent = err?.message || "Failed to load presets";
          reposition?.();
        });
    },
  });
}

import { CHEVRON_ICON_SVG, EDIT_ICON_SVG, TRASH_ICON_SVG } from "./icons.js";
import { openConfirmPopup, openInputPopup, openPopup } from "./popup.js";
import {
  categoryNames,
  deleteCategory,
  deleteSizePreset,
  formatSize,
  listCategories,
  listSizePresets,
  renameCategory,
  updateSizePreset,
} from "./api.js";

const UNCATEGORISED = "Uncategorised";

function mgrConfirm(opts) {
  return openConfirmPopup({ nested: true, ...opts });
}

function mgrInput(opts) {
  return openInputPopup({ nested: true, ...opts });
}

function matchesQuery(text, query) {
  if (!query) return true;
  return (text || "").toLowerCase().includes(query);
}

function groupByCategory(items) {
  const folders = new Map();
  for (const item of items) {
    const name = (item.category || "").trim() || UNCATEGORISED;
    const list = folders.get(name) || [];
    list.push(item);
    folders.set(name, list);
  }
  return folders;
}

function makeIconBtn(className, title, svg, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.title = title;
  btn.innerHTML = svg;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick?.(btn);
  });
  return btn;
}

function openCategoryPicker({ anchor, categories, current, onPick, onClose }) {
  return openPopup({
    nested: true,
    anchor,
    title: "Move to category",
    width: 260,
    onClose,
    render(body, { close }) {
      const filter = document.createElement("input");
      filter.className = "sp-popup-input";
      filter.type = "text";
      filter.placeholder = "filter";

      const list = document.createElement("div");
      list.className = "sp-pick-list";

      const items = ["", ...categories.filter((n) => n.toLowerCase() !== UNCATEGORISED.toLowerCase())];
      const selected = (current || "").trim();

      function paint() {
        const q = filter.value.trim().toLowerCase();
        list.replaceChildren();
        const shown = items.filter((name) => matchesQuery(name || UNCATEGORISED, q));
        for (const name of shown) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sp-pick-item";
          btn.textContent = name || UNCATEGORISED;
          if ((name || "") === selected) btn.classList.add("selected");
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
            onPick?.(name);
          });
          list.appendChild(btn);
        }
      }

      filter.addEventListener("input", paint);
      paint();
      body.append(filter, list);
      requestAnimationFrame(() => filter.focus());
    },
  });
}

function makeFolderSection({
  title,
  items,
  expanded,
  canManageFolder,
  onRenameFolder,
  onDeleteFolder,
  onToggleExpand,
  renderItem,
}) {
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
  count.textContent = String(items.length);

  toggle.append(chevron, label, count);

  const actions = document.createElement("div");
  actions.className = "sp-mgr-folder-actions";

  if (canManageFolder) {
    actions.append(
      makeIconBtn("sp-mgr-icon-btn", "Rename", EDIT_ICON_SVG, onRenameFolder),
      makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, onDeleteFolder),
    );
  }

  head.append(toggle, actions);

  const body = document.createElement("div");
  body.className = "sp-preset-folder-body";
  for (const item of items) {
    body.appendChild(renderItem(item));
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const collapsed = folder.classList.toggle("collapsed");
    toggle.title = collapsed ? "Expand" : "Collapse";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    onToggleExpand?.(!collapsed);
  });

  folder.append(head, body);
  return folder;
}

function folderExpanded(name, { query, openMap }) {
  if ((query || "").trim()) return true;
  if (openMap?.has(name)) return openMap.get(name);
  return false;
}

function makeItemRow(preset, { onMove, onDelete }) {
  const row = document.createElement("div");
  row.className = "sp-mgr-item";

  const info = document.createElement("div");
  info.className = "sp-mgr-item-info";

  const titleEl = document.createElement("div");
  titleEl.className = "sp-mgr-item-name";
  titleEl.textContent = formatSize(preset.width, preset.height);

  info.appendChild(titleEl);

  const actions = document.createElement("div");
  actions.className = "sp-mgr-item-actions";
  actions.append(
    makeIconBtn("sp-mgr-icon-btn", "Move", EDIT_ICON_SVG, onMove),
    makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, onDelete),
  );

  row.append(info, actions);
  return row;
}

function paintManagerList(listEl, { presets, categories, showEmpty, query, openMap, reload }) {
  listEl.replaceChildren();
  const q = query.trim().toLowerCase();

  const filtered = presets.filter((preset) => {
    const haystack = [preset.category, String(preset.width), String(preset.height), formatSize(preset.width, preset.height)]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  const grouped = groupByCategory(filtered);
  if (showEmpty) {
    for (const category of categories) {
      if ((category.count || 0) === 0 && !grouped.has(category.name)) {
        grouped.set(category.name, []);
      }
    }
  }

  const names = [...grouped.keys()]
    .filter((name) => {
      const items = grouped.get(name) || [];
      if (items.length) return true;
      if (!showEmpty) return false;
      return name.toLowerCase() !== UNCATEGORISED.toLowerCase();
    })
    .sort((a, b) => {
      const aUncat = a.toLowerCase() === UNCATEGORISED.toLowerCase();
      const bUncat = b.toLowerCase() === UNCATEGORISED.toLowerCase();
      if (aUncat !== bUncat) return aUncat ? -1 : 1;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });

  if (!names.length) {
    const empty = document.createElement("div");
    empty.className = "sp-popup-message";
    empty.textContent = q ? "No presets" : "No saved presets yet.";
    listEl.appendChild(empty);
    return;
  }

  const categoryNamesList = categoryNames(categories);

  for (const folderName of names) {
    const items = grouped.get(folderName) || [];
    listEl.appendChild(
      makeFolderSection({
        title: folderName,
        items,
        expanded: folderExpanded(folderName, { query: q, openMap }),
        canManageFolder: folderName.toLowerCase() !== UNCATEGORISED.toLowerCase(),
        onToggleExpand: (open) => openMap?.set(folderName, open),
        onRenameFolder: (btn) => {
          mgrInput({
            anchor: btn,
            title: "Rename category",
            placeholder: "category name",
            initialValue: folderName,
            confirmLabel: "Rename",
            validate: (value) => (!value.trim() ? "Name is required" : ""),
            onSubmit: async (value) => {
              const next = value.trim();
              const result = await renameCategory({ name: folderName, newName: next });
              if (!result.ok) {
                mgrConfirm({
                  anchor: btn,
                  title: "Rename category",
                  message: result.error || "Rename failed",
                  confirmLabel: "OK",
                  showCancel: false,
                  danger: false,
                });
                return;
              }
              if (openMap?.has(folderName)) {
                openMap.set(next, openMap.get(folderName));
                openMap.delete(folderName);
              }
              reload();
            },
          });
        },
        onDeleteFolder: (btn) => {
          mgrConfirm({
            anchor: btn,
            title: "Delete category",
            message: `Delete “${folderName}” and ${items.length} preset(s)?`,
            confirmLabel: "Delete",
            danger: true,
            onConfirm: async () => {
              const result = await deleteCategory(folderName);
              if (!result.ok) {
                mgrConfirm({
                  anchor: btn,
                  title: "Delete category",
                  message: result.error || "Delete failed",
                  confirmLabel: "OK",
                  showCancel: false,
                  danger: false,
                });
                return;
              }
              reload();
            },
          });
        },
        renderItem: (preset) =>
          makeItemRow(preset, {
            onMove: (btn) => {
              let picker = null;
              picker = openCategoryPicker({
                anchor: btn,
                categories: categoryNamesList,
                current: preset.category || "",
                onPick: async (name) => {
                  const result = await updateSizePreset({
                    id: preset.id,
                    category: name,
                    overwrite: true,
                  });
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Move preset",
                      message: result.error || "Move failed",
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }
                  reload();
                },
                onClose: () => {
                  picker = null;
                },
              });
            },
            onDelete: (btn) => {
              mgrConfirm({
                anchor: btn,
                title: "Delete preset",
                message: `Delete ${formatSize(preset.width, preset.height)}?`,
                confirmLabel: "Delete",
                danger: true,
                onConfirm: async () => {
                  const result = await deleteSizePreset(preset.id);
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Delete preset",
                      message: result.error || "Delete failed",
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }
                  reload();
                },
              });
            },
          }),
      }),
    );
  }
}

export function openManagerPopup({ anchor }) {
  return openPopup({
    anchor,
    title: "Size manager",
    width: 360,
    render(body) {
      const search = document.createElement("input");
      search.className = "sp-popup-input";
      search.type = "text";
      search.placeholder = "search sizes";

      const emptyRow = document.createElement("div");
      emptyRow.className = "sp-toggle-row";

      const emptyToggle = document.createElement("div");
      emptyToggle.className = "sp-toggle";
      emptyToggle.setAttribute("role", "switch");
      emptyToggle.setAttribute("aria-checked", "false");
      const emptyKnob = document.createElement("div");
      emptyKnob.className = "sp-toggle-knob";
      emptyToggle.appendChild(emptyKnob);

      const emptyLabel = document.createElement("span");
      emptyLabel.textContent = "Show empty categories";

      emptyRow.append(emptyToggle, emptyLabel);

      const status = document.createElement("div");
      status.className = "sp-popup-message";
      status.textContent = "Loading…";

      const list = document.createElement("div");
      list.className = "sp-preset-list sp-mgr-list";

      body.append(search, emptyRow, status, list);

      let showEmpty = false;
      let presets = [];
      let categories = [];
      const openMap = new Map();

      function paint() {
        paintManagerList(list, {
          presets,
          categories,
          showEmpty,
          query: search.value,
          openMap,
          reload: loadAll,
        });
      }

      async function loadAll() {
        status.textContent = "Loading…";
        status.style.display = "";
        const [presetResult, categoryResult] = await Promise.all([listSizePresets(), listCategories()]);
        if (!presetResult.ok) {
          status.textContent = presetResult.error || "Failed to load presets";
          return;
        }
        presets = presetResult.presets || [];
        categories = categoryResult.categories || [];
        status.style.display = "none";
        paint();
      }

      search.addEventListener("input", paint);

      emptyToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        showEmpty = !showEmpty;
        emptyToggle.classList.toggle("on", showEmpty);
        emptyToggle.setAttribute("aria-checked", showEmpty ? "true" : "false");
        paint();
      });

      loadAll();
    },
  });
}

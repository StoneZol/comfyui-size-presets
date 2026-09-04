import { CHEVRON_ICON_SVG, COPY_ICON_SVG, EDIT_ICON_SVG, MOVE_ICON_SVG, SWAP_ICON_SVG, TRASH_ICON_SVG } from "./icons.js";
import { openConfirmPopup, openInputPopup, openPopup } from "./popup.js";
import {
  categoryNames,
  deleteCategory,
  deleteSizePreset,
  formatSize,
  listCategories,
  listSizePresets,
  renameCategory,
  saveSizePreset,
  updateSizePreset,
} from "./api.js";
import { emptyShelfMatchesSearch, matchesSizePreset, parseSearchQuery } from "./search.js";
import { makeAspectPreview } from "./styles.js";

const UNCATEGORISED = "Uncategorised";

function categoryKey(preset) {
  return (preset.category || "").trim().toLowerCase() || UNCATEGORISED.toLowerCase();
}

/** True if square, or inverted W×H already exists in the same category. */
function hasInvertedPair(preset, allPresets) {
  if (preset.width === preset.height) return true;
  const cat = categoryKey(preset);
  return allPresets.some(
    (p) =>
      categoryKey(p) === cat &&
      p.width === preset.height &&
      p.height === preset.width,
  );
}

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

function makeSizeField(labelText, value) {
  const row = document.createElement("div");
  row.className = "sp-size-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.className = "sp-popup-input";
  input.type = "number";
  input.min = "64";
  input.max = "8192";
  input.step = "8";
  input.value = String(value);
  row.append(label, input);
  return { row, input };
}

function openCategoryPicker({ anchor, title = "Category", categories, current, onPick, onClose }) {
  return openPopup({
    nested: true,
    anchor,
    title,
    width: 260,
    onClose,
    render(body, { close }) {
      const filter = document.createElement("input");
      filter.className = "sp-popup-input";
      filter.type = "text";
      filter.placeholder = "filter or new name";

      const list = document.createElement("div");
      list.className = "sp-pick-list";

      const items = ["", ...categories.filter((n) => n.toLowerCase() !== UNCATEGORISED.toLowerCase())];
      const selected = (current || "").trim();

      function pick(name) {
        close();
        onPick?.(name);
      }

      function paint() {
        const typed = filter.value.trim();
        const q = typed.toLowerCase();
        list.replaceChildren();
        const shown = items.filter((name) => matchesQuery(name || UNCATEGORISED, q));
        const exactMatch = typed && items.some((name) => (name || "").toLowerCase() === q);

        if (typed && !exactMatch) {
          const createBtn = document.createElement("button");
          createBtn.type = "button";
          createBtn.className = "sp-pick-item selected";
          createBtn.textContent = `Use “${typed}”`;
          createBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            pick(typed);
          });
          list.appendChild(createBtn);
        }

        if (!shown.length && !typed) {
          const empty = document.createElement("div");
          empty.className = "sp-popup-message";
          empty.textContent = "No categories yet";
          list.appendChild(empty);
          return;
        }

        for (const name of shown) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sp-pick-item";
          btn.textContent = name || UNCATEGORISED;
          if ((name || "") === selected) btn.classList.add("selected");
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            pick(name);
          });
          list.appendChild(btn);
        }
      }

      filter.addEventListener("input", paint);
      filter.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const typed = filter.value.trim();
        if (!typed) return;
        const exact = items.find((name) => (name || "").toLowerCase() === typed.toLowerCase());
        pick(exact !== undefined ? exact : typed);
      });
      paint();
      body.append(filter, list);
      requestAnimationFrame(() => filter.focus());
    },
  });
}

function openEditSizePopup({ anchor, preset, onSaved }) {
  return openPopup({
    nested: true,
    anchor,
    title: "Edit size",
    width: 300,
    render(body, { close }) {
      const widthField = makeSizeField("Width", preset.width);
      const heightField = makeSizeField("Height", preset.height);
      const preview = makeAspectPreview(preset.width, preset.height);

      function updatePreview() {
        const box = preview.querySelector(".sp-aspect-box");
        const w = Math.max(1, Number(widthField.input.value) || 1);
        const h = Math.max(1, Number(heightField.input.value) || 1);
        const scale = 32 / Math.max(w, h);
        box.style.width = `${Math.max(4, Math.round(w * scale))}px`;
        box.style.height = `${Math.max(4, Math.round(h * scale))}px`;
      }

      widthField.input.addEventListener("input", updatePreview);
      heightField.input.addEventListener("input", updatePreview);

      const previewRow = document.createElement("div");
      previewRow.className = "sp-size-row";
      previewRow.append(
        Object.assign(document.createElement("label"), { textContent: "Preview" }),
        preview,
      );

      const errorEl = document.createElement("div");
      errorEl.className = "sp-popup-error";

      const actions = document.createElement("div");
      actions.className = "sp-popup-actions";

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "sp-popup-btn primary";
      confirm.textContent = "Save";

      async function submit() {
        const w = parseInt(widthField.input.value, 10);
        const h = parseInt(heightField.input.value, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64) {
          errorEl.textContent = "Enter valid width and height (min 64)";
          return;
        }
        if (w === preset.width && h === preset.height) {
          close();
          return;
        }
        confirm.disabled = true;
        try {
          const result = await updateSizePreset({
            id: preset.id,
            width: w,
            height: h,
          });
          if (result.conflicts?.length) {
            errorEl.textContent = `${formatSize(w, h)} already exists in this category`;
            return;
          }
          if (!result.ok) {
            errorEl.textContent = result.error || "Save failed";
            return;
          }
          close();
          onSaved?.();
        } catch (err) {
          errorEl.textContent = err?.message || "Save failed";
        } finally {
          confirm.disabled = false;
        }
      }

      confirm.addEventListener("click", (e) => {
        e.stopPropagation();
        submit();
      });
      for (const input of [widthField.input, heightField.input]) {
        input.addEventListener("input", () => {
          if (errorEl.textContent) errorEl.textContent = "";
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        });
      }

      actions.appendChild(confirm);
      body.append(widthField.row, heightField.row, previewRow, errorEl, actions);
      requestAnimationFrame(() => widthField.input.focus());
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
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(query);
  if (hasShelfFilter || tokens.length) return true;
  if (openMap?.has(name)) return openMap.get(name);
  return name === UNCATEGORISED;
}

function makeItemRow(preset, { onEdit, onCopy, onMove, onClone, onDelete }) {
  const row = document.createElement("div");
  row.className = "sp-mgr-item";

  const info = document.createElement("div");
  info.className = "sp-mgr-item-info";

  const titleRow = document.createElement("div");
  titleRow.className = "sp-mgr-item-title";
  titleRow.appendChild(makeAspectPreview(preset.width, preset.height));

  const titleEl = document.createElement("div");
  titleEl.className = "sp-mgr-item-name";
  titleEl.textContent = formatSize(preset.width, preset.height);
  titleRow.appendChild(titleEl);

  info.appendChild(titleRow);

  const actions = document.createElement("div");
  actions.className = "sp-mgr-item-actions";
  actions.append(
    makeIconBtn("sp-mgr-icon-btn", "Edit size", EDIT_ICON_SVG, onEdit),
    makeIconBtn("sp-mgr-icon-btn", "Copy to category", COPY_ICON_SVG, onCopy),
    makeIconBtn("sp-mgr-icon-btn", "Move to category", MOVE_ICON_SVG, onMove),
  );
  if (onClone) {
    actions.append(
      makeIconBtn(
        "sp-mgr-icon-btn",
        `Clone inverted ${formatSize(preset.height, preset.width)}`,
        SWAP_ICON_SVG,
        onClone,
      ),
    );
  }
  actions.append(makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, onDelete));

  row.append(info, actions);
  return row;
}

function paintManagerList(listEl, { presets, categories, showEmpty, query, openMap, reload }) {
  listEl.replaceChildren();
  const raw = query || "";
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(raw);
  const searching = hasShelfFilter || tokens.length > 0;

  const filtered = presets.filter((preset) =>
    matchesSizePreset(preset, raw, { emptyFolder: UNCATEGORISED }),
  );

  const grouped = groupByCategory(filtered);
  if (showEmpty) {
    for (const category of categories) {
      if ((category.count || 0) === 0 && !grouped.has(category.name)) {
        if (emptyShelfMatchesSearch(category.name, raw)) grouped.set(category.name, []);
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
    empty.textContent = searching ? "No presets" : "No saved presets yet.";
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
        expanded: folderExpanded(folderName, { query: raw, openMap }),
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
            onEdit: (btn) => {
              openEditSizePopup({
                anchor: btn,
                preset,
                onSaved: reload,
              });
            },
            onCopy: (btn) => {
              openCategoryPicker({
                anchor: btn,
                title: "Copy to category",
                categories: categoryNamesList,
                current: preset.category || "",
                onPick: async (name) => {
                  const targetLabel = (name || "").trim() || UNCATEGORISED;
                  const currentLabel = (preset.category || "").trim() || UNCATEGORISED;
                  if (targetLabel.toLowerCase() === currentLabel.toLowerCase()) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy to category",
                      message: "Already in this category.",
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }

                  const result = await saveSizePreset({
                    category: name,
                    width: preset.width,
                    height: preset.height,
                  });
                  if (result.conflicts?.length) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy to category",
                      message: `${formatSize(preset.width, preset.height)} already exists in “${targetLabel}”. Nothing to copy.`,
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy to category",
                      message: result.error || "Copy failed",
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
            onMove: (btn) => {
              openCategoryPicker({
                anchor: btn,
                title: "Move to category",
                categories: categoryNamesList,
                current: preset.category || "",
                onPick: async (name) => {
                  const targetLabel = (name || "").trim() || UNCATEGORISED;
                  const currentLabel = (preset.category || "").trim() || UNCATEGORISED;
                  if (targetLabel.toLowerCase() === currentLabel.toLowerCase()) return;

                  const result = await updateSizePreset({
                    id: preset.id,
                    category: name,
                  });
                  if (result.conflicts?.length) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Move to category",
                      message: `${formatSize(preset.width, preset.height)} already exists in “${targetLabel}”. Remove it from “${currentLabel}”?`,
                      confirmLabel: "Remove",
                      cancelLabel: "Cancel",
                      danger: true,
                      onConfirm: async () => {
                        const deleted = await deleteSizePreset(preset.id);
                        if (!deleted.ok) {
                          mgrConfirm({
                            anchor: btn,
                            title: "Move to category",
                            message: deleted.error || "Delete failed",
                            confirmLabel: "OK",
                            showCancel: false,
                            danger: false,
                          });
                          return;
                        }
                        reload();
                      },
                    });
                    return;
                  }
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Move to category",
                      message: result.error || "Move failed",
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
            onClone: hasInvertedPair(preset, presets)
              ? null
              : async (btn) => {
                  const result = await saveSizePreset({
                    category: preset.category || "",
                    width: preset.height,
                    height: preset.width,
                  });
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Clone size",
                      message: result.error || "Clone failed",
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }
                  reload();
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
    width: 380,
    render(body) {
      const search = document.createElement("input");
      search.className = "sp-popup-input";
      search.type = "text";
      search.placeholder = "category/size or 1024";

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

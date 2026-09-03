import { CHEVRON_ICON_SVG, COPY_ICON_SVG, EDIT_ICON_SVG, MOVE_ICON_SVG, PLUS_ICON_SVG, TRASH_ICON_SVG } from "../sp/icons.js";
import { openConfirmPopup, openInputPopup, openPopup } from "../sp/popup.js";
import {
  categoryNames,
  deleteValueCategory,
  deleteValuePreset,
  listValueCategories,
  listValuePresets,
  renameValueCategory,
  saveValuePreset,
  updateValuePreset,
} from "./api.js";
import { defaultField, formatFields, makeFieldChips, MAX_FIELDS, normalizeField, presetTitle, selectOnFocus } from "./fields.js";

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

function openEditFieldsPopup({ anchor, preset, onSaved }) {
  return openPopup({
    nested: true,
    anchor,
    title: "Edit preset",
    width: 340,
    render(body, { close, reposition }) {
      const nameRow = document.createElement("div");
      nameRow.className = "sp-size-row";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Name";
      const nameInput = document.createElement("input");
      nameInput.className = "sp-popup-input";
      nameInput.type = "text";
      nameInput.maxLength = 80;
      nameInput.value = preset.name || "";
      nameRow.append(nameLabel, nameInput);

      const fieldsWrap = document.createElement("div");
      fieldsWrap.className = "vp-fields";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "vp-add-btn";
      addBtn.innerHTML = `${PLUS_ICON_SVG}<span>Add field</span>`;

      let fields = (preset.fields || []).map(normalizeField);
      if (!fields.length) fields = [defaultField()];

      function paintFields() {
        fieldsWrap.replaceChildren();
        fields.forEach((field, index) => {
          const row = document.createElement("div");
          row.className = "vp-field-row";

          const fieldName = document.createElement("input");
          fieldName.className = "vp-field-name";
          fieldName.type = "text";
          fieldName.placeholder = "name";
          fieldName.maxLength = 40;
          fieldName.value = field.name;

          const typeBtn = document.createElement("button");
          typeBtn.type = "button";
          typeBtn.className = `vp-field-type${field.type === "INT" ? " is-int" : ""}`;
          typeBtn.textContent = field.type;
          typeBtn.title = "Toggle INT / FLOAT";

          const valueInput = document.createElement("input");
          valueInput.className = "vp-field-value";
          valueInput.type = "number";
          valueInput.step = field.type === "INT" ? "1" : "0.01";
          valueInput.value = String(field.value);
          selectOnFocus(valueInput);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "vp-field-remove";
          removeBtn.title = "Remove field";
          removeBtn.textContent = "×";
          removeBtn.disabled = fields.length <= 1;

          fieldName.addEventListener("change", () => {
            fields[index].name = fieldName.value.trim() || defaultField(fields.filter((_, i) => i !== index)).name;
          });
          typeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const type = fields[index].type === "INT" ? "FLOAT" : "INT";
            const value = type === "INT" ? Math.round(Number(fields[index].value) || 0) : Number(fields[index].value) || 0;
            fields[index] = { ...fields[index], type, value };
            paintFields();
          });
          valueInput.addEventListener("change", () => {
            const number = Number(valueInput.value);
            fields[index].value = Number.isFinite(number)
              ? fields[index].type === "INT"
                ? Math.round(number)
                : number
              : 0;
          });
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fields = fields.filter((_, i) => i !== index);
            if (!fields.length) fields = [defaultField()];
            paintFields();
            reposition?.();
          });

          row.append(fieldName, typeBtn, valueInput, removeBtn);
          fieldsWrap.appendChild(row);
        });
        addBtn.disabled = fields.length >= MAX_FIELDS;
      }

      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fields.length >= MAX_FIELDS) return;
        fields.push(defaultField(fields));
        paintFields();
        reposition?.();
      });

      const errorEl = document.createElement("div");
      errorEl.className = "sp-popup-error";
      const actions = document.createElement("div");
      actions.className = "sp-popup-actions";
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "sp-popup-btn primary";
      confirm.textContent = "Save";
      actions.appendChild(confirm);

      paintFields();
      body.append(nameRow, fieldsWrap, addBtn, errorEl, actions);

      async function submit() {
        const title = nameInput.value.trim();
        if (!title) {
          errorEl.textContent = "Preset name is required";
          nameInput.focus();
          return;
        }
        const rows = [...fieldsWrap.querySelectorAll(".vp-field-row")];
        const next = rows.map((row, index) => {
          const nameEl = row.querySelector(".vp-field-name");
          const valueEl = row.querySelector(".vp-field-value");
          const typeEl = row.querySelector(".vp-field-type");
          const others = fields.filter((_, i) => i !== index);
          return normalizeField({
            name: nameEl?.value.trim() || defaultField(others).name,
            type: typeEl?.textContent,
            value: valueEl?.value,
          });
        });
        confirm.disabled = true;
        try {
          const result = await updateValuePreset({ id: preset.id, name: title, fields: next });
          if (result.conflicts?.length) {
            errorEl.textContent = `“${title}” already exists in this category`;
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
      requestAnimationFrame(() => nameInput.focus());
    },
  });
}

function makeFolderSection({ title, items, expanded, canManageFolder, onRenameFolder, onDeleteFolder, onToggleExpand, renderItem }) {
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
  for (const item of items) body.appendChild(renderItem(item));

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
  return name === UNCATEGORISED;
}

function makeItemRow(preset, { onEdit, onCopy, onMove, onDelete }) {
  const row = document.createElement("div");
  row.className = "sp-mgr-item";
  const info = document.createElement("div");
  info.className = "sp-mgr-item-info";
  const titleRow = document.createElement("div");
  titleRow.className = "sp-mgr-item-title";
  const titleEl = document.createElement("div");
  titleEl.className = "sp-mgr-item-name";
  titleEl.textContent = presetTitle(preset);
  titleRow.appendChild(titleEl);
  info.append(titleRow, makeFieldChips(preset.fields));

  const actions = document.createElement("div");
  actions.className = "sp-mgr-item-actions";
  actions.append(
    makeIconBtn("sp-mgr-icon-btn", "Edit preset", EDIT_ICON_SVG, onEdit),
    makeIconBtn("sp-mgr-icon-btn", "Copy to category", COPY_ICON_SVG, onCopy),
    makeIconBtn("sp-mgr-icon-btn", "Move to category", MOVE_ICON_SVG, onMove),
    makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, onDelete),
  );
  row.append(info, actions);
  return row;
}

function paintManagerList(listEl, { presets, categories, showEmpty, query, openMap, reload }) {
  listEl.replaceChildren();
  const q = query.trim().toLowerCase();
  const filtered = presets.filter((preset) => {
    const haystack = [preset.name, preset.category, formatFields(preset.fields)].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  const grouped = groupByCategory(filtered);
  if (showEmpty) {
    for (const category of categories) {
      if ((category.count || 0) === 0 && !grouped.has(category.name)) grouped.set(category.name, []);
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
              const result = await renameValueCategory({ name: folderName, newName: next });
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
              const result = await deleteValueCategory(folderName);
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
            onEdit: (btn) => openEditFieldsPopup({ anchor: btn, preset, onSaved: reload }),
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
                  const result = await saveValuePreset({
                    category: name,
                    name: preset.name,
                    fields: preset.fields,
                  });
                  if (result.conflicts?.length) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy to category",
                      message: `“${presetTitle(preset)}” already exists in the target category.`,
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
                  const result = await updateValuePreset({ id: preset.id, category: name });
                  if (result.conflicts?.length) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Move to category",
                      message: `“${presetTitle(preset)}” already exists in “${targetLabel}”. Remove it from “${currentLabel}”?`,
                      confirmLabel: "Remove",
                      cancelLabel: "Cancel",
                      danger: true,
                      onConfirm: async () => {
                        const deleted = await deleteValuePreset(preset.id);
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
            onDelete: (btn) => {
              mgrConfirm({
                anchor: btn,
                title: "Delete preset",
                message: `Delete “${presetTitle(preset)}”?`,
                confirmLabel: "Delete",
                danger: true,
                onConfirm: async () => {
                  const result = await deleteValuePreset(preset.id);
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

export function openValueManagerPopup({ anchor }) {
  return openPopup({
    anchor,
    title: "Value manager",
    width: 380,
    render(body) {
      const search = document.createElement("input");
      search.className = "sp-popup-input";
      search.type = "text";
      search.placeholder = "search name or field";

      const emptyRow = document.createElement("div");
      emptyRow.className = "sp-toggle-row";
      const emptyToggle = document.createElement("div");
      emptyToggle.className = "sp-toggle";
      emptyToggle.setAttribute("role", "switch");
      emptyToggle.setAttribute("aria-checked", "false");
      emptyToggle.appendChild(Object.assign(document.createElement("div"), { className: "sp-toggle-knob" }));
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
        const [presetResult, categoryResult] = await Promise.all([listValuePresets(), listValueCategories()]);
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

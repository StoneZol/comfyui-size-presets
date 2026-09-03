import { CHEVRON_ICON_SVG, COPY_ICON_SVG, EDIT_ICON_SVG, GEAR_ICON_SVG, INFO_ICON_SVG, MOVE_ICON_SVG, PLUS_ICON_SVG, TRASH_ICON_SVG } from "../sp/icons.js";
import { openConfirmPopup, openInputPopup, openPopup } from "../sp/popup.js";
import {
  categoryNames,
  deleteValueCategory,
  deleteValueFieldCategory,
  deleteValueFieldDef,
  deleteValuePreset,
  listValueCategories,
  listValueFieldCategories,
  listValueFieldDefs,
  listValuePresets,
  renameValueCategory,
  renameValueFieldCategory,
  saveValuePreset,
  updateValuePreset,
} from "./api.js";
import {
  clampValue,
  defaultField,
  dropItemById,
  fieldCountLabel,
  fieldFromDef,
  formatFieldRange,
  formatFields,
  isolatePointer,
  makeFieldChips,
  makeFieldOrderControls,
  MAX_FIELDS,
  moveItemToIndex,
  normalizeField,
  nextPresetCopyName,
  notesPreview,
  presetTitle,
  selectOnFocus,
  uniqueCopyName,
} from "./fields.js";
import { openFieldConfigPopup, openFieldDefEditor, openFieldLibraryPopup } from "./field_config.js";
import { emptyShelfMatchesSearch, matchesValueField, matchesValuePreset, parseSearchQuery } from "../sp/search.js";
import { presetSearchPlaceholder } from "./prefs.js";
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

      const notesArea = document.createElement("textarea");
      notesArea.className = "sp-popup-input sp-mgr-prompt-area";
      notesArea.rows = 2;
      notesArea.maxLength = 500;
      notesArea.placeholder = "notes (optional)";
      notesArea.value = preset.notes || "";

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
          valueInput.min = String(field.min);
          valueInput.max = String(field.max);
          valueInput.step = String(field.step);
          valueInput.value = String(field.value);
          valueInput.title = `${field.min} … ${field.max} · step ${field.step}`;
          selectOnFocus(valueInput);
          isolatePointer(valueInput);
          isolatePointer(fieldName);

          const configBtn = document.createElement("button");
          configBtn.type = "button";
          configBtn.className = "vp-field-config";
          configBtn.title = "Limits & library";
          configBtn.innerHTML = GEAR_ICON_SVG;

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "vp-field-remove";
          removeBtn.title = "Remove field";
          removeBtn.textContent = "×";
          removeBtn.disabled = fields.length <= 1;

          const order = makeFieldOrderControls({
            index,
            id: field.id,
            onReorder: (fromId, toIndex) => {
              const from = fields.findIndex((item) => item.id === fromId);
              if (from < 0) return;
              fields = moveItemToIndex(fields, from, toIndex);
              paintFields();
              reposition?.();
            },
            onDrop: (fromId, toId, after) => {
              fields = dropItemById(fields, fromId, toId, after);
              paintFields();
              reposition?.();
            },
          });

          fieldName.addEventListener("change", () => {
            fields[index].name =
              fieldName.value.trim() || defaultField(fields.filter((_, i) => i !== index)).name;
          });
          typeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fields[index] = normalizeField({
              ...fields[index],
              type: fields[index].type === "INT" ? "FLOAT" : "INT",
              step: fields[index].type === "INT" ? 0.01 : 1,
            });
            paintFields();
          });
          valueInput.addEventListener("change", () => {
            fields[index].value = clampValue(
              valueInput.value,
              fields[index].type,
              fields[index].min,
              fields[index].max,
            );
            valueInput.value = String(fields[index].value);
          });
          configBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openFieldConfigPopup({
              anchor: configBtn,
              field: fields[index],
              onSave: (next) => {
                fields[index] = normalizeField({ ...next, id: fields[index].id });
                paintFields();
                reposition?.();
              },
            });
          });
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fields = fields.filter((_, i) => i !== index);
            if (!fields.length) fields = [defaultField()];
            paintFields();
            reposition?.();
          });

          row.append(order.dragHandle, order.pos, fieldName, typeBtn, valueInput, configBtn, removeBtn);
          order.wireRowDrop(row);
          fieldsWrap.appendChild(row);
        });
        addBtn.disabled = fields.length >= MAX_FIELDS;
      }

      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fields.length >= MAX_FIELDS) return;
        openFieldLibraryPopup({
          anchor: addBtn,
          onBlank: () => {
            fields.push(defaultField(fields));
            paintFields();
            reposition?.();
          },
          onPick: (def) => {
            fields.push(fieldFromDef(def, fields));
            paintFields();
            reposition?.();
          },
        });
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
      body.append(nameRow, notesArea, fieldsWrap, addBtn, errorEl, actions);

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
            ...fields[index],
            name: nameEl?.value.trim() || defaultField(others).name,
            type: typeEl?.textContent,
            value: valueEl?.value,
          });
        });
        confirm.disabled = true;
        try {
          const result = await updateValuePreset({
            id: preset.id,
            name: title,
            notes: notesArea.value.trim(),
            fields: next,
          });
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
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(query);
  if (hasShelfFilter || tokens.length) return true;
  if (openMap?.has(name)) return openMap.get(name);
  return name === UNCATEGORISED;
}

function openPresetInfoPopup({ anchor, preset }) {
  return openPopup({
    nested: true,
    anchor,
    title: presetTitle(preset),
    width: 300,
    render(body) {
      const count = document.createElement("div");
      count.className = "sp-popup-message";
      count.style.margin = "0";
      count.textContent = fieldCountLabel(preset.fields);
      body.appendChild(count);

      if ((preset.fields || []).length) {
        body.appendChild(makeFieldChips(preset.fields));
      }

      const notes = String(preset.notes || "").trim();
      if (notes) {
        const notesEl = document.createElement("div");
        notesEl.className = "sp-preset-desc";
        notesEl.style.marginTop = "8px";
        notesEl.textContent = notes;
        body.appendChild(notesEl);
      } else {
        const empty = document.createElement("div");
        empty.className = "sp-popup-message";
        empty.textContent = "No notes";
        body.appendChild(empty);
      }
    },
  });
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
  const meta = document.createElement("div");
  meta.className = "sp-mgr-item-meta";
  meta.textContent = fieldCountLabel(preset.fields);
  info.append(titleRow, meta);
  const preview = notesPreview(preset.notes);
  if (preview) {
    const notes = document.createElement("div");
    notes.className = "sp-mgr-item-meta";
    notes.textContent = preview;
    notes.title = String(preset.notes || "").trim();
    info.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "sp-mgr-item-actions";
  actions.append(
    makeIconBtn("sp-mgr-icon-btn", "Preset details", INFO_ICON_SVG, (btn) => {
      openPresetInfoPopup({ anchor: btn, preset });
    }),
    makeIconBtn("sp-mgr-icon-btn", "Edit preset", EDIT_ICON_SVG, onEdit),
    makeIconBtn("sp-mgr-icon-btn", "Copy preset", COPY_ICON_SVG, onCopy),
    makeIconBtn("sp-mgr-icon-btn", "Move to category", MOVE_ICON_SVG, onMove),
    makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, onDelete),
  );
  row.append(info, actions);
  return row;
}

function paintManagerList(listEl, { presets, categories, showEmpty, query, openMap, reload, includeFields }) {
  listEl.replaceChildren();
  const raw = query || "";
  const { tokens, hasShelfFilter } = parseSearchQuery(raw);
  const searching = hasShelfFilter || tokens.length > 0;
  const filtered = presets.filter((preset) =>
    matchesValuePreset(preset, raw, { emptyFolder: UNCATEGORISED, includeFields }),
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
                title: "Copy preset",
                categories: categoryNamesList,
                current: preset.category || "",
                onPick: async (name) => {
                  const copyName = nextPresetCopyName(presets, name, preset.name || presetTitle(preset));
                  const result = await saveValuePreset({
                    category: name,
                    name: copyName,
                    notes: preset.notes || "",
                    fields: preset.fields,
                  });
                  if (result.conflicts?.length) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy preset",
                      message: `“${copyName}” already exists in the target category.`,
                      confirmLabel: "OK",
                      showCancel: false,
                      danger: false,
                    });
                    return;
                  }
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Copy preset",
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

export function openValueManagerPopup({ anchor, searchInFields = false, onSearchInFieldsChange }) {
  return openPopup({
    anchor,
    title: "Value manager",
    width: 400,
    render(body) {
      const tabs = document.createElement("div");
      tabs.className = "sp-mgr-tabs";
      const presetsTab = document.createElement("button");
      presetsTab.type = "button";
      presetsTab.className = "sp-mgr-tab active";
      presetsTab.textContent = "Presets";
      const fieldsTab = document.createElement("button");
      fieldsTab.type = "button";
      fieldsTab.className = "sp-mgr-tab";
      fieldsTab.textContent = "Fields";
      tabs.append(presetsTab, fieldsTab);

      const search = document.createElement("input");
      search.className = "sp-popup-input";
      search.type = "text";

      let includeFields = !!searchInFields;
      let tab = "presets";
      search.placeholder = presetSearchPlaceholder(includeFields);

      const fieldsSearchRow = document.createElement("div");
      fieldsSearchRow.className = "sp-toggle-row";
      const fieldsSearchToggle = document.createElement("div");
      fieldsSearchToggle.className = "sp-toggle";
      fieldsSearchToggle.setAttribute("role", "switch");
      fieldsSearchToggle.appendChild(Object.assign(document.createElement("div"), { className: "sp-toggle-knob" }));
      const fieldsSearchLabel = document.createElement("span");
      fieldsSearchLabel.textContent = "Search in fields";
      fieldsSearchRow.append(fieldsSearchToggle, fieldsSearchLabel);

      function syncFieldsSearchToggle() {
        fieldsSearchToggle.classList.toggle("on", includeFields);
        fieldsSearchToggle.setAttribute("aria-checked", includeFields ? "true" : "false");
        search.placeholder =
          tab === "presets" ? presetSearchPlaceholder(includeFields) : "category/field or float";
      }
      syncFieldsSearchToggle();

      function flipFieldsSearch(e) {
        e.stopPropagation();
        includeFields = !includeFields;
        syncFieldsSearchToggle();
        onSearchInFieldsChange?.(includeFields);
        paint?.();
      }
      fieldsSearchToggle.addEventListener("click", flipFieldsSearch);
      fieldsSearchLabel.addEventListener("click", flipFieldsSearch);

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

      const addFieldBtn = document.createElement("button");
      addFieldBtn.type = "button";
      addFieldBtn.className = "vp-add-btn";
      addFieldBtn.style.display = "none";
      addFieldBtn.innerHTML = `${PLUS_ICON_SVG}<span>New field</span>`;

      const status = document.createElement("div");
      status.className = "sp-popup-message";
      status.textContent = "Loading…";
      const list = document.createElement("div");
      list.className = "sp-preset-list sp-mgr-list";
      body.append(tabs, search, fieldsSearchRow, emptyRow, addFieldBtn, status, list);

      let showEmpty = false;
      let presets = [];
      let categories = [];
      let fieldDefs = [];
      let fieldCategories = [];
      const openMap = new Map();
      const fieldOpenMap = new Map();

      function setTab(next) {
        tab = next;
        presetsTab.classList.toggle("active", tab === "presets");
        fieldsTab.classList.toggle("active", tab === "fields");
        emptyRow.style.display = "";
        fieldsSearchRow.style.display = tab === "presets" ? "" : "none";
        addFieldBtn.style.display = tab === "fields" ? "" : "none";
        syncFieldsSearchToggle();
        paint();
      }

      function paint() {
        if (tab === "presets") {
          paintManagerList(list, {
            presets,
            categories,
            showEmpty,
            query: search.value,
            openMap,
            reload: loadAll,
            includeFields,
          });
        } else {
          paintFieldsManagerList(list, {
            fields: fieldDefs,
            categories: fieldCategories,
            showEmpty,
            query: search.value,
            openMap: fieldOpenMap,
            reload: loadAll,
          });
        }
      }

      function afterFieldSaved(field) {
        const cat = (field?.category || "").trim() || UNCATEGORISED;
        fieldOpenMap.set(cat, true);
        setTab("fields");
        loadAll();
      }

      async function loadAll() {
        status.textContent = "Loading…";
        status.style.display = "";
        const [presetResult, categoryResult, fieldResult, fieldCatResult] = await Promise.all([
          listValuePresets(),
          listValueCategories(),
          listValueFieldDefs(),
          listValueFieldCategories(),
        ]);
        if (!presetResult.ok) {
          status.textContent = presetResult.error || "Failed to load presets";
          return;
        }
        if (!fieldResult.ok) {
          status.textContent = fieldResult.error || "Failed to load fields";
          return;
        }
        presets = presetResult.presets || [];
        categories = categoryResult.categories || [];
        fieldDefs = fieldResult.fields || [];
        fieldCategories = fieldCatResult.categories || [];
        status.style.display = "none";
        paint();
      }

      presetsTab.addEventListener("click", (e) => {
        e.stopPropagation();
        setTab("presets");
      });
      fieldsTab.addEventListener("click", (e) => {
        e.stopPropagation();
        setTab("fields");
      });
      search.addEventListener("input", paint);
      emptyToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        showEmpty = !showEmpty;
        emptyToggle.classList.toggle("on", showEmpty);
        emptyToggle.setAttribute("aria-checked", showEmpty ? "true" : "false");
        paint();
      });
      addFieldBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openFieldDefEditor({
          anchor: addFieldBtn,
          categories: categoryNames(fieldCategories),
          onSaved: afterFieldSaved,
        });
      });

      loadAll();
    },
  });
}

function paintFieldsManagerList(listEl, { fields, categories, showEmpty, query, openMap, reload }) {
  listEl.replaceChildren();
  const raw = query || "";
  const { tokens, hasShelfFilter } = parseSearchQuery(raw);
  const searching = hasShelfFilter || tokens.length > 0;
  const filtered = (fields || []).filter((field) =>
    matchesValueField(field, raw, { emptyFolder: UNCATEGORISED }),
  );

  const grouped = new Map();
  for (const field of filtered) {
    const name = (field.category || "").trim() || UNCATEGORISED;
    const list = grouped.get(name) || [];
    list.push(field);
    grouped.set(name, list);
  }
  if (showEmpty) {
    for (const category of categories || []) {
      const name = (category.name || "").trim();
      if (!name || grouped.has(name)) continue;
      if ((category.count || 0) === 0 && emptyShelfMatchesSearch(name, raw)) {
        grouped.set(name, []);
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
    empty.textContent = searching ? "No fields" : "No field definitions yet.";
    listEl.appendChild(empty);
    return;
  }

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
              const result = await renameValueFieldCategory({ name: folderName, newName: next });
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
            message: `Delete “${folderName}”? Fields move to Uncategorised.`,
            confirmLabel: "Delete",
            danger: true,
            onConfirm: async () => {
              const result = await deleteValueFieldCategory(folderName);
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
        renderItem: (field) => {
          const row = document.createElement("div");
          row.className = "sp-mgr-item";
          const info = document.createElement("div");
          info.className = "sp-mgr-item-info";
          const title = document.createElement("div");
          title.className = "sp-mgr-item-name";
          title.textContent = field.name;
          const meta = document.createElement("div");
          meta.className = "sp-mgr-item-meta";
          meta.textContent = formatFieldRange(field);
          info.append(title, meta);
          if (field.notes) {
            const notes = document.createElement("div");
            notes.className = "sp-mgr-item-meta";
            const preview = notesPreview(field.notes);
            notes.textContent = preview;
            notes.title = String(field.notes || "").trim();
            info.appendChild(notes);
          }
          const actions = document.createElement("div");
          actions.className = "sp-mgr-item-actions";
          actions.append(
            makeIconBtn("sp-mgr-icon-btn", "Edit field", EDIT_ICON_SVG, (btn) => {
              openFieldDefEditor({
                anchor: btn,
                field,
                categories: categoryNames(categories),
                onSaved: (saved) => {
                  const cat = (saved?.category || "").trim() || UNCATEGORISED;
                  openMap?.set(cat, true);
                  reload();
                },
              });
            }),
            makeIconBtn("sp-mgr-icon-btn", "Copy field", COPY_ICON_SVG, (btn) => {
              openFieldDefEditor({
                anchor: btn,
                title: "Copy field",
                field: {
                  name: uniqueCopyName(
                    field.name,
                    (fields || []).map((item) => item.name),
                  ),
                  type: field.type,
                  min: field.min,
                  max: field.max,
                  step: field.step,
                  default: field.default ?? field.value ?? 0,
                  category: "",
                  notes: field.notes || "",
                },
                categories: categoryNames(categories),
                onSaved: (saved) => {
                  const cat = (saved?.category || "").trim() || UNCATEGORISED;
                  openMap?.set(cat, true);
                  reload();
                },
              });
            }),
            makeIconBtn("sp-mgr-icon-btn danger", "Delete", TRASH_ICON_SVG, (btn) => {
              mgrConfirm({
                anchor: btn,
                title: "Delete field",
                message: `Delete “${field.name}” from library?`,
                confirmLabel: "Delete",
                danger: true,
                onConfirm: async () => {
                  const result = await deleteValueFieldDef(field.id);
                  if (!result.ok) {
                    mgrConfirm({
                      anchor: btn,
                      title: "Delete field",
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
            }),
          );
          row.append(info, actions);
          return row;
        },
      }),
    );
  }
}

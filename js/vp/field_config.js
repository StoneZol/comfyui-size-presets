import { CHEVRON_ICON_SVG } from "../sp/icons.js";
import { openPopup } from "../sp/popup.js";
import { matchesValueField, parseSearchQuery } from "../sp/search.js";
import {
  listValueFieldCategories,
  listValueFieldDefs,
  saveValueFieldDef,
  updateValueFieldDef,
  upsertValueFieldDef,
} from "./api.js";
import {
  DEFAULT_MAX,
  DEFAULT_MIN,
  defaultStep,
  formatFieldRange,
  isolatePointer,
  normalizeField,
  selectOnFocus,
} from "./fields.js";

const UNCATEGORISED = "Uncategorised";

function matchesCategory(name, query) {
  if (!query) return true;
  return (name || UNCATEGORISED).toLowerCase().includes(query);
}

function openCategoryPicker({ anchor, categories, current, onPick, onClose, onDraft }) {
  return openPopup({
    nested: true,
    anchor,
    title: "Category",
    width: 260,
    onClose,
    render(body, { close }) {
      const filter = document.createElement("input");
      filter.className = "sp-popup-input";
      filter.type = "text";
      filter.placeholder = "filter or new name";
      filter.value = (current || "").trim();

      const list = document.createElement("div");
      list.className = "sp-pick-list";
      const items = ["", ...(categories || []).filter((n) => n.toLowerCase() !== UNCATEGORISED.toLowerCase())];
      const selected = (current || "").trim();

      function pick(name) {
        close();
        onPick?.(name);
      }

      function paint() {
        const typed = filter.value.trim();
        const q = typed.toLowerCase();
        onDraft?.(typed);
        list.replaceChildren();
        const shown = items.filter((name) => matchesCategory(name, q));
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
        if (!typed) {
          pick("");
          return;
        }
        const exact = items.find((name) => (name || "").toLowerCase() === typed.toLowerCase());
        pick(exact !== undefined ? exact : typed);
      });
      paint();
      body.append(filter, list);
      requestAnimationFrame(() => {
        filter.focus();
        filter.select();
      });
    },
  });
}

function makeCategoryRow(value = "") {
  const row = document.createElement("div");
  row.className = "sp-mgr-prompt-field";
  const label = document.createElement("label");
  label.textContent = "Category";
  const folderRow = document.createElement("div");
  folderRow.className = "sp-save-folder-row";
  const input = document.createElement("input");
  input.className = "sp-popup-input";
  input.type = "text";
  input.placeholder = "category (type or choose)";
  input.autocomplete = "off";
  input.maxLength = 80;
  input.value = value || "";
  isolatePointer(input);
  const pickBtn = document.createElement("button");
  pickBtn.type = "button";
  pickBtn.className = "sp-popup-btn";
  pickBtn.textContent = "Choose";
  folderRow.append(input, pickBtn);
  row.append(label, folderRow);
  return { row, input, pickBtn };
}

function wireCategoryPicker(pickBtn, input, getCategories) {
  let picker = null;
  pickBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (picker) {
      picker.close();
      picker = null;
      return;
    }
    picker = openCategoryPicker({
      anchor: pickBtn,
      categories: getCategories?.() || [],
      current: input.value.trim(),
      onDraft: (typed) => {
        // Keep parent input in sync while typing in Choose (so Save still works).
        input.value = typed;
      },
      onPick: (name) => {
        input.value = name || "";
      },
      onClose: () => {
        picker = null;
      },
    });
  });
}

function makeBoundRow(labelText, value, step) {
  const row = document.createElement("div");
  row.className = "sp-size-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.className = "sp-popup-input";
  input.type = "number";
  input.step = String(step);
  input.value = String(value);
  selectOnFocus(input);
  isolatePointer(input);
  row.append(label, input);
  return { row, input };
}

function makeTextRow(labelText, value, { placeholder = "", multiline = false } = {}) {
  const row = document.createElement("div");
  row.className = multiline ? "sp-mgr-prompt-field" : "sp-size-row";
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement(multiline ? "textarea" : "input");
  input.className = multiline ? "sp-popup-input sp-mgr-prompt-area" : "sp-popup-input";
  if (!multiline) {
    input.type = "text";
    input.maxLength = 80;
  } else {
    input.rows = 3;
    input.maxLength = 500;
  }
  input.placeholder = placeholder;
  input.value = value || "";
  isolatePointer(input);
  row.append(label, input);
  return { row, input };
}

/** Edit limits on a node field; optional save into the shared library. */
export function openFieldConfigPopup({ anchor, field, onSave, nested = true }) {
  return openPopup({
    nested,
    anchor,
    title: `Field · ${field.name || "value"}`,
    width: 300,
    render(body, { close }) {
      let draft = normalizeField(field);
      let categories = [];

      const typeRow = document.createElement("div");
      typeRow.className = "sp-size-row";
      typeRow.append(
        Object.assign(document.createElement("label"), { textContent: "Type" }),
        Object.assign(document.createElement("div"), {
          className: "sp-popup-message",
          textContent: draft.type,
          style: "margin:0;padding:0;",
        }),
      );

      const minField = makeBoundRow("Min", draft.min, draft.step);
      const maxField = makeBoundRow("Max", draft.max, draft.step);
      const stepField = makeBoundRow("Step", draft.step, draft.type === "INT" ? 1 : 0.01);
      const categoryRow = makeCategoryRow(draft.category || "");
      wireCategoryPicker(categoryRow.pickBtn, categoryRow.input, () => categories);
      const notesRow = makeTextRow("Notes", draft.notes || "", { placeholder: "optional note", multiline: true });

      const errorEl = document.createElement("div");
      errorEl.className = "sp-popup-error";

      const actions = document.createElement("div");
      actions.className = "sp-popup-actions";
      actions.style.flexWrap = "wrap";
      actions.style.gap = "6px";

      const saveLib = document.createElement("button");
      saveLib.type = "button";
      saveLib.className = "sp-popup-btn primary";
      saveLib.textContent = "Save to library";

      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "sp-popup-btn";
      apply.textContent = "Apply only";

      function readDraft() {
        const min = Number(minField.input.value);
        const max = Number(maxField.input.value);
        const step = Number(stepField.input.value);
        if (![min, max, step].every(Number.isFinite) || step <= 0) {
          errorEl.className = "sp-popup-error";
          errorEl.textContent = "Enter valid min / max / step";
          return null;
        }
        draft = normalizeField({
          ...draft,
          min,
          max,
          step,
          value: draft.value,
          category: categoryRow.input.value.trim(),
          notes: notesRow.input.value.trim(),
        });
        return draft;
      }

      apply.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = readDraft();
        if (!next) return;
        close();
        onSave?.(next);
      });

      saveLib.addEventListener("click", async (e) => {
        e.stopPropagation();
        const next = readDraft();
        if (!next) return;
        if (!next.name) {
          errorEl.className = "sp-popup-error";
          errorEl.textContent = "Field name is required";
          return;
        }
        saveLib.disabled = true;
        try {
          const result = await upsertValueFieldDef({
            name: next.name,
            type: next.type,
            min: next.min,
            max: next.max,
            step: next.step,
            default: next.value,
            category: next.category,
            notes: next.notes,
          });
          if (!result.ok) {
            errorEl.className = "sp-popup-error";
            errorEl.textContent = result.error || "Library save failed";
            return;
          }
          const saved = normalizeField({
            ...next,
            category: result.field?.category ?? next.category,
            notes: result.field?.notes ?? next.notes,
          });
          categoryRow.input.value = saved.category || "";
          notesRow.input.value = saved.notes || "";
          draft = saved;
          onSave?.(saved);
          close();
        } catch (err) {
          errorEl.className = "sp-popup-error";
          errorEl.textContent = err?.message || "Library save failed";
        } finally {
          saveLib.disabled = false;
        }
      });

      actions.append(apply, saveLib);
      body.append(
        typeRow,
        minField.row,
        maxField.row,
        stepField.row,
        categoryRow.row,
        notesRow.row,
        errorEl,
        actions,
      );

      // Enrich from library when the preset slot has no shelf metadata yet.
      Promise.all([listValueFieldDefs(), listValueFieldCategories()])
        .then(([defsResult, catsResult]) => {
          categories = (catsResult.categories || []).map((c) => c.name).filter(Boolean);
          if (draft.category && draft.notes) return;
          const match = (defsResult.fields || []).find(
            (item) => (item.name || "").toLowerCase() === (draft.name || "").toLowerCase(),
          );
          if (!match) return;
          if (!categoryRow.input.value.trim() && match.category) {
            categoryRow.input.value = match.category;
            draft.category = match.category;
          }
          if (!notesRow.input.value.trim() && match.notes) {
            notesRow.input.value = match.notes;
            draft.notes = match.notes;
          }
        })
        .catch(() => {});
      requestAnimationFrame(() => minField.input.focus());
    },
  });
}

/** Full editor for a library field definition (manager Fields tab). */
export function openFieldDefEditor({ anchor, field = null, categories = [], onSaved, title }) {
  const editing = Boolean(field?.id);
  return openPopup({
    nested: true,
    anchor,
    title: title || (editing ? "Edit field" : "New field"),
    width: 320,
    render(body, { close }) {
      const nameRow = makeTextRow("Name", field?.name || "", { placeholder: "denoise" });
      const typeBtn = document.createElement("button");
      typeBtn.type = "button";
      typeBtn.className = `vp-field-type${(field?.type || "FLOAT") === "INT" ? " is-int" : ""}`;
      typeBtn.textContent = field?.type === "INT" ? "INT" : "FLOAT";
      typeBtn.title = "Toggle INT / FLOAT";
      const typeRow = document.createElement("div");
      typeRow.className = "sp-size-row";
      typeRow.append(Object.assign(document.createElement("label"), { textContent: "Type" }), typeBtn);

      let typ = field?.type === "INT" ? "INT" : "FLOAT";
      typeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        typ = typ === "INT" ? "FLOAT" : "INT";
        typeBtn.textContent = typ;
        typeBtn.classList.toggle("is-int", typ === "INT");
        stepField.input.step = typ === "INT" ? "1" : "0.01";
      });

      const minField = makeBoundRow("Min", field?.min ?? DEFAULT_MIN, field?.step ?? 0.01);
      const maxField = makeBoundRow("Max", field?.max ?? DEFAULT_MAX, field?.step ?? 0.01);
      const stepField = makeBoundRow(
        "Step",
        field?.step ?? defaultStep(typ),
        typ === "INT" ? 1 : 0.01,
      );
      const defaultField = makeBoundRow("Default", field?.default ?? field?.value ?? 0, field?.step ?? 0.01);
      const categoryRow = makeCategoryRow(field?.category || "");
      wireCategoryPicker(categoryRow.pickBtn, categoryRow.input, () => categories || []);
      const notesRow = makeTextRow("Notes", field?.notes || "", {
        placeholder: "where this field is used",
        multiline: true,
      });

      const errorEl = document.createElement("div");
      errorEl.className = "sp-popup-error";
      const actions = document.createElement("div");
      actions.className = "sp-popup-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "sp-popup-btn primary";
      save.textContent = "Save";
      actions.appendChild(save);

      save.addEventListener("click", async (e) => {
        e.stopPropagation();
        const name = nameRow.input.value.trim();
        if (!name) {
          errorEl.textContent = "Name is required";
          return;
        }
        const payload = {
          id: field?.id,
          name,
          type: typ,
          min: Number(minField.input.value),
          max: Number(maxField.input.value),
          step: Number(stepField.input.value),
          default: Number(defaultField.input.value),
          category: categoryRow.input.value.trim(),
          notes: notesRow.input.value.trim(),
        };
        if (![payload.min, payload.max, payload.step, payload.default].every(Number.isFinite) || payload.step <= 0) {
          errorEl.textContent = "Enter valid numbers";
          return;
        }
        save.disabled = true;
        try {
          const result = editing ? await updateValueFieldDef(payload) : await saveValueFieldDef(payload);
          if (result.conflicts?.length) {
            errorEl.textContent = `“${name}” already exists`;
            return;
          }
          if (!result.ok) {
            errorEl.textContent = result.error || "Save failed";
            return;
          }
          close();
          onSaved?.(result.field);
        } catch (err) {
          errorEl.textContent = err?.message || "Save failed";
        } finally {
          save.disabled = false;
        }
      });

      body.append(
        nameRow.row,
        typeRow,
        minField.row,
        maxField.row,
        stepField.row,
        defaultField.row,
        categoryRow.row,
        notesRow.row,
        errorEl,
        actions,
      );
      requestAnimationFrame(() => nameRow.input.focus());
    },
  });
}

/** Pick a field from the library, or create a blank one. */
export function openFieldLibraryPopup({ anchor, onPick, onBlank }) {
  return openPopup({
    nested: true,
    anchor,
    title: "Add field",
    width: 340,
    render(body, { close, reposition }) {
      const blank = document.createElement("button");
      blank.type = "button";
      blank.className = "sp-pick-item";
      blank.textContent = "Blank field";
      blank.addEventListener("click", (e) => {
        e.stopPropagation();
        close();
        onBlank?.();
      });

      const filter = document.createElement("input");
      filter.className = "sp-popup-input";
      filter.type = "text";
      filter.placeholder = "category/field or float";

      const list = document.createElement("div");
      list.className = "sp-preset-list";

      const status = document.createElement("div");
      status.className = "sp-popup-message";
      status.textContent = "Loading…";

      body.append(blank, filter, status, list);

      let defs = [];
      const openMap = new Map();

      function makePickFolder(title, items, expanded) {
        const folder = document.createElement("div");
        folder.className = "sp-preset-folder";
        if (!expanded) folder.classList.add("collapsed");

        const head = document.createElement("button");
        head.type = "button";
        head.className = "sp-preset-folder-head";
        const chevron = document.createElement("span");
        chevron.className = "sp-preset-folder-chevron";
        chevron.innerHTML = CHEVRON_ICON_SVG;
        const label = document.createElement("span");
        label.className = "sp-preset-folder-name";
        label.textContent = title;
        const count = document.createElement("span");
        count.className = "sp-preset-folder-count";
        count.textContent = String(items.length);
        head.append(chevron, label, count);
        head.title = expanded ? "Collapse" : "Expand";
        head.setAttribute("aria-expanded", expanded ? "true" : "false");

        const folderBody = document.createElement("div");
        folderBody.className = "sp-preset-folder-body";
        for (const item of items) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "sp-pick-item";
          const nameEl = document.createElement("div");
          nameEl.textContent = item.name;
          const meta = document.createElement("div");
          meta.className = "sp-mgr-item-meta";
          const bits = [
            formatFieldRange({
              ...item,
              value: item.default ?? 0,
              min: item.min ?? DEFAULT_MIN,
              max: item.max ?? DEFAULT_MAX,
              step: item.step ?? defaultStep(item.type),
            }),
          ];
          if (item.notes) bits.push(item.notes);
          meta.textContent = bits.join(" · ");
          btn.append(nameEl, meta);
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            close();
            onPick?.(item);
          });
          folderBody.appendChild(btn);
        }

        head.addEventListener("click", (e) => {
          e.stopPropagation();
          const collapsed = folder.classList.toggle("collapsed");
          head.title = collapsed ? "Expand" : "Collapse";
          head.setAttribute("aria-expanded", collapsed ? "false" : "true");
          openMap.set(title, !collapsed);
          reposition?.();
        });

        folder.append(head, folderBody);
        return folder;
      }

      function paint() {
        const raw = filter.value;
        const { tokens, hasShelfFilter } = parseSearchQuery(raw);
        const searching = hasShelfFilter || tokens.length > 0;
        list.replaceChildren();
        const shown = defs.filter((item) =>
          matchesValueField(item, raw, { emptyFolder: UNCATEGORISED }),
        );
        if (!shown.length) {
          const empty = document.createElement("div");
          empty.className = "sp-popup-message";
          empty.textContent = defs.length
            ? "No matches"
            : "Library empty — gear → Save to library, or manage in Fields tab";
          list.appendChild(empty);
          reposition?.();
          return;
        }

        const grouped = new Map();
        for (const item of shown) {
          const name = (item.category || "").trim() || UNCATEGORISED;
          const bucket = grouped.get(name) || [];
          bucket.push(item);
          grouped.set(name, bucket);
        }

        const names = [...grouped.keys()].sort((a, b) => {
          const aUncat = a.toLowerCase() === UNCATEGORISED.toLowerCase();
          const bUncat = b.toLowerCase() === UNCATEGORISED.toLowerCase();
          if (aUncat !== bUncat) return aUncat ? -1 : 1;
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        });

        for (const folderName of names) {
          const items = grouped.get(folderName) || [];
          const expanded = searching
            ? true
            : openMap.has(folderName)
              ? openMap.get(folderName)
              : folderName === UNCATEGORISED;
          list.appendChild(makePickFolder(folderName, items, expanded));
        }
        reposition?.();
      }

      filter.addEventListener("input", paint);

      Promise.all([listValueFieldDefs(), listValueFieldCategories()])
        .then(([result]) => {
          status.remove();
          if (!result.ok) {
            list.replaceChildren();
            const err = document.createElement("div");
            err.className = "sp-popup-message";
            err.textContent = result.error || "Failed to load library";
            list.appendChild(err);
            reposition?.();
            return;
          }
          defs = result.fields || [];
          paint();
          requestAnimationFrame(() => filter.focus());
        })
        .catch((err) => {
          status.textContent = err?.message || "Failed to load library";
          reposition?.();
        });
    },
  });
}

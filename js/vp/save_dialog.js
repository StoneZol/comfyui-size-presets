import { openPopup } from "../sp/popup.js";
import { categoryNames, listValueCategories, saveValuePreset } from "./api.js";
import { makeFieldChips } from "./fields.js";

const UNCATEGORISED = "Uncategorised";

function matchesCategory(name, query) {
  if (!query) return true;
  return (name || UNCATEGORISED).toLowerCase().includes(query);
}

function openCategoryPicker({ anchor, categories, current, onPick, onClose }) {
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

      const list = document.createElement("div");
      list.className = "sp-pick-list";
      const items = ["", ...categories];
      const selected = (current || "").trim();

      function pick(name) {
        close();
        onPick?.(name);
      }

      function paint() {
        const typed = filter.value.trim();
        const q = typed.toLowerCase();
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

export function openSaveValuePopup({ anchor, fields }) {
  return openPopup({
    anchor,
    title: "Save preset",
    width: 320,
    render(body, { close }) {
      const nameRow = document.createElement("div");
      nameRow.className = "sp-size-row";
      const nameLabel = document.createElement("label");
      nameLabel.textContent = "Name";
      const nameInput = document.createElement("input");
      nameInput.className = "sp-popup-input";
      nameInput.type = "text";
      nameInput.placeholder = "preset name";
      nameInput.maxLength = 80;
      nameRow.append(nameLabel, nameInput);

      const preview = document.createElement("div");
      if (!fields?.length) {
        preview.className = "sp-popup-message";
        preview.textContent = "No fields";
      } else {
        preview.appendChild(makeFieldChips(fields));
      }

      const folderRow = document.createElement("div");
      folderRow.className = "sp-save-folder-row";

      const folder = document.createElement("input");
      folder.className = "sp-popup-input";
      folder.type = "text";
      folder.placeholder = "category (type or choose)";
      folder.autocomplete = "off";

      const pickBtn = document.createElement("button");
      pickBtn.type = "button";
      pickBtn.className = "sp-popup-btn";
      pickBtn.textContent = "Choose";
      folderRow.append(folder, pickBtn);

      const errorEl = document.createElement("div");
      errorEl.className = "sp-popup-error";

      const actions = document.createElement("div");
      actions.className = "sp-popup-actions";
      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "sp-popup-btn primary";
      confirm.textContent = "Save";
      actions.appendChild(confirm);

      let categories = [];
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
          categories,
          current: folder.value.trim(),
          onPick: (name) => {
            folder.value = name || "";
          },
          onClose: () => {
            picker = null;
          },
        });
      });

      async function submit() {
        if (!nameInput.value.trim()) {
          errorEl.textContent = "Preset name is required";
          nameInput.focus();
          return;
        }
        if (!fields?.length) {
          errorEl.textContent = "Add at least one field";
          return;
        }
        confirm.disabled = true;
        try {
          const result = await saveValuePreset({
            category: folder.value.trim(),
            name: nameInput.value.trim(),
            fields,
          });
          if (result.conflicts?.length) {
            errorEl.textContent = `“${nameInput.value.trim()}” already exists in this category`;
            return;
          }
          if (!result.ok) {
            errorEl.textContent = result.error || "Save failed";
            return;
          }
          close();
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

      body.append(nameRow, preview, folderRow, errorEl, actions);
      requestAnimationFrame(() => nameInput.focus());
      listValueCategories()
        .then((result) => {
          categories = categoryNames(result.categories);
        })
        .catch(() => {});
    },
  });
}

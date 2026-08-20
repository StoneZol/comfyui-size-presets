import { openPopup } from "./popup.js";
import { categoryNames, listCategories, saveSizePreset } from "./api.js";
import { makeAspectPreview } from "./styles.js";

const UNCATEGORISED = "Uncategorised";

function matchesCategory(name, query) {
  if (!query) return true;
  const label = name || UNCATEGORISED;
  return label.toLowerCase().includes(query);
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
      filter.placeholder = "filter";

      const list = document.createElement("div");
      list.className = "sp-pick-list";

      const items = ["", ...categories];
      const selected = (current || "").trim();

      function paint() {
        const q = filter.value.trim().toLowerCase();
        list.replaceChildren();
        const shown = items.filter((name) => matchesCategory(name, q));
        if (!shown.length) {
          const empty = document.createElement("div");
          empty.className = "sp-popup-message";
          empty.textContent = "No categories";
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

export function openSavePresetPopup({ anchor, width, height }) {
  return openPopup({
    anchor,
    title: "Save preset",
    width: 300,
    render(body, { close }) {
      const widthField = makeSizeField("Width", width);
      const heightField = makeSizeField("Height", height);
      const preview = makeAspectPreview(width, height);

      function updatePreview() {
        const next = preview.querySelector(".sp-aspect-box");
        const w = Math.max(1, Number(widthField.input.value) || 1);
        const h = Math.max(1, Number(heightField.input.value) || 1);
        const scale = 32 / Math.max(w, h);
        next.style.width = `${Math.max(4, Math.round(w * scale))}px`;
        next.style.height = `${Math.max(4, Math.round(h * scale))}px`;
      }

      widthField.input.addEventListener("input", updatePreview);
      heightField.input.addEventListener("input", updatePreview);

      const previewRow = document.createElement("div");
      previewRow.className = "sp-size-row";
      previewRow.append(
        Object.assign(document.createElement("label"), { textContent: "Preview" }),
        preview,
      );

      const folderRow = document.createElement("div");
      folderRow.className = "sp-save-folder-row";

      const folder = document.createElement("input");
      folder.className = "sp-popup-input";
      folder.type = "text";
      folder.placeholder = UNCATEGORISED;

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

      let overwrite = false;
      let categories = [];
      let picker = null;

      function resetOverwrite() {
        if (!overwrite) return;
        overwrite = false;
        confirm.textContent = "Save";
        confirm.classList.remove("danger");
        confirm.classList.add("primary");
      }

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
        const w = parseInt(widthField.input.value, 10);
        const h = parseInt(heightField.input.value, 10);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64) {
          errorEl.textContent = "Enter valid width and height (min 64)";
          return;
        }
        confirm.disabled = true;
        try {
          const result = await saveSizePreset({
            category: folder.value.trim(),
            width: w,
            height: h,
            overwrite,
          });
          if (result.conflicts?.length) {
            errorEl.textContent = `${w} × ${h} already exists in this category`;
            confirm.textContent = "Overwrite";
            confirm.classList.add("danger");
            confirm.classList.remove("primary");
            overwrite = true;
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
      widthField.input.addEventListener("input", resetOverwrite);
      heightField.input.addEventListener("input", resetOverwrite);
      folder.addEventListener("input", resetOverwrite);
      widthField.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      heightField.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });

      actions.appendChild(confirm);
      body.append(widthField.row, heightField.row, previewRow, folderRow, errorEl, actions);
      requestAnimationFrame(() => widthField.input.focus());

      listCategories()
        .then((result) => {
          categories = categoryNames(result.categories);
        })
        .catch(() => {});
    },
  });
}

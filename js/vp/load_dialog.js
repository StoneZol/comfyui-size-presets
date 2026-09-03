import { CHEVRON_ICON_SVG, INFO_ICON_SVG } from "../sp/icons.js";
import { listValuePresets } from "./api.js";
import { fieldCountLabel, formatFields, makeFieldChips, presetTitle } from "./fields.js";
import { openPopup } from "../sp/popup.js";

const UNCATEGORISED = "Uncategorised";

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

function makePresetCard(preset, { onLoad }) {
  const card = document.createElement("div");
  card.className = "sp-preset-item";

  const head = document.createElement("div");
  head.className = "sp-preset-head";

  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.className = "sp-preset-load-main";
  loadBtn.title = `Load ${presetTitle(preset)}`;

  const name = document.createElement("div");
  name.className = "sp-preset-name";
  name.textContent = presetTitle(preset);
  const slots = document.createElement("div");
  slots.className = "sp-preset-slots";
  slots.textContent = fieldCountLabel(preset.fields);
  loadBtn.append(name, slots);

  const infoBtn = document.createElement("button");
  infoBtn.type = "button";
  infoBtn.className = "sp-mgr-icon-btn";
  infoBtn.title = "Preset details";
  infoBtn.innerHTML = INFO_ICON_SVG;

  head.append(loadBtn, infoBtn);
  card.appendChild(head);

  loadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onLoad?.(preset);
  });
  infoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPresetInfoPopup({ anchor: infoBtn, preset });
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

function makeFolder({ title, presets, expanded, onLoad }) {
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
  count.textContent = String(presets.length);

  head.append(chevron, label, count);
  head.title = expanded ? "Collapse folder" : "Expand folder";
  head.setAttribute("aria-expanded", expanded ? "true" : "false");

  const body = document.createElement("div");
  body.className = "sp-preset-folder-body";
  for (const preset of presets) body.appendChild(makePresetCard(preset, { onLoad }));

  head.addEventListener("click", (e) => {
    e.stopPropagation();
    const collapsed = folder.classList.toggle("collapsed");
    head.title = collapsed ? "Expand folder" : "Collapse folder";
    head.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });

  folder.append(head, body);
  return folder;
}

function matchesPreset(preset, query) {
  if (!query) return true;
  const haystack = [
    preset.name,
    preset.notes,
    preset.category || UNCATEGORISED,
    formatFields(preset.fields),
    ...(preset.fields || []).map((f) => f.name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function paintPresetList(list, presets, query, onLoad) {
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
  if (grouped.uncategorised.length) {
    list.appendChild(
      makeFolder({
        title: UNCATEGORISED,
        presets: grouped.uncategorised,
        expanded: true,
        onLoad,
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
      }),
    );
  }
}

export function openLoadValuePopup({ anchor, onPick }) {
  return openPopup({
    anchor,
    title: "Load preset",
    width: 340,
    render(body, { close, reposition }) {
      const status = document.createElement("div");
      status.className = "sp-popup-message";
      status.textContent = "Loading…";
      body.appendChild(status);

      listValuePresets()
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
          search.placeholder = "search category or field";

          const list = document.createElement("div");
          list.className = "sp-preset-list";

          const onLoad = (picked) => {
            close();
            onPick?.(picked);
          };

          search.addEventListener("input", () => {
            paintPresetList(list, presets, search.value, onLoad);
            reposition?.();
          });

          paintPresetList(list, presets, "", onLoad);
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

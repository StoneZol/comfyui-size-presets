import { CHEVRON_ICON_SVG, INFO_ICON_SVG } from "../sp/icons.js";
import { listValuePresets } from "./api.js";
import { fieldCountLabel, makeFieldChips, notesPreview, presetTitle } from "./fields.js";
import { openPopup } from "../sp/popup.js";
import { matchesValuePreset, parseSearchQuery } from "../sp/search.js";
import { presetSearchPlaceholder } from "./prefs.js";

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
  const preview = notesPreview(preset.notes);
  if (preview) {
    const notes = document.createElement("div");
    notes.className = "sp-preset-desc";
    notes.style.whiteSpace = "nowrap";
    notes.style.overflow = "hidden";
    notes.style.textOverflow = "ellipsis";
    notes.textContent = preview;
    notes.title = String(preset.notes || "").trim();
    loadBtn.appendChild(notes);
  }

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

function matchesPreset(preset, query, includeFields) {
  return matchesValuePreset(preset, query, { emptyFolder: UNCATEGORISED, includeFields });
}

function paintPresetList(list, presets, query, onLoad, includeFields) {
  const raw = query || "";
  const { tokens, hasShelfFilter } = parseSearchQuery(raw);
  const searching = hasShelfFilter || tokens.length > 0;
  const matched = presets.filter((preset) => matchesPreset(preset, raw, includeFields));
  list.replaceChildren();
  if (!matched.length) {
    const empty = document.createElement("div");
    empty.className = "sp-popup-message";
    empty.textContent = searching ? "No presets" : "No saved presets yet.";
    list.appendChild(empty);
    return;
  }

  const grouped = groupPresets(matched);
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

function makeFieldsSearchToggle({ on, onChange }) {
  let enabled = !!on;
  const row = document.createElement("div");
  row.className = "sp-toggle-row";
  const toggle = document.createElement("div");
  toggle.className = "sp-toggle";
  toggle.setAttribute("role", "switch");
  toggle.appendChild(Object.assign(document.createElement("div"), { className: "sp-toggle-knob" }));
  const label = document.createElement("span");
  label.textContent = "Search in fields";
  row.append(toggle, label);

  function sync() {
    toggle.classList.toggle("on", enabled);
    toggle.setAttribute("aria-checked", enabled ? "true" : "false");
  }
  sync();

  function flip(e) {
    e.stopPropagation();
    enabled = !enabled;
    sync();
    onChange?.(enabled);
  }
  toggle.addEventListener("click", flip);
  label.addEventListener("click", flip);
  return { row, get: () => enabled };
}

export function openLoadValuePopup({ anchor, onPick, searchInFields = false, onSearchInFieldsChange }) {
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

          const list = document.createElement("div");
          list.className = "sp-preset-list";

          const onLoad = (picked) => {
            close();
            onPick?.(picked);
          };

          let includeFields = !!searchInFields;
          search.placeholder = presetSearchPlaceholder(includeFields);

          const fieldsToggle = makeFieldsSearchToggle({
            on: includeFields,
            onChange: (next) => {
              includeFields = next;
              onSearchInFieldsChange?.(next);
              search.placeholder = presetSearchPlaceholder(next);
              paintPresetList(list, presets, search.value, onLoad, includeFields);
              reposition?.();
            },
          });

          const repaint = () => {
            paintPresetList(list, presets, search.value, onLoad, includeFields);
            reposition?.();
          };

          search.addEventListener("input", repaint);

          paintPresetList(list, presets, "", onLoad, includeFields);
          body.append(search, fieldsToggle.row, list);
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

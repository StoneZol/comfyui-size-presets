import { CHEVRON_ICON_SVG } from "./icons.js";
import { formatSize, listSizePresets } from "./api.js";
import { makeAspectPreview } from "./styles.js";
import { openPopup } from "./popup.js";
import { matchesSizePreset, parseSearchQuery } from "./search.js";

const UNCATEGORISED = "Uncategorised";

function makePresetCard(preset, { onLoad }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "sp-preset-item";
  card.title = `Load ${formatSize(preset.width, preset.height)}`;

  const head = document.createElement("div");
  head.className = "sp-preset-head";

  head.appendChild(makeAspectPreview(preset.width, preset.height));

  const name = document.createElement("div");
  name.className = "sp-preset-name";
  name.textContent = formatSize(preset.width, preset.height);

  head.appendChild(name);
  card.appendChild(head);

  card.addEventListener("click", (e) => {
    e.stopPropagation();
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
  for (const preset of presets) {
    body.appendChild(makePresetCard(preset, { onLoad }));
  }

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
  return matchesSizePreset(preset, query, { emptyFolder: UNCATEGORISED });
}

function paintPresetList(list, presets, query, onLoad) {
  const raw = query || "";
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(raw);
  const searching = hasShelfFilter || tokens.length > 0;
  const matched = presets.filter((preset) => matchesPreset(preset, raw));
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
          search.placeholder = "category/size or 1024";

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

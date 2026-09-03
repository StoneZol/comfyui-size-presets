import { GRIP_ICON_SVG } from "../sp/icons.js";

export const MAX_FIELDS = 16;
export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 1_000_000_000;
export const FIELD_TYPES = ["FLOAT", "INT", "BOOLEAN"];
// STRING disabled for now — list/COMBO semantics TBD; normalizeField still loads legacy STRING.
// export const FIELD_TYPES = ["FLOAT", "INT", "BOOLEAN", "STRING"];
export const NUMERIC_TYPES = new Set(["FLOAT", "INT"]);

export function selectOnFocus(input) {
  input.addEventListener("focus", () => {
    requestAnimationFrame(() => {
      if (document.activeElement === input) input.select();
    });
  });
  // mouseup.preventDefault keeps text selection, but breaks number spinner arrows
  // (one click becomes a burst of steps while the node is selected).
  if (input.type !== "number") {
    input.addEventListener("mouseup", (e) => e.preventDefault());
  }
}

/** Stop LiteGraph/Comfy from treating widget clicks as canvas drags. */
export function isolatePointer(el) {
  for (const type of ["pointerdown", "mousedown", "click", "dblclick", "wheel"]) {
    el.addEventListener(type, (e) => e.stopPropagation(), type === "wheel" ? { passive: true } : undefined);
  }
}

export function newFieldId() {
  return `f${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeType(raw) {
  const typ = String(raw || "FLOAT").trim().toUpperCase();
  if (typ === "BOOL" || typ === "BOOLEAN") return "BOOLEAN";
  if (typ === "STRING") return "STRING";
  if (typ === "INT") return "INT";
  if (typ === "FLOAT") return "FLOAT";
  return "FLOAT";
}

export function isNumericType(type) {
  return NUMERIC_TYPES.has(normalizeType(type));
}

export function socketType(type) {
  return normalizeType(type);
}

export function defaultStep(type) {
  return normalizeType(type) === "INT" ? 1 : 0.01;
}

export function coerceBound(raw, fallback, type) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const number = Number(raw);
  if (!Number.isFinite(number)) return fallback;
  return normalizeType(type) === "INT" ? Math.round(number) : number;
}

export function clampValue(value, type, min, max) {
  const typ = normalizeType(type);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const number = Math.max(lo, Math.min(hi, Number(value)));
  if (!Number.isFinite(number)) return typ === "INT" ? Math.round(lo) : lo;
  return typ === "INT" ? Math.round(number) : number;
}

export function coerceBool(raw) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const text = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off", ""].includes(text)) return false;
  return Boolean(raw);
}

/** Comma-separated UI text ↔ string[]. Empty → [""]. */
export function parseStringList(raw) {
  if (Array.isArray(raw)) {
    const parts = raw.map((item) => String(item ?? "").trim()).filter(Boolean);
    return parts.length ? parts : [""];
  }
  if (raw == null) return [""];
  const text = String(raw);
  const stripped = text.trim();
  if (stripped.startsWith("[") && stripped.endsWith("]")) {
    try {
      const data = JSON.parse(stripped);
      if (Array.isArray(data)) return parseStringList(data);
    } catch {
      /* fall through */
    }
  }
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [""];
}

export function formatStringList(values) {
  return parseStringList(values).join(", ");
}

export function defaultField(existing = [], type = "FLOAT") {
  const used = new Set(existing.map((f) => (f.name || "").trim().toLowerCase()));
  let n = 1;
  let name = "value";
  while (used.has(name.toLowerCase())) {
    n += 1;
    name = `value_${n}`;
  }
  const typ = normalizeType(type);
  if (typ === "BOOLEAN") {
    return {
      id: newFieldId(),
      name,
      type: typ,
      value: false,
      min: 0,
      max: 1,
      step: 1,
      category: "",
      notes: "",
    };
  }
  if (typ === "STRING") {
    return {
      id: newFieldId(),
      name,
      type: typ,
      value: [""],
      min: 0,
      max: 0,
      step: 1,
      category: "",
      notes: "",
    };
  }
  return {
    id: newFieldId(),
    name,
    type: typ,
    value: 0,
    min: DEFAULT_MIN,
    max: DEFAULT_MAX,
    step: defaultStep(typ),
    category: "",
    notes: "",
  };
}

export function fieldFromDef(def, existing = []) {
  const typ = normalizeType(def?.type);
  const base = defaultField(existing, typ);
  let name = String(def?.name || base.name).trim() || base.name;
  const used = new Set(existing.map((f) => (f.name || "").trim().toLowerCase()));
  if (used.has(name.toLowerCase())) {
    let i = 2;
    while (used.has(`${name}_${i}`.toLowerCase())) i += 1;
    name = `${name}_${i}`;
  }

  if (typ === "BOOLEAN") {
    return {
      ...base,
      name,
      type: typ,
      value: coerceBool(def?.default ?? def?.value ?? false),
      category: String(def?.category || "").trim(),
      notes: String(def?.notes || "").trim(),
    };
  }
  if (typ === "STRING") {
    return {
      ...base,
      name,
      type: typ,
      value: parseStringList(def?.default ?? def?.value ?? ""),
      category: String(def?.category || "").trim(),
      notes: String(def?.notes || "").trim(),
    };
  }

  const min = coerceBound(def?.min, DEFAULT_MIN, typ);
  const max = coerceBound(def?.max, DEFAULT_MAX, typ);
  const step = coerceBound(def?.step, defaultStep(typ), typ) || defaultStep(typ);
  const value = clampValue(def?.default ?? def?.value ?? 0, typ, min, max);
  return {
    id: newFieldId(),
    name,
    type: typ,
    value,
    min,
    max,
    step: typ === "INT" ? Math.max(1, Math.round(step)) : step,
    category: String(def?.category || "").trim(),
    notes: String(def?.notes || "").trim(),
  };
}

export function normalizeField(raw) {
  const name = String(raw?.name || "").trim();
  const type = normalizeType(raw?.type);
  const category = String(raw?.category || "").trim();
  const notes = String(raw?.notes || "").trim();
  const id = raw?.id ? String(raw.id) : newFieldId();

  if (type === "BOOLEAN") {
    return {
      id,
      name,
      type,
      value: coerceBool(raw?.value),
      min: 0,
      max: 1,
      step: 1,
      category,
      notes,
    };
  }
  if (type === "STRING") {
    return {
      id,
      name,
      type,
      value: parseStringList(raw?.value),
      min: 0,
      max: 0,
      step: 1,
      category,
      notes,
    };
  }

  const min = (() => {
    let v = coerceBound(raw?.min, DEFAULT_MIN, type);
    if (v < -1e8) v = 0;
    return v;
  })();
  const max = coerceBound(raw?.max, DEFAULT_MAX, type);
  let step = coerceBound(raw?.step, defaultStep(type), type);
  if (!(step > 0)) step = defaultStep(type);
  if (type === "INT") step = Math.max(1, Math.round(step));
  const value = clampValue(raw?.value, type, min, max);
  return { id, name, type, value, min, max, step, category, notes };
}

export function parseFields(raw) {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw || "[]");
    } catch {
      return [defaultField()];
    }
  }
  if (!Array.isArray(data) || !data.length) return [defaultField()];
  return data.slice(0, MAX_FIELDS).map(normalizeField);
}

export function fieldsJson(fields) {
  return JSON.stringify(fields.map(normalizeField));
}

export function formatFieldValue(field) {
  const f = normalizeField(field);
  if (f.type === "BOOLEAN") return f.value ? "true" : "false";
  if (f.type === "STRING") return formatStringList(f.value);
  if (f.type === "INT") return String(f.value);
  const n = Number(f.value);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

export function formatFieldRange(field) {
  const f = normalizeField({
    ...field,
    value: field?.value ?? field?.default,
  });
  if (f.type === "BOOLEAN") return "BOOLEAN";
  if (f.type === "STRING") {
    const n = parseStringList(f.value).filter(Boolean).length || 1;
    return `STRING · ${n} value${n === 1 ? "" : "s"}`;
  }
  const unbounded = f.max >= DEFAULT_MAX - 1;
  if (unbounded && f.min <= 0) return `${f.type} · ≥0 · step ${f.step}`;
  if (unbounded) return `${f.type} · ${f.min}… · step ${f.step}`;
  return `${f.type} · ${f.min}…${f.max} · step ${f.step}`;
}

export function formatFields(fields) {
  return (fields || [])
    .map((field) => `${normalizeField(field).name} ${formatFieldValue(field)}`)
    .join(" · ");
}

export function fieldCountLabel(fields) {
  const n = (fields || []).length;
  return n === 1 ? "1 field" : `${n} fields`;
}

/** Short notes line for cards (≈20–40 chars). */
export function notesPreview(notes, max = 36) {
  const text = String(notes || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Next free library name for a copy: denoise → denoise_2. */
export function uniqueCopyName(base, existingNames = []) {
  const root = String(base || "field").trim() || "field";
  const used = new Set(
    (existingNames || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean),
  );
  if (!used.has(root.toLowerCase())) return root;
  let i = 2;
  while (used.has(`${root}_${i}`.toLowerCase())) i += 1;
  return `${root}_${i}`;
}

/** Swap item at index with neighbor (delta -1 / +1). Returns new array. */
export function moveItem(list, index, delta) {
  return moveItemToIndex(list, index, index + delta);
}

/** Move item from fromIndex to toIndex. Returns new array. */
export function moveItemToIndex(list, fromIndex, toIndex) {
  const items = [...(list || [])];
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  const next = Math.max(0, Math.min(items.length - 1, toIndex));
  if (fromIndex === next) return items;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(next, 0, moved);
  return items;
}

/**
 * Drop helper matching prompt-craft: insert before/after target by id.
 * ids are string field ids.
 */
export function dropItemById(list, fromId, toId, after) {
  const items = [...(list || [])];
  const from = items.findIndex((item) => String(item?.id) === String(fromId));
  let to = items.findIndex((item) => String(item?.id) === String(toId));
  if (from < 0 || to < 0) return items;
  if (after) to += 1;
  if (from < to) to -= 1;
  return moveItemToIndex(items, from, to);
}

/** Grip handle + 1-based position input (prompt-craft style). */
export function makeFieldOrderControls({ index, id, onReorder, onDrop }) {
  const dragHandle = document.createElement("div");
  dragHandle.className = "vp-drag-handle";
  dragHandle.title = "Drag to reorder";
  dragHandle.innerHTML = GRIP_ICON_SVG;
  dragHandle.draggable = true;
  dragHandle.addEventListener("pointerdown", (e) => e.stopPropagation());
  dragHandle.addEventListener("mousedown", (e) => e.stopPropagation());
  dragHandle.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
    dragHandle.closest(".vp-field-row")?.classList.add("dragging");
  });
  dragHandle.addEventListener("dragend", () => {
    const row = dragHandle.closest(".vp-field-row");
    row?.classList.remove("dragging");
    row?.parentElement?.querySelectorAll(".vp-field-row").forEach((el) => {
      el.classList.remove("drop-above", "drop-below");
    });
  });

  const pos = document.createElement("input");
  pos.className = "vp-field-pos";
  pos.type = "number";
  pos.min = "1";
  pos.step = "1";
  pos.title = "Position";
  pos.value = String(index + 1);
  isolatePointer(pos);
  selectOnFocus(pos);

  function commitPos() {
    const parsed = parseInt(pos.value, 10);
    if (Number.isNaN(parsed)) {
      pos.value = String(index + 1);
      return;
    }
    onReorder?.(String(id), parsed - 1);
  }

  pos.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pos.blur();
    }
    if (e.key === "Escape") {
      pos.value = String(index + 1);
      pos.blur();
    }
  });
  pos.addEventListener("blur", commitPos);

  return { dragHandle, pos, wireRowDrop };

  function wireRowDrop(row) {
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = row.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      row.classList.toggle("drop-above", above);
      row.classList.toggle("drop-below", !above);
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("drop-above", "drop-below");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.remove("drop-above", "drop-below");
      const fromId = e.dataTransfer.getData("text/plain");
      if (!fromId || fromId === String(id)) return;
      const rect = row.getBoundingClientRect();
      const after = e.clientY >= rect.top + rect.height / 2;
      onDrop?.(fromId, String(id), after);
    });
  }
}

/** Strip trailing " (N)" so Flux (2) → Flux. */
export function baseShelfName(title) {
  return (title || "").trim().replace(/\s+\(\d+\)$/, "");
}

/** Next free name: Flux → Flux (2) → Flux (3). Keeps title if unused. */
export function nextDuplicateName(names, title) {
  const trimmed = (title || "").trim() || "Untitled";
  const taken = new Set(
    (names || []).map((name) => String(name || "").trim().toLowerCase()).filter(Boolean),
  );
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  const base = baseShelfName(trimmed) || "Untitled";
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n += 1;
  return `${base} (${n})`;
}

/** Next free preset name inside a category (empty = Uncategorised). */
export function nextPresetCopyName(presets, category, title) {
  const target = (category || "").trim().toLowerCase();
  const names = (presets || [])
    .filter((preset) => (preset.category || "").trim().toLowerCase() === target)
    .map((preset) => preset.name);
  return nextDuplicateName(names, title);
}

export function presetTitle(preset) {
  return String(preset?.name || "").trim() || formatFields(preset?.fields);
}

export function typeBadgeClass(type) {
  const typ = normalizeType(type);
  if (typ === "INT") return "vp-field-type is-int";
  if (typ === "BOOLEAN") return "vp-field-type is-bool";
  if (typ === "STRING") return "vp-field-type is-string";
  return "vp-field-type";
}

export function makeTypeBadge(type, { title = "Type is fixed after create" } = {}) {
  const badge = document.createElement("span");
  badge.className = typeBadgeClass(type);
  badge.textContent = normalizeType(type);
  badge.title = title;
  return badge;
}

export function makeFieldChips(fields) {
  const wrap = document.createElement("div");
  wrap.className = "vp-field-chips";
  for (const field of fields || []) {
    const f = normalizeField(field);
    const chip = document.createElement("span");
    chip.className = "vp-chip";
    const type = document.createElement("span");
    type.className = "vp-chip-type";
    type.textContent = f.type;
    const label = document.createElement("span");
    label.textContent = `${f.name} ${formatFieldValue(f)}`;
    chip.append(type, label);
    wrap.appendChild(chip);
  }
  return wrap;
}

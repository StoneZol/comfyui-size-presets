export const MAX_FIELDS = 16;

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

export function defaultField(existing = []) {
  const used = new Set(existing.map((f) => (f.name || "").trim().toLowerCase()));
  let n = 1;
  let name = "value";
  while (used.has(name.toLowerCase())) {
    n += 1;
    name = `value_${n}`;
  }
  return { id: newFieldId(), name, type: "FLOAT", value: 0 };
}

export function normalizeField(raw) {
  const name = String(raw?.name || "").trim();
  const type = String(raw?.type || "FLOAT").toUpperCase() === "INT" ? "INT" : "FLOAT";
  const number = Number(raw?.value);
  const value = Number.isFinite(number) ? (type === "INT" ? Math.round(number) : number) : 0;
  const field = { name, type, value };
  if (raw?.id) field.id = String(raw.id);
  else field.id = newFieldId();
  return field;
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
  if (f.type === "INT") return String(f.value);
  const n = Number(f.value);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

export function formatFields(fields) {
  return (fields || [])
    .map((field) => `${normalizeField(field).name} ${formatFieldValue(field)}`)
    .join(" · ");
}

export function presetTitle(preset) {
  return String(preset?.name || "").trim() || formatFields(preset?.fields);
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

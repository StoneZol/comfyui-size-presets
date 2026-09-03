export const MAX_FIELDS = 16;

export function selectOnFocus(input) {
  input.addEventListener("focus", () => {
    requestAnimationFrame(() => input.select());
  });
  input.addEventListener("mouseup", (e) => e.preventDefault());
}

export function defaultField(existing = []) {
  const used = new Set(existing.map((f) => (f.name || "").trim().toLowerCase()));
  let n = 1;
  let name = "value";
  while (used.has(name.toLowerCase())) {
    n += 1;
    name = `value_${n}`;
  }
  return { name, type: "FLOAT", value: 0 };
}

export function normalizeField(raw) {
  const name = String(raw?.name || "").trim();
  const type = String(raw?.type || "FLOAT").toUpperCase() === "INT" ? "INT" : "FLOAT";
  const number = Number(raw?.value);
  const value = Number.isFinite(number) ? (type === "INT" ? Math.round(number) : number) : 0;
  return { name, type, value };
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

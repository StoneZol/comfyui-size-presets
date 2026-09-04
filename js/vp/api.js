const PRESETS_URL = "/value_presets/presets";
const CATEGORIES_URL = "/value_presets/categories";
const FIELDS_URL = "/value_presets/fields";

async function readJson(res) {
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok && !data.error && !data.conflicts) {
    data.error = `Request failed (HTTP ${res.status})`;
  }
  return data;
}

export function categoryNames(items) {
  return (items || [])
    .map((item) => (typeof item === "string" ? item : item?.name || ""))
    .filter(Boolean);
}

export async function saveValuePreset({ category, fields, name, notes = "" }) {
  const res = await fetch(PRESETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, fields, name, notes }),
  });
  return readJson(res);
}

export async function listValuePresets({ category = "" } = {}) {
  const url = category ? `${PRESETS_URL}?category=${encodeURIComponent(category)}` : PRESETS_URL;
  const res = await fetch(url);
  return readJson(res);
}

export async function updateValuePreset({ id, category, fields, name, notes }) {
  const res = await fetch(PRESETS_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, category, fields, name, notes }),
  });
  return readJson(res);
}

export async function deleteValuePreset(id) {
  const res = await fetch(`${PRESETS_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return readJson(res);
}

export async function listValueCategories() {
  const res = await fetch(CATEGORIES_URL);
  return readJson(res);
}

export async function renameValueCategory({ name, newName }) {
  const res = await fetch(CATEGORIES_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, new_name: newName }),
  });
  return readJson(res);
}

export async function deleteValueCategory(name) {
  const res = await fetch(`${CATEGORIES_URL}?name=${encodeURIComponent(name)}`, { method: "DELETE" });
  return readJson(res);
}

export async function listValueFieldDefs() {
  const res = await fetch(FIELDS_URL);
  return readJson(res);
}

export async function saveValueFieldDef(field) {
  const res = await fetch(FIELDS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(field),
  });
  return readJson(res);
}

/** Create or update library field by name (node gear / sync). */
export async function upsertValueFieldDef(field) {
  const res = await fetch(FIELDS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...field, upsert: true }),
  });
  return readJson(res);
}

export async function updateValueFieldDef(field) {
  const res = await fetch(FIELDS_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(field),
  });
  return readJson(res);
}

export async function deleteValueFieldDef(id) {
  const res = await fetch(`${FIELDS_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return readJson(res);
}

const FIELD_CATEGORIES_URL = "/value_presets/field_categories";

export async function listValueFieldCategories() {
  const res = await fetch(FIELD_CATEGORIES_URL);
  return readJson(res);
}

export async function renameValueFieldCategory({ name, newName }) {
  const res = await fetch(FIELD_CATEGORIES_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, new_name: newName }),
  });
  return readJson(res);
}

export async function deleteValueFieldCategory(name) {
  const res = await fetch(`${FIELD_CATEGORIES_URL}?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  return readJson(res);
}

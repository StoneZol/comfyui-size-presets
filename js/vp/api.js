const PRESETS_URL = "/value_presets/presets";
const CATEGORIES_URL = "/value_presets/categories";

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

export async function saveValuePreset({ category, fields, name }) {
  const res = await fetch(PRESETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, fields, name }),
  });
  return readJson(res);
}

export async function listValuePresets({ category = "" } = {}) {
  const url = category ? `${PRESETS_URL}?category=${encodeURIComponent(category)}` : PRESETS_URL;
  const res = await fetch(url);
  return readJson(res);
}

export async function updateValuePreset({ id, category, fields, name }) {
  const res = await fetch(PRESETS_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, category, fields, name }),
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

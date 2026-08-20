const SIZES_URL = "/size_presets/sizes";
const CATEGORIES_URL = "/size_presets/categories";

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

export async function saveSizePreset({ category, width, height, overwrite = false }) {
  const res = await fetch(SIZES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, width, height, overwrite }),
  });
  return readJson(res);
}

export async function listSizePresets({ category = "" } = {}) {
  const url = category
    ? `${SIZES_URL}?category=${encodeURIComponent(category)}`
    : SIZES_URL;
  const res = await fetch(url);
  return readJson(res);
}

export async function updateSizePreset({ id, category, width, height, overwrite = false }) {
  const res = await fetch(SIZES_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, category, width, height, overwrite }),
  });
  return readJson(res);
}

export async function deleteSizePreset(id) {
  const res = await fetch(`${SIZES_URL}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return readJson(res);
}

export async function listCategories() {
  const res = await fetch(CATEGORIES_URL);
  return readJson(res);
}

export async function renameCategory({ name, newName }) {
  const res = await fetch(CATEGORIES_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, new_name: newName }),
  });
  return readJson(res);
}

export async function deleteCategory(name) {
  const res = await fetch(`${CATEGORIES_URL}?name=${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
  return readJson(res);
}

export function formatSize(width, height) {
  return `${width} × ${height}`;
}

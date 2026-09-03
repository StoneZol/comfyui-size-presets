/** Shared library search: AND tokens; optional `shelf/ rest` | `shelf\ rest` | `shelf: rest`. */

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * @param {string} raw
 * @returns {{ shelf: string|null, tokens: string[], hasShelfFilter: boolean }}
 */
export function parseSearchQuery(raw) {
  const text = String(raw || "").trim();
  if (!text) return { shelf: null, tokens: [], hasShelfFilter: false };

  const sep = text.search(/[\\/:]/);
  if (sep < 0) {
    return { shelf: null, tokens: tokenize(text), hasShelfFilter: false };
  }

  const shelf = text.slice(0, sep).trim().toLowerCase() || null;
  const rest = text.slice(sep + 1).trim();
  return {
    shelf,
    tokens: tokenize(rest),
    hasShelfFilter: true,
  };
}

function includesAll(haystack, tokens) {
  if (!tokens.length) return true;
  const h = String(haystack || "").toLowerCase();
  return tokens.every((token) => h.includes(token));
}

function shelfLabel(name, emptyLabel = "Uncategorised") {
  const trimmed = String(name || "").trim();
  return trimmed || emptyLabel;
}

/**
 * Empty folder visibility while Show empty is on.
 * With an active query, the shelf name itself must match.
 */
export function emptyShelfMatchesSearch(name, rawQuery) {
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(rawQuery);
  if (!hasShelfFilter && !tokens.length) return true;

  const label = String(name || "").toLowerCase();
  if (hasShelfFilter) {
    if (shelf && !label.includes(shelf)) return false;
    return tokens.length === 0;
  }
  return includesAll(label, tokens);
}

/** Size preset: optional category filter, then AND over size / category. */
export function matchesSizePreset(preset, rawQuery, { emptyFolder = "Uncategorised" } = {}) {
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(rawQuery);
  if (!hasShelfFilter && !tokens.length) return true;

  const category = shelfLabel(preset?.category, emptyFolder);
  if (shelf && !category.toLowerCase().includes(shelf)) return false;
  if (!tokens.length) return true;

  const size = `${preset?.width ?? ""} × ${preset?.height ?? ""} ${preset?.width ?? ""} ${preset?.height ?? ""}`;
  const fields = hasShelfFilter ? [size] : [category, size];
  return includesAll(fields.join(" "), tokens);
}

/** Value preset: optional category filter, then AND over name / notes [/ fields]. */
export function matchesValuePreset(
  preset,
  rawQuery,
  { emptyFolder = "Uncategorised", includeFields = false } = {},
) {
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(rawQuery);
  if (!hasShelfFilter && !tokens.length) return true;

  const category = shelfLabel(preset?.category, emptyFolder);
  if (shelf && !category.toLowerCase().includes(shelf)) return false;
  if (!tokens.length) return true;

  const bits = hasShelfFilter
    ? [preset?.name, preset?.notes]
    : [category, preset?.name, preset?.notes];

  if (includeFields) {
    bits.push(
      (preset?.fields || [])
        .map((field) => `${field?.name || ""} ${field?.label || ""} ${field?.value ?? ""} ${field?.type || ""}`)
        .join(" "),
    );
  }

  return includesAll(bits.join(" "), tokens);
}

/** Library field def: optional category filter, then AND over name / notes / type / range. */
export function matchesValueField(field, rawQuery, { emptyFolder = "Uncategorised" } = {}) {
  const { shelf, tokens, hasShelfFilter } = parseSearchQuery(rawQuery);
  if (!hasShelfFilter && !tokens.length) return true;

  const category = shelfLabel(field?.category, emptyFolder);
  if (shelf && !category.toLowerCase().includes(shelf)) return false;
  if (!tokens.length) return true;

  const range = `${field?.min ?? ""} ${field?.max ?? ""} ${field?.step ?? ""} ${field?.default ?? ""}`;
  const fields = hasShelfFilter
    ? [field?.name, field?.label, field?.notes, field?.type, range]
    : [category, field?.name, field?.label, field?.notes, field?.type, range];
  return includesAll(fields.join(" "), tokens);
}

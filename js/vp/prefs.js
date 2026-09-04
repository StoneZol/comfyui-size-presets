/** Per-node UI prefs (session lifetime of the node instance). */

const SEARCH_IN_FIELDS = "__vpSearchInFields";

export function getSearchInFields(node) {
  return !!node?.[SEARCH_IN_FIELDS];
}

export function setSearchInFields(node, value) {
  if (!node) return;
  node[SEARCH_IN_FIELDS] = !!value;
}

export function presetSearchPlaceholder(includeFields) {
  return includeFields ? "category/name or denoise" : "category/name";
}

let _config = null;

export async function loadConfig() {
  if (_config) return _config;
  const res = await fetch(new URL("./config.json", import.meta.url));
  if (!res.ok) {
    throw new Error(`Failed to load Size Presets config.json (HTTP ${res.status})`);
  }
  _config = await res.json();
  return _config;
}

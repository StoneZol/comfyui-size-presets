const CSS = `
.sp-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
}

.sp-header-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-save-btn,
.sp-load-btn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  box-sizing: border-box;
  line-height: 1;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #2a2a2e);
  color: var(--input-text, #ddd);
}

.sp-manage-btn,
.sp-switch-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 26px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  box-sizing: border-box;
  line-height: 1;
}

.sp-manage-btn {
  border: 1px solid #5a5080;
  background: #2f2b3d;
  color: #e0dce8;
  font-size: 13px;
}

.sp-switch-btn {
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #252528);
  color: var(--descrip-text, #bbb);
}

.sp-save-btn:hover,
.sp-load-btn:hover,
.sp-manage-btn:hover,
.sp-switch-btn:hover {
  filter: brightness(1.15);
}

.sp-save-btn svg,
.sp-load-btn svg,
.sp-switch-btn svg {
  width: 14px;
  height: 14px;
  display: block;
}

.sp-size-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sp-size-row label {
  flex: 0 0 52px;
  font-size: 11px;
  color: var(--descrip-text, #aaa);
}

.sp-size-row input {
  flex: 1 1 auto;
  min-width: 0;
}

.sp-aspect-preview {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sp-aspect-box {
  border: 1px solid var(--border-color, #555);
  border-radius: 2px;
  background: color-mix(in srgb, var(--comfy-input-bg, #222) 70%, #6d5aa8);
  max-width: 32px;
  max-height: 32px;
}

[data-testid="node-widget"]:has(.sp-root),
.lg-node-widget:has(.sp-root),
.comfy-widget-row:has(.sp-root) {
  margin: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}
`;

export function injectStyles(styleId) {
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function makeAspectPreview(width, height) {
  const wrap = document.createElement("div");
  wrap.className = "sp-aspect-preview";
  const box = document.createElement("div");
  box.className = "sp-aspect-box";
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const scale = 32 / Math.max(w, h);
  box.style.width = `${Math.max(4, Math.round(w * scale))}px`;
  box.style.height = `${Math.max(4, Math.round(h * scale))}px`;
  wrap.appendChild(box);
  return wrap;
}

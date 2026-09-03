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

/*
 * Scale row — disabled until polished (see size_presets.js).
 *
 * .sp-scale-row { ... }
 * .sp-scale-btn { ... }
 * .sp-scale-coef-wrap { ... }
 * .sp-scale-coef { ... }
 * .sp-scale-pick { ... }
 */

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

.vp-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.vp-field-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.vp-field-name {
  flex: 1 1 72px;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #222);
  color: var(--input-text, #ddd);
  font-family: inherit;
  font-size: 12px;
  box-sizing: border-box;
}

.vp-field-type {
  flex: 0 0 48px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #252528);
  color: var(--descrip-text, #bbb);
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
}

.vp-field-type.is-int {
  border-color: #5a5080;
  background: #2f2b3d;
  color: #e0dce8;
}

.vp-field-value {
  flex: 0 0 76px;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #222);
  color: var(--input-text, #ddd);
  font-family: inherit;
  font-size: 12px;
  box-sizing: border-box;
  /* Native spinner arrows fight with node selection / pointer routing. */
  -moz-appearance: textfield;
  appearance: textfield;
}

.vp-field-value::-webkit-outer-spin-button,
.vp-field-value::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.vp-field-remove {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--descrip-text, #888);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
}

.vp-drag-handle {
  flex: 0 0 16px;
  width: 16px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #777;
  cursor: grab;
  user-select: none;
}

.vp-drag-handle:active {
  cursor: grabbing;
}

.vp-drag-handle svg {
  width: 10px;
  height: 14px;
  fill: currentColor;
}

.vp-field-pos {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  padding: 0;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  background: var(--comfy-input-bg, #1c1c1f);
  color: #999;
  font-family: inherit;
  font-size: 11px;
  text-align: center;
  outline: none;
  -moz-appearance: textfield;
  appearance: textfield;
}

.vp-field-pos:focus {
  border-color: #6d5aa8;
  color: var(--input-text, #ddd);
}

.vp-field-pos::-webkit-outer-spin-button,
.vp-field-pos::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.vp-field-row.dragging {
  opacity: 0.4;
}

.vp-field-row.drop-above {
  box-shadow: inset 0 2px 0 #a78bfa;
}

.vp-field-row.drop-below {
  box-shadow: inset 0 -2px 0 #a78bfa;
}

.vp-field-config {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--descrip-text, #888);
  cursor: pointer;
  padding: 0;
}

.vp-field-config svg {
  width: 14px;
  height: 14px;
  display: block;
}

.vp-field-config:hover {
  color: var(--input-text, #ddd);
  border-color: var(--border-color, #444);
  background: var(--comfy-menu-bg, #1e1e1e);
}

.vp-field-remove:hover {
  color: #e07070;
  border-color: #7a3a3a;
}

.vp-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 26px;
  border-radius: 6px;
  border: 1px dashed var(--border-color, #555);
  background: transparent;
  color: var(--descrip-text, #aaa);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.vp-add-btn:hover {
  color: var(--input-text, #ddd);
  border-color: #6d5aa8;
}

.vp-add-btn svg {
  width: 12px;
  height: 12px;
  display: block;
}

.vp-add-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.vp-field-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.vp-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-menu-bg, #1e1e1e);
  font-size: 11px;
  line-height: 1.3;
  color: var(--input-text, #ddd);
}

.vp-chip-type {
  color: var(--descrip-text, #888);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
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

import { app } from "../../../scripts/app.js";
import { loadConfig } from "./sp/config.js";
import { injectStyles } from "./sp/styles.js";
import { SAVE_ICON_SVG, LOAD_ICON_SVG, SWAP_ICON_SVG } from "./sp/icons.js";
import { openSavePresetPopup } from "./sp/save_dialog.js";
import { openLoadPresetPopup } from "./sp/load_dialog.js";
import { openManagerPopup } from "./sp/manager_dialog.js";
// import { CHEVRON_ICON_SVG } from "./sp/icons.js";
// import { openPopup } from "./sp/popup.js";

const config = await loadConfig();
injectStyles(config.style_id);

const MIN_NODE_WIDTH = 280;
const BUTTON_PANEL_HEIGHT = 96;
const SOCKET_ROWS_HEIGHT = 56;
const WIDGET_ROW_HEIGHT = 28;

/*
 * Scale row (÷ coef ×) — disabled until rounding matches other resizers.
 *
 * const MIN_SIZE = 64;
 * const MAX_SIZE = 8192;
 * const SIZE_STEP = 2;
 * const DEFAULT_SCALE = 1.5;
 * const SCALE_PRESETS = [1.25, 1.5, 1.75, 2];
 *
 * function snapSize(value) {
 *   const n = Math.round(Number(value) / SIZE_STEP) * SIZE_STEP;
 *   return Math.max(MIN_SIZE, Math.min(MAX_SIZE, n));
 * }
 *
 * function readScaleCoef(input) {
 *   const value = Number(input?.value);
 *   if (!Number.isFinite(value) || value <= 0) return null;
 *   return value;
 * }
 *
 * function scaleSize(node, factor, divide) {
 *   const f = Number(factor);
 *   if (!Number.isFinite(f) || f <= 0) return;
 *   const mult = divide ? 1 / f : f;
 *   const { width, height } = readSize(node);
 *   applySize(node, snapSize(width * mult), snapSize(height * mult));
 * }
 *
 * function openScalePresetPicker({ anchor, current, onPick, onClose }) { ... }
 */

function findSizeWidget(node, name) {
  return node.widgets?.find((w) => w.name === name);
}

function readSize(node) {
  const width = parseInt(findSizeWidget(node, "width")?.value, 10) || 512;
  const height = parseInt(findSizeWidget(node, "height")?.value, 10) || 512;
  return { width, height };
}

function applySize(node, width, height) {
  const widthWidget = findSizeWidget(node, "width");
  const heightWidget = findSizeWidget(node, "height");
  if (widthWidget) widthWidget.value = width;
  if (heightWidget) heightWidget.value = height;
  node.setDirtyCanvas(true, true);
}

function swapSizes(node) {
  const widthWidget = findSizeWidget(node, "width");
  const heightWidget = findSizeWidget(node, "height");
  if (!widthWidget || !heightWidget) return;
  const tmp = widthWidget.value;
  widthWidget.value = heightWidget.value;
  heightWidget.value = tmp;
  node.setDirtyCanvas(true, true);
}

function widgetRowEl(widget) {
  if (!widget) return null;
  const el = widget.element || widget.inputEl || widget.domElement;
  return el?.closest?.("[data-testid='node-widget'], .lg-node-widget, .comfy-widget-row") || el?.parentElement || el;
}

function reorderWidgetArray(node, uiWidget) {
  const widgets = node.widgets;
  if (!widgets || !uiWidget) return;
  const idx = widgets.indexOf(uiWidget);
  if (idx < 0) return;
  const heightIdx = widgets.findIndex((w) => w.name === "height");
  const wantIdx = heightIdx >= 0 ? heightIdx + 1 : widgets.length - 1;
  if (idx === wantIdx) return;
  widgets.splice(idx, 1);
  const nextHeightIdx = widgets.findIndex((w) => w.name === "height");
  widgets.splice(nextHeightIdx >= 0 ? nextHeightIdx + 1 : widgets.length, 0, uiWidget);
}

/** Keep width/height above the button panel (widgets array + DOM order). */
function placeButtonPanelAfterInputs(node, uiWidget, root) {
  reorderWidgetArray(node, uiWidget);

  const heightRow = widgetRowEl(findSizeWidget(node, "height"));
  const panelRow =
    root.closest?.("[data-testid='node-widget'], .lg-node-widget, .comfy-widget-row") || root.parentElement;
  if (
    heightRow?.after &&
    panelRow?.parentElement &&
    heightRow.parentElement === panelRow.parentElement &&
    heightRow.nextElementSibling !== panelRow
  ) {
    heightRow.after(panelRow);
  }
}

function schedulePanelPlacement(node, uiWidget, root) {
  requestAnimationFrame(() => placeButtonPanelAfterInputs(node, uiWidget, root));
}

app.registerExtension({
  name: config.extension_name,

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== config.node_class) return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      const node = this;

      if (node.size?.[0]) {
        const defaultHeight =
          SOCKET_ROWS_HEIGHT + WIDGET_ROW_HEIGHT * 2 + BUTTON_PANEL_HEIGHT + 12;
        node.setSize([Math.max(node.size[0], MIN_NODE_WIDTH), Math.max(node.size[1] || 0, defaultHeight)]);
      }

      const root = document.createElement("div");
      root.className = "sp-root";
      root.addEventListener("pointerdown", (e) => e.stopPropagation());
      root.addEventListener("wheel", (e) => e.stopPropagation());

      const libraryRow = document.createElement("div");
      libraryRow.className = "sp-header-row";

      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "sp-load-btn";
      loadBtn.innerHTML = `${LOAD_ICON_SVG}<span>Load preset</span>`;

      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "sp-save-btn";
      saveBtn.innerHTML = `${SAVE_ICON_SVG}<span>Save preset</span>`;

      libraryRow.append(loadBtn, saveBtn);

      const managerBtn = document.createElement("button");
      managerBtn.type = "button";
      managerBtn.className = "sp-manage-btn";
      managerBtn.textContent = "Manager";

      const switchBtn = document.createElement("button");
      switchBtn.type = "button";
      switchBtn.className = "sp-switch-btn";
      switchBtn.innerHTML = `${SWAP_ICON_SVG}<span>Switch size</span>`;

      root.append(switchBtn, libraryRow, managerBtn);

      /*
      const scaleRow = document.createElement("div");
      scaleRow.className = "sp-scale-row";
      // ... ÷ [coef ▾] × — see commented block at top of file
      root.appendChild(scaleRow);
      */

      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openLoadPresetPopup({
          anchor: loadBtn,
          onPick: (preset) => applySize(node, preset.width, preset.height),
        });
      });

      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { width, height } = readSize(node);
        openSavePresetPopup({ anchor: saveBtn, width, height });
      });

      managerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openManagerPopup({ anchor: managerBtn });
      });

      switchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        swapSizes(node);
      });

      const uiWidget = node.addDOMWidget("size_presets_ui", "div", root, {
        serialize: false,
        hideOnZoom: false,
      });

      if (uiWidget) {
        uiWidget.serialize = false;
        uiWidget.options = {
          ...(uiWidget.options || {}),
          serialize: false,
          hideInPanel: true,
          getMinHeight: () => BUTTON_PANEL_HEIGHT,
        };
        uiWidget.computeSize = (width) => [width || MIN_NODE_WIDTH, BUTTON_PANEL_HEIGHT];
        uiWidget.computeLayoutSize = () => ({
          minHeight: BUTTON_PANEL_HEIGHT,
          minWidth: 0,
        });
      }

      reorderWidgetArray(node, uiWidget);
      schedulePanelPlacement(node, uiWidget, root);
      setTimeout(() => schedulePanelPlacement(node, uiWidget, root), 100);

      const onConfigure = node.onConfigure;
      node.onConfigure = function () {
        const result = onConfigure ? onConfigure.apply(this, arguments) : undefined;
        schedulePanelPlacement(node, uiWidget, root);
        return result;
      };

      return r;
    };
  },
});

import { app } from "../../../scripts/app.js";
import { injectStyles } from "./sp/styles.js";
import { LOAD_ICON_SVG, PLUS_ICON_SVG, SAVE_ICON_SVG } from "./sp/icons.js";
import { defaultField, fieldsJson, isolatePointer, MAX_FIELDS, parseFields, selectOnFocus } from "./vp/fields.js";
import { openSaveValuePopup } from "./vp/save_dialog.js";
import { openLoadValuePopup } from "./vp/load_dialog.js";
import { openValueManagerPopup } from "./vp/manager_dialog.js";
import {
  createShadowNumber,
  hideDataWidget,
  hideOnCanvasKeepInPanel,
  isShadowFieldName,
  parseShadowFieldId,
  shadowWidgetName,
} from "./vp/shadow_fields.js";

injectStyles("size-presets-styles");

const MIN_NODE_WIDTH = 300;
const BUTTON_PANEL_HEIGHT = 70;
const FIELD_ROW_HEIGHT = 34;
const ADD_ROW_HEIGHT = 30;
const KEPT_WIDGETS = new Set(["fields_json", "value_presets_ui"]);

function panelHeight(fieldCount) {
  return FIELD_ROW_HEIGHT * Math.max(fieldCount, 1) + ADD_ROW_HEIGHT + BUTTON_PANEL_HEIGHT;
}

app.registerExtension({
  name: "size.presets.values",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "ValuePresets") return;

    const required = nodeData.input?.required;
    if (required?.fields_json) {
      nodeData.input.hidden ??= {};
      nodeData.input.hidden.fields_json = required.fields_json;
      delete required.fields_json;
    }

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      const node = this;

      let dataWidget = node.widgets?.find((w) => w.name === "fields_json");
      if (!dataWidget) {
        dataWidget = node.addWidget("text", "fields_json", '[{"name":"value","type":"FLOAT","value":0}]', () => {}, {});
      }
      hideDataWidget(dataWidget);
      dataWidget.type = "";

      let fields = parseFields(dataWidget.value);
      let uiWidget = null;
      let syncing = false;

      const root = document.createElement("div");
      root.className = "sp-root";
      root.addEventListener("pointerdown", (e) => e.stopPropagation());
      root.addEventListener("wheel", (e) => e.stopPropagation());

      const fieldsWrap = document.createElement("div");
      fieldsWrap.className = "vp-fields";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "vp-add-btn";
      addBtn.innerHTML = `${PLUS_ICON_SVG}<span>Add field</span>`;

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

      root.append(fieldsWrap, addBtn, libraryRow, managerBtn);

      function persist({ light = false } = {}) {
        if (!dataWidget) return;
        dataWidget.value = fieldsJson(fields);
        // Full dirty redraw remounts Vue widgets under a held mouse button and
        // turns one spinner click into a burst of steps.
        node.setDirtyCanvas(true, !light);
      }

      function collectFromShadows() {
        for (const widget of node.widgets || []) {
          const id = parseShadowFieldId(widget.name);
          if (!id) continue;
          const field = fields.find((item) => item.id === id);
          if (!field) continue;
          const number = Number(widget.value);
          if (!Number.isFinite(number)) continue;
          field.value = field.type === "INT" ? Math.round(number) : number;
        }
      }

      function findShadow(id) {
        return node.widgets?.find((w) => w.name === shadowWidgetName(id));
      }

      function bindShadow(widget, field) {
        const prev = widget.callback;
        widget.callback = function () {
          prev?.apply(this, arguments);
          if (syncing) return;
          const number = Number(widget.value);
          field.value = Number.isFinite(number) ? (field.type === "INT" ? Math.round(number) : number) : 0;
          persist({ light: true });
          syncOutputs();
          const input = fieldsWrap.querySelector(`[data-vp-id="${field.id}"] .vp-field-value`);
          if (input && input !== document.activeElement) input.value = String(field.value);
        };
      }

      function addShadow(field) {
        const widget = createShadowNumber(node, field);
        bindShadow(widget, field);
        hideOnCanvasKeepInPanel(widget);
      }

      function removeShadows() {
        const widgets = node.widgets || [];
        for (let i = widgets.length - 1; i >= 0; i--) {
          if (KEPT_WIDGETS.has(widgets[i].name) || !isShadowFieldName(widgets[i].name)) continue;
          widgets[i].onRemove?.();
          widgets.splice(i, 1);
        }
      }

      function rebuildShadows() {
        collectFromShadows();
        removeShadows();
        for (const field of fields) addShadow(field);
        hideDataWidget(dataWidget);
        dataWidget.type = "";
      }

      function writeShadow(field) {
        const widget = findShadow(field.id);
        if (!widget) return;
        syncing = true;
        widget.label = field.name;
        widget.options = {
          ...(widget.options || {}),
          step: field.type === "INT" ? 1 : 0.01,
          precision: field.type === "INT" ? 0 : 3,
        };
        if (widget.value !== field.value) widget.value = field.value;
        hideOnCanvasKeepInPanel(widget);
        widget.type = "number";
        syncing = false;
      }

      function syncOutputs() {
        while ((node.outputs?.length || 0) > fields.length) {
          node.removeOutput(node.outputs.length - 1);
        }
        fields.forEach((field, i) => {
          const type = field.type === "INT" ? "INT" : "FLOAT";
          const name = field.name || `v${i + 1}`;
          if (i >= (node.outputs?.length || 0)) {
            node.addOutput(name, type);
            return;
          }
          const output = node.outputs[i];
          output.name = name;
          output.type = type;
          output.label = name;
          if (output.links?.length && node.graph) {
            for (const linkId of [...output.links]) {
              const link = node.graph.links?.[linkId];
              const target = link ? node.graph.getNodeById(link.target_id) : null;
              const input = target?.inputs?.[link.target_slot];
              if (input?.type && input.type !== "*" && input.type !== type) {
                node.graph.removeLink(linkId);
              }
            }
          }
        });
      }

      function hideDuplicateCanvasFields() {
        let host = root.parentElement;
        for (let i = 0; i < 8 && host; i++) {
          const widgets = host.querySelectorAll?.("[data-testid='node-widget'], .lg-node-widget");
          if (widgets?.length) {
            widgets.forEach((el) => {
              if (el.contains(root)) return;
              el.style.setProperty("display", "none", "important");
              el.style.setProperty("height", "0", "important");
              el.style.setProperty("min-height", "0", "important");
              el.style.setProperty("overflow", "hidden", "important");
              el.style.setProperty("margin", "0", "important");
              el.style.setProperty("padding", "0", "important");
            });
            return;
          }
          host = host.parentElement;
        }
      }

      function resize() {
        const height = panelHeight(fields.length);
        if (uiWidget) {
          uiWidget.computeSize = (width) => [width || MIN_NODE_WIDTH, height];
          uiWidget.computeLayoutSize = () => ({ minHeight: height, minWidth: 0 });
        }
        const nextHeight = Math.max(node.size?.[1] || 0, height + 40);
        node.setSize([Math.max(node.size?.[0] || 0, MIN_NODE_WIDTH), nextHeight]);
      }

      function applyFields(next, { rebuild = false } = {}) {
        fields = (next || []).slice(0, MAX_FIELDS);
        persist();
        if (rebuild) rebuildShadows();
        else for (const field of fields) writeShadow(field);
        syncOutputs();
        paint();
      }

      function paint() {
        fieldsWrap.replaceChildren();
        fields.forEach((field, index) => {
          const row = document.createElement("div");
          row.className = "vp-field-row";
          row.dataset.vpId = field.id;

          const nameInput = document.createElement("input");
          nameInput.className = "vp-field-name";
          nameInput.type = "text";
          nameInput.placeholder = "name";
          nameInput.value = field.name;
          nameInput.maxLength = 40;

          const typeBtn = document.createElement("button");
          typeBtn.type = "button";
          typeBtn.className = `vp-field-type${field.type === "INT" ? " is-int" : ""}`;
          typeBtn.textContent = field.type;
          typeBtn.title = "Toggle INT / FLOAT";

          const valueInput = document.createElement("input");
          valueInput.className = "vp-field-value";
          valueInput.type = "number";
          valueInput.step = field.type === "INT" ? "1" : "0.01";
          valueInput.value = String(field.value);
          selectOnFocus(valueInput);
          isolatePointer(valueInput);
          isolatePointer(nameInput);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "vp-field-remove";
          removeBtn.title = "Remove field";
          removeBtn.textContent = "×";
          removeBtn.disabled = fields.length <= 1;

          nameInput.addEventListener("change", () => {
            field.name = nameInput.value.trim() || defaultField(fields.filter((_, i) => i !== index)).name;
            persist();
            writeShadow(field);
            syncOutputs();
            paint();
          });
          typeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            field.type = field.type === "INT" ? "FLOAT" : "INT";
            field.value = field.type === "INT" ? Math.round(Number(field.value) || 0) : Number(field.value) || 0;
            persist();
            rebuildShadows();
            syncOutputs();
            paint();
          });
          valueInput.addEventListener("change", () => {
            const number = Number(valueInput.value);
            field.value = Number.isFinite(number) ? (field.type === "INT" ? Math.round(number) : number) : 0;
            persist({ light: true });
            writeShadow(field);
            syncOutputs();
          });
          valueInput.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.stopPropagation();
          });
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fields = fields.filter((_, i) => i !== index);
            if (!fields.length) fields = [defaultField()];
            persist();
            rebuildShadows();
            syncOutputs();
            paint();
          });

          row.append(nameInput, typeBtn, valueInput, removeBtn);
          fieldsWrap.appendChild(row);
        });
        addBtn.disabled = fields.length >= MAX_FIELDS;
        hideDuplicateCanvasFields();
        resize();
      }

      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fields.length >= MAX_FIELDS) return;
        const field = defaultField(fields);
        fields.push(field);
        persist();
        addShadow(field);
        syncOutputs();
        paint();
      });

      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openLoadValuePopup({
          anchor: loadBtn,
          onPick: (preset) => applyFields(parseFields(preset.fields), { rebuild: true }),
        });
      });

      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        collectFromShadows();
        persist();
        openSaveValuePopup({ anchor: saveBtn, fields });
      });

      managerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openValueManagerPopup({ anchor: managerBtn });
      });

      const onResize = node.onResize;
      node.onResize = function () {
        const result = onResize ? onResize.apply(this, arguments) : undefined;
        hideDataWidget(dataWidget);
        dataWidget.type = "";
        for (const w of node.widgets || []) {
          if (isShadowFieldName(w.name)) hideOnCanvasKeepInPanel(w);
        }
        hideDuplicateCanvasFields();
        return result;
      };

      const onConfigure = node.onConfigure;
      node.onConfigure = function () {
        const result = onConfigure ? onConfigure.apply(this, arguments) : undefined;
        dataWidget = node.widgets?.find((w) => w.name === "fields_json") || dataWidget;
        hideDataWidget(dataWidget);
        dataWidget.type = "";
        fields = parseFields(dataWidget?.value);
        rebuildShadows();
        syncOutputs();
        paint();
        return result;
      };

      uiWidget = node.addDOMWidget("value_presets_ui", "div", root, {
        serialize: false,
        hideOnZoom: false,
      });
      if (uiWidget) {
        uiWidget.serialize = false;
        uiWidget.options = {
          ...(uiWidget.options || {}),
          serialize: false,
          hideInPanel: true,
          getMinHeight: () => panelHeight(fields.length),
        };
      }

      rebuildShadows();
      syncOutputs();
      paint();
      return r;
    };
  },
});

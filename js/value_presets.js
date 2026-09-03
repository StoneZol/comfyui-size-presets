import { app } from "../../../scripts/app.js";
import { injectStyles } from "./sp/styles.js";
import { GEAR_ICON_SVG, LOAD_ICON_SVG, PLUS_ICON_SVG, SAVE_ICON_SVG } from "./sp/icons.js";
import {
  clampValue,
  coerceBool,
  defaultField,
  dropItemById,
  fieldFromDef,
  fieldsJson,
  formatStringList,
  isolatePointer,
  isNumericType,
  makeFieldOrderControls,
  makeTypeBadge,
  MAX_FIELDS,
  moveItemToIndex,
  normalizeField,
  parseFields,
  parseStringList,
  selectOnFocus,
  socketType,
} from "./vp/fields.js";
import { openSaveValuePopup } from "./vp/save_dialog.js";
import { openLoadValuePopup } from "./vp/load_dialog.js";
import { openValueManagerPopup } from "./vp/manager_dialog.js";
import { openFieldConfigPopup, openFieldLibraryPopup, openFieldTypePicker } from "./vp/field_config.js";
import { getSearchInFields, setSearchInFields } from "./vp/prefs.js";
import {
  createShadowNumber,
  hideDataWidget,
  hideOnCanvasKeepInPanel,
  isShadowFieldName,
  parseShadowFieldId,
  shadowWidgetName,
} from "./vp/shadow_fields.js";

injectStyles("size-presets-styles");

const MIN_NODE_WIDTH = 320;
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
        dataWidget = node.addWidget(
          "text",
          "fields_json",
          '[{"name":"value","type":"FLOAT","value":0}]',
          () => {},
          {},
        );
      }
      hideDataWidget(dataWidget);

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

      function resolveDataWidget() {
        dataWidget = node.widgets?.find((w) => w.name === "fields_json") || dataWidget;
        if (dataWidget) hideDataWidget(dataWidget);
        return dataWidget;
      }

      function persist({ light = false } = {}) {
        const widget = resolveDataWidget();
        if (!widget) return;
        widget.value = fieldsJson(fields);
        widget.serialize = true;
        if (widget.options) widget.options.serialize = true;
        node.setDirtyCanvas(true, !light);
        if (node.graph) node.graph.setDirtyCanvas?.(true, !light);
      }

      function collectFromShadows() {
        for (const widget of node.widgets || []) {
          const id = parseShadowFieldId(widget.name);
          if (!id) continue;
          const field = fields.find((item) => item.id === id);
          if (!field || !isNumericType(field.type)) continue;
          const number = Number(widget.value);
          if (!Number.isFinite(number)) continue;
          field.value = clampValue(number, field.type, field.min, field.max);
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
          if (!isNumericType(field.type)) return;
          const number = Number(widget.value);
          field.value = clampValue(number, field.type, field.min, field.max);
          persist({ light: true });
          syncOutputs();
          const input = fieldsWrap.querySelector(`[data-vp-id="${field.id}"] .vp-field-value`);
          if (input && input !== document.activeElement) input.value = String(field.value);
        };
      }

      function addShadow(field) {
        if (!isNumericType(field.type)) return;
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

      /** @param {{ harvest?: boolean }} [opts] harvest=false after structural edits (add/remove/reorder). */
      function rebuildShadows({ harvest = true } = {}) {
        if (harvest) collectFromShadows();
        removeShadows();
        for (const field of fields) addShadow(field);
        resolveDataWidget();
      }

      function writeShadow(field) {
        if (!isNumericType(field.type)) return;
        const widget = findShadow(field.id);
        if (!widget) return;
        syncing = true;
        widget.label = field.name;
        widget.options = {
          ...(widget.options || {}),
          min: field.min,
          max: field.max,
          step: field.step,
          precision: field.type === "INT" ? 0 : 3,
        };
        if (widget.value !== field.value) widget.value = field.value;
        hideOnCanvasKeepInPanel(widget);
        widget.type = "number";
        widget.serialize = false;
        if (widget.options) widget.options.serialize = false;
        syncing = false;
      }

      function syncOutputs() {
        while ((node.outputs?.length || 0) > fields.length) {
          node.removeOutput(node.outputs.length - 1);
        }
        fields.forEach((field, i) => {
          const type = socketType(field.type);
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
        fields = (next || []).slice(0, MAX_FIELDS).map(normalizeField);
        persist();
        if (rebuild) rebuildShadows({ harvest: false });
        else for (const field of fields) writeShadow(field);
        syncOutputs();
        paint();
      }

      function addFieldInstance(field) {
        if (fields.length >= MAX_FIELDS) return;
        fields.push(normalizeField(field));
        persist();
        addShadow(fields[fields.length - 1]);
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

          const typeBadge = makeTypeBadge(field.type);

          let valueControl;
          if (field.type === "BOOLEAN") {
            valueControl = document.createElement("div");
            valueControl.className = "sp-toggle vp-field-bool";
            valueControl.setAttribute("role", "switch");
            valueControl.setAttribute("aria-checked", field.value ? "true" : "false");
            if (field.value) valueControl.classList.add("on");
            valueControl.appendChild(Object.assign(document.createElement("div"), { className: "sp-toggle-knob" }));
            valueControl.title = field.value ? "true" : "false";
            isolatePointer(valueControl);
            valueControl.addEventListener("click", (e) => {
              e.stopPropagation();
              field.value = !coerceBool(field.value);
              valueControl.classList.toggle("on", field.value);
              valueControl.setAttribute("aria-checked", field.value ? "true" : "false");
              valueControl.title = field.value ? "true" : "false";
              persist({ light: true });
              syncOutputs();
            });
          } else if (field.type === "STRING") {
            valueControl = document.createElement("input");
            valueControl.className = "vp-field-value vp-field-value-string";
            valueControl.type = "text";
            valueControl.placeholder = "a, b, c";
            valueControl.value = formatStringList(field.value);
            valueControl.title = "Comma-separated values";
            selectOnFocus(valueControl);
            isolatePointer(valueControl);
            valueControl.addEventListener("change", () => {
              field.value = parseStringList(valueControl.value);
              valueControl.value = formatStringList(field.value);
              persist({ light: true });
              syncOutputs();
            });
          } else {
            valueControl = document.createElement("input");
            valueControl.className = "vp-field-value";
            valueControl.type = "number";
            valueControl.min = String(field.min);
            valueControl.max = String(field.max);
            valueControl.step = String(field.step);
            valueControl.value = String(field.value);
            valueControl.title = `${field.min} … ${field.max} · step ${field.step}`;
            selectOnFocus(valueControl);
            isolatePointer(valueControl);
            valueControl.addEventListener("change", () => {
              field.value = clampValue(valueControl.value, field.type, field.min, field.max);
              valueControl.value = String(field.value);
              persist({ light: true });
              writeShadow(field);
              syncOutputs();
            });
            valueControl.addEventListener("keydown", (e) => {
              if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
              e.stopPropagation();
            });
          }

          const configBtn = document.createElement("button");
          configBtn.type = "button";
          configBtn.className = "vp-field-config";
          configBtn.title = field.type === "BOOLEAN" || field.type === "STRING" ? "Library & notes" : "Limits & library";
          configBtn.innerHTML = GEAR_ICON_SVG;

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "vp-field-remove";
          removeBtn.title = "Remove field";
          removeBtn.textContent = "×";

          const order = makeFieldOrderControls({
            index,
            id: field.id,
            onReorder: (fromId, toIndex) => {
              const from = fields.findIndex((item) => item.id === fromId);
              if (from < 0) return;
              fields = moveItemToIndex(fields, from, toIndex);
              persist();
              rebuildShadows({ harvest: false });
              syncOutputs();
              paint();
            },
            onDrop: (fromId, toId, after) => {
              fields = dropItemById(fields, fromId, toId, after);
              persist();
              rebuildShadows({ harvest: false });
              syncOutputs();
              paint();
            },
          });

          isolatePointer(nameInput);
          nameInput.addEventListener("change", () => {
            field.name =
              nameInput.value.trim() || defaultField(fields.filter((_, i) => i !== index)).name;
            persist();
            writeShadow(field);
            syncOutputs();
            paint();
          });
          typeBadge.title = "Replace field type";
          typeBadge.style.cursor = "pointer";
          typeBadge.addEventListener("click", (e) => {
            e.stopPropagation();
            openFieldTypePicker({
              anchor: typeBadge,
              nested: false,
              onPick: (type) => {
                if (type === field.type) return;
                fields[index] = defaultField(
                  fields.filter((_, i) => i !== index),
                  type,
                );
                persist();
                rebuildShadows({ harvest: false });
                syncOutputs();
                paint();
              },
            });
          });
          configBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openFieldConfigPopup({
              anchor: configBtn,
              field,
              nested: false,
              onSave: (next) => {
                fields[index] = normalizeField({ ...next, id: field.id, type: field.type });
                persist();
                rebuildShadows({ harvest: false });
                syncOutputs();
                paint();
              },
            });
          });
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            fields = fields.filter((_, i) => i !== index);
            persist();
            rebuildShadows({ harvest: false });
            syncOutputs();
            paint();
          });

          row.append(order.dragHandle, order.pos, nameInput, typeBadge, valueControl, configBtn, removeBtn);
          order.wireRowDrop(row);
          fieldsWrap.appendChild(row);
        });
        if (!fields.length) {
          const empty = document.createElement("div");
          empty.className = "sp-popup-message";
          empty.style.margin = "0";
          empty.style.padding = "4px 2px";
          empty.textContent = "No fields — add one below";
          fieldsWrap.appendChild(empty);
        }
        addBtn.disabled = fields.length >= MAX_FIELDS;
        hideDuplicateCanvasFields();
        resize();
      }

      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fields.length >= MAX_FIELDS) return;
        openFieldLibraryPopup({
          anchor: addBtn,
          onBlank: () => {
            openFieldTypePicker({
              anchor: addBtn,
              onPick: (type) => addFieldInstance(defaultField(fields, type)),
            });
          },
          onPick: (def) => addFieldInstance(fieldFromDef(def, fields)),
        });
      });

      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openLoadValuePopup({
          anchor: loadBtn,
          searchInFields: getSearchInFields(node),
          onSearchInFieldsChange: (value) => setSearchInFields(node, value),
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
        openValueManagerPopup({
          anchor: managerBtn,
          searchInFields: getSearchInFields(node),
          onSearchInFieldsChange: (value) => setSearchInFields(node, value),
        });
      });

      const onResize = node.onResize;
      node.onResize = function () {
        const result = onResize ? onResize.apply(this, arguments) : undefined;
        resolveDataWidget();
        for (const w of node.widgets || []) {
          if (isShadowFieldName(w.name)) hideOnCanvasKeepInPanel(w);
        }
        hideDuplicateCanvasFields();
        return result;
      };

      const onConfigure = node.onConfigure;
      node.onConfigure = function () {
        const result = onConfigure ? onConfigure.apply(this, arguments) : undefined;
        resolveDataWidget();
        fields = parseFields(dataWidget?.value);
        rebuildShadows({ harvest: false });
        syncOutputs();
        paint();
        return result;
      };

      const onSerialize = node.onSerialize;
      node.onSerialize = function (info) {
        persist({ light: true });
        const result = onSerialize ? onSerialize.apply(this, arguments) : undefined;
        // Force the stored payload after LiteGraph snapshots widget values.
        if (info && dataWidget) {
          const serializable = (node.widgets || []).filter(
            (w) => w.serialize !== false && w.options?.serialize !== false,
          );
          const slot = serializable.indexOf(dataWidget);
          if (slot >= 0 && Array.isArray(info.widgets_values)) {
            info.widgets_values[slot] = dataWidget.value;
          }
        }
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

      rebuildShadows({ harvest: false });
      syncOutputs();
      paint();
      return r;
    };
  },
});

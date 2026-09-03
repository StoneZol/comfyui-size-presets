import { app } from "../../../scripts/app.js";
import { injectStyles } from "./sp/styles.js";
import { LOAD_ICON_SVG, PLUS_ICON_SVG, SAVE_ICON_SVG } from "./sp/icons.js";
import { defaultField, fieldsJson, MAX_FIELDS, parseFields, selectOnFocus } from "./vp/fields.js";
import { openSaveValuePopup } from "./vp/save_dialog.js";
import { openLoadValuePopup } from "./vp/load_dialog.js";
import { openValueManagerPopup } from "./vp/manager_dialog.js";

injectStyles("size-presets-styles");

const MIN_NODE_WIDTH = 300;
const BUTTON_PANEL_HEIGHT = 70;
const FIELD_ROW_HEIGHT = 34;
const ADD_ROW_HEIGHT = 30;

function hideFieldsWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  widget.computeLayoutSize = () => ({ minHeight: 0, minWidth: 0 });
}

function readFields(node) {
  const widget = node.widgets?.find((w) => w.name === "fields_json");
  return parseFields(widget?.value);
}

function writeFields(node, fields, paint) {
  const widget = node.widgets?.find((w) => w.name === "fields_json");
  const next = (fields || []).slice(0, MAX_FIELDS);
  if (widget) widget.value = fieldsJson(next);
  syncOutputs(node, next);
  paint?.();
  node.setDirtyCanvas(true, true);
}

function syncOutputs(node, fields) {
  const list = fields || [];
  while ((node.outputs?.length || 0) > list.length) {
    node.removeOutput(node.outputs.length - 1);
  }
  list.forEach((field, i) => {
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

function panelHeight(fieldCount) {
  return FIELD_ROW_HEIGHT * Math.max(fieldCount, 1) + ADD_ROW_HEIGHT + BUTTON_PANEL_HEIGHT;
}

app.registerExtension({
  name: "size.presets.values",

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "ValuePresets") return;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
      const node = this;

      hideFieldsWidget(node.widgets?.find((w) => w.name === "fields_json"));

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

      function currentFields() {
        return readFields(node);
      }

      function paint() {
        const fields = currentFields();
        fieldsWrap.replaceChildren();
        fields.forEach((field, index) => {
          const row = document.createElement("div");
          row.className = "vp-field-row";

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

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "vp-field-remove";
          removeBtn.title = "Remove field";
          removeBtn.textContent = "×";
          removeBtn.disabled = fields.length <= 1;

          nameInput.addEventListener("change", () => {
            const next = currentFields();
            const name = nameInput.value.trim() || defaultField(next.filter((_, i) => i !== index)).name;
            next[index] = { ...next[index], name };
            writeFields(node, next, paint);
          });
          typeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const next = currentFields();
            const type = next[index].type === "INT" ? "FLOAT" : "INT";
            const value = type === "INT" ? Math.round(Number(next[index].value) || 0) : Number(next[index].value) || 0;
            next[index] = { ...next[index], type, value };
            writeFields(node, next, paint);
          });
          valueInput.addEventListener("change", () => {
            const next = currentFields();
            const number = Number(valueInput.value);
            next[index] = {
              ...next[index],
              value: Number.isFinite(number) ? (next[index].type === "INT" ? Math.round(number) : number) : 0,
            };
            writeFields(node, next, paint);
          });
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const next = currentFields().filter((_, i) => i !== index);
            if (!next.length) next.push(defaultField());
            writeFields(node, next, paint);
          });

          row.append(nameInput, typeBtn, valueInput, removeBtn);
          fieldsWrap.appendChild(row);
        });
        addBtn.disabled = fields.length >= MAX_FIELDS;
        resize();
      }

      function resize() {
        const height = panelHeight(currentFields().length);
        if (uiWidget) {
          uiWidget.computeSize = (width) => [width || MIN_NODE_WIDTH, height];
          uiWidget.computeLayoutSize = () => ({ minHeight: height, minWidth: 0 });
        }
        const nextHeight = Math.max(node.size?.[1] || 0, height + 40);
        node.setSize([Math.max(node.size?.[0] || 0, MIN_NODE_WIDTH), nextHeight]);
      }

      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = currentFields();
        if (next.length >= MAX_FIELDS) return;
        next.push(defaultField(next));
        writeFields(node, next, paint);
      });

      loadBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openLoadValuePopup({
          anchor: loadBtn,
          onPick: (preset) => writeFields(node, parseFields(preset.fields), paint),
        });
      });

      saveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSaveValuePopup({ anchor: saveBtn, fields: currentFields() });
      });

      managerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openValueManagerPopup({ anchor: managerBtn });
      });

      const uiWidget = node.addDOMWidget("value_presets_ui", "div", root, {
        serialize: false,
        hideOnZoom: false,
      });
      if (uiWidget) {
        uiWidget.serialize = false;
        uiWidget.options = {
          ...(uiWidget.options || {}),
          serialize: false,
          hideInPanel: true,
          getMinHeight: () => panelHeight(currentFields().length),
        };
      }

      writeFields(node, currentFields(), paint);

      const onConfigure = node.onConfigure;
      node.onConfigure = function () {
        const result = onConfigure ? onConfigure.apply(this, arguments) : undefined;
        hideFieldsWidget(node.widgets?.find((w) => w.name === "fields_json"));
        writeFields(node, currentFields(), paint);
        return result;
      };

      return r;
    };
  },
});

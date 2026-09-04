const SHADOW_RE = /^vp:(.+)$/;

export function hideOnCanvasKeepInPanel(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.hasLayoutSize = false;
  widget.serialize = false;
  widget.computeSize = () => [0, -4];
  widget.draw = () => {};
  widget.mouse = () => false;
  widget.computeLayoutSize = () => ({ minHeight: 0, maxHeight: 0, minWidth: 0 });
  widget.options = {
    ...(widget.options || {}),
    serialize: false,
    minNodeSize: [0, 0],
  };
  delete widget.options.hidden;
  delete widget.options.canvasOnly;
  const el = widget.element || widget.inputEl || widget.textEl || widget.domElement;
  if (el?.style) {
    el.style.display = "none";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.position = "absolute";
    el.style.width = "0";
    el.style.height = "0";
    el.style.overflow = "hidden";
  }
}

export function hideDataWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  // Must stay serializable — blank type drops fields_json from widgets_values,
  // so deletes/edits vanish after refresh and the previous payload comes back.
  widget.serialize = true;
  widget.computeSize = () => [0, -4];
  widget.draw = () => {};
  widget.mouse = () => false;
  if (!widget.type || widget.type === "converted-widget") widget.type = "text";
  widget.options = {
    ...(widget.options || {}),
    hidden: true,
    serialize: true,
    multiline: true,
  };
  const el = widget.element || widget.inputEl || widget.textEl || widget.domElement;
  if (el?.style) el.style.display = "none";
}

export function isShadowFieldName(name) {
  return SHADOW_RE.test(name || "");
}

export function shadowWidgetName(id) {
  return `vp:${id}`;
}

export function parseShadowFieldId(name) {
  const match = SHADOW_RE.exec(name || "");
  return match ? match[1] : null;
}

export function createShadowNumber(node, field) {
  const step = Number(field.step) > 0 ? Number(field.step) : field.type === "INT" ? 1 : 0.01;
  const min = Number.isFinite(Number(field.min)) ? Number(field.min) : -1e12;
  const max = Number.isFinite(Number(field.max)) ? Number(field.max) : 1e12;
  const widget = node.addWidget("number", shadowWidgetName(field.id), field.value, () => {}, {
    min,
    max,
    step,
    precision: field.type === "INT" ? 0 : 3,
  });
  widget.label = field.name;
  widget.value = field.value;
  hideOnCanvasKeepInPanel(widget);
  widget.type = "number";
  widget.serialize = false;
  if (widget.options) widget.options.serialize = false;
  return widget;
}

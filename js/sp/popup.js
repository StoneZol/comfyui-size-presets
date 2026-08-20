const STYLE_ID = "sp-popup-styles";

const CSS = `
.sp-popup-root {
  position: fixed;
  z-index: 11000;
  min-width: 240px;
  max-width: min(420px, calc(100vw - 16px));
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-menu-bg, #1e1e1e);
  color: var(--input-text, #ddd);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  font-family: inherit;
  font-size: 12px;
}

.sp-popup-nested {
  z-index: 11100;
}

.sp-popup-centered {
  max-width: min(480px, calc(100vw - 16px));
  max-height: 75vh;
  overflow: hidden;
}

.sp-popup-centered .sp-popup-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.sp-popup-fixed {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

.sp-popup-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.sp-popup-footer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  margin-top: 8px;
  border-top: 1px solid var(--border-color, #444);
}

.sp-popup-footer .sp-popup-actions {
  align-self: flex-end;
}

.sp-popup-title {
  flex: 0 0 auto;
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--descrip-text, #aaa);
  padding: 2px 4px 8px;
  user-select: none;
}

.sp-popup-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
}

.sp-popup-input {
  box-sizing: border-box;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #222);
  color: var(--input-text, #ddd);
  font-family: inherit;
  font-size: 12px;
  outline: none;
}

.sp-popup-input:focus {
  border-color: var(--descrip-text, #888);
}

.sp-popup-input.invalid {
  border-color: #c0392b;
}

.sp-popup-error {
  min-height: 14px;
  padding: 0 2px;
  color: #ff8a80;
  font-size: 11px;
}

.sp-popup-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.sp-popup-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #2a2a2e);
  color: var(--input-text, #ddd);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
}

.sp-popup-btn:hover {
  filter: brightness(1.15);
}

.sp-popup-btn.primary {
  background: #2f2b3d;
  border-color: #6d5aa8;
  color: #e8e4f5;
}

.sp-popup-btn.danger {
  background: #3a2323;
  border-color: #c0392b;
  color: #ff8a80;
}

.sp-popup-message {
  padding: 2px 4px 0;
  line-height: 1.4;
  color: var(--input-text, #ddd);
}

.sp-save-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #3a3a3a);
}

.sp-save-cat {
  font-size: 11px;
  letter-spacing: 0.02em;
  color: var(--descrip-text, #aaa);
  user-select: none;
}

.sp-popup-textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #222);
  color: var(--input-text, #ddd);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.35;
  resize: vertical;
  outline: none;
}

.sp-popup-textarea:focus {
  border-color: var(--descrip-text, #888);
}

.sp-save-slots {
  padding: 2px 4px 0;
  color: var(--descrip-text, #aaa);
  line-height: 1.4;
}

.sp-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
  color: var(--descrip-text, #aaa);
  font-size: 11px;
  user-select: none;
}

.sp-preset-peek {
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

.sp-preset-peek:hover {
  color: var(--input-text, #ddd);
  background: var(--comfy-menu-bg, #1e1e1e);
  border-color: var(--border-color, #444);
}

.sp-preset-peek svg {
  width: 14px;
  height: 14px;
  display: block;
}

.sp-prompt-tip {
  position: fixed;
  z-index: 12000;
  max-width: min(360px, calc(100vw - 16px));
  max-height: min(50vh, 360px);
  overflow: auto;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #555);
  background: #1c1c1f;
  color: var(--input-text, #ddd);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: auto;
}

.sp-prompt-tip-label {
  font-size: 10px;
  letter-spacing: 0.02em;
  margin-top: 6px;
}

.sp-prompt-tip-label:first-child {
  margin-top: 0;
}

.sp-prompt-tip-pos {
  color: #6bbf7a;
}

.sp-prompt-tip-neg {
  color: #e07070;
}

.sp-prompt-tip-text {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--input-text, #ddd);
}

.sp-save-folder-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sp-save-folder-row .sp-popup-input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
}

.sp-save-folder-row .sp-popup-btn {
  flex: 0 0 auto;
}

.sp-pick-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.sp-pick-item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #2a2a2e);
  color: var(--input-text, #ddd);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
}

.sp-pick-item:hover {
  filter: brightness(1.12);
}

.sp-pick-item.selected {
  background: #2f2b3d;
  border-color: #6d5aa8;
  color: #e8e4f5;
}

.sp-preset-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sp-preset-folder {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-preset-folder-head {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 28px;
  padding: 0 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--input-text, #ddd);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
}

.sp-preset-folder-head:hover {
  background: var(--comfy-input-bg, #2a2a2e);
}

.sp-preset-folder-chevron {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  color: var(--descrip-text, #888);
}

.sp-preset-folder-chevron svg {
  width: 14px;
  height: 14px;
  display: block;
  transition: transform 0.15s ease;
}

.sp-preset-folder.collapsed .sp-preset-folder-chevron svg {
  transform: rotate(-90deg);
}

.sp-preset-folder-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-preset-folder-count {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--descrip-text, #888);
}

.sp-preset-folder-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-preset-folder.collapsed .sp-preset-folder-body {
  display: none;
}

.sp-mgr-tabs {
  display: flex;
  gap: 4px;
}

.sp-mgr-tab {
  flex: 1 1 0;
  height: 28px;
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  background: var(--comfy-input-bg, #2a2a2e);
  color: var(--descrip-text, #aaa);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.sp-mgr-tab.active {
  color: var(--input-text, #ddd);
  border-color: #6d5aa8;
  background: #2f2b3d;
}

.sp-mgr-list {
  min-height: 120px;
}

.sp-mgr-folder-head {
  cursor: default;
}

.sp-mgr-folder-head:hover {
  background: transparent;
}

.sp-mgr-folder-toggle {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 28px;
  padding: 0 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.sp-mgr-folder-toggle:hover {
  background: var(--comfy-input-bg, #2a2a2e);
}

.sp-mgr-folder-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sp-mgr-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #2a2a2e);
}

.sp-mgr-item-info {
  flex: 1 1 auto;
  min-width: 0;
}

.sp-mgr-item-name {
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-mgr-item-meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--descrip-text, #888);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-mgr-item-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
}

.sp-mgr-icon-btn {
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

.sp-mgr-icon-btn:hover {
  color: var(--input-text, #ddd);
  background: var(--comfy-menu-bg, #1e1e1e);
  border-color: var(--border-color, #444);
}

.sp-mgr-icon-btn.danger:hover {
  color: #e07070;
  border-color: #7a3a3a;
}

.sp-mgr-icon-btn svg {
  width: 14px;
  height: 14px;
  display: block;
}

.sp-mgr-prompt-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sp-mgr-prompt-label {
  font-size: 11px;
  letter-spacing: 0.02em;
}

.sp-mgr-prompt-label.positive {
  color: #6bbf7a;
}

.sp-mgr-prompt-label.negative {
  color: #e07070;
}

.sp-mgr-prompt-area {
  min-height: 64px;
  max-height: min(25vh, 240px);
  resize: vertical;
}

.sp-preset-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #444);
  background: var(--comfy-input-bg, #2a2a2e);
  color: var(--input-text, #ddd);
  box-sizing: border-box;
}

.sp-preset-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
}

.sp-preset-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-preset-slots {
  font-size: 11px;
  color: var(--descrip-text, #aaa);
  line-height: 1.35;
}

.sp-preset-desc-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.sp-preset-desc {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 11px;
  color: var(--descrip-text, #888);
  line-height: 1.35;
  white-space: pre-wrap;
}

.sp-preset-load,
.sp-preset-collapse {
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

.sp-preset-load:hover,
.sp-preset-collapse:hover {
  color: var(--input-text, #ddd);
  background: var(--comfy-menu-bg, #1e1e1e);
  border-color: var(--border-color, #444);
}

.sp-preset-load svg,
.sp-preset-collapse svg {
  width: 14px;
  height: 14px;
  display: block;
}

.sp-preset-collapse svg {
  transition: transform 0.15s ease;
}

.sp-preset-item.desc-collapsed .sp-preset-collapse svg {
  transform: rotate(-90deg);
}
`;

function injectPopupStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

const popupStack = [];

function placePopup(el, { anchor, position, centered }) {
    const margin = 8;
    const gap = 4;
    let x = position?.x ?? margin;
    let y = position?.y ?? margin;
    let anchorRect = null;
    if (!centered && anchor?.getBoundingClientRect) {
        anchorRect = anchor.getBoundingClientRect();
    }

    if (!el.isConnected) {
        el.style.visibility = "hidden";
        document.body.appendChild(el);
    }

    const box = el.getBoundingClientRect();
    if (centered) {
        x = (window.innerWidth - box.width) / 2;
        const anchorY = window.innerHeight * 0.4;
        y = anchorY - box.height / 2;
        const maxBottom = window.innerHeight - margin;
        if (y + box.height > maxBottom) y = maxBottom - box.height;
        if (y < margin) y = margin;
    } else if (anchorRect) {
        x = anchorRect.left + (anchorRect.width - box.width) / 2;
        y = anchorRect.bottom + gap;
        if (y + box.height > window.innerHeight - margin) {
            const above = anchorRect.top - gap - box.height;
            if (above >= margin) y = above;
        }
    }

    const maxX = Math.max(margin, window.innerWidth - box.width - margin);
    const maxY = Math.max(margin, window.innerHeight - box.height - margin);
    el.style.left = `${Math.max(margin, Math.min(x, maxX))}px`;
    el.style.top = `${Math.max(margin, Math.min(y, maxY))}px`;
    el.style.visibility = "visible";
}

/**
 * Floating popup anchored to an element or screen point.
 * A non-nested open closes the whole stack. Nested opens stack on top;
 * Escape / outside-click closes only the top dialog.
 *
 * @param {object} opts
 * @param {HTMLElement} [opts.anchor]
 * @param {{x:number,y:number}} [opts.position]
 * @param {string} [opts.title]
 * @param {number} [opts.width]
 * @param {boolean} [opts.nested]
 * @param {boolean} [opts.centered]
 * @param {(body: HTMLElement, api: { close: () => void, root: HTMLElement, setTitle: (t: string) => void }) => void} opts.render
 * @param {() => void} [opts.onClose]
 */
export function openPopup(opts) {
    injectPopupStyles();
    if (!opts.nested) {
        while (popupStack.length)
            popupStack[popupStack.length - 1].close();
    }

    const root = document.createElement("div");
    root.className = "sp-popup-root";
    if (opts.nested) root.classList.add("sp-popup-nested");
    if (opts.centered)
        root.classList.add("sp-popup-centered");
    if (opts.width) root.style.width = `${opts.width}px`;
    root.addEventListener("pointerdown", (e) =>
        e.stopPropagation(),
    );
    root.addEventListener(
        "wheel",
        (e) => e.stopPropagation(),
        { passive: true },
    );

    const titleEl = document.createElement("div");
    titleEl.className = "sp-popup-title";
    if (opts.title) titleEl.textContent = opts.title;
    else titleEl.style.display = "none";

    const body = document.createElement("div");
    body.className = "sp-popup-body";

    root.append(titleEl, body);

    let closed = false;
    let resizeObserver = null;
    let repositionScheduled = false;
    const placementOpts = {
        anchor: opts.anchor,
        position: opts.position,
        centered: opts.centered,
    };

    function reposition() {
        if (closed) return;
        placePopup(root, placementOpts);
    }

    function scheduleReposition() {
        if (repositionScheduled || closed) return;
        repositionScheduled = true;
        requestAnimationFrame(() => {
            repositionScheduled = false;
            reposition();
        });
    }

    function close() {
        if (closed) return;
        closed = true;
        resizeObserver?.disconnect();
        resizeObserver = null;
        while (
            popupStack.length &&
            popupStack[popupStack.length - 1] !== api
        ) {
            popupStack[popupStack.length - 1].close();
        }
        const index = popupStack.indexOf(api);
        if (index >= 0) popupStack.splice(index, 1);
        document.removeEventListener(
            "pointerdown",
            onDocDown,
            true,
        );
        document.removeEventListener(
            "keydown",
            onKey,
            true,
        );
        root.remove();
        opts.onClose?.();
    }

    function onDocDown(e) {
        if (popupStack[popupStack.length - 1] !== api)
            return;
        if (e.target?.closest?.(".sp-prompt-tip")) return;
        if (
            root.contains(e.target) ||
            e.target === opts.anchor
        )
            return;
        const inStack = popupStack.some((item) =>
            item.root.contains(e.target),
        );
        if (inStack) {
            close();
            return;
        }
        if (popupStack[0] && popupStack[0] !== api) {
            popupStack[0].close();
            return;
        }
        close();
    }

    function onKey(e) {
        if (e.key !== "Escape") return;
        if (popupStack[popupStack.length - 1] !== api)
            return;
        e.preventDefault();
        e.stopPropagation();
        close();
    }

    const api = {
        close,
        root,
        reposition,
        setTitle(text) {
            titleEl.style.display = text ? "" : "none";
            titleEl.textContent = text || "";
        },
    };

    popupStack.push(api);
    opts.render?.(body, api);
    reposition();
    if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(scheduleReposition);
        resizeObserver.observe(root);
    }
    document.addEventListener(
        "pointerdown",
        onDocDown,
        true,
    );
    document.addEventListener("keydown", onKey, true);
    return api;
}

/**
 * Name/value prompt built on openPopup.
 */
export function openInputPopup({
    anchor,
    position,
    title = "Name",
    placeholder = "",
    confirmLabel = "Add",
    initialValue = "",
    validate,
    onSubmit,
    nested = false,
} = {}) {
    return openPopup({
        anchor,
        position,
        title,
        width: 280,
        nested,
        render(body, { close }) {
            const input = document.createElement("input");
            input.className = "sp-popup-input";
            input.type = "text";
            input.placeholder = placeholder;
            input.value = initialValue;

            const errorEl = document.createElement("div");
            errorEl.className = "sp-popup-error";

            const actions = document.createElement("div");
            actions.className = "sp-popup-actions";

            const confirm =
                document.createElement("button");
            confirm.type = "button";
            confirm.className = "sp-popup-btn primary";
            confirm.textContent = confirmLabel;

            function showError(message) {
                errorEl.textContent = message || "";
                input.classList.toggle(
                    "invalid",
                    !!message,
                );
            }

            function submit() {
                const value = input.value.trim();
                const error = validate?.(value);
                if (error) {
                    showError(error);
                    input.focus();
                    return;
                }
                close();
                onSubmit?.(value);
            }

            confirm.addEventListener("click", (e) => {
                e.stopPropagation();
                submit();
            });
            input.addEventListener("input", () => {
                if (errorEl.textContent) showError("");
            });
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                }
            });

            actions.appendChild(confirm);
            body.append(input, errorEl, actions);
            requestAnimationFrame(() => input.focus());
        },
    });
}

/**
 * Confirm / cancel prompt built on openPopup.
 */
export function openConfirmPopup({
    anchor,
    position,
    title = "Confirm",
    message = "",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    showCancel = true,
    danger = true,
    onConfirm,
    nested = false,
} = {}) {
    return openPopup({
        anchor,
        position,
        title,
        width: 280,
        nested,
        render(body, { close }) {
            const text = document.createElement("div");
            text.className = "sp-popup-message";
            text.textContent = message;

            const actions = document.createElement("div");
            actions.className = "sp-popup-actions";

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "sp-popup-btn";
            cancel.textContent = cancelLabel;
            cancel.addEventListener("click", (e) => {
                e.stopPropagation();
                close();
            });

            const confirm =
                document.createElement("button");
            confirm.type = "button";
            confirm.className = `sp-popup-btn ${danger ? "danger" : "primary"}`;
            confirm.textContent = confirmLabel;
            confirm.addEventListener("click", (e) => {
                e.stopPropagation();
                close();
                onConfirm?.();
            });

            if (showCancel) actions.appendChild(cancel);
            actions.appendChild(confirm);
            body.append(text, actions);
            requestAnimationFrame(() => confirm.focus());
        },
    });
}


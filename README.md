# ComfyUI Size Presets

**Save and load image sizes — width/height presets with categories.**

One node with native **width** and **height** inputs (pinnable in ComfyUI Favorites), four action buttons, and a local **SQLite library** for your common resolutions.

MIT — see [LICENSE](LICENSE)

---

## Features

- **Native width / height** — INT widgets you can pin and wire to Empty Latent Image, etc.
- **Save preset** — snapshot current size into a category
- **Load preset** — browse by category, search by size, click to apply
- **Manager** — rename/delete categories, move or delete presets
- **Switch size** — swap width ↔ height on the node
- **Size = name** — `1024 × 768` is the preset identity (no extra naming)

---

## Install

1. Clone into `ComfyUI/custom_nodes/`:

    ```bash
    git clone https://github.com/StoneZol/comfyui-size-presets.git
    ```

2. Restart ComfyUI (or refresh the browser after a hot reload).

3. Add node: **Size Presets**

No pip dependencies — Python 3.8+ stdlib + SQLite only.

---

## Node layout

```
width  [____512____]
height [____512____]
[   Switch size   ]
[Load preset] [Save preset]
[     Manager     ]
      │ width  ──→
      │ height ──→
```

---

## Quick start

1. Add **Size Presets** to your graph.
2. Set width and height (or connect inputs from other nodes).
3. **Save preset** — adjust size if needed, pick a category, save.
4. **Load preset** — pick a size from a category; values apply to the node.
5. **Switch size** — flip portrait ↔ landscape without reloading.
6. Connect **width** / **height** outputs to your latent or resize nodes.

---

## Library

Presets are stored in `db/presets.sqlite` (auto-created on first use).

Each preset is uniquely identified by `(category, width, height)`. Saving the same size in the same category again updates the existing entry (with overwrite confirmation).

Default uncategorised bucket: **Uncategorised**.

---

## File layout

```
comfyui-size-presets/
├── nodes.py              # SizePresets node
├── routes.py             # REST API
├── db/
│   ├── db.py             # SQLite CRUD
│   └── presets.sqlite    # created at runtime
└── js/
    ├── size_presets.js   # Node UI entry
    └── sp/               # Dialogs, API client, styles
```

---

## API routes

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET/POST/PATCH/DELETE | `/size_presets/sizes` | List, save, move, delete presets |
| GET/PATCH/DELETE | `/size_presets/categories` | List, rename, delete categories |

# ComfyUI Size Presets

**Save and load image sizes — and named INT/FLOAT values — with categories.**

Two nodes, one local **SQLite library**: classic **width/height** presets, plus dynamic **Value Presets** for any named numbers (cfg, steps, denoise, …) with the socket type you need.

MIT — see [LICENSE](LICENSE)

---

## Screenshots

| Node                                         | Load preset                            |
| -------------------------------------------- | -------------------------------------- |
| ![Size Presets node](docs/screenshots/1.png) | ![Load preset](docs/screenshots/2.png) |

| Save preset                            | Manager                                 |
| -------------------------------------- | --------------------------------------- |
| ![Save preset](docs/screenshots/3.png) | ![Size manager](docs/screenshots/4.png) |

---

## Features

### Size Presets

- **Native width / height** — INT widgets you can pin and wire to Empty Latent Image, etc.
- **Save / Load / Manager** — categories, search, copy/move
- **Switch size** — swap width ↔ height
- **Size = identity** — `1024 × 768` (no extra naming)

### Value Presets

- **Dynamic fields** — name + INT/FLOAT + value (up to 16)
- **Typed outputs** — each field is an INT or FLOAT socket
- **Same library UX** — Load / Save / Manager with categories
- **Named presets** — unique `(category, name)`, no overwrite
- **Field library** — reusable defs with min / max / step, categories and notes
- **Preset notes** — short description on save / in manager
- **Edit in Manager** — Presets and Fields tabs; rename, add/remove, limits

---

## Install

1. Clone into `ComfyUI/custom_nodes/`:

    ```bash
    git clone https://github.com/StoneZol/comfyui-size-presets.git
    ```

2. Restart ComfyUI (or refresh the browser after a hot reload).

3. Add node: **Size Presets** or **Value Presets**

No pip dependencies — Python 3.8+ stdlib + SQLite only.

---

## Size Presets layout

```
      │ width  ──→
      │ height ──→
width  [____512____]
height [____512____]
[   Switch size   ]
[Load preset] [Save preset]
[     Manager     ]
```

## Value Presets layout

```
      │ cfg     ──→ FLOAT
      │ steps   ──→ INT
[ name ] [INT|FLOAT] [value] [×]
[        Add field        ]
[Load preset] [Save preset]
[        Manager          ]
```

---

## Quick start

### Sizes

1. Add **Size Presets**, set width/height (or connect inputs).
2. **Save preset** → pick a category.
3. **Load preset** → click a size card.
4. Wire **width** / **height** to latent or resize nodes.

### Values

1. Add **Value Presets**.
2. Add fields, name them, toggle **INT / FLOAT**, set values.
3. Save/load like sizes; outputs match field types for FLOAT-only inputs.

---

## Library

Presets are stored in `db/presets.sqlite` (auto-created on first use).

- Sizes: unique `(category, width, height)`
- Values: unique `(category, preset name)`

Default bucket: **Uncategorised**. Size and value categories are separate tables.

---

## File layout

```
comfyui-size-presets/
├── nodes.py              # SizePresets + ValuePresets
├── routes.py             # REST API
├── db/
│   ├── db.py             # size tables + SQLite
│   ├── values.py         # value preset CRUD
│   └── presets.sqlite    # created at runtime
└── js/
    ├── size_presets.js   # Size node UI
    ├── value_presets.js  # Value node UI
    ├── sp/               # Shared popups / size dialogs
    └── vp/               # Value dialogs + API
```

---

## API routes

| Method                | Path                        | Purpose                          |
| --------------------- | --------------------------- | -------------------------------- |
| GET/POST/PATCH/DELETE | `/size_presets/sizes`       | Size presets                     |
| GET/PATCH/DELETE      | `/size_presets/categories`  | Size categories                  |
| GET/POST/PATCH/DELETE | `/value_presets/presets`    | Value presets                    |
| GET/PATCH/DELETE      | `/value_presets/categories` | Value categories                 |
| GET/POST/PATCH/DELETE | `/value_presets/fields`     | Shared field definitions         |

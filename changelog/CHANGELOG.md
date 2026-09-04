# Changelog

## 2.0.0 — 2026-09-04

Value Presets library UX and field model overhaul.

- **Field library** — shared defs with min / max / step, category, notes; gear → Save to library; Manager **Fields** tab
- **Preset notes** — optional description on save / cards / info popup
- **Reorder fields** — drag handle + position index (node and Manager edit)
- **Search** — `category/` · `\` · `:` shelf filter, then AND tokens (Load + Manager); **Search in fields** toggle (per node)
- **Type locked after create** — replace via type badge / last-slot flow; blank add opens type picker
- **Empty node** — all fields can be removed (`[]`); Add field to start again
- **Manager** — Presets + Fields tabs; copy / move / edit; empty categories toggle
- **Persistence fix** — `fields_json` stays serializable so deletes/edits survive refresh
- Architecture ready for BOOLEAN / STRING later (create UI not exposed yet)

## 1.1.0 — 2026-09-03

- **Value Presets** node: dynamic named fields with INT/FLOAT outputs
- Field library with min / max / step limits for reuse
- Separate value preset library tables in the same SQLite file
- Load / Save / Manager for value presets (same UX pattern as sizes)

## 1.0.0 — 2026-08-20

Initial release.

- Native width/height INT inputs and outputs
- Save / Load / Manager / Switch size buttons
- Categories with search and rename
- Local SQLite library (`db/presets.sqlite`)

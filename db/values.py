"""SQLite library for named INT/FLOAT/BOOLEAN/STRING field presets."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Tuple

from .db import (
    UNCATEGORISED_NAME,
    _connect,
    _is_uncategorised,
    _lock,
    _normalize_category,
)

MAX_FIELDS = 16
ALLOWED_TYPES = ("INT", "FLOAT", "BOOLEAN", "STRING")
DEFAULT_MIN = 0.0
DEFAULT_MAX = 1_000_000_000.0


def _normalize_type(raw) -> str:
    typ = str(raw or "FLOAT").strip().upper()
    if typ in ("BOOL", "BOOLEAN"):
        return "BOOLEAN"
    if typ == "STRING":
        return "STRING"
    if typ == "INT":
        return "INT"
    if typ == "FLOAT":
        return "FLOAT"
    return ""


def _default_step(typ: str) -> float:
    return 1.0 if typ == "INT" else 0.01


def _coerce_bound(raw, fallback: float, typ: str) -> float:
    if raw is None or raw == "":
        return fallback
    try:
        number = float(raw)
    except (TypeError, ValueError):
        return fallback
    if not (number == number) or number in (float("inf"), float("-inf")):
        return fallback
    return float(int(round(number))) if typ == "INT" else float(number)


def _clamp_value(value: float, typ: str, min_v: float, max_v: float) -> Any:
    lo = min(min_v, max_v)
    hi = max(min_v, max_v)
    number = max(lo, min(hi, float(value)))
    return int(round(number)) if typ == "INT" else float(number)


def _coerce_bool(raw) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        return bool(raw)
    text = str(raw or "").strip().lower()
    if text in ("1", "true", "yes", "on"):
        return True
    if text in ("0", "false", "no", "off", ""):
        return False
    return bool(raw)


def _parse_string_list(raw) -> List[str]:
    if isinstance(raw, list):
        parts = [str(item).strip() for item in raw]
        parts = [p for p in parts if p]
        return parts or [""]
    if raw is None:
        return [""]
    text = str(raw)
    # Allow JSON array string
    stripped = text.strip()
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            data = json.loads(stripped)
            if isinstance(data, list):
                return _parse_string_list(data)
        except json.JSONDecodeError:
            pass
    parts = [p.strip() for p in text.split(",")]
    parts = [p for p in parts if p]
    return parts or [""]


def _canonicalize_one_field(item: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    name = str(item.get("name") or "").strip()
    if not name:
        return None, "Field name is required"
    if len(name) > 40:
        return None, "Field name is too long"
    typ = _normalize_type(item.get("type"))
    if not typ:
        return None, "Type must be INT, FLOAT, BOOLEAN, or STRING"

    category = _normalize_category(item.get("category") or "")
    notes = _normalize_notes(item.get("notes") or "")

    if typ == "BOOLEAN":
        return {
            "name": name,
            "type": typ,
            "value": _coerce_bool(item.get("value", False)),
            "min": 0.0,
            "max": 1.0,
            "step": 1.0,
            "category": category,
            "notes": notes,
        }, None

    if typ == "STRING":
        values = _parse_string_list(item.get("value", item.get("default", "")))
        return {
            "name": name,
            "type": typ,
            "value": values,
            "min": 0.0,
            "max": 0.0,
            "step": 1.0,
            "category": category,
            "notes": notes,
        }, None

    min_v = _coerce_bound(item.get("min"), DEFAULT_MIN, typ)
    max_v = _coerce_bound(item.get("max"), DEFAULT_MAX, typ)
    if min_v < -1e8:
        min_v = 0.0
    step_raw = item.get("step")
    if step_raw is None or step_raw == "":
        step_v = _default_step(typ)
    else:
        try:
            step_v = float(step_raw)
        except (TypeError, ValueError):
            return None, f"Invalid step for “{name}”"
        if not (step_v == step_v) or step_v <= 0:
            return None, f"Step for “{name}” must be > 0"
        if typ == "INT":
            step_v = max(1.0, float(int(round(step_v))))
    try:
        number = float(item.get("value", 0))
    except (TypeError, ValueError):
        return None, f"Invalid value for “{name}”"
    if not (number == number) or number in (float("inf"), float("-inf")):
        return None, f"Invalid value for “{name}”"
    value = _clamp_value(number, typ, min_v, max_v)
    return {
        "name": name,
        "type": typ,
        "value": value,
        "min": int(min_v) if typ == "INT" else float(min_v),
        "max": int(max_v) if typ == "INT" else float(max_v),
        "step": int(step_v) if typ == "INT" else float(step_v),
        "category": category,
        "notes": notes,
    }, None


def canonicalize_fields(raw) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str], str]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "[]")
        except json.JSONDecodeError:
            return None, "Invalid fields JSON", ""
    if not isinstance(raw, list):
        return None, "Fields must be a list", ""
    if len(raw) > MAX_FIELDS:
        return None, f"At most {MAX_FIELDS} fields", ""
    if not raw:
        return None, "Add at least one field", ""

    seen = set()
    fields: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            return None, "Invalid field", ""
        parsed, error = _canonicalize_one_field(item)
        if error or not parsed:
            return None, error or "Invalid field", ""
        key = parsed["name"].casefold()
        if key in seen:
            return None, f"Duplicate field “{parsed['name']}”", ""
        seen.add(key)
        fields.append(parsed)

    key = "|".join(
        f"{f['name'].casefold()}:{f['type']}:{_key_value(f['type'], f['value'])}" for f in fields
    )
    return fields, None, key


def _key_value(typ: str, value: Any) -> str:
    if typ == "INT":
        return str(int(value))
    if typ == "FLOAT":
        return f"{float(value):.6f}"
    if typ == "BOOLEAN":
        return "1" if value else "0"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def fields_json(fields: List[Dict[str, Any]]) -> str:
    return json.dumps(fields, ensure_ascii=False, separators=(",", ":"))


def _get_or_create_category(conn, name: str) -> Tuple[Optional[int], str]:
    title = _normalize_category(name)
    if _is_uncategorised(title):
        return None, ""
    row = conn.execute(
        "SELECT id, name FROM value_categories WHERE name = ? COLLATE NOCASE",
        (title,),
    ).fetchone()
    if row:
        return int(row["id"]), row["name"]
    cur = conn.execute("INSERT INTO value_categories (name) VALUES (?)", (title,))
    return int(cur.lastrowid), title


def _normalize_preset_name(name: str) -> str:
    return (name or "").strip()[:80]


def _normalize_notes(notes: str) -> str:
    return (notes or "").strip()[:500]


def _preset_row(row) -> Dict:
    try:
        fields = json.loads(row["fields_json"] or "[]")
    except json.JSONDecodeError:
        fields = []
    notes = ""
    try:
        notes = row["notes"] or ""
    except (KeyError, IndexError):
        notes = ""
    return {
        "id": int(row["id"]),
        "name": row["name"] or "",
        "notes": notes,
        "fields": fields,
        "category": row["category"] or "",
    }


def _find_by_name(conn, category_id: Optional[int], name: str, exclude_id: Optional[int] = None):
    title = _normalize_preset_name(name)
    if category_id is None:
        sql = "SELECT id FROM value_presets WHERE category_id IS NULL AND name = ? COLLATE NOCASE"
        params: List[Any] = [title]
    else:
        sql = "SELECT id FROM value_presets WHERE category_id = ? AND name = ? COLLATE NOCASE"
        params = [category_id, title]
    if exclude_id is not None:
        sql += " AND id != ?"
        params.append(int(exclude_id))
    return conn.execute(sql, params).fetchone()


def save_value_preset(category: str, fields, name: str = "", notes: str = "") -> Dict:
    parsed, error, fields_key = canonicalize_fields(fields)
    if error:
        return {"ok": False, "error": error}
    title = _normalize_preset_name(name)
    if not title:
        return {"ok": False, "error": "Preset name is required"}
    note = _normalize_notes(notes)

    payload = fields_json(parsed)
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            category_id, category_name = _get_or_create_category(conn, category)
            existing = _find_by_name(conn, category_id, title)
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"category": category_name, "name": title}]}
            conn.execute(
                """
                INSERT INTO value_presets (category_id, name, notes, fields_json, fields_key)
                VALUES (?, ?, ?, ?, ?)
                """,
                (category_id, title, note, payload, fields_key),
            )
            _upsert_fields_into_library(conn, parsed)
            conn.commit()
            return {
                "ok": True,
                "name": title,
                "notes": note,
                "fields": parsed,
                "category": category_name,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def list_value_presets(category: str = "") -> Dict:
    shelf = _normalize_category(category)
    with _lock:
        conn = _connect()
        try:
            if shelf and not _is_uncategorised(shelf):
                rows = conn.execute(
                    """
                    SELECT
                        value_presets.id,
                        value_presets.name AS name,
                        value_presets.notes AS notes,
                        value_presets.fields_json,
                        value_categories.name AS category
                    FROM value_presets
                    LEFT JOIN value_categories ON value_categories.id = value_presets.category_id
                    WHERE value_categories.name = ? COLLATE NOCASE
                    ORDER BY value_presets.name COLLATE NOCASE, value_presets.id
                    """,
                    (shelf,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT
                        value_presets.id,
                        value_presets.name AS name,
                        value_presets.notes AS notes,
                        value_presets.fields_json,
                        value_categories.name AS category
                    FROM value_presets
                    LEFT JOIN value_categories ON value_categories.id = value_presets.category_id
                    ORDER BY
                        CASE WHEN value_categories.name IS NULL THEN 0 ELSE 1 END,
                        value_categories.name COLLATE NOCASE,
                        value_presets.name COLLATE NOCASE,
                        value_presets.id
                    """
                ).fetchall()
            return {"ok": True, "presets": [_preset_row(row) for row in rows]}
        finally:
            conn.close()


def list_value_categories() -> Dict:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT
                    value_categories.name AS name,
                    COUNT(value_presets.id) AS count
                FROM value_categories
                LEFT JOIN value_presets ON value_presets.category_id = value_categories.id
                GROUP BY value_categories.id
                ORDER BY value_categories.name COLLATE NOCASE
                """
            ).fetchall()
            uncategorised = conn.execute(
                "SELECT COUNT(*) AS c FROM value_presets WHERE category_id IS NULL"
            ).fetchone()["c"]
            categories = [{"name": row["name"], "count": int(row["count"] or 0)} for row in rows]
            return {
                "ok": True,
                "categories": categories,
                "uncategorised_count": int(uncategorised or 0),
                "uncategorised": UNCATEGORISED_NAME,
            }
        finally:
            conn.close()


def update_value_preset(
    preset_id: int,
    category: Optional[str] = None,
    fields=None,
    name: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict:
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                """
                SELECT value_presets.*, value_categories.name AS category
                FROM value_presets
                LEFT JOIN value_categories ON value_categories.id = value_presets.category_id
                WHERE value_presets.id = ?
                """,
                (int(preset_id),),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}

            next_fields = row["fields_json"]
            next_key = row["fields_key"]
            if fields is not None:
                parsed, error, next_key = canonicalize_fields(fields)
                if error:
                    conn.rollback()
                    return {"ok": False, "error": error}
                next_fields = fields_json(parsed)
            else:
                parsed, error, next_key = canonicalize_fields(row["fields_json"])
                if error:
                    conn.rollback()
                    return {"ok": False, "error": error}

            title = _normalize_preset_name(row["name"] if name is None else name)
            if not title:
                conn.rollback()
                return {"ok": False, "error": "Preset name is required"}

            try:
                current_notes = row["notes"] or ""
            except (KeyError, IndexError):
                current_notes = ""
            note = current_notes if notes is None else _normalize_notes(notes)

            category_id = row["category_id"]
            category_name = row["category"] or ""
            if category is not None:
                category_id, category_name = _get_or_create_category(conn, category)

            existing = _find_by_name(conn, category_id, title, exclude_id=int(preset_id))
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"category": category_name, "name": title}]}

            conn.execute(
                """
                UPDATE value_presets
                SET category_id = ?, name = ?, notes = ?, fields_json = ?, fields_key = ?,
                    updated_at = datetime('now')
                WHERE id = ?
                """,
                (category_id, title, note, next_fields, next_key, int(preset_id)),
            )
            if fields is not None:
                _upsert_fields_into_library(conn, parsed)
            conn.commit()
            return {
                "ok": True,
                "id": int(preset_id),
                "name": title,
                "notes": note,
                "fields": parsed,
                "category": category_name,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_value_preset(preset_id: int) -> Dict:
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("DELETE FROM value_presets WHERE id = ?", (int(preset_id),))
            conn.commit()
            if cur.rowcount == 0:
                return {"ok": False, "error": "Not found"}
            return {"ok": True}
        finally:
            conn.close()


def rename_value_category(name: str, new_name: str) -> Dict:
    old = _normalize_category(name)
    new = _normalize_category(new_name)
    if _is_uncategorised(old):
        return {"ok": False, "error": "Cannot rename Uncategorised"}
    if not new or _is_uncategorised(new):
        return {"ok": False, "error": "Invalid name"}
    if old.casefold() == new.casefold():
        return {"ok": True, "name": new}

    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id FROM value_categories WHERE name = ? COLLATE NOCASE",
                (old,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            existing = conn.execute(
                "SELECT id FROM value_categories WHERE name = ? COLLATE NOCASE",
                (new,),
            ).fetchone()
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"name": new}]}
            conn.execute(
                "UPDATE value_categories SET name = ? WHERE id = ?",
                (new, int(row["id"])),
            )
            conn.commit()
            return {"ok": True, "name": new}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_value_category(name: str) -> Dict:
    shelf = _normalize_category(name)
    if _is_uncategorised(shelf):
        return {"ok": False, "error": "Cannot delete Uncategorised"}

    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id FROM value_categories WHERE name = ? COLLATE NOCASE",
                (shelf,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM value_presets WHERE category_id = ?",
                (int(row["id"]),),
            ).fetchone()["c"]
            conn.execute("DELETE FROM value_categories WHERE id = ?", (int(row["id"]),))
            conn.commit()
            return {"ok": True, "deleted": int(count)}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def _get_or_create_field_category(conn, name: str) -> Tuple[Optional[int], str]:
    title = _normalize_category(name)
    if _is_uncategorised(title):
        return None, ""
    row = conn.execute(
        "SELECT id, name FROM value_field_categories WHERE name = ? COLLATE NOCASE",
        (title,),
    ).fetchone()
    if row:
        return int(row["id"]), row["name"]
    cur = conn.execute("INSERT INTO value_field_categories (name) VALUES (?)", (title,))
    return int(cur.lastrowid), title


def _field_def_row(row) -> Dict:
    typ = _normalize_type(row["type"]) or "FLOAT"
    min_v = row["min_value"]
    max_v = row["max_value"]
    step_v = row["step_value"]
    default_v = row["default_value"]
    try:
        notes = row["notes"] or ""
    except (KeyError, IndexError):
        notes = ""
    try:
        category = row["category"] or ""
    except (KeyError, IndexError):
        category = ""
    try:
        default_json = row["default_json"]
    except (KeyError, IndexError):
        default_json = None

    if typ == "BOOLEAN":
        default = bool(int(default_v or 0))
    elif typ == "STRING":
        default = _parse_string_list(default_json if default_json not in (None, "") else "")
    elif typ == "INT":
        default = int(default_v) if default_v is not None else 0
    else:
        default = float(default_v) if default_v is not None else 0.0

    return {
        "id": int(row["id"]),
        "name": row["name"] or "",
        "type": typ,
        "min": None if min_v is None else (int(min_v) if typ == "INT" else float(min_v)),
        "max": None if max_v is None else (int(max_v) if typ == "INT" else float(max_v)),
        "step": None if step_v is None else (int(step_v) if typ == "INT" else float(step_v)),
        "default": default,
        "notes": notes,
        "category": category,
    }


def _pack_field_def_defaults(parsed: Dict[str, Any]) -> Tuple[float, Optional[str]]:
    typ = parsed["type"]
    if typ == "BOOLEAN":
        return (1.0 if parsed["default"] else 0.0), None
    if typ == "STRING":
        return 0.0, json.dumps(parsed["default"], ensure_ascii=False, separators=(",", ":"))
    return float(parsed["default"]), None


def _canonicalize_field_def(payload: Dict) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    name = str(payload.get("name") or "").strip()
    if not name:
        return None, "Field name is required"
    if len(name) > 40:
        return None, "Field name is too long"
    typ = _normalize_type(payload.get("type"))
    if not typ:
        return None, "Type must be INT, FLOAT, BOOLEAN, or STRING"

    notes = _normalize_notes(payload.get("notes") or "")
    category = _normalize_category(payload.get("category") or "")
    default_raw = payload.get("default", payload.get("value", 0 if typ != "STRING" else ""))

    if typ == "BOOLEAN":
        return {
            "name": name,
            "type": typ,
            "min": 0.0,
            "max": 1.0,
            "step": 1.0,
            "default": _coerce_bool(default_raw),
            "notes": notes,
            "category": category,
        }, None

    if typ == "STRING":
        return {
            "name": name,
            "type": typ,
            "min": 0.0,
            "max": 0.0,
            "step": 1.0,
            "default": _parse_string_list(default_raw),
            "notes": notes,
            "category": category,
        }, None

    min_v = _coerce_bound(payload.get("min"), DEFAULT_MIN, typ)
    max_v = _coerce_bound(payload.get("max"), DEFAULT_MAX, typ)
    step_raw = payload.get("step")
    if step_raw is None or step_raw == "":
        step_v = _default_step(typ)
    else:
        try:
            step_v = float(step_raw)
        except (TypeError, ValueError):
            return None, "Invalid step"
        if not (step_v == step_v) or step_v <= 0:
            return None, "Step must be > 0"
        if typ == "INT":
            step_v = max(1.0, float(int(round(step_v))))
    try:
        number = float(default_raw)
    except (TypeError, ValueError):
        return None, "Invalid default"
    default_v = _clamp_value(number, typ, min_v, max_v)
    return {
        "name": name,
        "type": typ,
        "min": int(min_v) if typ == "INT" else float(min_v),
        "max": int(max_v) if typ == "INT" else float(max_v),
        "step": int(step_v) if typ == "INT" else float(step_v),
        "default": default_v,
        "notes": notes,
        "category": category,
    }, None


def list_value_field_defs() -> Dict:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT
                    value_field_defs.id,
                    value_field_defs.name,
                    value_field_defs.type,
                    value_field_defs.min_value,
                    value_field_defs.max_value,
                    value_field_defs.step_value,
                    value_field_defs.default_value,
                    value_field_defs.default_json,
                    value_field_defs.notes,
                    value_field_categories.name AS category
                FROM value_field_defs
                LEFT JOIN value_field_categories
                    ON value_field_categories.id = value_field_defs.category_id
                ORDER BY
                    CASE WHEN value_field_categories.name IS NULL THEN 0 ELSE 1 END,
                    value_field_categories.name COLLATE NOCASE,
                    value_field_defs.name COLLATE NOCASE
                """
            ).fetchall()
            return {"ok": True, "fields": [_field_def_row(row) for row in rows]}
        finally:
            conn.close()


def list_value_field_categories() -> Dict:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT
                    value_field_categories.name AS name,
                    COUNT(value_field_defs.id) AS count
                FROM value_field_categories
                LEFT JOIN value_field_defs ON value_field_defs.category_id = value_field_categories.id
                GROUP BY value_field_categories.id
                ORDER BY value_field_categories.name COLLATE NOCASE
                """
            ).fetchall()
            uncategorised = conn.execute(
                "SELECT COUNT(*) AS c FROM value_field_defs WHERE category_id IS NULL"
            ).fetchone()["c"]
            return {
                "ok": True,
                "categories": [{"name": row["name"], "count": int(row["count"] or 0)} for row in rows],
                "uncategorised_count": int(uncategorised or 0),
                "uncategorised": UNCATEGORISED_NAME,
            }
        finally:
            conn.close()


def save_value_field_def(payload: Dict) -> Dict:
    parsed, error = _canonicalize_field_def(payload or {})
    if error:
        return {"ok": False, "error": error}
    default_num, default_json = _pack_field_def_defaults(parsed)
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            existing = conn.execute(
                "SELECT id FROM value_field_defs WHERE name = ? COLLATE NOCASE",
                (parsed["name"],),
            ).fetchone()
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"name": parsed["name"]}]}
            category_id, category_name = _get_or_create_field_category(conn, parsed["category"])
            cur = conn.execute(
                """
                INSERT INTO value_field_defs
                    (category_id, name, type, min_value, max_value, step_value, default_value, default_json, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    parsed["name"],
                    parsed["type"],
                    parsed["min"],
                    parsed["max"],
                    parsed["step"],
                    default_num,
                    default_json,
                    parsed["notes"],
                ),
            )
            conn.commit()
            return {
                "ok": True,
                "field": {**parsed, "id": int(cur.lastrowid), "category": category_name},
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def upsert_value_field_def(payload: Dict) -> Dict:
    """Create or update a library field by name (used from node gear / save preset)."""
    parsed, error = _canonicalize_field_def(payload or {})
    if error:
        return {"ok": False, "error": error}
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            existing = conn.execute(
                "SELECT id, type FROM value_field_defs WHERE name = ? COLLATE NOCASE",
                (parsed["name"],),
            ).fetchone()
            category_id, category_name = _get_or_create_field_category(conn, parsed["category"])
            if existing:
                field_id = int(existing["id"])
                # Type is immutable after create — keep stored type.
                locked = _normalize_type(existing["type"]) or parsed["type"]
                if locked != parsed["type"]:
                    reparsed, re_err = _canonicalize_field_def({**payload, "type": locked})
                    if re_err or not reparsed:
                        conn.rollback()
                        return {"ok": False, "error": re_err or "Invalid field"}
                    parsed = reparsed
                default_num, default_json = _pack_field_def_defaults(parsed)
                conn.execute(
                    """
                    UPDATE value_field_defs
                    SET category_id = ?, name = ?, min_value = ?, max_value = ?, step_value = ?,
                        default_value = ?, default_json = ?, notes = ?, updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (
                        category_id,
                        parsed["name"],
                        parsed["min"],
                        parsed["max"],
                        parsed["step"],
                        default_num,
                        default_json,
                        parsed["notes"],
                        field_id,
                    ),
                )
                conn.commit()
                return {
                    "ok": True,
                    "updated": True,
                    "field": {**parsed, "id": field_id, "category": category_name},
                }
            default_num, default_json = _pack_field_def_defaults(parsed)
            cur = conn.execute(
                """
                INSERT INTO value_field_defs
                    (category_id, name, type, min_value, max_value, step_value, default_value, default_json, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    parsed["name"],
                    parsed["type"],
                    parsed["min"],
                    parsed["max"],
                    parsed["step"],
                    default_num,
                    default_json,
                    parsed["notes"],
                ),
            )
            conn.commit()
            return {
                "ok": True,
                "updated": False,
                "field": {**parsed, "id": int(cur.lastrowid), "category": category_name},
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def _upsert_fields_into_library(conn, fields: List[Dict[str, Any]]) -> None:
    for item in fields or []:
        parsed, error = _canonicalize_field_def(
            {
                "name": item.get("name"),
                "type": item.get("type"),
                "min": item.get("min"),
                "max": item.get("max"),
                "step": item.get("step"),
                "default": item.get("value", item.get("default", 0)),
                "category": item.get("category") or "",
                "notes": item.get("notes") or "",
            }
        )
        if error or not parsed:
            continue
        existing = conn.execute(
            """
            SELECT
                value_field_defs.id,
                value_field_defs.type,
                value_field_defs.category_id,
                value_field_defs.notes,
                value_field_categories.name AS category
            FROM value_field_defs
            LEFT JOIN value_field_categories
                ON value_field_categories.id = value_field_defs.category_id
            WHERE value_field_defs.name = ? COLLATE NOCASE
            """,
            (parsed["name"],),
        ).fetchone()
        if existing:
            locked = _normalize_type(existing["type"]) or parsed["type"]
            if locked != parsed["type"]:
                reparsed, re_err = _canonicalize_field_def({**item, "type": locked, "default": item.get("value")})
                if re_err or not reparsed:
                    continue
                parsed = reparsed
            category = parsed["category"] or (existing["category"] or "")
            notes = parsed["notes"] or (existing["notes"] or "")
            category_id, _category_name = _get_or_create_field_category(conn, category)
            default_num, default_json = _pack_field_def_defaults(parsed)
            conn.execute(
                """
                UPDATE value_field_defs
                SET category_id = ?, min_value = ?, max_value = ?, step_value = ?,
                    default_value = ?, default_json = ?, notes = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    category_id,
                    parsed["min"],
                    parsed["max"],
                    parsed["step"],
                    default_num,
                    default_json,
                    notes,
                    int(existing["id"]),
                ),
            )
        else:
            category_id, _category_name = _get_or_create_field_category(conn, parsed["category"])
            default_num, default_json = _pack_field_def_defaults(parsed)
            conn.execute(
                """
                INSERT INTO value_field_defs
                    (category_id, name, type, min_value, max_value, step_value, default_value, default_json, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    category_id,
                    parsed["name"],
                    parsed["type"],
                    parsed["min"],
                    parsed["max"],
                    parsed["step"],
                    default_num,
                    default_json,
                    parsed["notes"],
                ),
            )


def update_value_field_def(field_id: int, payload: Dict) -> Dict:
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id, type FROM value_field_defs WHERE id = ?",
                (int(field_id),),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            locked_type = _normalize_type(row["type"]) or "FLOAT"
            parsed, error = _canonicalize_field_def({**(payload or {}), "type": locked_type})
            if error or not parsed:
                conn.rollback()
                return {"ok": False, "error": error or "Invalid field"}
            existing = conn.execute(
                "SELECT id FROM value_field_defs WHERE name = ? COLLATE NOCASE AND id != ?",
                (parsed["name"], int(field_id)),
            ).fetchone()
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"name": parsed["name"]}]}
            category_id, category_name = _get_or_create_field_category(conn, parsed["category"])
            default_num, default_json = _pack_field_def_defaults(parsed)
            conn.execute(
                """
                UPDATE value_field_defs
                SET category_id = ?, name = ?, min_value = ?, max_value = ?, step_value = ?,
                    default_value = ?, default_json = ?, notes = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (
                    category_id,
                    parsed["name"],
                    parsed["min"],
                    parsed["max"],
                    parsed["step"],
                    default_num,
                    default_json,
                    parsed["notes"],
                    int(field_id),
                ),
            )
            conn.commit()
            return {
                "ok": True,
                "field": {**parsed, "id": int(field_id), "category": category_name},
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_value_field_def(field_id: int) -> Dict:
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("DELETE FROM value_field_defs WHERE id = ?", (int(field_id),))
            conn.commit()
            if cur.rowcount == 0:
                return {"ok": False, "error": "Not found"}
            return {"ok": True}
        finally:
            conn.close()


def rename_value_field_category(name: str, new_name: str) -> Dict:
    old = _normalize_category(name)
    new = _normalize_category(new_name)
    if _is_uncategorised(old):
        return {"ok": False, "error": "Cannot rename Uncategorised"}
    if not new or _is_uncategorised(new):
        return {"ok": False, "error": "Invalid name"}
    if old.casefold() == new.casefold():
        return {"ok": True, "name": new}
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id FROM value_field_categories WHERE name = ? COLLATE NOCASE",
                (old,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            existing = conn.execute(
                "SELECT id FROM value_field_categories WHERE name = ? COLLATE NOCASE",
                (new,),
            ).fetchone()
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"name": new}]}
            conn.execute(
                "UPDATE value_field_categories SET name = ? WHERE id = ?",
                (new, int(row["id"])),
            )
            conn.commit()
            return {"ok": True, "name": new}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_value_field_category(name: str) -> Dict:
    shelf = _normalize_category(name)
    if _is_uncategorised(shelf):
        return {"ok": False, "error": "Cannot delete Uncategorised"}
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id FROM value_field_categories WHERE name = ? COLLATE NOCASE",
                (shelf,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM value_field_defs WHERE category_id = ?",
                (int(row["id"]),),
            ).fetchone()["c"]
            conn.execute(
                "UPDATE value_field_defs SET category_id = NULL WHERE category_id = ?",
                (int(row["id"]),),
            )
            conn.execute("DELETE FROM value_field_categories WHERE id = ?", (int(row["id"]),))
            conn.commit()
            return {"ok": True, "moved": int(count)}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

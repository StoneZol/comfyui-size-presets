"""SQLite library for named INT/FLOAT field presets."""

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
ALLOWED_TYPES = ("INT", "FLOAT")


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
        name = str(item.get("name") or "").strip()
        if not name:
            return None, "Field name is required", ""
        if len(name) > 40:
            return None, "Field name is too long", ""
        key = name.casefold()
        if key in seen:
            return None, f"Duplicate field “{name}”", ""
        seen.add(key)
        typ = str(item.get("type") or "FLOAT").strip().upper()
        if typ not in ALLOWED_TYPES:
            return None, "Type must be INT or FLOAT", ""
        try:
            number = float(item.get("value", 0))
        except (TypeError, ValueError):
            return None, f"Invalid value for “{name}”", ""
        if not (number == number) or number in (float("inf"), float("-inf")):
            return None, f"Invalid value for “{name}”", ""
        value: Any = int(round(number)) if typ == "INT" else float(number)
        fields.append({"name": name, "type": typ, "value": value})

    key = "|".join(
        f"{f['name'].casefold()}:{f['type']}:{_key_number(f['type'], f['value'])}" for f in fields
    )
    return fields, None, key


def _key_number(typ: str, value: Any) -> str:
    if typ == "INT":
        return str(int(value))
    return f"{float(value):.6f}"


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


def _preset_row(row) -> Dict:
    try:
        fields = json.loads(row["fields_json"] or "[]")
    except json.JSONDecodeError:
        fields = []
    return {
        "id": int(row["id"]),
        "name": row["name"] or "",
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


def save_value_preset(category: str, fields, name: str = "") -> Dict:
    parsed, error, fields_key = canonicalize_fields(fields)
    if error:
        return {"ok": False, "error": error}
    title = _normalize_preset_name(name)
    if not title:
        return {"ok": False, "error": "Preset name is required"}

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
                INSERT INTO value_presets (category_id, name, fields_json, fields_key)
                VALUES (?, ?, ?, ?)
                """,
                (category_id, title, payload, fields_key),
            )
            conn.commit()
            return {"ok": True, "name": title, "fields": parsed, "category": category_name}
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
                SET category_id = ?, name = ?, fields_json = ?, fields_key = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (category_id, title, next_fields, next_key, int(preset_id)),
            )
            conn.commit()
            return {
                "ok": True,
                "id": int(preset_id),
                "name": title,
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

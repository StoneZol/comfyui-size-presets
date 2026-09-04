"""SQLite library for size presets grouped by category."""

from __future__ import annotations

import os
import sqlite3
import threading
from typing import Dict, List, Optional, Tuple

lock = threading.Lock()
_lock = lock

UNCATEGORISED_NAME = "Uncategorised"


def _db_path() -> str:
    directory = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(directory, exist_ok=True)
    return os.path.join(directory, "presets.sqlite")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path(), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    _migrate(conn)
    conn.commit()
    return conn


def _migrate(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL COLLATE NOCASE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(name)
        );

        CREATE TABLE IF NOT EXISTS size_presets (
            id INTEGER PRIMARY KEY,
            category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(category_id, width, height)
        );

        CREATE TABLE IF NOT EXISTS value_categories (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL COLLATE NOCASE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(name)
        );

        CREATE TABLE IF NOT EXISTS value_presets (
            id INTEGER PRIMARY KEY,
            category_id INTEGER REFERENCES value_categories(id) ON DELETE CASCADE,
            name TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            fields_json TEXT NOT NULL,
            fields_key TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS value_field_categories (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL COLLATE NOCASE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(name)
        );

        CREATE TABLE IF NOT EXISTS value_field_defs (
            id INTEGER PRIMARY KEY,
            category_id INTEGER REFERENCES value_field_categories(id) ON DELETE SET NULL,
            name TEXT NOT NULL COLLATE NOCASE,
            type TEXT NOT NULL,
            min_value REAL,
            max_value REAL,
            step_value REAL,
            default_value REAL NOT NULL DEFAULT 0,
            default_json TEXT,
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(name)
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_size_presets_category ON size_presets(category_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_value_presets_category ON value_presets(category_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_value_presets_key ON value_presets(category_id, fields_key)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_value_field_defs_name ON value_field_defs(name)")
    _migrate_value_extras(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_value_field_defs_category ON value_field_defs(category_id)")


def _migrate_value_extras(conn: sqlite3.Connection) -> None:
    preset_cols = {row[1] for row in conn.execute("PRAGMA table_info(value_presets)").fetchall()}
    if "name" not in preset_cols:
        conn.execute("ALTER TABLE value_presets ADD COLUMN name TEXT NOT NULL DEFAULT ''")
    if "notes" not in preset_cols:
        conn.execute("ALTER TABLE value_presets ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
    for row in conn.execute("SELECT id, name FROM value_presets").fetchall():
        title = (row["name"] or "").strip()
        if title:
            continue
        conn.execute("UPDATE value_presets SET name = ? WHERE id = ?", (f"Preset {int(row['id'])}", int(row["id"])))

    field_cols = {row[1] for row in conn.execute("PRAGMA table_info(value_field_defs)").fetchall()}
    if "category_id" not in field_cols:
        conn.execute("ALTER TABLE value_field_defs ADD COLUMN category_id INTEGER REFERENCES value_field_categories(id) ON DELETE SET NULL")
    if "notes" not in field_cols:
        conn.execute("ALTER TABLE value_field_defs ADD COLUMN notes TEXT NOT NULL DEFAULT ''")
    if "default_json" not in field_cols:
        conn.execute("ALTER TABLE value_field_defs ADD COLUMN default_json TEXT")
    # Old wide-open mins were -1e9; clamp defaults to 0 for new UX.
    conn.execute(
        """
        UPDATE value_field_defs
        SET min_value = 0
        WHERE min_value IS NOT NULL AND min_value < 0 AND min_value <= -100000000
        """
    )


def init_db() -> None:
    with _lock:
        conn = _connect()
        conn.close()


def _normalize_category(name: str) -> str:
    return (name or "").strip()


def _is_uncategorised(name: str) -> bool:
    return not name or name.casefold() == UNCATEGORISED_NAME.casefold()


def _get_or_create_category(conn: sqlite3.Connection, name: str) -> Tuple[Optional[int], str]:
    title = _normalize_category(name)
    if _is_uncategorised(title):
        return None, ""
    row = conn.execute(
        "SELECT id, name FROM categories WHERE name = ? COLLATE NOCASE",
        (title,),
    ).fetchone()
    if row:
        return int(row["id"]), row["name"]
    cur = conn.execute("INSERT INTO categories (name) VALUES (?)", (title,))
    return int(cur.lastrowid), title


def _preset_row(row: sqlite3.Row) -> Dict:
    return {
        "id": int(row["id"]),
        "width": int(row["width"]),
        "height": int(row["height"]),
        "category": row["category"] or "",
    }


def _validate_dimensions(width: int, height: int) -> Optional[str]:
    for label, value in (("width", width), ("height", height)):
        if value < 64:
            return f"{label} must be at least 64"
        if value > 8192:
            return f"{label} must be at most 8192"
    return None


def save_size_preset(
    category: str,
    width: int,
    height: int,
    overwrite: bool = False,
) -> Dict:
    dim_error = _validate_dimensions(int(width), int(height))
    if dim_error:
        return {"ok": False, "error": dim_error}

    w = int(width)
    h = int(height)

    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            category_id, category_name = _get_or_create_category(conn, category)

            if category_id is None:
                existing = conn.execute(
                    """
                    SELECT id FROM size_presets
                    WHERE category_id IS NULL AND width = ? AND height = ?
                    """,
                    (w, h),
                ).fetchone()
            else:
                existing = conn.execute(
                    """
                    SELECT id FROM size_presets
                    WHERE category_id = ? AND width = ? AND height = ?
                    """,
                    (category_id, w, h),
                ).fetchone()

            if existing and not overwrite:
                conn.rollback()
                return {
                    "ok": False,
                    "conflicts": [{"width": w, "height": h, "category": category_name}],
                }

            if existing:
                conn.execute(
                    """
                    UPDATE size_presets
                    SET updated_at = datetime('now')
                    WHERE id = ?
                    """,
                    (int(existing["id"]),),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO size_presets (category_id, width, height)
                    VALUES (?, ?, ?)
                    """,
                    (category_id, w, h),
                )
            conn.commit()
            return {"ok": True, "width": w, "height": h, "category": category_name}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def list_size_presets(category: str = "") -> Dict:
    shelf = _normalize_category(category)
    with _lock:
        conn = _connect()
        try:
            if shelf and not _is_uncategorised(shelf):
                rows = conn.execute(
                    """
                    SELECT
                        size_presets.id,
                        size_presets.width,
                        size_presets.height,
                        categories.name AS category
                    FROM size_presets
                    LEFT JOIN categories ON categories.id = size_presets.category_id
                    WHERE categories.name = ? COLLATE NOCASE
                    ORDER BY size_presets.width, size_presets.height
                    """,
                    (shelf,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT
                        size_presets.id,
                        size_presets.width,
                        size_presets.height,
                        categories.name AS category
                    FROM size_presets
                    LEFT JOIN categories ON categories.id = size_presets.category_id
                    ORDER BY
                        CASE WHEN categories.name IS NULL THEN 0 ELSE 1 END,
                        categories.name COLLATE NOCASE,
                        size_presets.width,
                        size_presets.height
                    """
                ).fetchall()
            return {"ok": True, "presets": [_preset_row(row) for row in rows]}
        finally:
            conn.close()


def list_categories() -> Dict:
    with _lock:
        conn = _connect()
        try:
            rows = conn.execute(
                """
                SELECT
                    categories.name AS name,
                    COUNT(size_presets.id) AS count
                FROM categories
                LEFT JOIN size_presets ON size_presets.category_id = categories.id
                GROUP BY categories.id
                ORDER BY categories.name COLLATE NOCASE
                """
            ).fetchall()
            uncategorised = conn.execute(
                "SELECT COUNT(*) AS c FROM size_presets WHERE category_id IS NULL"
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


def update_size_preset(
    preset_id: int,
    category: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    overwrite: bool = False,
) -> Dict:
    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                """
                SELECT size_presets.*, categories.name AS category
                FROM size_presets
                LEFT JOIN categories ON categories.id = size_presets.category_id
                WHERE size_presets.id = ?
                """,
                (int(preset_id),),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}

            next_w = int(row["width"]) if width is None else int(width)
            next_h = int(row["height"]) if height is None else int(height)
            dim_error = _validate_dimensions(next_w, next_h)
            if dim_error:
                conn.rollback()
                return {"ok": False, "error": dim_error}

            category_id = row["category_id"]
            category_name = row["category"] or ""
            if category is not None:
                category_id, category_name = _get_or_create_category(conn, category)

            if next_w != int(row["width"]) or next_h != int(row["height"]) or category_id != row["category_id"]:
                if category_id is None:
                    existing = conn.execute(
                        """
                        SELECT id FROM size_presets
                        WHERE category_id IS NULL AND width = ? AND height = ? AND id != ?
                        """,
                        (next_w, next_h, int(preset_id)),
                    ).fetchone()
                else:
                    existing = conn.execute(
                        """
                        SELECT id FROM size_presets
                        WHERE category_id = ? AND width = ? AND height = ? AND id != ?
                        """,
                        (category_id, next_w, next_h, int(preset_id)),
                    ).fetchone()
                if existing and not overwrite:
                    conn.rollback()
                    return {
                        "ok": False,
                        "conflicts": [{"width": next_w, "height": next_h, "category": category_name}],
                    }
                if existing and overwrite:
                    conn.execute("DELETE FROM size_presets WHERE id = ?", (int(existing["id"]),))

            conn.execute(
                """
                UPDATE size_presets
                SET category_id = ?, width = ?, height = ?, updated_at = datetime('now')
                WHERE id = ?
                """,
                (category_id, next_w, next_h, int(preset_id)),
            )
            conn.commit()
            return {
                "ok": True,
                "id": int(preset_id),
                "width": next_w,
                "height": next_h,
                "category": category_name,
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_size_preset(preset_id: int) -> Dict:
    with _lock:
        conn = _connect()
        try:
            cur = conn.execute("DELETE FROM size_presets WHERE id = ?", (int(preset_id),))
            conn.commit()
            if cur.rowcount == 0:
                return {"ok": False, "error": "Not found"}
            return {"ok": True}
        finally:
            conn.close()


def rename_category(name: str, new_name: str) -> Dict:
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
                "SELECT id FROM categories WHERE name = ? COLLATE NOCASE",
                (old,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            existing = conn.execute(
                "SELECT id FROM categories WHERE name = ? COLLATE NOCASE",
                (new,),
            ).fetchone()
            if existing:
                conn.rollback()
                return {"ok": False, "conflicts": [{"name": new}]}
            conn.execute(
                "UPDATE categories SET name = ? WHERE id = ?",
                (new, int(row["id"])),
            )
            conn.commit()
            return {"ok": True, "name": new}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def delete_category(name: str) -> Dict:
    shelf = _normalize_category(name)
    if _is_uncategorised(shelf):
        return {"ok": False, "error": "Cannot delete Uncategorised"}

    with _lock:
        conn = _connect()
        try:
            conn.execute("BEGIN")
            row = conn.execute(
                "SELECT id FROM categories WHERE name = ? COLLATE NOCASE",
                (shelf,),
            ).fetchone()
            if not row:
                conn.rollback()
                return {"ok": False, "error": "Not found"}
            count = conn.execute(
                "SELECT COUNT(*) AS c FROM size_presets WHERE category_id = ?",
                (int(row["id"]),),
            ).fetchone()["c"]
            conn.execute("DELETE FROM categories WHERE id = ?", (int(row["id"]),))
            conn.commit()
            return {"ok": True, "deleted": int(count)}
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

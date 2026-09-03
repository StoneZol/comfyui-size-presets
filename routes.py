"""HTTP routes for the Size Presets library."""

from aiohttp import web
from server import PromptServer

from . import db

SIZES_ROUTE = "/size_presets/sizes"
CATEGORIES_ROUTE = "/size_presets/categories"
VALUE_PRESETS_ROUTE = "/value_presets/presets"
VALUE_CATEGORIES_ROUTE = "/value_presets/categories"

db.init_db()


async def _read_json(request):
    try:
        payload = await request.json()
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


async def save_size_preset(request):
    payload = await _read_json(request)
    if payload is None:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.save_size_preset(
            payload.get("category") or "",
            int(payload.get("width") or 0),
            int(payload.get("height") or 0),
            overwrite=bool(payload.get("overwrite")),
        )
    except (TypeError, ValueError):
        return web.json_response({"ok": False, "error": "Invalid dimensions"}, status=400)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def list_size_presets(request):
    try:
        result = db.list_size_presets(request.query.get("category") or "")
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    return web.json_response(result)


async def update_size_preset(request):
    payload = await _read_json(request)
    if payload is None or not payload.get("id"):
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.update_size_preset(
            int(payload["id"]),
            category=payload["category"] if "category" in payload else None,
            width=int(payload["width"]) if "width" in payload else None,
            height=int(payload["height"]) if "height" in payload else None,
            overwrite=bool(payload.get("overwrite")),
        )
    except (TypeError, ValueError):
        return web.json_response({"ok": False, "error": "Invalid dimensions"}, status=400)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def delete_size_preset(request):
    preset_id = request.rel_url.query.get("id")
    if not preset_id:
        return web.json_response({"ok": False, "error": "Missing id"}, status=400)
    try:
        result = db.delete_size_preset(int(preset_id))
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 404 if result.get("error") == "Not found" else 400
    return web.json_response(result, status=status)


async def list_categories(request):
    try:
        result = db.list_categories()
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    return web.json_response(result)


async def update_category(request):
    payload = await _read_json(request)
    if payload is None:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.rename_category(payload.get("name") or "", payload.get("new_name") or "")
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def delete_category(request):
    name = request.rel_url.query.get("name") or ""
    try:
        result = db.delete_category(name)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 400
    return web.json_response(result, status=status)


_existing = {getattr(route, "path", None) for route in PromptServer.instance.routes}
if SIZES_ROUTE not in _existing:
    PromptServer.instance.routes.post(SIZES_ROUTE)(save_size_preset)
    PromptServer.instance.routes.get(SIZES_ROUTE)(list_size_presets)
    PromptServer.instance.routes.patch(SIZES_ROUTE)(update_size_preset)
    PromptServer.instance.routes.delete(SIZES_ROUTE)(delete_size_preset)
if CATEGORIES_ROUTE not in _existing:
    PromptServer.instance.routes.get(CATEGORIES_ROUTE)(list_categories)
    PromptServer.instance.routes.patch(CATEGORIES_ROUTE)(update_category)
    PromptServer.instance.routes.delete(CATEGORIES_ROUTE)(delete_category)


async def save_value_preset(request):
    payload = await _read_json(request)
    if payload is None:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.values.save_value_preset(
            payload.get("category") or "",
            payload.get("fields"),
            payload.get("name") or "",
        )
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def list_value_presets(request):
    try:
        result = db.values.list_value_presets(request.query.get("category") or "")
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    return web.json_response(result)


async def update_value_preset(request):
    payload = await _read_json(request)
    if payload is None or not payload.get("id"):
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.values.update_value_preset(
            int(payload["id"]),
            category=payload["category"] if "category" in payload else None,
            fields=payload["fields"] if "fields" in payload else None,
            name=payload["name"] if "name" in payload else None,
        )
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def delete_value_preset(request):
    preset_id = request.rel_url.query.get("id")
    if not preset_id:
        return web.json_response({"ok": False, "error": "Missing id"}, status=400)
    try:
        result = db.values.delete_value_preset(int(preset_id))
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 404 if result.get("error") == "Not found" else 400
    return web.json_response(result, status=status)


async def list_value_categories(request):
    try:
        result = db.values.list_value_categories()
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    return web.json_response(result)


async def update_value_category(request):
    payload = await _read_json(request)
    if payload is None:
        return web.json_response({"ok": False, "error": "Invalid JSON"}, status=400)
    try:
        result = db.values.rename_value_category(payload.get("name") or "", payload.get("new_name") or "")
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 409 if result.get("conflicts") else 400
    return web.json_response(result, status=status)


async def delete_value_category(request):
    name = request.rel_url.query.get("name") or ""
    try:
        result = db.values.delete_value_category(name)
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)
    status = 200 if result.get("ok") else 400
    return web.json_response(result, status=status)


if VALUE_PRESETS_ROUTE not in _existing:
    PromptServer.instance.routes.post(VALUE_PRESETS_ROUTE)(save_value_preset)
    PromptServer.instance.routes.get(VALUE_PRESETS_ROUTE)(list_value_presets)
    PromptServer.instance.routes.patch(VALUE_PRESETS_ROUTE)(update_value_preset)
    PromptServer.instance.routes.delete(VALUE_PRESETS_ROUTE)(delete_value_preset)
if VALUE_CATEGORIES_ROUTE not in _existing:
    PromptServer.instance.routes.get(VALUE_CATEGORIES_ROUTE)(list_value_categories)
    PromptServer.instance.routes.patch(VALUE_CATEGORIES_ROUTE)(update_value_category)
    PromptServer.instance.routes.delete(VALUE_CATEGORIES_ROUTE)(delete_value_category)

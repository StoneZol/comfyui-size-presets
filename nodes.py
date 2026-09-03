"""Size Presets nodes — size pairs and named INT/FLOAT values."""

from .db.values import MAX_FIELDS, canonicalize_fields


class AnyType(str):
    """Wildcard socket type so frontend INT/FLOAT labels control connections."""

    def __ne__(self, _other):
        return False


any_type = AnyType("*")


class SizePresets:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 8}),
                "height": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 8}),
            },
        }

    RETURN_TYPES = ("INT", "INT")
    RETURN_NAMES = ("width", "height")
    FUNCTION = "get_size"
    CATEGORY = "Size Presets"

    def get_size(self, width, height):
        return (width, height)


class ValuePresets:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "fields_json": ("STRING", {"default": '[{"name":"value","type":"FLOAT","value":0}]', "multiline": True}),
            },
        }

    RETURN_TYPES = tuple(any_type for _ in range(MAX_FIELDS))
    RETURN_NAMES = tuple(f"v{i + 1}" for i in range(MAX_FIELDS))
    FUNCTION = "get_values"
    CATEGORY = "Size Presets"

    @classmethod
    def IS_CHANGED(cls, fields_json):
        return fields_json

    def get_values(self, fields_json):
        parsed, error, _key = canonicalize_fields(fields_json)
        values = []
        if error or not parsed:
            parsed = []
        for i in range(MAX_FIELDS):
            if i < len(parsed):
                values.append(parsed[i]["value"])
            else:
                values.append(0.0)
        return tuple(values)


NODE_CLASS_MAPPINGS = {
    "SizePresets": SizePresets,
    "ValuePresets": ValuePresets,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SizePresets": "Size Presets",
    "ValuePresets": "Value Presets",
}

"""Size Presets — save and load width/height pairs from a local SQLite library."""


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


NODE_CLASS_MAPPINGS = {
    "SizePresets": SizePresets,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SizePresets": "Size Presets",
}

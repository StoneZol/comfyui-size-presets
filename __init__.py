from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import routes  # noqa: F401

# Tells ComfyUI where to find frontend JS/CSS for this custom node package.
# Files under ./js will be served at /extensions/<this-folder-name>/...
WEB_DIRECTORY = "./js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

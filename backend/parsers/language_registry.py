from typing import Dict
try:
    import tree_sitter_python as tspython
    import tree_sitter_javascript as tsjs
except ImportError:
    tspython = None
    tsjs = None

class LanguageRegistry:
    """Registry to map file extensions to tree-sitter language identifiers."""
    
    _EXTENSION_MAP = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
    }
    
    @classmethod
    def get_language_id(cls, extension: str) -> str:
        """Returns the language identifier for a given file extension."""
        return cls._EXTENSION_MAP.get(extension.lower())

    @classmethod
    def get_supported_languages(cls) -> Dict[str, str]:
        """Returns the dictionary of supported file extensions and their language IDs."""
        return cls._EXTENSION_MAP.copy()

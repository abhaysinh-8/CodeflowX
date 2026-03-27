from __future__ import annotations

import logging
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)


class LanguageRegistry:
    """Registry to map file extensions to tree-sitter language identifiers and parse code."""

    _EXTENSION_MAP: Dict[str, str] = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
    }

    @classmethod
    def get_language_id(cls, extension: str) -> Optional[str]:
        """Returns the language identifier for a given file extension."""
        return cls._EXTENSION_MAP.get(extension.lower())

    @classmethod
    def get_supported_languages(cls) -> Dict[str, str]:
        """Returns the dictionary of supported file extensions and their language IDs."""
        return cls._EXTENSION_MAP.copy()

    @classmethod
    def parse(cls, code: str, language: str) -> Optional[Any]:
        """
        Parse source code for any supported language using tree-sitter.

        This is the primary parse entry point. For Python it loads tree-sitter-python
        directly; for JS/TS/Java it delegates to GrammarLoader.

        Args:
            code: Source code string.
            language: Language identifier ('python', 'javascript', 'typescript', 'java').

        Returns:
            A tree_sitter.Tree object, or None if parsing failed.
        """
        try:
            from tree_sitter import Language as TSLanguage, Parser

            if language == "python":
                import tree_sitter_python as tspython  # type: ignore[import]
                lang = TSLanguage(tspython.language())
            elif language in ("javascript", "typescript"):
                # Delegate to GrammarLoader which handles JS/TS
                from backend.parsers.grammar_loader import load_grammar
                lang = load_grammar(language)
                if lang is None:
                    return None
            elif language == "java":
                from backend.parsers.grammar_loader import load_grammar
                lang = load_grammar(language)
                if lang is None:
                    return None
            else:
                logger.warning("Unsupported language: %s", language)
                return None

            parser = Parser(lang)
            return parser.parse(bytes(code, "utf8"))
        except ImportError as exc:
            logger.warning("tree-sitter grammar not installed: %s", exc)
            return None
        except Exception as exc:
            logger.error("Failed to parse %s code: %s", language, exc)
            return None

"""
CodeFlowX+ — Grammar Loader (Abhaysinh's backend responsibility)
================================================================
Loads Tree-sitter grammars for supported programming languages.
Currently implements TypeScript/JavaScript support and stubs for Java.

HOW TO ADD A NEW LANGUAGE (Contributor Guide)
---------------------------------------------
1. Install the tree-sitter grammar package:
   pip install tree-sitter-<language>
   e.g.: pip install tree-sitter-go

2. Register the language in GRAMMAR_REGISTRY below:
   'go': _load_go

3. Implement the loader function following the pattern of _load_typescript().

4. Add the language to SUPPORTED_LANGUAGES and PARTIAL_SUPPORT_LANGUAGES as needed.

5. Write tests in /tests/test_grammar_loader.py for the new grammar.
"""

from __future__ import annotations

import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Support Tiers
# ---------------------------------------------------------------------------
FULLY_SUPPORTED_LANGUAGES = {"python", "javascript", "typescript"}
PARTIALLY_SUPPORTED_LANGUAGES = {"java"}
ALL_SUPPORTED_LANGUAGES = FULLY_SUPPORTED_LANGUAGES | PARTIALLY_SUPPORTED_LANGUAGES


def _load_typescript() -> Optional[Any]:
    """
    Load the TypeScript/JavaScript Tree-sitter grammar.
    Requires: pip install tree-sitter-typescript
    Supports: TypeScript ES2020+, TSX, async/await, optional chaining,
              arrow functions, destructuring, generics.
    """
    try:
        import tree_sitter_typescript as tsts  # type: ignore[import]
        from tree_sitter import Language
        lang = Language(tsts.language_typescript())
        logger.info("TypeScript grammar loaded successfully.")
        return lang
    except ImportError:
        logger.warning(
            "tree-sitter-typescript not installed. "
            "Run: pip install tree-sitter-typescript"
        )
        return None
    except Exception as exc:
        logger.error("Failed to load TypeScript grammar: %s", exc)
        return None


def _load_javascript() -> Optional[Any]:
    """
    Load the JavaScript Tree-sitter grammar.
    Falls back to the TypeScript grammar package which bundles JS support.
    Supports: ES2020+, JSX, CommonJS and ESM imports, async/await.
    """
    try:
        import tree_sitter_javascript as tsjs  # type: ignore[import]
        from tree_sitter import Language
        lang = Language(tsjs.language())
        logger.info("JavaScript grammar loaded successfully.")
        return lang
    except ImportError:
        logger.warning(
            "tree-sitter-javascript not installed. "
            "Run: pip install tree-sitter-javascript"
        )
        # Attempt TypeScript package as fallback (bundles JS grammar)
        return _load_typescript()


def _load_java() -> Optional[Any]:
    """
    Java 11+ grammar loader.
    Requires: pip install tree-sitter-java

    Supports:
    - Classes, interfaces, enums
    - try-with-resources, try/catch/finally
    - Lambda expressions (Java 8+)
    - Records (Java 16+)
    - Sealed classes (Java 17+)
    """
    try:
        import tree_sitter_java as tsj  # type: ignore[import]
        from tree_sitter import Language
        lang = Language(tsj.language())
        logger.info("Java grammar loaded successfully.")
        return lang
    except ImportError:
        logger.warning(
            "tree-sitter-java not installed. "
            "Run: pip install tree-sitter-java"
        )
        return None
    except Exception as exc:
        logger.error("Failed to load Java grammar: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
GRAMMAR_REGISTRY: dict[str, Any] = {
    "typescript": _load_typescript,
    "javascript": _load_javascript,
    "java": _load_java,
    # Future languages (roadmap):
    # "go":   _load_go,
    # "rust": _load_rust,
    # "cpp":  _load_cpp,
    # "ruby": _load_ruby,
}


def load_grammar(language: str) -> Optional[Any]:
    """
    Load a Tree-sitter Language object for the given language identifier.

    Args:
        language: Language identifier string, e.g. 'python', 'typescript', 'java'.
                  Python is handled by the LanguageRegistry in Yash's parser module.

    Returns:
        A tree_sitter.Language object, or None if the grammar is unavailable.

    Raises:
        ValueError: If the language is completely unknown (not even stubbed).
    """
    if language == "python":
        # Python grammar is loaded directly via tree-sitter-python.
        try:
            import tree_sitter_python as tspython  # type: ignore[import]
            from tree_sitter import Language
            lang = Language(tspython.language())
            logger.info("Python grammar loaded successfully.")
            return lang
        except ImportError:
            logger.warning("tree-sitter-python not installed. Run: pip install tree-sitter-python")
            return None
        except Exception as exc:
            logger.error("Failed to load Python grammar: %s", exc)
            return None

    loader_fn = GRAMMAR_REGISTRY.get(language)
    if loader_fn is None:
        logger.warning("Unknown language '%s'. Supported: %s", language, sorted(ALL_SUPPORTED_LANGUAGES))
        return None
    return loader_fn()


def is_language_supported(language: str) -> bool:
    """Return True if the language has any level of grammar support."""
    return language in ALL_SUPPORTED_LANGUAGES


def get_support_level(language: str) -> str:
    """Return 'full', 'partial', or 'unsupported' for a given language."""
    if language in FULLY_SUPPORTED_LANGUAGES:
        return "full"
    if language in PARTIALLY_SUPPORTED_LANGUAGES:
        return "partial"
    return "unsupported"


# ---------------------------------------------------------------------------
# GrammarLoader Class — Backward Compatibility Wrapper
# ---------------------------------------------------------------------------
class GrammarLoader:
    """
    Class-based wrapper around function-based grammar loaders.
    Provides backward compatibility with existing main.py endpoints.
    """

    @classmethod
    def parse(cls, code: str, language: str) -> Optional[Any]:
        """
        Parse code using the appropriate grammar for the language.

        Args:
            code: Source code string
            language: Language identifier (e.g., 'python', 'typescript', 'javascript', 'java')

        Returns:
            A tree_sitter.Tree object, or None if grammar unavailable.
        """
        try:
            from tree_sitter import Parser
            lang = load_grammar(language)
            if lang is None:
                logger.warning("Grammar for '%s' is not available.", language)
                return None

            parser = Parser(lang)
            return parser.parse(bytes(code, "utf8"))
        except Exception as exc:
            logger.error("Failed to parse code with '%s' grammar: %s", language, exc)
            return None

    @classmethod
    def get_support_status(cls, language: str) -> str:
        """Get the support level for a language (full/partial/unsupported)."""
        return get_support_level(language)

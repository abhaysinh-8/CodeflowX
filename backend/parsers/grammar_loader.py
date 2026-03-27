from tree_sitter import Language, Parser
from typing import Optional, Any
import tree_sitter_python
import tree_sitter_javascript

class GrammarLoader:
    """Loader to initialize tree-sitter grammars and parse source code."""
    
    _languages = {
        "python": Language(tree_sitter_python.language()),
        "javascript": Language(tree_sitter_javascript.language()),
    }
    
    @classmethod
    def get_parser(cls, lang_id: str) -> Optional[Parser]:
        """Returns a tree-sitter Parser initialized for the specified language."""
        lang = cls._languages.get(lang_id.lower())
        if not lang:
            return None
        
        parser = Parser(lang)
        return parser

    @classmethod
    def parse(cls, code: str, lang_id: str) -> Optional[Any]:
        """Parses the given code using the grammar for the specified language."""
        parser = cls.get_parser(lang_id)
        if not parser:
            return None
        
        # In tree-sitter 0.22+, parse expects bytes
        tree = parser.parse(bytes(code, "utf8"))
        return tree

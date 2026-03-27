import pytest
from backend.parsers.grammar_loader import GrammarLoader
from backend.parsers.language_registry import LanguageRegistry

def test_language_registry():
    assert LanguageRegistry.get_language_id(".py") == "python"
    assert LanguageRegistry.get_language_id(".js") == "javascript"
    assert LanguageRegistry.get_language_id(".JSX") == "javascript"
    assert LanguageRegistry.get_language_id(".unknown") is None

def test_parse_python():
    code = "def hello():\n    print('world')"
    tree = GrammarLoader.parse(code, "python")
    assert tree is not None
    assert tree.root_node.type == "module"
    # In tree-sitter 0.22+, child count includes named and unnamed nodes
    # Let's check for function_definition in named children
    found_func = False
    for i in range(tree.root_node.child_count):
        if tree.root_node.child(i).type == "function_definition":
            found_func = True
            break
    assert found_func

def test_parse_javascript():
    code = "function hello() {\n    console.log('world');\n}"
    tree = GrammarLoader.parse(code, "javascript")
    assert tree is not None
    assert tree.root_node.type == "program"
    
    found_func = False
    for i in range(tree.root_node.child_count):
        if tree.root_node.child(i).type == "function_declaration":
            found_func = True
            break
    assert found_func

def test_unsupported_language():
    assert GrammarLoader.parse("print(1)", "cobol") is None

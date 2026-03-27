import pytest
from backend.parsers.grammar_loader import GrammarLoader
from backend.ir.transformer import ASTTransformer
from backend.ir.ir_node import IRNodeType
from backend.ir.utils import find_by_id, get_descendants

def test_python_ir_transformation():
    code = """
def add(a, b):
    return a + b

x = add(5, 3)
if x > 5:
    print("big")
"""
    tree = GrammarLoader.parse(code, "python")
    transformer = ASTTransformer("python", code)
    ir = transformer.transform(tree.root_node)
    
    assert ir is not None
    assert ir.language == "python"
    
    # Check for specific nodes
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    
    assert IRNodeType.FUNCTION_DEF in types
    assert IRNodeType.IF_STMT in types
    assert IRNodeType.CALL in types
    assert IRNodeType.ASSIGNMENT in types
    assert IRNodeType.RETURN in types

def test_deterministic_uuids():
    code = "def hello(): pass"
    
    # Transform twice
    tree1 = GrammarLoader.parse(code, "python")
    ir1 = ASTTransformer("python", code).transform(tree1.root_node)
    
    tree2 = GrammarLoader.parse(code, "python")
    ir2 = ASTTransformer("python", code).transform(tree2.root_node)
    
    assert ir1.id == ir2.id
    assert len(ir1.children) == len(ir2.children)
    for c1, c2 in zip(ir1.children, ir2.children):
        assert c1.id == c2.id

def test_js_ir_transformation():
    code = """
function main() {
    const x = 10;
    if (x > 5) {
        console.log("hi");
    }
}
"""
    tree = GrammarLoader.parse(code, "javascript")
    transformer = ASTTransformer("javascript", code)
    ir = transformer.transform(tree.root_node)
    
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    
    assert IRNodeType.FUNCTION_DEF in types
    assert IRNodeType.IF_STMT in types
    assert IRNodeType.ASSIGNMENT in types
    assert IRNodeType.CALL in types


def test_python_try_except_ir():
    code = """
def risky():
    try:
        result = 1 / 0
    except ZeroDivisionError:
        result = 0
    return result
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.TRY_EXCEPT in types, "TRY_EXCEPT node type missing from IR"


def test_python_class_def_ir():
    code = """
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        pass
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.CLASS_DEF in types, "CLASS_DEF node type missing from IR"
    assert IRNodeType.FUNCTION_DEF in types


def test_python_for_loop_ir():
    code = """
def total(items):
    s = 0
    for item in items:
        s += item
    return s
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.FOR_LOOP in types, "FOR_LOOP node type missing from IR"


def test_python_while_loop_ir():
    code = """
def countdown(n):
    while n > 0:
        n -= 1
    return n
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.WHILE_LOOP in types, "WHILE_LOOP node type missing from IR"


def test_js_arrow_function_ir():
    code = """
const greet = (name) => {
    return "Hello " + name;
};
"""
    tree = GrammarLoader.parse(code, "javascript")
    ir = ASTTransformer("javascript", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.FUNCTION_DEF in types or IRNodeType.ASSIGNMENT in types, \
        "Arrow function should map to FUNCTION_DEF or ASSIGNMENT"


def test_js_async_await_ir():
    code = """
async function fetchData(url) {
    const response = await fetch(url);
    return response.json();
}
"""
    tree = GrammarLoader.parse(code, "javascript")
    ir = ASTTransformer("javascript", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    types = [d.type for d in descendants]
    assert IRNodeType.FUNCTION_DEF in types, "async function should produce FUNCTION_DEF"
    assert IRNodeType.CALL in types or IRNodeType.RETURN in types


def test_ir_node_source_positions():
    """Verify source_start and source_end are captured on IR nodes."""
    code = "def foo():\n    return 1\n"
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    fn_nodes = [d for d in descendants if d.type == IRNodeType.FUNCTION_DEF]
    assert fn_nodes, "No FUNCTION_DEF nodes found"
    fn = fn_nodes[0]
    assert fn.source_start is not None and fn.source_start >= 0
    assert fn.source_end is not None and fn.source_end > fn.source_start


def test_find_by_id_utility():
    code = "def bar(): pass"
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    descendants = get_descendants(ir)
    if descendants:
        target = descendants[0]
        found = find_by_id(ir, target.id)
        assert found is not None
        assert found.id == target.id

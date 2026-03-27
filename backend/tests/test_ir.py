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

import pytest
from backend.ir.ir_node import IRNode, IRNodeType
from backend.modules.flowchart import FlowchartModule
from backend.parsers.grammar_loader import GrammarLoader
from backend.ir.transformer import ASTTransformer

def test_flowchart_sequential():
    # Create mock IR nodes
    node1 = IRNode(id="1", type=IRNodeType.ASSIGNMENT, language="python", name="x=1", source_start=0, source_end=3, children=[])
    node2 = IRNode(id="2", type=IRNodeType.ASSIGNMENT, language="python", name="y=2", source_start=4, source_end=7, children=[])
    root = IRNode(id="root", type=IRNodeType.BLOCK, language="python", name="root", source_start=0, source_end=7, children=[node1, node2])
    
    module = FlowchartModule()
    result = module.generate(root)
    
    assert len(result["nodes"]) == 4 # start, node1, node2, end
    assert len(result["edges"]) == 3 # start->node1, node1->node2, node2->end

def test_flowchart_shapes():
    module = FlowchartModule()
    assert module._get_shape(IRNodeType.IF_STMT) == "diamond"
    assert module._get_shape(IRNodeType.FUNCTION_DEF) == "rounded"
    assert module._get_shape(IRNodeType.ASSIGNMENT) == "rectangle"
    assert module._get_shape(IRNodeType.RETURN) == "parallelogram"

def test_flowchart_with_if():
    # if x > 0: print(x)
    cond = IRNode(id="cond", type=IRNodeType.OTHER, language="python", name="x > 0", source_start=3, source_end=8, children=[])
    print_call = IRNode(id="call", type=IRNodeType.CALL, language="python", name="print", source_start=10, source_end=15, children=[])
    then_block = IRNode(id="block", type=IRNodeType.BLOCK, language="python", name="block", source_start=10, source_end=15, children=[print_call])
    
    if_node = IRNode(id="if", type=IRNodeType.IF_STMT, language="python", name="if", source_start=0, source_end=15, children=[cond, then_block])
    root = IRNode(id="root", type=IRNodeType.BLOCK, language="python", name="root", source_start=0, source_end=15, children=[if_node])
    
    module = FlowchartModule()
    result = module.generate(root)
    
    # Needs to have the decision node and the call node
    node_labels = [n["data"]["label"] for n in result["nodes"]]
    assert "Condition?" in node_labels
    assert "CALL: print" in node_labels


def test_flowchart_traverses_nested_function_body():
    code = """
def add(a, b):
    x = a + b
    if x > 0:
        print(x)
    return x
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)

    module = FlowchartModule()
    result = module.generate(ir)

    labels = [n["data"]["label"] for n in result["nodes"]]
    assert any(lbl == "add" for lbl in labels), "Function node missing"
    assert "Assignment" in labels, "Nested assignment from function body missing"
    assert "Condition?" in labels, "Nested if from function body missing"
    assert "CALL: print" in labels, "Nested call from branch missing"
    assert "Return" in labels, "Nested return from function body missing"

    edge_labels = [e.get("label", "") for e in result["edges"]]
    assert "true" in edge_labels
    assert "false" in edge_labels


def test_flowchart_nodes_include_source_ranges_and_ir_links():
    code = "def f():\n    return 1\n"
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    result = FlowchartModule().generate(ir)

    function_nodes = [n for n in result["nodes"] if n["type"] == "function_def"]
    assert function_nodes, "Expected at least one function_def node"
    fn_data = function_nodes[0]["data"]
    assert fn_data.get("source_start") == 1
    assert fn_data.get("source_end") >= fn_data.get("source_start")
    assert fn_data.get("ir_node_id"), "Flowchart node should carry source IR node id"

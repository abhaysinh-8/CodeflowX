import pytest
from backend.ir.ir_node import IRNode, IRNodeType
from backend.modules.flowchart import FlowchartModule

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

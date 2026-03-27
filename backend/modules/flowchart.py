from typing import List, Dict, Any, Optional
from backend.ir.ir_node import IRNode, IRNodeType

class FlowchartModule:
    """Generates React Flow nodes and edges from an IR tree with branching support."""
    
    def __init__(self):
        self.nodes = []
        self.edges = []
        self.vertical_spacing = 100
        self.horizontal_spacing = 250

    def generate(self, ir_root: IRNode) -> Dict[str, Any]:
        self.nodes = []
        self.edges = []
        
        start_id = "start-node"
        self._add_node(start_id, "Start", "circle", 0, 0)
        
        # Traverse recursively starting from root
        last_id = self._traverse(ir_root.children, start_id, 0, self.vertical_spacing)
        
        end_id = "end-node"
        # Find the max Y to place the end node
        max_y = max([n["position"]["y"] for n in self.nodes]) if self.nodes else 0
        self._add_node(end_id, "End", "circle", 0, max_y + self.vertical_spacing)
        self._add_edge(last_id, end_id)
        
        return {
            "nodes": self.nodes,
            "edges": self.edges
        }

    def _traverse(self, ir_nodes: List[IRNode], prev_id: str, x: int, y: int) -> str:
        current_prev = prev_id
        current_y = y
        
        for node in ir_nodes:
            if node.type == IRNodeType.IF_STMT:
                current_prev, current_y = self._handle_if(node, current_prev, x, current_y)
            elif node.type == IRNodeType.FOR_LOOP or node.type == IRNodeType.WHILE_LOOP:
                current_prev, current_y = self._handle_loop(node, current_prev, x, current_y)
            elif node.type == IRNodeType.BLOCK:
                current_prev = self._traverse(node.children, current_prev, x, current_y)
                # Update current_y based on the last node in the block
                current_y = max([n["position"]["y"] for n in self.nodes]) + self.vertical_spacing
            else:
                node_id = f"node-{node.id}"
                label = self._get_label(node)
                shape = self._get_shape(node.type)
                self._add_node(node_id, label, shape, x, current_y)
                self._add_edge(current_prev, node_id)
                current_prev = node_id
                current_y += self.vertical_spacing
                
        return current_prev

    def _handle_if(self, node: IRNode, prev_id: str, x: int, y: int) -> tuple:
        decision_id = f"dec-{node.id}"
        self._add_node(decision_id, "Condition?", "diamond", x, y)
        self._add_edge(prev_id, decision_id)
        
        # Branches
        # simplified: True branch to the right, False branch downwards (or vice versa)
        true_y = y + self.vertical_spacing
        true_x = x + self.horizontal_spacing
        
        # Assume children[0] is condition, children[1] is then_block, children[2] is else_block
        last_true_id = decision_id
        if len(node.children) > 1:
             last_true_id = self._traverse([node.children[1]], decision_id, true_x, true_y)
             self._add_edge(decision_id, list(filter(lambda n: n["id"].startswith(f"node-{node.children[1].id}"), self.nodes))[0]["id"] if any(n["id"].startswith(f"node-{node.children[1].id}") for n in self.nodes) else last_true_id, "True")

        # Merge point
        merge_id = f"merge-{node.id}"
        next_y = max([n["position"]["y"] for n in self.nodes]) + self.vertical_spacing
        self._add_node(merge_id, "", "circle", x, next_y) # Invisible or small merge dot
        
        self._add_edge(decision_id, merge_id, "False")
        if last_true_id != decision_id:
            self._add_edge(last_true_id, merge_id)
            
        return merge_id, next_y + self.vertical_spacing

    def _handle_loop(self, node: IRNode, prev_id: str, x: int, y: int) -> tuple:
        loop_id = f"loop-{node.id}"
        self._add_node(loop_id, "Loop Start", "diamond", x, y)
        self._add_edge(prev_id, loop_id)
        
        # Loop body (simplified)
        body_y = y + self.vertical_spacing
        body_x = x + self.horizontal_spacing
        
        if len(node.children) > 1:
            last_body_id = self._traverse([node.children[1]], loop_id, body_x, body_y)
            self._add_edge(last_body_id, loop_id, "loop-back")
            
        return loop_id, y + self.vertical_spacing

    def _get_label(self, node: IRNode) -> str:
        if node.name:
            return f"{node.type.value.upper()}: {node.name}"
        return node.type.value.capitalize()

    def _get_shape(self, node_type: IRNodeType) -> str:
        if node_type in (IRNodeType.IF_STMT, IRNodeType.FOR_LOOP, IRNodeType.WHILE_LOOP):
            return "diamond"
        if node_type in (IRNodeType.FUNCTION_DEF, IRNodeType.CALL):
            return "rounded"
        if node_type == IRNodeType.RETURN:
            return "parallelogram"
        return "rectangle"

    def _add_node(self, node_id: str, label: str, shape: str, x: int, y: int):
        self.nodes.append({
            "id": node_id,
            "type": "custom",
            "data": {"label": label, "shape": shape},
            "position": {"x": x, "y": y}
        })

    def _add_edge(self, source: str, target: str, label: str = ""):
        self.edges.append({
            "id": f"e-{source}-{target}-{label}",
            "source": source,
            "target": target,
            "label": label,
            "animated": "loop-back" in label
        })

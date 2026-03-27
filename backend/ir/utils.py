from typing import List, Optional, Any
from backend.ir.ir_node import IRNode

def find_by_id(node: IRNode, node_id: str) -> Optional[IRNode]:
    """Finds a node by its UUID in the IR tree."""
    if node.id == node_id:
        return node
    
    for child in node.children:
        result = find_by_id(child, node_id)
        if result:
            return result
    return None

def get_descendants(node: IRNode) -> List[IRNode]:
    """Returns a flat list of all descendant nodes."""
    descendants = []
    for child in node.children:
        descendants.append(child)
        descendants.extend(get_descendants(child))
    return descendants

def get_ancestors(node: IRNode, root: IRNode) -> List[IRNode]:
    """Returns a list of ancestors from the given node up to the root."""
    # This requires a tree traversal to find the path
    path = _find_path(root, node.id)
    if path:
        # Path includes the node itself, so we remove it and reverse to get ancestors
        return path[:-1][::-1]
    return []

def _find_path(current: IRNode, target_id: str) -> Optional[List[IRNode]]:
    """Helper to find the path to a node ID."""
    if current.id == target_id:
        return [current]
    
    for child in current.children:
        path = _find_path(child, target_id)
        if path:
            return [current] + path
    return None

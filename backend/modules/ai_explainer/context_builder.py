from __future__ import annotations

from typing import Any, Dict, Iterable, List, Mapping, Optional


def build_context(explain_type: str, payload: Mapping[str, Any]) -> Dict[str, Any]:
    """
    Build the structured explain context contract:
    {
      "ir_node": {...},
      "source_code": "...",
      "execution_state": {...},
      "coverage": {...},
      "dependency": {...}
    }
    """

    source_code = str(payload.get("source_code") or "")
    ir_root = payload.get("ir") if isinstance(payload.get("ir"), dict) else None
    flow_nodes = _as_dict_list(payload.get("flow_nodes"))
    flow_edges = _as_dict_list(payload.get("flow_edges"))
    execution_steps = _as_dict_list(payload.get("execution_steps"))
    coverage = payload.get("coverage") if isinstance(payload.get("coverage"), dict) else {}
    dependency = payload.get("dependency") if isinstance(payload.get("dependency"), dict) else {}
    provided_execution_state = payload.get("execution_state") if isinstance(payload.get("execution_state"), dict) else {}

    target_id = _pick_target_id(explain_type, payload)
    ir_node = _resolve_ir_node(explain_type, payload, ir_root, flow_nodes, flow_edges)
    edge_context = _resolve_edge_context(payload, flow_edges, flow_nodes)
    coverage_context = _resolve_coverage_context(payload, coverage, flow_nodes)
    dependency_context = _resolve_dependency_context(payload, dependency)

    execution_state = provided_execution_state or _resolve_execution_state(
        explain_type=explain_type,
        payload=payload,
        execution_steps=execution_steps,
        flow_nodes=flow_nodes,
        edge_context=edge_context,
    )

    return {
        "explain_type": explain_type,
        "target_id": target_id,
        "ir_node": ir_node,
        "source_code": source_code,
        "execution_state": execution_state,
        "coverage": coverage_context,
        "dependency": dependency_context,
        "edge": edge_context,
        "follow_up": bool(payload.get("follow_up", False)),
        "previous_explanation": str(payload.get("previous_explanation") or ""),
        "user_note": str(payload.get("user_note") or ""),
    }


def _pick_target_id(explain_type: str, payload: Mapping[str, Any]) -> str:
    if explain_type == "node":
        return str(payload.get("ir_node_id") or "").strip()
    if explain_type == "edge":
        return str(payload.get("edge_id") or "").strip()
    if explain_type == "coverage":
        return str(payload.get("coverage_id") or payload.get("ir_node_id") or "").strip()
    if explain_type == "failure":
        if payload.get("ir_node_id"):
            return str(payload.get("ir_node_id")).strip()
        failed_ids = payload.get("failed_function_ids")
        if isinstance(failed_ids, list) and failed_ids:
            return str(failed_ids[0]).strip()
        return str(payload.get("failed_function_id") or "").strip()
    return ""


def _resolve_ir_node(
    explain_type: str,
    payload: Mapping[str, Any],
    ir_root: Optional[Dict[str, Any]],
    flow_nodes: List[Dict[str, Any]],
    flow_edges: List[Dict[str, Any]],
) -> Dict[str, Any]:
    ir_node_id = str(payload.get("ir_node_id") or "").strip()

    if explain_type == "edge":
        edge_id = str(payload.get("edge_id") or "").strip()
        edge = _find_by_id(flow_edges, edge_id)
        source_node = _find_by_id(flow_nodes, str(edge.get("source", ""))) if edge else {}
        target_node = _find_by_id(flow_nodes, str(edge.get("target", ""))) if edge else {}
        return {
            "edge_id": edge_id,
            "edge": edge,
            "source_node": source_node,
            "target_node": target_node,
        }

    if explain_type == "coverage":
        if not ir_node_id:
            ir_node_id = str(payload.get("coverage_id") or "").strip()

    if not ir_node_id and explain_type == "failure":
        ir_node_id = str(payload.get("failed_function_id") or "").strip()
        if not ir_node_id:
            failed_ids = payload.get("failed_function_ids")
            if isinstance(failed_ids, list) and failed_ids:
                ir_node_id = str(failed_ids[0]).strip()

    if ir_root and ir_node_id:
        hit = _find_ir_node(ir_root, ir_node_id)
        if hit:
            return hit

    # Fall back to flow-node metadata when raw IR tree is not provided.
    if ir_node_id:
        flow_hit = _find_flow_node_by_ir(flow_nodes, ir_node_id)
        if flow_hit:
            data = flow_hit.get("data", {}) if isinstance(flow_hit.get("data"), dict) else {}
            return {
                "id": ir_node_id,
                "type": str(flow_hit.get("type", "")),
                "name": data.get("name") or data.get("label"),
                "source_start": data.get("source_start"),
                "source_end": data.get("source_end"),
                "metadata": data.get("metadata", {}),
            }

    return {}


def _resolve_edge_context(
    payload: Mapping[str, Any],
    flow_edges: List[Dict[str, Any]],
    flow_nodes: List[Dict[str, Any]],
) -> Dict[str, Any]:
    edge_id = str(payload.get("edge_id") or "").strip()
    if not edge_id:
        return {}
    edge = _find_by_id(flow_edges, edge_id)
    if not edge:
        return {"edge_id": edge_id}
    source = _find_by_id(flow_nodes, str(edge.get("source", "")))
    target = _find_by_id(flow_nodes, str(edge.get("target", "")))
    return {
        "edge_id": edge_id,
        "edge": edge,
        "source": source,
        "target": target,
    }


def _resolve_coverage_context(
    payload: Mapping[str, Any],
    coverage: Dict[str, Any],
    flow_nodes: List[Dict[str, Any]],
) -> Dict[str, Any]:
    coverage_id = str(payload.get("coverage_id") or "").strip()
    ir_node_id = str(payload.get("ir_node_id") or "").strip()

    map_by_ir = coverage.get("coverage_node_coverage_map", {})
    map_by_node = coverage.get("node_coverage_map", {})
    if not isinstance(map_by_ir, dict):
        map_by_ir = {}
    if not isinstance(map_by_node, dict):
        map_by_node = {}

    flow_node = _find_flow_node_by_ir(flow_nodes, ir_node_id) if ir_node_id else {}
    flow_node_id = str(flow_node.get("id", "")) if flow_node else ""

    record: Dict[str, Any] = {}
    if coverage_id and coverage_id in map_by_ir:
        candidate = map_by_ir.get(coverage_id)
        if isinstance(candidate, dict):
            record = candidate
    elif ir_node_id and ir_node_id in map_by_ir:
        candidate = map_by_ir.get(ir_node_id)
        if isinstance(candidate, dict):
            record = candidate
    elif flow_node_id and flow_node_id in map_by_node:
        candidate = map_by_node.get(flow_node_id)
        if isinstance(candidate, dict):
            record = candidate
    elif coverage_id in map_by_node:
        candidate = map_by_node.get(coverage_id)
        if isinstance(candidate, dict):
            record = candidate

    return {
        "coverage_id": coverage_id or ir_node_id,
        "ir_node_id": ir_node_id,
        "flow_node_id": flow_node_id,
        "record": record,
        "summary": coverage.get("summary", {}),
    }


def _resolve_dependency_context(payload: Mapping[str, Any], dependency: Dict[str, Any]) -> Dict[str, Any]:
    if not dependency:
        return {}
    ir_node_id = str(payload.get("ir_node_id") or "").strip()
    nodes = dependency.get("nodes", [])
    edges = dependency.get("edges", [])
    if not isinstance(nodes, list):
        nodes = []
    if not isinstance(edges, list):
        edges = []

    if not ir_node_id:
        return {
            "graph_id": dependency.get("graph_id"),
            "nodes_count": len(nodes),
            "edges_count": len(edges),
        }

    matched_node: Dict[str, Any] = {}
    for item in nodes:
        if not isinstance(item, dict):
            continue
        if str(item.get("ir_node_id") or "").strip() == ir_node_id:
            matched_node = item
            break
    return {
        "graph_id": dependency.get("graph_id"),
        "node": matched_node,
        "nodes_count": len(nodes),
        "edges_count": len(edges),
    }


def _resolve_execution_state(
    *,
    explain_type: str,
    payload: Mapping[str, Any],
    execution_steps: List[Dict[str, Any]],
    flow_nodes: List[Dict[str, Any]],
    edge_context: Dict[str, Any],
) -> Dict[str, Any]:
    if not execution_steps:
        return {}

    explicit_index = payload.get("execution_step_index")
    if isinstance(explicit_index, int) and 0 <= explicit_index < len(execution_steps):
        return execution_steps[explicit_index]

    if explain_type == "edge":
        edge = edge_context.get("edge")
        if isinstance(edge, dict):
            source = str(edge.get("source", ""))
            target = str(edge.get("target", ""))
            for step in execution_steps:
                traversed = step.get("edge_traversed")
                if not isinstance(traversed, dict):
                    continue
                if str(traversed.get("from_id", "")) == source and str(traversed.get("to_id", "")) == target:
                    return step

    ir_node_id = str(payload.get("ir_node_id") or "").strip()
    if ir_node_id:
        candidate_flow_ids = {
            str(node.get("id", ""))
            for node in flow_nodes
            if isinstance(node, dict)
            and isinstance(node.get("data"), dict)
            and str(node["data"].get("ir_node_id", "")).strip() == ir_node_id
        }
        for step in reversed(execution_steps):
            active_node_id = str(step.get("active_node_id", ""))
            executing_ir = str(step.get("currently_executing_function_id", "")).strip()
            if active_node_id in candidate_flow_ids or executing_ir == ir_node_id:
                return step

    return execution_steps[-1]


def _find_ir_node(root: Dict[str, Any], target_id: str) -> Dict[str, Any]:
    stack: List[Dict[str, Any]] = [root]
    while stack:
        current = stack.pop()
        if str(current.get("id", "")).strip() == target_id:
            return current
        children = current.get("children", [])
        if isinstance(children, list):
            for child in reversed(children):
                if isinstance(child, dict):
                    stack.append(child)
    return {}


def _find_flow_node_by_ir(flow_nodes: Iterable[Dict[str, Any]], ir_node_id: str) -> Dict[str, Any]:
    for node in flow_nodes:
        data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
        if str(data.get("ir_node_id", "")).strip() == ir_node_id:
            return node
    return {}


def _find_by_id(items: Iterable[Dict[str, Any]], item_id: str) -> Dict[str, Any]:
    for item in items:
        if str(item.get("id", "")).strip() == item_id:
            return item
    return {}


def _as_dict_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


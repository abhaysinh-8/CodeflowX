from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from backend.ir.ir_node import IRNode, IRNodeType


@dataclass(frozen=True)
class ExitRef:
    """Represents an outgoing edge waiting to connect to the next node."""

    node_id: str
    label: str = ""
    source_handle: Optional[str] = None


class FlowchartModule:
    """
    Generates React Flow nodes/edges from IR with nested control-flow traversal.

    This version traverses function/class bodies and branching constructs so real
    source code produces full flowcharts instead of only top-level declarations.
    """

    _EMIT_TYPES = {
        IRNodeType.FUNCTION_DEF,
        IRNodeType.IF_STMT,
        IRNodeType.FOR_LOOP,
        IRNodeType.WHILE_LOOP,
        IRNodeType.RETURN,
        IRNodeType.CALL,
        IRNodeType.TRY_EXCEPT,
        IRNodeType.CLASS_DEF,
        IRNodeType.ASSIGNMENT,
    }

    _BLOCK_RAW_TYPES = {
        "block",
        "module",
        "program",
        "statement_block",
        "class_body",
    }

    _WRAPPER_RAW_TYPES = {
        "expression_statement",
        "else_clause",
        "elif_clause",
        "catch_clause",
        "except_clause",
        "finally_clause",
        "parenthesized_expression",
        "argument_list",
    }

    def __init__(self):
        self.nodes: List[Dict[str, Any]] = []
        self.edges: List[Dict[str, Any]] = []
        self.vertical_spacing = 100
        self.horizontal_spacing = 260
        self._lane_next_y: Dict[int, int] = {}
        self._node_lookup: Dict[str, Dict[str, Any]] = {}
        self._edge_keys: set[Tuple[str, str, str, Optional[str]]] = set()

    def generate(self, ir_root: IRNode) -> Dict[str, Any]:
        self.nodes = []
        self.edges = []
        self._lane_next_y = {}
        self._node_lookup = {}
        self._edge_keys = set()

        start_id = "start-node"
        self._add_node(
            node_id=start_id,
            node_type="terminal",
            label="Start",
            shape="circle",
            x=0,
            y=0,
            source_start=None,
            source_end=None,
            ir_node_id=None,
            extra_data={"terminal_type": "start"},
        )
        self._lane_next_y[0] = self.vertical_spacing

        root_nodes = self._extract_statement_nodes(ir_root.children)
        exits = self._build_sequence(root_nodes, [ExitRef(start_id)], x=0)

        end_id = "end-node"
        end_y = self._max_y() + self.vertical_spacing
        self._add_node(
            node_id=end_id,
            node_type="terminal",
            label="End",
            shape="circle",
            x=0,
            y=end_y,
            source_start=None,
            source_end=None,
            ir_node_id=None,
            extra_data={"terminal_type": "end"},
        )

        for outgoing in self._dedupe_exits(exits or [ExitRef(start_id)]):
            self._add_edge(
                source=outgoing.node_id,
                target=end_id,
                label=outgoing.label,
                source_handle=outgoing.source_handle,
            )

        return {"nodes": self.nodes, "edges": self.edges}

    def _build_sequence(
        self,
        nodes: Sequence[IRNode],
        incoming: List[ExitRef],
        x: int,
        first_label: str = "",
        first_source_handle: Optional[str] = None,
    ) -> List[ExitRef]:
        current_exits = incoming
        for idx, node in enumerate(nodes):
            entry_label = first_label if idx == 0 else ""
            entry_source_handle = first_source_handle if idx == 0 else None
            current_exits = self._build_node(
                node=node,
                incoming=current_exits,
                x=x,
                entry_label=entry_label,
                entry_source_handle=entry_source_handle,
            )
        return current_exits

    def _build_node(
        self,
        node: IRNode,
        incoming: List[ExitRef],
        x: int,
        entry_label: str = "",
        entry_source_handle: Optional[str] = None,
    ) -> List[ExitRef]:
        if node.type == IRNodeType.IF_STMT:
            return self._build_if(node, incoming, x, entry_label, entry_source_handle)
        if node.type in (IRNodeType.FOR_LOOP, IRNodeType.WHILE_LOOP):
            return self._build_loop(node, incoming, x, entry_label, entry_source_handle)
        if node.type == IRNodeType.TRY_EXCEPT:
            return self._build_try(node, incoming, x, entry_label, entry_source_handle)

        node_id = f"node-{node.id}"
        node_type = self._get_frontend_node_type(node.type)
        label = self._get_label(node)
        shape = self._get_shape(node.type)
        x_pos, y_pos = self._allocate_position(x)

        self._add_node(
            node_id=node_id,
            node_type=node_type,
            label=label,
            shape=shape,
            x=x_pos,
            y=y_pos,
            source_start=node.source_start,
            source_end=node.source_end,
            ir_node_id=node.id,
            extra_data={
                "name": node.name or None,
                "raw_type": node.metadata.get("raw_type"),
            },
        )
        self._connect_incoming(incoming, node_id, entry_label, entry_source_handle)

        if node.type in (IRNodeType.FUNCTION_DEF, IRNodeType.CLASS_DEF):
            body_nodes = self._extract_body_nodes(node)
            if body_nodes:
                body_x = x + (self.horizontal_spacing // 2 if node.type == IRNodeType.CLASS_DEF else 0)
                self._seed_lane(body_x, y_pos)
                return self._build_sequence(body_nodes, [ExitRef(node_id)], body_x)

        return [ExitRef(node_id)]

    def _build_if(
        self,
        node: IRNode,
        incoming: List[ExitRef],
        x: int,
        entry_label: str = "",
        entry_source_handle: Optional[str] = None,
    ) -> List[ExitRef]:
        decision_id = f"node-{node.id}"
        label = self._get_label(node) or "Condition?"
        condition_text = self._extract_condition_text(node) or node.name or "Condition"
        x_pos, y_pos = self._allocate_position(x)

        self._add_node(
            node_id=decision_id,
            node_type="if_stmt",
            label=label,
            shape="diamond",
            x=x_pos,
            y=y_pos,
            source_start=node.source_start,
            source_end=node.source_end,
            ir_node_id=node.id,
            extra_data={"condition": condition_text},
        )
        self._connect_incoming(incoming, decision_id, entry_label, entry_source_handle)

        then_nodes, else_nodes = self._split_if_branches(node)
        then_x = x - self.horizontal_spacing
        else_x = x + self.horizontal_spacing
        self._seed_lane(then_x, y_pos)
        self._seed_lane(else_x, y_pos)

        if then_nodes:
            then_exits = self._build_sequence(
                then_nodes,
                [ExitRef(decision_id)],
                then_x,
                first_label="true",
                first_source_handle="true",
            )
        else:
            then_exits = [ExitRef(decision_id, label="true", source_handle="true")]

        if else_nodes:
            else_exits = self._build_sequence(
                else_nodes,
                [ExitRef(decision_id)],
                else_x,
                first_label="false",
                first_source_handle="false",
            )
        else:
            else_exits = [ExitRef(decision_id, label="false", source_handle="false")]

        return self._dedupe_exits([*then_exits, *else_exits])

    def _build_loop(
        self,
        node: IRNode,
        incoming: List[ExitRef],
        x: int,
        entry_label: str = "",
        entry_source_handle: Optional[str] = None,
    ) -> List[ExitRef]:
        loop_id = f"node-{node.id}"
        label = self._get_label(node)
        node_type = "for_loop" if node.type == IRNodeType.FOR_LOOP else "while_loop"
        x_pos, y_pos = self._allocate_position(x)

        self._add_node(
            node_id=loop_id,
            node_type=node_type,
            label=label,
            shape="diamond",
            x=x_pos,
            y=y_pos,
            source_start=node.source_start,
            source_end=node.source_end,
            ir_node_id=node.id,
            extra_data={},
        )
        self._connect_incoming(incoming, loop_id, entry_label, entry_source_handle)

        body_nodes = self._extract_loop_body(node)
        if body_nodes:
            body_x = x - self.horizontal_spacing
            self._seed_lane(body_x, y_pos)
            body_exits = self._build_sequence(
                body_nodes,
                [ExitRef(loop_id)],
                body_x,
                first_label="loop",
                first_source_handle="loop",
            )
            for exit_ref in self._dedupe_exits(body_exits):
                self._add_edge(
                    source=exit_ref.node_id,
                    target=loop_id,
                    label="loop-back",
                    source_handle=exit_ref.source_handle,
                )

        return [ExitRef(loop_id, label="false", source_handle="exit")]

    def _build_try(
        self,
        node: IRNode,
        incoming: List[ExitRef],
        x: int,
        entry_label: str = "",
        entry_source_handle: Optional[str] = None,
    ) -> List[ExitRef]:
        try_id = f"node-{node.id}"
        x_pos, y_pos = self._allocate_position(x)

        self._add_node(
            node_id=try_id,
            node_type="try_except",
            label=self._get_label(node),
            shape="rectangle",
            x=x_pos,
            y=y_pos,
            source_start=node.source_start,
            source_end=node.source_end,
            ir_node_id=node.id,
            extra_data={},
        )
        self._connect_incoming(incoming, try_id, entry_label, entry_source_handle)

        try_body, fault_branches = self._split_try_branches(node)
        normal_x = x - (self.horizontal_spacing // 2)
        fault_x = x + self.horizontal_spacing
        self._seed_lane(normal_x, y_pos)
        self._seed_lane(fault_x, y_pos)

        if try_body:
            normal_exits = self._build_sequence(
                try_body,
                [ExitRef(try_id)],
                normal_x,
                first_source_handle="exit",
            )
        else:
            normal_exits = [ExitRef(try_id, source_handle="exit")]

        fault_exits: List[ExitRef] = []
        for branch in fault_branches:
            if not branch:
                continue
            branch_exits = self._build_sequence(
                branch,
                [ExitRef(try_id)],
                fault_x,
                first_label="fault",
                first_source_handle="fault",
            )
            fault_exits.extend(branch_exits)

        return self._dedupe_exits([*normal_exits, *fault_exits])

    def _connect_incoming(
        self,
        incoming: List[ExitRef],
        target_id: str,
        entry_label: str = "",
        entry_source_handle: Optional[str] = None,
    ) -> None:
        for source_ref in self._dedupe_exits(incoming):
            label = entry_label if entry_label else source_ref.label
            source_handle = (
                entry_source_handle
                if entry_source_handle is not None
                else source_ref.source_handle
            )
            self._add_edge(
                source=source_ref.node_id,
                target=target_id,
                label=label,
                source_handle=source_handle,
            )

    def _extract_body_nodes(self, node: IRNode) -> List[IRNode]:
        body_nodes: List[IRNode] = []
        for child in node.children:
            raw = self._raw_type(child)
            if child.type == IRNodeType.BLOCK or raw in self._BLOCK_RAW_TYPES:
                body_nodes.extend(self._extract_statement_nodes(child.children))

        if body_nodes:
            return self._dedupe_ir_nodes(body_nodes)

        for child in node.children:
            raw = self._raw_type(child)
            if raw in {"identifier", "parameters", "formal_parameters", "type_parameters"}:
                continue
            body_nodes.extend(self._flatten_statement_node(child))
        return self._dedupe_ir_nodes(body_nodes)

    def _extract_loop_body(self, node: IRNode) -> List[IRNode]:
        blocks = [
            child
            for child in node.children
            if child.type == IRNodeType.BLOCK or self._raw_type(child) in self._BLOCK_RAW_TYPES
        ]
        if blocks:
            return self._dedupe_ir_nodes(
                self._extract_statement_nodes(blocks[0].children)
            )

        if len(node.children) > 1:
            return self._dedupe_ir_nodes(
                self._extract_statement_nodes(node.children[1:])
            )
        return []

    def _split_if_branches(self, node: IRNode) -> Tuple[List[IRNode], List[IRNode]]:
        then_nodes: List[IRNode] = []
        else_nodes: List[IRNode] = []

        blocks = [
            child
            for child in node.children
            if child.type == IRNodeType.BLOCK or self._raw_type(child) in self._BLOCK_RAW_TYPES
        ]
        if blocks:
            then_nodes = self._extract_statement_nodes(blocks[0].children)
            if len(blocks) > 1:
                else_nodes = self._extract_statement_nodes(blocks[1].children)

        for child in node.children:
            raw = self._raw_type(child)
            if raw in {"else_clause", "elif_clause"}:
                else_nodes.extend(self._extract_statement_nodes(child.children))

        if not then_nodes and len(node.children) > 1:
            then_nodes = self._extract_statement_nodes([node.children[1]])
        if not else_nodes and len(node.children) > 2:
            else_nodes = self._extract_statement_nodes([node.children[2]])

        return self._dedupe_ir_nodes(then_nodes), self._dedupe_ir_nodes(else_nodes)

    def _split_try_branches(self, node: IRNode) -> Tuple[List[IRNode], List[List[IRNode]]]:
        try_body: List[IRNode] = []
        fault_branches: List[List[IRNode]] = []
        first_block_used = False

        for child in node.children:
            raw = self._raw_type(child)
            if child.type == IRNodeType.BLOCK or raw in self._BLOCK_RAW_TYPES:
                if not first_block_used:
                    try_body.extend(self._extract_statement_nodes(child.children))
                    first_block_used = True
                else:
                    fault_branches.append(self._extract_statement_nodes(child.children))
                continue

            if raw in {"except_clause", "catch_clause"}:
                fault = self._extract_statement_nodes(child.children)
                if fault:
                    fault_branches.append(fault)
                continue

            if raw == "finally_clause":
                try_body.extend(self._extract_statement_nodes(child.children))

        return self._dedupe_ir_nodes(try_body), [self._dedupe_ir_nodes(b) for b in fault_branches]

    def _extract_statement_nodes(self, nodes: Sequence[IRNode]) -> List[IRNode]:
        extracted: List[IRNode] = []
        for node in nodes:
            extracted.extend(self._flatten_statement_node(node))
        return self._dedupe_ir_nodes(extracted)

    def _flatten_statement_node(self, node: IRNode) -> List[IRNode]:
        if node.type in self._EMIT_TYPES:
            return [node]

        raw = self._raw_type(node)
        if node.type == IRNodeType.BLOCK or raw in self._BLOCK_RAW_TYPES or raw in self._WRAPPER_RAW_TYPES:
            return self._extract_statement_nodes(node.children)

        flattened: List[IRNode] = []
        for child in node.children:
            flattened.extend(self._flatten_statement_node(child))
        return flattened

    def _dedupe_ir_nodes(self, nodes: Sequence[IRNode]) -> List[IRNode]:
        seen: set[str] = set()
        deduped: List[IRNode] = []
        for node in nodes:
            if node.id in seen:
                continue
            seen.add(node.id)
            deduped.append(node)
        return deduped

    def _dedupe_exits(self, exits: Sequence[ExitRef]) -> List[ExitRef]:
        seen: set[Tuple[str, str, Optional[str]]] = set()
        deduped: List[ExitRef] = []
        for exit_ref in exits:
            key = (exit_ref.node_id, exit_ref.label, exit_ref.source_handle)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(exit_ref)
        return deduped

    def _allocate_position(self, x: int) -> Tuple[int, int]:
        y = self._lane_next_y.get(x, self.vertical_spacing)
        self._lane_next_y[x] = y + self.vertical_spacing
        return x, y

    def _seed_lane(self, x: int, from_y: int) -> None:
        min_y = from_y + self.vertical_spacing
        current = self._lane_next_y.get(x, self.vertical_spacing)
        if current < min_y:
            self._lane_next_y[x] = min_y

    def _max_y(self) -> int:
        if not self.nodes:
            return 0
        return max(node["position"]["y"] for node in self.nodes)

    def _raw_type(self, node: IRNode) -> str:
        raw = node.metadata.get("raw_type")
        return str(raw) if raw is not None else ""

    def _extract_condition_text(self, node: IRNode) -> str:
        if not node.children:
            return ""
        first = node.children[0]
        if first.name:
            return first.name
        raw = self._raw_type(first)
        if raw in {"comparison_operator", "binary_expression", "parenthesized_expression"}:
            return "Condition?"
        return ""

    def _get_label(self, node: IRNode) -> str:
        if node.type == IRNodeType.IF_STMT:
            return "Condition?"
        if node.type == IRNodeType.TRY_EXCEPT:
            return "try / catch"
        if node.type == IRNodeType.RETURN:
            return "Return"
        if node.type == IRNodeType.ASSIGNMENT:
            return "Assignment"
        if node.type == IRNodeType.CLASS_DEF:
            return f"class {node.name}" if node.name else "Class"
        if node.type == IRNodeType.FUNCTION_DEF:
            return node.name if node.name else "Function"
        if node.type == IRNodeType.CALL:
            return f"CALL: {node.name}" if node.name else "Call"
        if node.name:
            return f"{node.type.value.upper()}: {node.name}"
        return node.type.value.replace("_", " ").capitalize()

    def _get_shape(self, node_type: IRNodeType) -> str:
        if node_type in (IRNodeType.IF_STMT, IRNodeType.FOR_LOOP, IRNodeType.WHILE_LOOP):
            return "diamond"
        if node_type in (IRNodeType.FUNCTION_DEF, IRNodeType.CLASS_DEF, IRNodeType.CALL):
            return "rounded"
        if node_type == IRNodeType.RETURN:
            return "parallelogram"
        if node_type == IRNodeType.TRY_EXCEPT:
            return "rectangle"
        return "rectangle"

    def _get_frontend_node_type(self, node_type: IRNodeType) -> str:
        mapping = {
            IRNodeType.FUNCTION_DEF: "function_def",
            IRNodeType.IF_STMT: "if_stmt",
            IRNodeType.FOR_LOOP: "for_loop",
            IRNodeType.WHILE_LOOP: "while_loop",
            IRNodeType.CALL: "call",
            IRNodeType.TRY_EXCEPT: "try_except",
        }
        return mapping.get(node_type, "custom")

    def _add_node(
        self,
        node_id: str,
        node_type: str,
        label: str,
        shape: str,
        x: int,
        y: int,
        source_start: Optional[int],
        source_end: Optional[int],
        ir_node_id: Optional[str],
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        if node_id in self._node_lookup:
            return

        data: Dict[str, Any] = {
            "label": label,
            "shape": shape,
            "source_start": source_start,
            "source_end": source_end,
            "ir_node_id": ir_node_id,
        }
        if extra_data:
            for key, value in extra_data.items():
                if value is not None:
                    data[key] = value

        node = {
            "id": node_id,
            "type": node_type,
            "data": data,
            "position": {"x": x, "y": y},
        }
        self.nodes.append(node)
        self._node_lookup[node_id] = node

    def _add_edge(
        self,
        source: str,
        target: str,
        label: str = "",
        source_handle: Optional[str] = None,
    ) -> None:
        key = (source, target, label, source_handle)
        if key in self._edge_keys:
            return
        self._edge_keys.add(key)

        edge_id = f"e-{len(self.edges) + 1}-{source}-{target}"
        if label:
            edge_id = f"{edge_id}-{label.replace(' ', '_')}"

        edge: Dict[str, Any] = {
            "id": edge_id,
            "source": source,
            "target": target,
            "label": label,
            "animated": label in {"loop-back", "fault"},
        }
        if source_handle:
            edge["sourceHandle"] = source_handle

        self.edges.append(edge)

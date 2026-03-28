from __future__ import annotations

import ast
import asyncio
import copy
import json
import os
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional, Sequence, Tuple

from fastapi import WebSocket
from pydantic import BaseModel, Field

from backend.ir.ir_node import IRNode, IRNodeType

try:  # Optional Celery wiring for long-running execution jobs.
    from celery import Celery
except Exception:  # pragma: no cover - Celery is optional in local dev/tests.
    Celery = None  # type: ignore[assignment]


CELERY_APP = None
if Celery is not None:
    _celery_broker = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL")
    _celery_backend = os.getenv("CELERY_RESULT_BACKEND") or _celery_broker
    if _celery_broker and _celery_backend:
        CELERY_APP = Celery(
            "codeflowx_execution",
            broker=_celery_broker,
            backend=_celery_backend,
        )

CELERY_EXECUTION_TASK_NAME = "codeflowx.execution.generate_steps"


VariableType = Literal["int", "str", "list", "dict", "bool", "NoneType"]
VariableScope = Literal["local", "global"]
VariableChangeType = Literal["added", "changed", "removed", "unchanged"]
BranchType = Literal["true", "false", "loop", "exception"]
AnimationHint = Literal["forward", "backtrack", "exception"]


class VariableState(BaseModel):
    value: Any
    type: VariableType
    scope: VariableScope
    prev_value: Any | None = None
    change_type: VariableChangeType = "unchanged"


class CallStackFrame(BaseModel):
    function_name: str
    file: str
    source_line: int
    ir_node_id: str


class EdgeTraversal(BaseModel):
    from_id: str
    to_id: str
    label: str = ""


class ExecutionStep(BaseModel):
    step_id: int
    active_node_id: str
    currently_executing_function_id: str | None = None
    prev_node_id: str | None = None
    variables: Dict[str, VariableState] = Field(default_factory=dict)
    call_stack: List[CallStackFrame] = Field(default_factory=list)
    branch_taken: BranchType | None = None
    loop_counts: Dict[str, int] = Field(default_factory=dict)
    edge_traversed: EdgeTraversal
    animation_hint: AnimationHint = "forward"


class BreakpointHit(BaseModel):
    node_id: str
    step_id: int
    hit_count: int
    timestamp_ms: int


@dataclass
class _RuntimeFrame:
    scope: VariableScope
    function_name: str
    ir_node_id: str
    source_line: int
    file: str
    variables: Dict[str, Any] = field(default_factory=dict)


class ExecutionInterpreter:
    """
    IR-driven execution simulator.

    The engine intentionally does not execute user code. It traverses the IR tree
    and applies lightweight symbolic/literal evaluation to build deterministic
    execution steps for visualization.
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
        "arguments",
    }

    def __init__(
        self,
        ir_root: IRNode,
        source_code: str = "",
        file: str = "main",
        step_limit: int | None = None,
        call_resolution_map: Optional[Dict[str, Dict[str, Any]]] = None,
    ):
        self.ir_root = ir_root
        self.source_code = source_code
        self.source_bytes = source_code.encode("utf8") if source_code else b""
        self.file = file
        self.step_limit = step_limit

        self.steps: List[ExecutionStep] = []
        self._next_step_id = 1
        self._prev_node_id = "start-node"
        self._loop_counts: Dict[str, int] = {}
        self._last_snapshot: Dict[str, Dict[str, Any]] = {}
        self._max_call_depth = 24
        self._max_loop_iterations = 16
        self.call_resolution_map: Dict[str, Dict[str, Any]] = call_resolution_map or {}

        self._frames: List[_RuntimeFrame] = [
            _RuntimeFrame(
                scope="global",
                function_name="global",
                ir_node_id=ir_root.id,
                source_line=max(1, ir_root.source_start),
                file=file,
                variables={},
            )
        ]
        self._call_stack: List[CallStackFrame] = []
        self._is_returning = False
        self._last_return_value: Any = None

        self._function_index: Dict[str, IRNode] = {}
        self._function_index_by_id: Dict[str, IRNode] = {}
        self._index_functions(ir_root)

    def generate_steps(self) -> List[ExecutionStep]:
        root_nodes = self._extract_statement_nodes(self.ir_root.children)
        self._execute_sequence(root_nodes, first_edge_label="")
        return self.steps

    def _execute_sequence(self, nodes: Sequence[IRNode], first_edge_label: str = "") -> None:
        edge_label = first_edge_label
        for idx, node in enumerate(nodes):
            if self._should_stop():
                break
            if self._is_returning:
                break
            entry_label = edge_label if idx == 0 else ""
            edge_label = self._execute_node(node, entry_label=entry_label) or ""

    def _execute_node(self, node: IRNode, entry_label: str = "") -> str:
        if node.type == IRNodeType.ASSIGNMENT:
            self._apply_assignment(node)
            self._emit_step(node, edge_label=entry_label)
            return ""

        if node.type == IRNodeType.CALL:
            self._emit_step(node, edge_label=entry_label)
            self._execute_call(node)
            return ""

        if node.type == IRNodeType.RETURN:
            self._last_return_value = self._extract_return_value(node)
            self._emit_step(node, edge_label=entry_label)
            self._is_returning = True
            return ""

        if node.type == IRNodeType.FUNCTION_DEF:
            self._function_index[node.name] = node
            self._emit_step(node, edge_label=entry_label)
            return ""

        if node.type == IRNodeType.CLASS_DEF:
            self._emit_step(node, edge_label=entry_label)
            for child in self._extract_body_nodes(node):
                if child.type == IRNodeType.FUNCTION_DEF and child.name:
                    self._function_index[child.name] = child
            return ""

        if node.type == IRNodeType.IF_STMT:
            return self._execute_if(node, entry_label=entry_label)

        if node.type in {IRNodeType.FOR_LOOP, IRNodeType.WHILE_LOOP}:
            return self._execute_loop(node, entry_label=entry_label)

        if node.type == IRNodeType.TRY_EXCEPT:
            return self._execute_try(node, entry_label=entry_label)

        self._emit_step(node, edge_label=entry_label)
        return ""

    def _execute_if(self, node: IRNode, entry_label: str = "") -> str:
        then_nodes, else_nodes = self._split_if_branches(node)
        condition_result = self._evaluate_condition(node)
        take_true = condition_result if condition_result is not None else bool(then_nodes or not else_nodes)

        branch_taken: BranchType = "true" if take_true else "false"
        self._emit_step(node, branch_taken=branch_taken, edge_label=entry_label)

        branch_nodes = then_nodes if take_true else else_nodes
        if not branch_nodes:
            return branch_taken

        self._execute_sequence(branch_nodes, first_edge_label=branch_taken)
        return ""

    def _execute_loop(self, node: IRNode, entry_label: str = "") -> str:
        loop_key = f"node-{node.id}"
        body_nodes = self._extract_loop_body(node)
        first_visit = True

        if node.type == IRNodeType.FOR_LOOP:
            iter_values = self._resolve_for_values(node)
            if not iter_values:
                self._emit_step(node, branch_taken="false", edge_label=entry_label)
                return "false"

            loop_var = self._extract_loop_target_name(node)
            for idx, value in enumerate(iter_values):
                if self._should_stop() or self._is_returning:
                    break
                if idx >= self._max_loop_iterations:
                    break

                if loop_var:
                    self._set_variable(loop_var, value)

                self._loop_counts[loop_key] = self._loop_counts.get(loop_key, 0) + 1
                self._emit_step(
                    node,
                    branch_taken="loop",
                    edge_label=entry_label if first_visit else "loop-back",
                    animation_hint="forward" if first_visit else "backtrack",
                )
                first_visit = False
                self._execute_sequence(body_nodes, first_edge_label="loop")

                if self._is_returning:
                    break

            if not self._is_returning:
                self._emit_step(
                    node,
                    branch_taken="false",
                    edge_label="loop-back" if not first_visit else entry_label,
                    animation_hint="backtrack" if not first_visit else "forward",
                )
                return "false"
            return ""

        iterations = 0
        while True:
            if self._should_stop() or self._is_returning:
                break

            condition = self._evaluate_condition(node)
            if condition is None:
                condition = iterations < 1

            if not condition or iterations >= self._max_loop_iterations:
                self._emit_step(
                    node,
                    branch_taken="false",
                    edge_label=entry_label if first_visit else "loop-back",
                    animation_hint="forward" if first_visit else "backtrack",
                )
                return "false"

            self._loop_counts[loop_key] = self._loop_counts.get(loop_key, 0) + 1
            self._emit_step(
                node,
                branch_taken="loop",
                edge_label=entry_label if first_visit else "loop-back",
                animation_hint="forward" if first_visit else "backtrack",
            )
            first_visit = False
            iterations += 1
            self._execute_sequence(body_nodes, first_edge_label="loop")

        return ""

    def _execute_try(self, node: IRNode, entry_label: str = "") -> str:
        try_body, except_branches, finally_body = self._split_try_parts(node)
        has_exception = self._detect_exception_path(try_body)
        branch_taken = "exception" if (has_exception and except_branches) else None

        self._emit_step(
            node,
            branch_taken=branch_taken,
            edge_label=entry_label,
            animation_hint="exception" if branch_taken == "exception" else "forward",
        )

        if branch_taken == "exception" and except_branches:
            self._execute_sequence(except_branches[0], first_edge_label="fault")
        else:
            self._execute_sequence(try_body, first_edge_label="")

        if not self._is_returning and finally_body:
            self._execute_sequence(finally_body, first_edge_label="")

        return ""

    def _execute_call(self, call_node: IRNode) -> Any:
        call_record = self.call_resolution_map.get(call_node.id, {})
        target_ir_id = str(call_record.get("target_ir_node_id", "")).strip()

        callee: Optional[IRNode] = None
        if target_ir_id:
            callee = self._function_index_by_id.get(target_ir_id)

        if callee is None and call_node.name:
            callee = self._function_index.get(call_node.name)
        if not callee:
            return None
        return self._invoke_function(callee, call_node)

    def _invoke_function(self, function_node: IRNode, call_node: IRNode | None = None) -> Any:
        if len(self._call_stack) >= self._max_call_depth:
            return None

        frame = _RuntimeFrame(
            scope="local",
            function_name=function_node.name or "anonymous",
            ir_node_id=function_node.id,
            source_line=max(1, function_node.source_start),
            file=self.file,
            variables={},
        )
        self._frames.append(frame)
        self._call_stack.append(
            CallStackFrame(
                function_name=frame.function_name,
                file=frame.file,
                source_line=frame.source_line,
                ir_node_id=frame.ir_node_id,
            )
        )

        if call_node is not None:
            args = self._extract_call_args(call_node)
            params = self._extract_function_params(function_node)
            for idx, param in enumerate(params):
                self._set_variable(param, args[idx] if idx < len(args) else None)

        prev_returning = self._is_returning
        prev_return_value = self._last_return_value
        self._is_returning = False
        self._last_return_value = None

        body_nodes = self._extract_body_nodes(function_node)
        self._execute_sequence(body_nodes, first_edge_label="call")
        result = self._last_return_value

        self._frames.pop()
        self._call_stack.pop()

        self._is_returning = prev_returning
        self._last_return_value = prev_return_value
        return result

    def _apply_assignment(self, node: IRNode) -> None:
        target, operator, value_node, value_expr = self._extract_assignment_components(node)
        if not target:
            return

        value = self._evaluate_expression_node(value_node, value_expr)
        if operator in {"+=", "-=", "*=", "/=", "%="}:
            current = self._lookup_variable(target)
            value = self._apply_augmented_op(current, value, operator)

        self._set_variable(target, value)

    def _apply_augmented_op(self, left: Any, right: Any, operator: str) -> Any:
        try:
            if operator == "+=":
                return left + right
            if operator == "-=":
                return left - right
            if operator == "*=":
                return left * right
            if operator == "/=":
                return left / right
            if operator == "%=":
                return left % right
        except Exception:
            return right
        return right

    def _current_frame(self) -> _RuntimeFrame:
        return self._frames[-1]

    def _set_variable(self, name: str, value: Any) -> None:
        key = self._normalize_variable_name(name)
        if not key:
            return
        self._current_frame().variables[key] = copy.deepcopy(value)

    def _lookup_variable(self, name: str) -> Any:
        key = self._normalize_variable_name(name)
        if not key:
            return None
        for frame in reversed(self._frames):
            if key in frame.variables:
                return frame.variables[key]
        return None

    def _normalize_variable_name(self, raw: str) -> str:
        name = raw.strip()
        if not name:
            return ""
        return name

    def _snapshot_variables(self) -> Dict[str, VariableState]:
        current = self._collect_visible_variables()
        all_keys = set(current) | set(self._last_snapshot)
        snapshot: Dict[str, VariableState] = {}

        for key in sorted(all_keys):
            if key not in current:
                prev = self._last_snapshot[key]
                snapshot[key] = VariableState(
                    value=None,
                    type="NoneType",
                    scope=prev["scope"],
                    prev_value=prev["value"],
                    change_type="removed",
                )
                continue

            now = current[key]
            if key not in self._last_snapshot:
                snapshot[key] = VariableState(
                    value=now["value"],
                    type=now["type"],
                    scope=now["scope"],
                    prev_value=None,
                    change_type="added",
                )
                continue

            prev = self._last_snapshot[key]
            changed = prev["value"] != now["value"] or prev["type"] != now["type"] or prev["scope"] != now["scope"]
            snapshot[key] = VariableState(
                value=now["value"],
                type=now["type"],
                scope=now["scope"],
                prev_value=prev["value"],
                change_type="changed" if changed else "unchanged",
            )

        self._last_snapshot = copy.deepcopy(current)
        return snapshot

    def _collect_visible_variables(self) -> Dict[str, Dict[str, Any]]:
        global_vars = self._frames[0].variables if self._frames else {}
        local_vars = self._frames[-1].variables if len(self._frames) > 1 else {}
        local_keys = set(local_vars.keys()) if len(self._frames) > 1 else set()

        merged: Dict[str, Dict[str, Any]] = {}

        for name, value in global_vars.items():
            display = f"global::{name}" if name in local_keys else name
            merged[display] = {
                "value": self._json_safe(value),
                "type": self._infer_type(value),
                "scope": "global",
            }

        if len(self._frames) > 1:
            for name, value in local_vars.items():
                merged[name] = {
                    "value": self._json_safe(value),
                    "type": self._infer_type(value),
                    "scope": "local",
                }

        return merged

    def _emit_step(
        self,
        node: IRNode,
        branch_taken: BranchType | None = None,
        edge_label: str = "",
        animation_hint: AnimationHint = "forward",
    ) -> None:
        if self._should_stop():
            return

        active_node_id = f"node-{node.id}"
        prev_node_id = self._prev_node_id
        from_id = prev_node_id or "start-node"

        step = ExecutionStep(
            step_id=self._next_step_id,
            active_node_id=active_node_id,
            currently_executing_function_id=self._current_frame().ir_node_id if self._frames else None,
            prev_node_id=prev_node_id,
            variables=self._snapshot_variables(),
            call_stack=[frame.model_copy(deep=True) for frame in self._call_stack],
            branch_taken=branch_taken,
            loop_counts=copy.deepcopy(self._loop_counts),
            edge_traversed=EdgeTraversal(from_id=from_id, to_id=active_node_id, label=edge_label),
            animation_hint=animation_hint,
        )
        self.steps.append(step)
        self._next_step_id += 1
        self._prev_node_id = active_node_id

    def _should_stop(self) -> bool:
        return self.step_limit is not None and len(self.steps) >= self.step_limit

    def _evaluate_expression_node(self, value_node: IRNode | None, fallback_expr: str = "") -> Any:
        if value_node is not None and value_node.type == IRNodeType.CALL:
            resolved = self._execute_call(value_node)
            has_resolution = (
                value_node.id in self.call_resolution_map
                or (bool(value_node.name) and value_node.name in self._function_index)
            )
            if has_resolution:
                return resolved

        expr = self._extract_text(value_node) if value_node is not None else fallback_expr
        if not expr:
            expr = fallback_expr
        return self._evaluate_expression(expr)

    def _evaluate_expression(self, expr: str) -> Any:
        text = expr.strip()
        if not text:
            return None

        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", text):
            lookup = self._lookup_variable(text)
            if lookup is not None:
                return copy.deepcopy(lookup)

        lowered = text.lower()
        if lowered in {"none", "null", "undefined"}:
            return None
        if lowered == "true":
            return True
        if lowered == "false":
            return False

        if re.fullmatch(r"-?\d+", text):
            try:
                return int(text)
            except ValueError:
                pass

        if re.fullmatch(r"-?\d+\.\d+", text):
            try:
                return float(text)
            except ValueError:
                pass

        if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
            return text[1:-1]

        normalized = self._normalize_expression(text)
        try:
            parsed = ast.parse(normalized, mode="eval")
            return self._safe_eval_ast(parsed.body)
        except Exception:
            return text

    def _normalize_expression(self, expr: str) -> str:
        normalized = expr
        normalized = normalized.replace("===", "==").replace("!==", "!=")
        normalized = normalized.replace("&&", " and ").replace("||", " or ")
        normalized = re.sub(r"(?<![=!<>])!(?!=)", " not ", normalized)
        normalized = re.sub(r"\btrue\b", "True", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\bfalse\b", "False", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\bnull\b", "None", normalized, flags=re.IGNORECASE)
        normalized = re.sub(r"\bundefined\b", "None", normalized, flags=re.IGNORECASE)
        return normalized

    def _safe_eval_ast(self, node: ast.AST) -> Any:
        if isinstance(node, ast.Constant):
            return node.value

        if isinstance(node, ast.Name):
            value = self._lookup_variable(node.id)
            if value is None:
                raise ValueError(f"Unknown variable {node.id}")
            return value

        if isinstance(node, ast.List):
            return [self._safe_eval_ast(elt) for elt in node.elts]

        if isinstance(node, ast.Tuple):
            return [self._safe_eval_ast(elt) for elt in node.elts]

        if isinstance(node, ast.Dict):
            result: Dict[str, Any] = {}
            for key, value in zip(node.keys, node.values):
                key_value = self._safe_eval_ast(key) if key is not None else ""
                result[str(key_value)] = self._safe_eval_ast(value)
            return result

        if isinstance(node, ast.UnaryOp):
            operand = self._safe_eval_ast(node.operand)
            if isinstance(node.op, ast.USub):
                return -operand
            if isinstance(node.op, ast.UAdd):
                return +operand
            if isinstance(node.op, ast.Not):
                return not operand
            raise ValueError("Unsupported unary operator")

        if isinstance(node, ast.BinOp):
            left = self._safe_eval_ast(node.left)
            right = self._safe_eval_ast(node.right)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
            if isinstance(node.op, ast.Mod):
                return left % right
            raise ValueError("Unsupported binary operator")

        if isinstance(node, ast.BoolOp):
            values = [self._safe_eval_ast(value) for value in node.values]
            if isinstance(node.op, ast.And):
                return all(bool(v) for v in values)
            if isinstance(node.op, ast.Or):
                return any(bool(v) for v in values)
            raise ValueError("Unsupported boolean operator")

        if isinstance(node, ast.Compare):
            left = self._safe_eval_ast(node.left)
            for op, comparator in zip(node.ops, node.comparators):
                right = self._safe_eval_ast(comparator)
                if isinstance(op, ast.Eq) and not (left == right):
                    return False
                if isinstance(op, ast.NotEq) and not (left != right):
                    return False
                if isinstance(op, ast.Lt) and not (left < right):
                    return False
                if isinstance(op, ast.LtE) and not (left <= right):
                    return False
                if isinstance(op, ast.Gt) and not (left > right):
                    return False
                if isinstance(op, ast.GtE) and not (left >= right):
                    return False
                left = right
            return True

        if isinstance(node, ast.Subscript):
            value = self._safe_eval_ast(node.value)
            index = self._safe_eval_ast(node.slice) if not isinstance(node.slice, ast.Slice) else None
            if index is None:
                raise ValueError("Unsupported slice operation")
            return value[index]

        raise ValueError(f"Unsupported expression node: {type(node).__name__}")

    def _index_functions(self, node: IRNode) -> None:
        if node.type == IRNodeType.FUNCTION_DEF and node.name:
            self._function_index[node.name] = node
            self._function_index_by_id[node.id] = node
        for child in node.children:
            self._index_functions(child)

    def _extract_return_value(self, node: IRNode) -> Any:
        if not node.children:
            return None
        return self._evaluate_expression_node(node.children[0], self._extract_text(node.children[0]))

    def _extract_call_args(self, call_node: IRNode) -> List[Any]:
        args: List[Any] = []
        for child in call_node.children:
            raw = self._raw_type(child)
            if raw in {"argument_list", "arguments"}:
                for arg in child.children:
                    args.append(self._evaluate_expression_node(arg, self._extract_text(arg)))
        return args

    def _extract_function_params(self, function_node: IRNode) -> List[str]:
        params: List[str] = []
        for child in function_node.children:
            raw = self._raw_type(child)
            if raw not in {"parameters", "formal_parameters"}:
                continue
            for param in child.children:
                p = self._extract_text(param).strip()
                if p:
                    params.append(p)
        return params

    def _extract_assignment_components(self, node: IRNode) -> Tuple[str, str, IRNode | None, str]:
        working = node
        raw = self._raw_type(working)
        if raw in {"lexical_declaration", "variable_declaration"}:
            for child in node.children:
                if child.type == IRNodeType.ASSIGNMENT:
                    working = child
                    raw = self._raw_type(working)
                    break

        target = ""
        value_node: IRNode | None = None
        operator = "="

        if working.children:
            target = self._extract_text(working.children[0]).strip()
            if len(working.children) > 1:
                value_node = working.children[-1]

        full_text = self._extract_text(working).strip()
        match = re.search(r"(\+=|-=|\*=|/=|%=)", full_text)
        if match:
            operator = match.group(1)
        elif raw in {"augmented_assignment"}:
            operator = "+="

        value_expr = self._extract_text(value_node).strip() if value_node is not None else ""
        return target, operator, value_node, value_expr

    def _evaluate_condition(self, node: IRNode) -> bool | None:
        if not node.children:
            return None

        candidate = node.children[0]
        raw = self._raw_type(candidate)
        if raw in {"block", "statement_block", "else_clause", "except_clause"}:
            return None

        expr = self._extract_text(candidate).strip()
        if not expr:
            return None

        value = self._evaluate_expression(expr)
        if isinstance(value, str) and value == expr:
            return None
        return bool(value)

    def _resolve_for_values(self, node: IRNode) -> List[Any]:
        if len(node.children) < 2:
            return [0]

        iterable_node = node.children[1]
        iterable_text = self._extract_text(iterable_node).strip()

        if iterable_node.type == IRNodeType.CALL and iterable_node.name == "range":
            args = self._extract_call_args(iterable_node)
            try:
                int_args = [int(a) for a in args]
                if len(int_args) == 1:
                    return list(range(int_args[0]))
                if len(int_args) == 2:
                    return list(range(int_args[0], int_args[1]))
                if len(int_args) >= 3:
                    return list(range(int_args[0], int_args[1], int_args[2]))
            except Exception:
                return [0]

        value = self._evaluate_expression_node(iterable_node, iterable_text)
        if isinstance(value, dict):
            return list(value.keys())
        if isinstance(value, (list, tuple)):
            return list(value)
        if isinstance(value, str) and value and value != iterable_text:
            return [value]
        return [0]

    def _extract_loop_target_name(self, node: IRNode) -> str:
        if not node.children:
            return ""
        first = node.children[0]
        name = self._extract_text(first).strip()
        return name

    def _detect_exception_path(self, nodes: Sequence[IRNode]) -> bool:
        for node in nodes:
            raw = self._raw_type(node)
            text = self._extract_text(node)
            cleaned = text.replace(" ", "")
            if raw in {"raise_statement", "throw_statement"}:
                return True
            if "/0" in cleaned:
                return True
            if self._detect_exception_path(node.children):
                return True
        return False

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
            return self._dedupe_ir_nodes(self._extract_statement_nodes(blocks[0].children))
        if len(node.children) > 1:
            return self._dedupe_ir_nodes(self._extract_statement_nodes(node.children[1:]))
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

    def _split_try_parts(self, node: IRNode) -> Tuple[List[IRNode], List[List[IRNode]], List[IRNode]]:
        try_body: List[IRNode] = []
        except_branches: List[List[IRNode]] = []
        finally_body: List[IRNode] = []
        first_block_used = False

        for child in node.children:
            raw = self._raw_type(child)
            if child.type == IRNodeType.BLOCK or raw in self._BLOCK_RAW_TYPES:
                if not first_block_used:
                    try_body.extend(self._extract_statement_nodes(child.children))
                    first_block_used = True
                else:
                    except_branches.append(self._extract_statement_nodes(child.children))
                continue

            if raw in {"except_clause", "catch_clause"}:
                fault = self._extract_statement_nodes(child.children)
                if fault:
                    except_branches.append(fault)
                continue

            if raw == "finally_clause":
                finally_body.extend(self._extract_statement_nodes(child.children))

        return (
            self._dedupe_ir_nodes(try_body),
            [self._dedupe_ir_nodes(branch) for branch in except_branches],
            self._dedupe_ir_nodes(finally_body),
        )

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

    def _raw_type(self, node: IRNode) -> str:
        raw = node.metadata.get("raw_type")
        return str(raw) if raw is not None else ""

    def _extract_text(self, node: IRNode | None) -> str:
        if node is None:
            return ""
        if not self.source_bytes:
            return node.name or ""

        start = node.metadata.get("start_byte")
        end = node.metadata.get("end_byte")
        if isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(self.source_bytes):
            try:
                return self.source_bytes[start:end].decode("utf8")
            except Exception:
                return node.name or ""
        return node.name or ""

    def _json_safe(self, value: Any) -> Any:
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, (list, tuple, set)):
            return [self._json_safe(item) for item in value]
        if isinstance(value, dict):
            return {str(k): self._json_safe(v) for k, v in value.items()}
        return repr(value)

    def _infer_type(self, value: Any) -> VariableType:
        if value is None:
            return "NoneType"
        if isinstance(value, bool):
            return "bool"
        if isinstance(value, (int, float)):
            return "int"
        if isinstance(value, str):
            return "str"
        if isinstance(value, (list, tuple, set)):
            return "list"
        if isinstance(value, dict):
            return "dict"
        return "str"


def ir_from_dict(data: Dict[str, Any]) -> IRNode:
    raw_type = str(data.get("type", "other"))
    try:
        node_type = IRNodeType(raw_type)
    except ValueError:
        node_type = IRNodeType.OTHER

    children = [ir_from_dict(child) for child in data.get("children", []) if isinstance(child, dict)]

    return IRNode(
        id=str(data.get("id", uuid.uuid4())),
        type=node_type,
        language=str(data.get("language", "")),
        name=str(data.get("name", "")),
        source_start=int(data.get("source_start", 0) or 0),
        source_end=int(data.get("source_end", 0) or 0),
        children=children,
        metadata=data.get("metadata", {}) if isinstance(data.get("metadata", {}), dict) else {},
    )


def celery_enabled() -> bool:
    return CELERY_APP is not None


def build_execution_steps(
    ir_data: Dict[str, Any],
    code: str = "",
    file: str = "main",
    step_limit: int | None = None,
    call_resolution_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Convert IR payload to deterministic execution steps."""
    ir_root = ir_from_dict(ir_data)
    interpreter = ExecutionInterpreter(
        ir_root=ir_root,
        source_code=code,
        file=file,
        step_limit=step_limit,
        call_resolution_map=call_resolution_map or {},
    )
    return [step.model_dump() for step in interpreter.generate_steps()]


if CELERY_APP is not None:
    @CELERY_APP.task(name=CELERY_EXECUTION_TASK_NAME)  # type: ignore[misc]
    def _celery_generate_steps_task(
        ir_data: Dict[str, Any],
        code: str = "",
        file: str = "main",
        step_limit: int | None = None,
        call_resolution_map: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        return build_execution_steps(
            ir_data=ir_data,
            code=code,
            file=file,
            step_limit=step_limit,
            call_resolution_map=call_resolution_map or {},
        )


def run_execution_job(
    ir_data: Dict[str, Any],
    code: str = "",
    file: str = "main",
    step_limit: int | None = None,
    call_resolution_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Build execution steps with optional Celery offload.

    Celery is opt-in through CODEFLOWX_EXECUTION_USE_CELERY=1 so local dev/test
    remains deterministic by default.
    """
    use_celery = (
        celery_enabled()
        and os.getenv("CODEFLOWX_EXECUTION_USE_CELERY", "0").strip() == "1"
    )

    if use_celery and CELERY_APP is not None:
        try:
            timeout_s = float(os.getenv("CODEFLOWX_EXECUTION_TASK_TIMEOUT", "30"))
        except ValueError:
            timeout_s = 30.0

        try:
            async_result = CELERY_APP.send_task(
                CELERY_EXECUTION_TASK_NAME,
                args=[ir_data, code, file, step_limit, call_resolution_map or {}],
            )
            steps = async_result.get(timeout=timeout_s)
            if isinstance(steps, list):
                return steps, "celery"
        except Exception:
            # If broker/worker is unavailable, fail open to local execution.
            pass

    return build_execution_steps(
        ir_data=ir_data,
        code=code,
        file=file,
        step_limit=step_limit,
        call_resolution_map=call_resolution_map or {},
    ), "local"


class ExecutionJobStore:
    """
    Redis-backed storage with in-memory fallback.
    """

    def __init__(self):
        self.ttl_seconds = 3600
        self._memory: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

        self._redis = None
        redis_url = os.getenv("CODEFLOWX_REDIS_URL") or os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis.asyncio as redis_async  # type: ignore[import]

                self._redis = redis_async.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    def _key(self, job_id: str) -> str:
        return f"execution:{job_id}"

    async def save_job(self, job_id: str, payload: Dict[str, Any]) -> None:
        if self._redis is not None:
            try:
                await self._redis.setex(self._key(job_id), self.ttl_seconds, json.dumps(payload))
                return
            except Exception:
                self._redis = None

        async with self._lock:
            self._memory[job_id] = (time.time() + self.ttl_seconds, payload)

    async def get_job(self, job_id: str) -> Dict[str, Any] | None:
        if self._redis is not None:
            try:
                raw = await self._redis.get(self._key(job_id))
                if not raw:
                    return None
                return json.loads(raw)
            except Exception:
                self._redis = None

        async with self._lock:
            self._cleanup_memory_locked()
            entry = self._memory.get(job_id)
            if not entry:
                return None
            return copy.deepcopy(entry[1])

    async def patch_job(self, job_id: str, patch: Dict[str, Any]) -> Dict[str, Any] | None:
        existing = await self.get_job(job_id)
        if not existing:
            return None
        existing.update(patch)
        await self.save_job(job_id, existing)
        return existing

    async def append_breakpoint_hit(self, job_id: str, hit: BreakpointHit) -> None:
        existing = await self.get_job(job_id)
        if not existing:
            return
        hits = existing.get("breakpoint_hits") or []
        for item in hits:
            if item.get("node_id") == hit.node_id:
                item["hit_count"] = int(item.get("hit_count", 0)) + 1
                item["step_id"] = hit.step_id
                item["timestamp_ms"] = hit.timestamp_ms
                break
        else:
            hits.append(hit.model_dump())
        existing["breakpoint_hits"] = hits
        await self.save_job(job_id, existing)

    async def touch(self, job_id: str) -> None:
        existing = await self.get_job(job_id)
        if existing is not None:
            await self.save_job(job_id, existing)

    def _cleanup_memory_locked(self) -> None:
        now = time.time()
        stale = [job_id for job_id, (expires, _) in self._memory.items() if expires <= now]
        for job_id in stale:
            self._memory.pop(job_id, None)


def _normalize_breakpoint_expression(expr: str) -> str:
    normalized = expr.strip()
    normalized = normalized.replace("===", "==").replace("!==", "!=")
    normalized = normalized.replace("&&", " and ").replace("||", " or ")
    normalized = re.sub(r"(?<![=!<>])!(?!=)", " not ", normalized)
    normalized = re.sub(r"\btrue\b", "True", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bfalse\b", "False", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bnull\b", "None", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\bundefined\b", "None", normalized, flags=re.IGNORECASE)
    return normalized


def _safe_eval_breakpoint_ast(node: ast.AST, scope: Dict[str, Any]) -> Any:
    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, ast.Name):
        return scope.get(node.id)

    if isinstance(node, ast.List):
        return [_safe_eval_breakpoint_ast(item, scope) for item in node.elts]

    if isinstance(node, ast.Tuple):
        return tuple(_safe_eval_breakpoint_ast(item, scope) for item in node.elts)

    if isinstance(node, ast.Dict):
        output: Dict[str, Any] = {}
        for key, value in zip(node.keys, node.values):
            key_value = _safe_eval_breakpoint_ast(key, scope) if key is not None else ""
            output[str(key_value)] = _safe_eval_breakpoint_ast(value, scope)
        return output

    if isinstance(node, ast.UnaryOp):
        operand = _safe_eval_breakpoint_ast(node.operand, scope)
        if isinstance(node.op, ast.USub):
            return -operand
        if isinstance(node.op, ast.UAdd):
            return +operand
        if isinstance(node.op, ast.Not):
            return not operand
        raise ValueError("Unsupported unary operator")

    if isinstance(node, ast.BinOp):
        left = _safe_eval_breakpoint_ast(node.left, scope)
        right = _safe_eval_breakpoint_ast(node.right, scope)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        if isinstance(node.op, ast.Mod):
            return left % right
        raise ValueError("Unsupported binary operator")

    if isinstance(node, ast.BoolOp):
        values = [_safe_eval_breakpoint_ast(item, scope) for item in node.values]
        if isinstance(node.op, ast.And):
            return all(bool(value) for value in values)
        if isinstance(node.op, ast.Or):
            return any(bool(value) for value in values)
        raise ValueError("Unsupported boolean operator")

    if isinstance(node, ast.Compare):
        left = _safe_eval_breakpoint_ast(node.left, scope)
        for op, comparator in zip(node.ops, node.comparators):
            right = _safe_eval_breakpoint_ast(comparator, scope)
            if isinstance(op, ast.Eq) and not (left == right):
                return False
            if isinstance(op, ast.NotEq) and not (left != right):
                return False
            if isinstance(op, ast.Lt) and not (left < right):
                return False
            if isinstance(op, ast.LtE) and not (left <= right):
                return False
            if isinstance(op, ast.Gt) and not (left > right):
                return False
            if isinstance(op, ast.GtE) and not (left >= right):
                return False
            left = right
        return True

    if isinstance(node, ast.Subscript):
        value = _safe_eval_breakpoint_ast(node.value, scope)
        index = _safe_eval_breakpoint_ast(node.slice, scope)
        return value[index]

    raise ValueError(f"Unsupported expression node: {type(node).__name__}")


def evaluate_breakpoint_expression(expr: str, step: Dict[str, Any]) -> bool:
    """
    Evaluate a conditional breakpoint expression safely against step variables.

    Returns False when the expression cannot be parsed/evaluated.
    """
    expression = _normalize_breakpoint_expression(expr)
    if not expression:
        return True

    variables = step.get("variables", {})
    scope: Dict[str, Any] = {}
    if isinstance(variables, dict):
        for key, payload in variables.items():
            if not isinstance(payload, dict):
                continue
            value = payload.get("value")
            scope[str(key)] = value
            if str(key).startswith("global::"):
                scope[str(key).split("::", 1)[1]] = value

    try:
        parsed = ast.parse(expression, mode="eval")
        return bool(_safe_eval_breakpoint_ast(parsed.body, scope))
    except Exception:
        return False


async def stream_job_steps(
    websocket: WebSocket,
    job: Dict[str, Any],
    store: ExecutionJobStore,
    start_index: int = 0,
    steps_per_second: float = 3.0,
) -> None:
    """
    Streams precomputed execution steps over a websocket channel.

    Supported client messages:
      {"event":"RESUME"}
      {"event":"PAUSE"}
      {"event":"SET_RATE","steps_per_second":5}
      {"event":"JUMP","step_index":10}
      {"event":"PLAY_TO_NEXT_BREAKPOINT"}
    """

    steps = job.get("steps", [])
    total_steps = len(steps)
    breakpoints = set(job.get("breakpoint_node_ids", []))
    conditional_breakpoints = {
        str(node_id): str(expr)
        for node_id, expr in (job.get("conditional_breakpoints") or {}).items()
        if str(node_id)
    }
    rate = max(0.1, float(steps_per_second))
    index = max(0, min(start_index, max(0, total_steps - 1)))
    paused = False
    play_to_next_breakpoint = False

    await websocket.send_json(
        {
            "event": "READY",
            "job_id": job.get("job_id"),
            "total_steps": total_steps,
            "breakpoint_node_ids": sorted(breakpoints),
            "conditional_breakpoints": conditional_breakpoints,
        }
    )

    async def _recv(timeout: float) -> Dict[str, Any] | None:
        try:
            message = await asyncio.wait_for(websocket.receive_json(), timeout=timeout)
            if isinstance(message, dict):
                return message
            return None
        except asyncio.TimeoutError:
            return None

    async def _handle_command(message: Dict[str, Any]) -> None:
        nonlocal paused, rate, index, play_to_next_breakpoint
        event = str(message.get("event", "")).upper()
        if event == "RESUME":
            paused = False
            play_to_next_breakpoint = False
            return
        if event == "PAUSE":
            paused = True
            return
        if event == "SET_RATE":
            try:
                rate = max(0.1, float(message.get("steps_per_second", rate)))
            except Exception:
                rate = max(0.1, rate)
            return
        if event == "JUMP":
            try:
                requested = int(message.get("step_index", index))
            except Exception:
                requested = index
            index = max(0, min(requested, max(0, total_steps - 1)))
            paused = True
            if total_steps:
                await websocket.send_json(
                    {
                        "event": "STEP",
                        "step_index": index + 1,
                        "total_steps": total_steps,
                        "step": steps[index],
                        "paused": True,
                    }
                )
            return
        if event == "PLAY_TO_NEXT_BREAKPOINT":
            paused = False
            play_to_next_breakpoint = True

    ping_every = 15.0
    last_ping = time.monotonic()

    while index < total_steps:
        now = time.monotonic()
        if now - last_ping >= ping_every:
            await websocket.send_json({"event": "PING", "timestamp_ms": int(time.time() * 1000)})
            last_ping = now

        if paused:
            incoming = await _recv(timeout=1.0)
            if incoming:
                await _handle_command(incoming)
            continue

        step = steps[index]
        await websocket.send_json(
            {
                "event": "STEP",
                "step_index": index + 1,
                "total_steps": total_steps,
                "step": step,
                "paused": False,
            }
        )

        active_node_id = step.get("active_node_id")
        if active_node_id in breakpoints:
            condition_expr = conditional_breakpoints.get(str(active_node_id), "").strip()
            condition_ok = evaluate_breakpoint_expression(condition_expr, step)
            if condition_expr and not condition_ok:
                index += 1
                incoming = await _recv(timeout=1.0 / rate)
                if incoming:
                    await _handle_command(incoming)
                continue

            hit = BreakpointHit(
                node_id=active_node_id,
                step_id=int(step.get("step_id", index + 1)),
                hit_count=1,
                timestamp_ms=int(time.time() * 1000),
            )
            await store.append_breakpoint_hit(str(job.get("job_id")), hit)
            await websocket.send_json(
                {
                    "event": "PAUSED",
                    "reason": "breakpoint",
                    "node_id": active_node_id,
                    "condition": condition_expr,
                    "step_index": index + 1,
                    "step": step,
                }
            )
            paused = not play_to_next_breakpoint
            play_to_next_breakpoint = False

        index += 1
        incoming = await _recv(timeout=1.0 / rate)
        if incoming:
            await _handle_command(incoming)

    await store.patch_job(str(job.get("job_id")), {"status": "completed"})
    await websocket.send_json(
        {
            "event": "COMPLETED",
            "job_id": job.get("job_id"),
            "total_steps": total_steps,
        }
    )

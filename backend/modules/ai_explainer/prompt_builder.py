from __future__ import annotations

import json
from typing import Any, Dict, List


def build_node_prompt(context: Dict[str, Any]) -> str:
    examples = [
        {
            "input": {"ir_node": {"type": "function_def", "name": "parse_order", "source_start": 10, "source_end": 28}},
            "output": {
                "explanation": "Defines parse_order() and validates raw payload before downstream calls.",
                "confidence": 0.89,
                "relevant_lines": [10, 28],
            },
        },
        {
            "input": {"ir_node": {"type": "if_stmt", "name": "discount_check", "source_start": 41, "source_end": 47}},
            "output": {
                "explanation": "Branches on discount eligibility; false branch keeps base pricing unchanged.",
                "confidence": 0.84,
                "relevant_lines": [41, 47],
            },
        },
        {
            "input": {"ir_node": {"type": "call", "name": "db.save", "source_start": 63, "source_end": 63}},
            "output": {
                "explanation": "Persists the prepared object; later nodes assume this write succeeded.",
                "confidence": 0.8,
                "relevant_lines": [63, 63],
            },
        },
    ]
    return _build_prompt(
        task_title="Explain the selected IR node.",
        task_rules=[
            "Focus on what this node does and why it matters in control/data flow.",
            "Mention branch intent when node type is conditional or loop-related.",
            "If context is incomplete, say what is inferred vs explicit.",
        ],
        examples=examples,
        context=context,
    )


def build_edge_prompt(context: Dict[str, Any]) -> str:
    examples = [
        {
            "input": {"edge": {"edge_id": "e-d1-l1", "edge": {"label": "true"}}},
            "output": {
                "explanation": "The true branch transitions into the loop body, indicating the condition evaluated truthy.",
                "confidence": 0.83,
                "relevant_lines": [22, 30],
            },
        },
        {
            "input": {"edge": {"edge_id": "e-d1-c1", "edge": {"label": "false"}}},
            "output": {
                "explanation": "False branch skips loop processing and jumps directly to the fallback call.",
                "confidence": 0.81,
                "relevant_lines": [22, 34],
            },
        },
        {
            "input": {"edge": {"edge_id": "dep-a-b", "edge": {"type": "depends_on"}}},
            "output": {
                "explanation": "Indicates an upstream dependency; failures in the source can propagate into the target.",
                "confidence": 0.77,
                "relevant_lines": [12, 26],
            },
        },
    ]
    return _build_prompt(
        task_title="Explain the selected graph edge.",
        task_rules=[
            "Describe why control or dependency moves from source to target.",
            "Reference branch labels (true/false/exception) when present.",
            "Clarify impact if the transition is skipped or fails.",
        ],
        examples=examples,
        context=context,
    )


def build_coverage_prompt(context: Dict[str, Any]) -> str:
    examples = [
        {
            "input": {"coverage": {"record": {"coverage_status": "uncovered", "hit_lines": 0, "total_lines": 5}}},
            "output": {
                "explanation": "This region was never executed; tests do not cover the logic path yet.",
                "confidence": 0.92,
                "relevant_lines": [55, 59],
            },
        },
        {
            "input": {"coverage": {"record": {"coverage_status": "partially_covered", "branch_covered": 1, "branch_total": 3}}},
            "output": {
                "explanation": "Only some branches are covered; at least two decision paths remain untested.",
                "confidence": 0.88,
                "relevant_lines": [33, 40],
            },
        },
        {
            "input": {"coverage": {"record": {"coverage_status": "dead", "hits": 0}}},
            "output": {
                "explanation": "The node appears unreachable in current execution paths and test runs.",
                "confidence": 0.74,
                "relevant_lines": [72, 79],
            },
        },
    ]
    return _build_prompt(
        task_title="Explain the selected coverage region or coverage target.",
        task_rules=[
            "Explain observed coverage status and what that implies for reliability.",
            "Call out missing branches/tests when data indicates partial coverage.",
            "Keep recommendations short and specific.",
        ],
        examples=examples,
        context=context,
    )


def build_failure_prompt(context: Dict[str, Any]) -> str:
    examples = [
        {
            "input": {"dependency": {"node": {"name": "payment_gateway"}, "nodes_count": 84}},
            "output": {
                "explanation": "A failure here can fan out to multiple checkout paths because it is a shared upstream dependency.",
                "confidence": 0.86,
                "relevant_lines": [120, 149],
            },
        },
        {
            "input": {"execution_state": {"active_node_id": "node-validate"}, "ir_node": {"name": "validate_order"}},
            "output": {
                "explanation": "If validate_order fails, downstream persistence and notification steps are bypassed.",
                "confidence": 0.82,
                "relevant_lines": [48, 67],
            },
        },
        {
            "input": {"ir_node": {"name": "retry_handler", "type": "try_except"}},
            "output": {
                "explanation": "This block contains fallback handling, so failure impact may be partially contained.",
                "confidence": 0.7,
                "relevant_lines": [151, 174],
            },
        },
    ]
    return _build_prompt(
        task_title="Explain potential failure impact for the selected target.",
        task_rules=[
            "Prioritize blast-radius reasoning and downstream effects.",
            "Mention whether safeguards (try/except, fallback branches) reduce impact.",
            "If uncertain, lower confidence and state assumptions.",
        ],
        examples=examples,
        context=context,
    )


def _build_prompt(
    *,
    task_title: str,
    task_rules: List[str],
    examples: List[Dict[str, Any]],
    context: Dict[str, Any],
) -> str:
    rules_lines = "\n".join(f"- {rule}" for rule in task_rules)
    examples_text = _format_examples(examples)
    context_json = json.dumps(context, indent=2, ensure_ascii=True, default=str)

    return (
        f"{task_title}\n\n"
        "Return exactly one JSON object and nothing else.\n"
        f"{_json_contract()}\n\n"
        "Rules:\n"
        f"{rules_lines}\n\n"
        "Few-shot examples:\n"
        f"{examples_text}\n\n"
        "Context:\n"
        f"{context_json}\n"
    )


def _json_contract() -> str:
    return json.dumps(
        {
            "explanation": "string",
            "confidence": 0.0,
            "relevant_lines": [1, 1],
        },
        ensure_ascii=True,
    )


def _format_examples(examples: List[Dict[str, Any]]) -> str:
    blocks: List[str] = []
    for idx, example in enumerate(examples, start=1):
        blocks.append(
            (
                f"Example {idx} input:\n"
                f"{json.dumps(example['input'], indent=2, ensure_ascii=True)}\n"
                f"Example {idx} output:\n"
                f"{json.dumps(example['output'], indent=2, ensure_ascii=True)}"
            )
        )
    return "\n\n".join(blocks)


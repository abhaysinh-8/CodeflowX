from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class ParsedCoverage:
    format: str
    line_hits: Dict[int, int]
    node_hits: Dict[str, int]
    branch_hits: Dict[str, Dict[str, int]]


def _strip_ns(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _normalize_branch_label(label: str) -> str:
    raw = label.strip().lower()
    if raw in {"true", "t"}:
        return "true"
    if raw in {"false", "f", "exit"}:
        return "false"
    if raw in {"loop", "loop-back"}:
        return "loop"
    if raw in {"fault", "exception"}:
        return "exception"
    return raw


def _detect_format(filename: str, raw_bytes: bytes) -> str:
    lower_name = filename.lower()
    text = raw_bytes.decode("utf8", errors="replace")
    stripped = text.lstrip()

    if lower_name.endswith(".info") or "\nDA:" in text:
        return "istanbul"

    if lower_name.endswith(".json"):
        return "native"

    if stripped.startswith("{") or stripped.startswith("["):
        return "native"

    try:
        root = ET.fromstring(raw_bytes)
    except ET.ParseError:
        return "unknown"

    root_tag = _strip_ns(root.tag).lower()
    if root_tag == "coverage":
        return "pytest-cov"
    if root_tag == "report":
        # JaCoCo root is <report>, with <line nr=".." ci=".."> entries.
        has_jacoco_line = any(_strip_ns(elem.tag).lower() == "line" and elem.get("nr") is not None for elem in root.iter())
        if has_jacoco_line:
            return "jacoco"
    return "unknown"


def _parse_cobertura_xml(raw_bytes: bytes) -> Dict[int, int]:
    root = ET.fromstring(raw_bytes)
    line_hits: Dict[int, int] = {}
    for elem in root.iter():
        if _strip_ns(elem.tag).lower() != "line":
            continue
        number = elem.get("number")
        hits = elem.get("hits")
        if number is None or hits is None:
            continue
        line_no = _safe_int(number, -1)
        if line_no <= 0:
            continue
        line_hits[line_no] = line_hits.get(line_no, 0) + max(0, _safe_int(hits, 0))
    return line_hits


def _parse_jacoco_xml(raw_bytes: bytes) -> Dict[int, int]:
    root = ET.fromstring(raw_bytes)
    line_hits: Dict[int, int] = {}
    for elem in root.iter():
        if _strip_ns(elem.tag).lower() != "line":
            continue
        number = elem.get("nr")
        covered_instructions = elem.get("ci")
        if number is None or covered_instructions is None:
            continue
        line_no = _safe_int(number, -1)
        if line_no <= 0:
            continue
        hits = 1 if _safe_int(covered_instructions, 0) > 0 else 0
        line_hits[line_no] = max(line_hits.get(line_no, 0), hits)
    return line_hits


def _parse_lcov(raw_bytes: bytes) -> Dict[int, int]:
    text = raw_bytes.decode("utf8", errors="replace")
    line_hits: Dict[int, int] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("DA:"):
            continue
        payload = line[3:]
        parts = payload.split(",", 1)
        if len(parts) != 2:
            continue
        line_no = _safe_int(parts[0], -1)
        if line_no <= 0:
            continue
        hits = max(0, _safe_int(parts[1], 0))
        line_hits[line_no] = line_hits.get(line_no, 0) + hits
    return line_hits


def _parse_native_json(raw_bytes: bytes) -> Tuple[Dict[int, int], Dict[str, int], Dict[str, Dict[str, int]]]:
    payload = json.loads(raw_bytes.decode("utf8", errors="replace"))
    line_hits: Dict[int, int] = {}
    node_hits: Dict[str, int] = {}
    branch_hits: Dict[str, Dict[str, int]] = {}

    if isinstance(payload, dict):
        line_hits_raw = payload.get("line_hits")
        if isinstance(line_hits_raw, dict):
            for key, value in line_hits_raw.items():
                line_no = _safe_int(key, -1)
                if line_no > 0:
                    line_hits[line_no] = max(0, _safe_int(value, 0))

        node_hits_raw = payload.get("node_hits")
        if isinstance(node_hits_raw, dict):
            for key, value in node_hits_raw.items():
                node_id = str(key).strip()
                if not node_id:
                    continue
                node_hits[node_id] = max(0, _safe_int(value, 0))

        branch_hits_raw = payload.get("branch_hits")
        if isinstance(branch_hits_raw, dict):
            for node_id, labels in branch_hits_raw.items():
                node_key = str(node_id).strip()
                if not node_key or not isinstance(labels, dict):
                    continue
                normalized: Dict[str, int] = {}
                for label, count in labels.items():
                    label_key = _normalize_branch_label(str(label))
                    normalized[label_key] = normalized.get(label_key, 0) + max(0, _safe_int(count, 0))
                branch_hits[node_key] = normalized

        steps = payload.get("steps")
        if isinstance(steps, list):
            for step in steps:
                if not isinstance(step, dict):
                    continue
                active_node_id = str(step.get("active_node_id", "")).strip()
                if active_node_id:
                    node_hits[active_node_id] = node_hits.get(active_node_id, 0) + 1
                    branch = _normalize_branch_label(str(step.get("branch_taken", "")).strip())
                    if branch:
                        branch_hits.setdefault(active_node_id, {})
                        branch_hits[active_node_id][branch] = branch_hits[active_node_id].get(branch, 0) + 1

    return line_hits, node_hits, branch_hits


def parse_coverage_payload(filename: str, raw_bytes: bytes) -> ParsedCoverage:
    fmt = _detect_format(filename, raw_bytes)
    if fmt == "unknown":
        raise ValueError("Unsupported coverage format. Expected coverage.xml, lcov.info, jacoco.xml, or native JSON.")

    if fmt == "pytest-cov":
        return ParsedCoverage(format=fmt, line_hits=_parse_cobertura_xml(raw_bytes), node_hits={}, branch_hits={})

    if fmt == "jacoco":
        return ParsedCoverage(format=fmt, line_hits=_parse_jacoco_xml(raw_bytes), node_hits={}, branch_hits={})

    if fmt == "istanbul":
        return ParsedCoverage(format=fmt, line_hits=_parse_lcov(raw_bytes), node_hits={}, branch_hits={})

    line_hits, node_hits, branch_hits = _parse_native_json(raw_bytes)
    return ParsedCoverage(format="native", line_hits=line_hits, node_hits=node_hits, branch_hits=branch_hits)


def _parse_line_range(node_data: Dict[str, Any]) -> Tuple[Optional[int], Optional[int]]:
    source_start = node_data.get("source_start")
    source_end = node_data.get("source_end")
    if source_start is None:
        return None, None
    start_line = _safe_int(source_start, -1)
    if start_line <= 0:
        return None, None
    end_line = _safe_int(source_end, start_line)
    if end_line < start_line:
        end_line = start_line
    return start_line, end_line


def _reachable_nodes(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> Set[str]:
    node_ids = {str(node.get("id", "")) for node in nodes if str(node.get("id", "")).strip()}
    if not node_ids:
        return set()

    start_id = "start-node" if "start-node" in node_ids else next(iter(node_ids))
    adjacency: Dict[str, Set[str]] = {nid: set() for nid in node_ids}
    for edge in edges:
        source = str(edge.get("source", "")).strip()
        target = str(edge.get("target", "")).strip()
        if source in adjacency and target in adjacency:
            adjacency[source].add(target)

    visited: Set[str] = {start_id}
    queue: List[str] = [start_id]
    while queue:
        current = queue.pop(0)
        for nxt in adjacency.get(current, set()):
            if nxt in visited:
                continue
            visited.add(nxt)
            queue.append(nxt)
    return visited


def _branch_labels_for_node(node_id: str, edges: List[Dict[str, Any]]) -> Dict[str, str]:
    labels: Dict[str, str] = {}
    for edge in edges:
        source = str(edge.get("source", "")).strip()
        if source != node_id:
            continue
        target = str(edge.get("target", "")).strip()
        normalized = _normalize_branch_label(str(edge.get("label", "")))
        if normalized:
            labels[target] = normalized
    return labels


def apply_coverage_to_flowchart(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    parsed: ParsedCoverage,
) -> Dict[str, Any]:
    updated_nodes: List[Dict[str, Any]] = []
    node_coverage_map: Dict[str, Dict[str, Any]] = {}

    reachable = _reachable_nodes(nodes, edges)
    node_hit_counts: Dict[str, int] = {}
    node_hit_lines: Dict[str, int] = {}
    node_total_lines: Dict[str, int] = {}

    for node in nodes:
        node_id = str(node.get("id", "")).strip()
        node_data = dict(node.get("data", {}) if isinstance(node.get("data"), dict) else {})
        start_line, end_line = _parse_line_range(node_data)

        total_lines = 0
        hit_lines = 0
        if start_line is not None and end_line is not None:
            total_lines = max(0, end_line - start_line + 1)
            for line_no in range(start_line, end_line + 1):
                if parsed.line_hits.get(line_no, 0) > 0:
                    hit_lines += 1

        line_hit_count = hit_lines
        node_hit_count = parsed.node_hits.get(node_id, 0)
        if line_hit_count > node_hit_count:
            node_hit_count = line_hit_count

        node_hit_counts[node_id] = node_hit_count
        node_hit_lines[node_id] = hit_lines
        node_total_lines[node_id] = total_lines

    for node in nodes:
        node_id = str(node.get("id", "")).strip()
        node_data = dict(node.get("data", {}) if isinstance(node.get("data"), dict) else {})
        node_type = str(node.get("type", ""))
        is_dead = node_id not in reachable and node_id not in {"start-node", "end-node"}

        hit_count = node_hit_counts.get(node_id, 0)
        hit_lines = node_hit_lines.get(node_id, 0)
        total_lines = node_total_lines.get(node_id, 0)

        branches = _branch_labels_for_node(node_id, edges)
        branch_labels = set(branches.values())
        branch_total = len(branch_labels)

        native_branch_hits = parsed.branch_hits.get(node_id, {})
        branch_covered = 0
        for label in branch_labels:
            branch_hit = max(0, _safe_int(native_branch_hits.get(label, 0), 0))
            if branch_hit <= 0:
                has_covered_target = any(
                    node_hit_counts.get(target_id, 0) > 0 and branch_label == label
                    for target_id, branch_label in branches.items()
                )
                branch_hit = 1 if has_covered_target else 0
            if branch_hit > 0:
                branch_covered += 1

        if is_dead:
            coverage_status = "dead"
        else:
            has_hit = hit_count > 0
            if branch_total > 0:
                if branch_covered == 0 and not has_hit:
                    coverage_status = "uncovered"
                elif branch_covered < branch_total:
                    coverage_status = "partially_covered" if has_hit or hit_lines > 0 else "uncovered"
                else:
                    coverage_status = "fully_covered" if has_hit or branch_covered > 0 else "uncovered"
            else:
                coverage_status = "fully_covered" if has_hit else "uncovered"

        node_data["coverage_status"] = coverage_status
        node_data["coverage_hits"] = hit_count
        node_data["coverage_hit_lines"] = hit_lines
        node_data["coverage_total_lines"] = total_lines
        node_data["coverage_branch_covered"] = branch_covered
        node_data["coverage_branch_total"] = branch_total

        updated_node = dict(node)
        updated_node["data"] = node_data
        updated_nodes.append(updated_node)

        node_coverage_map[node_id] = {
            "coverage_status": coverage_status,
            "hits": hit_count,
            "hit_lines": hit_lines,
            "total_lines": total_lines,
            "branch_covered": branch_covered,
            "branch_total": branch_total,
            "dead": is_dead,
        }

    countable_nodes = [
        node for node in updated_nodes
        if str(node.get("type", "")) != "terminal"
    ]
    total_nodes = len(countable_nodes)
    covered = sum(1 for node in countable_nodes if node.get("data", {}).get("coverage_status") == "fully_covered")
    partial = sum(1 for node in countable_nodes if node.get("data", {}).get("coverage_status") == "partially_covered")
    uncovered = sum(1 for node in countable_nodes if node.get("data", {}).get("coverage_status") == "uncovered")
    dead = sum(1 for node in countable_nodes if node.get("data", {}).get("coverage_status") == "dead")
    coverage_percent = round((covered / total_nodes) * 100, 2) if total_nodes else 0.0

    summary = {
        "total_nodes": total_nodes,
        "covered": covered,
        "partial": partial,
        "uncovered": uncovered,
        "dead": dead,
        "coverage_percent": coverage_percent,
    }

    report_json = {
        "format": "codeflowx-coverage-v1",
        "import_format": parsed.format,
        "line_hits": {str(k): v for k, v in sorted(parsed.line_hits.items(), key=lambda item: item[0])},
        "node_hits": dict(sorted(parsed.node_hits.items(), key=lambda item: item[0])),
        "branch_hits": parsed.branch_hits,
        "summary": summary,
        "node_coverage_map": node_coverage_map,
    }

    return {
        "nodes": updated_nodes,
        "edges": edges,
        "node_coverage_map": node_coverage_map,
        "summary": summary,
        "report_json": report_json,
    }


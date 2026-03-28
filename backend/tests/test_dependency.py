from backend.main import _run_dependency_pipeline, DEPENDENCY_GRAPH_CACHE
from backend.modules.dependency import rank_dependency_nodes, build_subgraph


def test_dependency_pipeline_python_core_edges():
    code = """
import requests
from utils.math import helper_util

class BaseProcessor:
    pass

class Processor(BaseProcessor):
    def process(self, x):
        return helper(x)

def helper(v):
    return v * 2

@app.route("/run")
def main():
    requests.get("https://example.com")
    return helper(5)
"""
    result = _run_dependency_pipeline(code=code, language="python", module_path="sample.py")
    assert result["status"] == "success"
    assert result["graph_id"] in DEPENDENCY_GRAPH_CACHE

    nodes = result["nodes"]
    edges = result["edges"]
    clusters = result["clusters"]

    node_types = {node["type"] for node in nodes}
    edge_types = {edge["type"] for edge in edges}

    assert "module" in node_types
    assert "class" in node_types
    assert "entrypoint" in node_types
    assert "function" in node_types or "method" in node_types
    assert "external" in node_types

    assert "imports" in edge_types
    assert "inherits" in edge_types
    assert "calls" in edge_types
    assert "depends_on" in edge_types
    assert "triggers" in edge_types

    assert any(cluster["type"] == "module" for cluster in clusters)
    assert any(cluster["type"] == "class" for cluster in clusters)


def test_dependency_search_ranks_best_match_first():
    code = """
def helper():
    return 1

def main():
    return helper()
"""
    result = _run_dependency_pipeline(code=code, language="python", module_path="search_case.py")
    nodes = result["nodes"]
    ranked = rank_dependency_nodes(nodes, query="main", limit=10)

    assert ranked
    assert ranked[0]["name"] == "main"


def test_dependency_subgraph_returns_neighbors():
    code = """
def alpha():
    return beta()

def beta():
    return 2
"""
    result = _run_dependency_pipeline(code=code, language="python", module_path="subgraph.py")
    nodes = result["nodes"]
    edges = result["edges"]

    alpha = next(node for node in nodes if node["name"] == "alpha")
    subgraph = build_subgraph(nodes, edges, node_id=alpha["id"], hops=1)

    assert any(node["id"] == alpha["id"] for node in subgraph["nodes"])
    assert len(subgraph["edges"]) >= 1


def test_dependency_resolution_prefers_local_then_import_aware_external():
    code = """
import numpy as np
from tools.shared import external_helper as ext_helper

def helper():
    return 1

def main():
    x = helper()
    y = np.array([1, 2, 3])
    z = ext_helper()
    return x
"""
    result = _run_dependency_pipeline(code=code, language="python", module_path="imports.py")
    assert result["status"] == "success"

    nodes = result["nodes"]
    edges = result["edges"]
    call_resolution_map = result.get("call_resolution_map", {})

    helper_node = next(node for node in nodes if node["name"] == "helper")
    main_node = next(node for node in nodes if node["name"] == "main")

    assert any(
        edge["source"] == main_node["id"]
        and edge["target"] == helper_node["id"]
        and edge["type"] == "calls"
        for edge in edges
    )
    assert any(
        node["type"] == "external" and node["name"] in {"numpy", "tools"}
        for node in nodes
    )
    assert any(
        record.get("resolution_type") == "local_symbol"
        for record in call_resolution_map.values()
    )
    assert any(
        record.get("resolution_type") == "external"
        for record in call_resolution_map.values()
    )

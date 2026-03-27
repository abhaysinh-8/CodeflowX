from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dependency_api_end_to_end():
    headers = _auth_headers()
    code = """
import requests

def helper():
    return 1

def main():
    requests.get("https://example.com")
    return helper()
"""
    dep_res = client.post(
        "/api/v1/dependency",
        headers=headers,
        json={"code": code, "language": "python", "module_path": "api_case.py"},
    )
    assert dep_res.status_code == 200
    dep_data = dep_res.json()
    assert dep_data["status"] == "success"
    assert dep_data["graph_id"]
    assert dep_data["nodes"]
    assert "flowchart_job_id" in dep_data["nodes"][0]

    graph_id = dep_data["graph_id"]
    search_res = client.get(
        "/api/v1/dependency/search",
        headers=headers,
        params={"q": "main", "graph_id": graph_id},
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["status"] == "success"
    assert isinstance(search_data["results"], list)

    node_id = dep_data["nodes"][0]["id"]
    subgraph_res = client.get(
        f"/api/v1/dependency/subgraph/{node_id}",
        headers=headers,
        params={"graph_id": graph_id, "hops": 1},
    )
    assert subgraph_res.status_code == 200
    subgraph_data = subgraph_res.json()
    assert subgraph_data["status"] == "success"
    assert "nodes" in subgraph_data
    assert "edges" in subgraph_data

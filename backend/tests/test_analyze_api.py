from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_analyze_api_returns_unified_payload_with_cross_view_fields():
    headers = _auth_headers()
    code = """
def helper(x):
    return x + 1

def main():
    y = helper(2)
    return y
"""
    res = client.post(
        "/api/v1/analyze",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["job_id"]

    assert "flowchart" in data
    assert "dependency" in data
    assert "execution" in data
    assert "coverage" in data
    assert "ir_node_lookup" in data

    dep_nodes = data["dependency"]["nodes"]
    assert dep_nodes
    assert all(node.get("flowchart_job_id") == data["job_id"] for node in dep_nodes)

    steps = data["execution"]["steps"]
    assert steps
    assert "currently_executing_function_id" in steps[0]

    flow_ir_ids = {
        str(node.get("data", {}).get("ir_node_id", "")).strip()
        for node in data["flowchart"]["nodes"]
        if str(node.get("data", {}).get("ir_node_id", "")).strip()
    }
    lookup_keys = set(data["ir_node_lookup"].keys())
    assert flow_ir_ids & lookup_keys
    assert isinstance(data["coverage"]["coverage_node_coverage_map"], dict)


def test_analyze_poll_returns_cached_bundle():
    headers = _auth_headers()
    code = "def a():\n    return 1\n"
    create_res = client.post(
        "/api/v1/analyze",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert create_res.status_code == 200
    payload = create_res.json()
    job_id = payload["job_id"]

    poll_res = client.get(f"/api/v1/analyze/{job_id}", headers=headers)
    assert poll_res.status_code == 200
    poll = poll_res.json()
    assert poll["status"] == "completed"
    assert poll["job_id"] == job_id
    assert poll["results"]["job_id"] == job_id
    assert "dependency" in poll["results"]


def test_analyze_lazy_flowchart_endpoint_returns_focus_metadata():
    headers = _auth_headers()
    code = """
def ping():
    return 1

def pong():
    return ping()
"""
    analyze_res = client.post(
        "/api/v1/analyze",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert analyze_res.status_code == 200
    payload = analyze_res.json()
    job_id = payload["job_id"]

    candidate_ir_id = ""
    for node in payload["dependency"]["nodes"]:
        ir_id = str(node.get("ir_node_id") or "").strip()
        if ir_id:
            candidate_ir_id = ir_id
            break
    if not candidate_ir_id:
        for node in payload["flowchart"]["nodes"]:
            ir_id = str(node.get("data", {}).get("ir_node_id") or "").strip()
            if ir_id:
                candidate_ir_id = ir_id
                break
    assert candidate_ir_id

    lazy_res = client.get(
        f"/api/v1/analyze/{job_id}/flowchart",
        headers=headers,
        params={"ir_node_id": candidate_ir_id},
    )
    assert lazy_res.status_code == 200
    lazy_payload = lazy_res.json()
    assert lazy_payload["status"] == "success"
    assert lazy_payload["focus_ir_node_id"] == candidate_ir_id
    assert isinstance(lazy_payload["flowchart"]["nodes"], list)

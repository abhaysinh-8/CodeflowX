from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _find_dep_node_by_name(nodes: list[dict], name: str) -> dict:
    return next(node for node in nodes if str(node.get("name", "")).strip() == name)


def test_failure_simulation_single_failure():
    headers = _auth_headers()
    code = """
def c():
    return 1

def b():
    return c()

def a():
    return b()

def main():
    return a()
"""
    analyze = client.post(
        "/api/v1/analyze",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert analyze.status_code == 200
    payload = analyze.json()
    job_id = payload["job_id"]

    c_node = _find_dep_node_by_name(payload["dependency"]["nodes"], "c")
    simulate = client.post(
        "/api/v1/simulate/failure",
        headers=headers,
        json={
            "job_id": job_id,
            "failed_function_id": c_node["ir_node_id"],
        },
    )
    assert simulate.status_code == 200
    sim = simulate.json()
    assert sim["status"] == "success"
    assert sim["blast_radius"] >= 1
    assert isinstance(sim["affected_nodes"], list)
    assert any(node["severity"] == "failed" for node in sim["affected_nodes"])
    assert any(node["severity"] == "directly_affected" for node in sim["affected_nodes"])
    assert isinstance(sim["unreachable_branches"], list)


def test_failure_simulation_multi_failure_ids():
    headers = _auth_headers()
    code = """
def z():
    return 1

def y():
    return z()

def x():
    return y()
"""
    analyze = client.post(
        "/api/v1/analyze",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert analyze.status_code == 200
    payload = analyze.json()
    job_id = payload["job_id"]

    x_node = _find_dep_node_by_name(payload["dependency"]["nodes"], "x")
    z_node = _find_dep_node_by_name(payload["dependency"]["nodes"], "z")
    simulate = client.post(
        "/api/v1/simulate/failure",
        headers=headers,
        json={
            "job_id": job_id,
            "failed_function_ids": [x_node["id"], z_node["id"]],
        },
    )
    assert simulate.status_code == 200
    sim = simulate.json()
    assert sim["status"] == "success"
    assert len(sim["failed_function_ids"]) == 2
    assert all(
        identifier in sim["failed_function_ids"]
        for identifier in [x_node["id"], z_node["id"]]
    )

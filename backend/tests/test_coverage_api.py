import json

from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_coverage_api_imports_cobertura_and_returns_node_coverage_map():
    headers = _auth_headers()
    code = """
def add(a, b):
    c = a + b
    if c > 0:
        return c
    return 0
"""
    flow = client.post(
        "/api/v1/flowchart",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert flow.status_code == 200
    flow_payload = flow.json()
    assert flow_payload["status"] == "success"

    coverage_xml = """<?xml version="1.0" ?>
<coverage>
  <packages>
    <package name="app">
      <classes>
        <class name="app.py" filename="app.py">
          <lines>
            <line number="2" hits="1"/>
            <line number="3" hits="1"/>
            <line number="4" hits="1"/>
            <line number="5" hits="1"/>
            <line number="6" hits="0"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
""".encode("utf8")

    response = client.post(
        "/api/v1/coverage",
        headers=headers,
        files={"file": ("coverage.xml", coverage_xml, "application/xml")},
        data={"flowchart_json": json.dumps({"nodes": flow_payload["nodes"], "edges": flow_payload["edges"]})},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["format"] == "pytest-cov"
    assert "node_coverage_map" in payload
    assert "summary" in payload
    assert payload["summary"]["total_nodes"] >= 1
    assert any(
        node.get("data", {}).get("coverage_status") in {"fully_covered", "partially_covered", "uncovered", "dead"}
        for node in payload["flowchart"]["nodes"]
    )


def test_coverage_api_rejects_unknown_format():
    headers = _auth_headers()
    response = client.post(
        "/api/v1/coverage",
        headers=headers,
        files={"file": ("coverage.txt", b"not-a-coverage-format", "text/plain")},
        data={"flowchart_json": json.dumps({"nodes": [{"id": "start-node", "type": "terminal", "data": {}, "position": {"x": 0, "y": 0}}], "edges": []})},
    )
    assert response.status_code == 400
    assert "Unsupported coverage format" in response.json()["detail"]


from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_flowchart_api_reports_missing_token_syntax_error():
    headers = _auth_headers()
    code = "def broken(:\n    pass\n"
    response = client.post(
        "/api/v1/flowchart",
        headers=headers,
        json={"code": code, "language": "python"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "error"
    assert "Syntax error" in payload["error"]
    assert payload["line"] >= 1
    assert payload["column"] >= 1


from urllib.parse import parse_qs, urlparse
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from backend.main import app
from backend.github.store import get_github_store
from backend.services.github_service import get_github_service


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_github_oauth_callback_stores_encrypted_token(monkeypatch):
    headers = _auth_headers()

    auth_response = client.get("/api/v1/github/auth", headers=headers, follow_redirects=False)
    assert auth_response.status_code in {302, 307}

    redirect_target = auth_response.headers.get("location")
    assert redirect_target

    parsed = urlparse(redirect_target)
    state = parse_qs(parsed.query).get("state", [""])[0]
    assert state

    service = get_github_service()
    monkeypatch.setattr(service, "exchange_code_for_token", AsyncMock(return_value="gho_mock_token"))

    callback_response = client.get(
        "/api/v1/github/callback",
        params={"code": "sample_code", "state": state},
    )
    assert callback_response.status_code == 200
    assert "GitHub connected" in callback_response.text

    store = get_github_store()
    encrypted = store.get_encrypted_token("demo_user")
    assert encrypted
    assert encrypted != "gho_mock_token"
    assert service.get_user_token("demo_user") == "gho_mock_token"

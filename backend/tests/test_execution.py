from fastapi.testclient import TestClient

from backend.ir.transformer import ASTTransformer
from backend.modules.execution import ExecutionInterpreter
from backend.parsers.grammar_loader import GrammarLoader
from backend.main import app


client = TestClient(app)


def _auth_headers() -> dict:
    token = client.post("/api/v1/login").json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _ir_to_dict(node) -> dict:
    return {
        "id": node.id,
        "type": node.type.value,
        "language": node.language,
        "name": node.name,
        "source_start": node.source_start,
        "source_end": node.source_end,
        "children": [_ir_to_dict(c) for c in node.children],
        "metadata": node.metadata,
    }


def _build_ir_payload(code: str, language: str = "python") -> dict:
    tree = GrammarLoader.parse(code, language)
    ir = ASTTransformer(language, code).transform(tree.root_node)
    return _ir_to_dict(ir)


def test_execution_interpreter_tracks_variables_and_control_flow():
    code = """
x = 1
if x > 0:
    x = 2
for i in range(2):
    y = i
"""
    tree = GrammarLoader.parse(code, "python")
    ir = ASTTransformer("python", code).transform(tree.root_node)
    steps = ExecutionInterpreter(ir, source_code=code, step_limit=100).generate_steps()

    assert steps, "Interpreter should emit execution steps"
    assert any(step.branch_taken in {"true", "false"} for step in steps), "Expected IF branch decision step"
    assert any(step.branch_taken == "loop" for step in steps), "Expected loop branch steps"
    assert any("x" in step.variables for step in steps), "Variable x should appear in snapshots"
    assert any("y" in step.variables for step in steps), "Variable y should appear in snapshots"


def test_execution_api_generates_job_and_step_lookup():
    headers = _auth_headers()
    code = """
def add(a, b):
    return a + b

result = add(1, 2)
"""
    ir_payload = _build_ir_payload(code)

    response = client.post(
        "/api/v1/execution",
        headers=headers,
        json={
            "ir": ir_payload,
            "code": code,
            "breakpoint_node_ids": [],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["job_id"]
    assert data["total_steps"] > 0

    step_res = client.get(
        f"/api/v1/execution/{data['job_id']}/step/1",
        headers=headers,
    )
    assert step_res.status_code == 200
    step_data = step_res.json()
    assert step_data["status"] == "success"
    assert step_data["step"]["active_node_id"].startswith("node-")
    assert isinstance(step_data["variables"], dict)


def test_execution_breakpoint_hits_are_recorded_after_websocket_pause():
    headers = _auth_headers()
    code = """
x = 1
x = x + 1
"""
    ir_payload = _build_ir_payload(code)

    bootstrap = client.post(
        "/api/v1/execution",
        headers=headers,
        json={"ir": ir_payload, "code": code, "breakpoint_node_ids": []},
    ).json()
    first_node = bootstrap["steps"][0]["active_node_id"]

    run_res = client.post(
        "/api/v1/execution",
        headers=headers,
        json={"ir": ir_payload, "code": code, "breakpoint_node_ids": [first_node]},
    )
    assert run_res.status_code == 200
    job_id = run_res.json()["job_id"]

    paused_received = False
    with client.websocket_connect(f"/execution/{job_id}?rate=100") as ws:
        for _ in range(6):
            event = ws.receive_json()
            if event.get("event") == "PAUSED":
                paused_received = True
                break

    assert paused_received, "Expected websocket stream to pause on breakpoint"

    bp_res = client.get(f"/api/v1/execution/{job_id}/breakpoints", headers=headers)
    assert bp_res.status_code == 200
    bp_data = bp_res.json()
    assert bp_data["status"] == "success"
    assert any(hit["node_id"] == first_node for hit in bp_data["hits"])

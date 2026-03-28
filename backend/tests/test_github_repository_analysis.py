from __future__ import annotations

from pathlib import Path

from backend.github.store import GitHubStore
from backend.services.github_service import GitHubService


def test_repository_analysis_detects_supported_files_and_builds_graph():
    fixture_repo = Path(__file__).resolve().parent / "fixtures" / "github_repo"
    assert fixture_repo.exists()

    store = GitHubStore()
    service = GitHubService(store=store)

    record = store.create_repo(
        user_id="demo_user",
        repo_url="https://github.com/acme/example",
        owner="acme",
        name="example",
        clone_url="https://github.com/acme/example.git",
    )
    store.update_repo(record.repo_id, local_path=str(fixture_repo))

    payload = service.analyze_repository(record.repo_id)

    assert payload["status"] == "completed"
    assert payload["stats"]["total_files"] == 2
    assert payload["stats"]["total_functions"] >= 2
    assert len(payload["graph"]["nodes"]) >= 1
    assert "helper" in payload["graph"]["function_registry"]


def test_search_functions_returns_ranked_results():
    service = GitHubService(store=GitHubStore())
    index = [
        {
            "name": "process_items",
            "path": "core/pipeline.py",
            "language": "python",
            "ir_node_id": "1",
            "line": 10,
        },
        {
            "name": "processor",
            "path": "core/processor.py",
            "language": "python",
            "ir_node_id": "2",
            "line": 20,
        },
        {
            "name": "emit_metric",
            "path": "telemetry/log.ts",
            "language": "typescript",
            "ir_node_id": "3",
            "line": 2,
        },
    ]

    result = service.search_functions(search_index=index, query="process", cursor=None, limit=1)

    assert result["total"] >= 2
    assert len(result["results"]) == 1
    assert result["results"][0]["name"] in {"process_items", "processor"}
    assert result["next_cursor"] == "1"

    next_page = service.search_functions(search_index=index, query="process", cursor=result["next_cursor"], limit=2)
    assert isinstance(next_page["results"], list)

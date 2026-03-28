from __future__ import annotations

import asyncio
import os
import shutil

import pytest

from backend.github.store import GitHubStore
from backend.services.github_service import GitHubService


def test_public_github_repo_end_to_end_clone_and_analysis():
    run_flag = os.getenv("CODEFLOWX_RUN_GITHUB_INTEGRATION", "0").strip().lower()
    if run_flag not in {"1", "true", "yes", "on"}:
        pytest.skip("Set CODEFLOWX_RUN_GITHUB_INTEGRATION=1 to run network integration test")

    store = GitHubStore()
    service = GitHubService(store=store)
    parsed = service.parse_repo_url("https://github.com/pypa/sampleproject")

    record = store.create_repo(
        user_id="demo_user",
        repo_url="https://github.com/pypa/sampleproject",
        owner=parsed.owner,
        name=parsed.repo,
        clone_url=parsed.clone_url,
    )

    clone_path = asyncio.run(service.clone_repository(record.repo_id, parsed.clone_url))
    store.update_repo(record.repo_id, local_path=clone_path)

    try:
        payload = service.analyze_repository(record.repo_id)
        assert payload["status"] == "completed"
        assert payload["stats"]["total_files"] >= 1
    finally:
        shutil.rmtree(clone_path, ignore_errors=True)

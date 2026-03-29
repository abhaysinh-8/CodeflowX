from __future__ import annotations

from pydantic import BaseModel, Field


class GitHubConnectRequest(BaseModel):
    repo_url: str = Field(min_length=1)


class GitHubConnectResponse(BaseModel):
    repo_id: str


class GitHubStatusResponse(BaseModel):
    status: str
    progress: float
    files_parsed: int
    total_files: int
    current_file: str


class GitHubCancelResponse(BaseModel):
    status: str
    repo_id: str

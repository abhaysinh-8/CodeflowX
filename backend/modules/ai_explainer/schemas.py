from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


ExplainType = Literal["node", "edge", "coverage", "failure"]


class ExplainRequestBase(BaseModel):
    """
    Shared explain request shape used by all explain endpoints.
    """

    model_config = ConfigDict(extra="allow")

    job_id: Optional[str] = None
    source_code: str = ""
    language: Optional[str] = None
    ir: Optional[Dict[str, Any]] = None

    flow_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    flow_edges: List[Dict[str, Any]] = Field(default_factory=list)

    execution_steps: List[Dict[str, Any]] = Field(default_factory=list)
    execution_step_index: Optional[int] = None
    execution_state: Dict[str, Any] = Field(default_factory=dict)

    coverage: Dict[str, Any] = Field(default_factory=dict)
    dependency: Dict[str, Any] = Field(default_factory=dict)

    previous_explanation: Optional[str] = None
    follow_up: bool = False
    user_note: Optional[str] = None


class NodeExplainRequest(ExplainRequestBase):
    ir_node_id: str = Field(min_length=1)


class EdgeExplainRequest(ExplainRequestBase):
    edge_id: str = Field(min_length=1)
    source_ir_node_id: Optional[str] = None
    target_ir_node_id: Optional[str] = None


class CoverageExplainRequest(ExplainRequestBase):
    coverage_id: str = Field(min_length=1)
    ir_node_id: Optional[str] = None


class FailureExplainRequest(ExplainRequestBase):
    mode: Literal["explain"] = "explain"
    ir_node_id: Optional[str] = None
    failed_function_id: Optional[str] = None
    failed_function_ids: List[str] = Field(default_factory=list)


class ExplainJobResponse(BaseModel):
    status: Literal["queued"] = "queued"
    job_id: str
    cache_hit: bool = False


class ExplainResult(BaseModel):
    explanation: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    relevant_lines: List[int] = Field(default_factory=list)

    @field_validator("relevant_lines", mode="before")
    @classmethod
    def _normalize_relevant_lines(cls, value: Any) -> List[int]:
        if isinstance(value, tuple):
            value = list(value)
        if not isinstance(value, list):
            return []

        normalized: List[int] = []
        for item in value:
            try:
                normalized.append(max(1, int(item)))
            except Exception:
                continue
        if len(normalized) >= 2:
            return [normalized[0], normalized[1]]
        if len(normalized) == 1:
            return [normalized[0], normalized[0]]
        return []


class ExplainChunkMessage(BaseModel):
    type: Literal["chunk"] = "chunk"
    text: str


class ExplainFinalMessage(ExplainResult):
    type: Literal["final"] = "final"


class ExplainErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    error: str


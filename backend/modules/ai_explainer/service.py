from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Dict, Mapping, Tuple

from .cache import ExplanationCache, ExplanationJobStore
from .context_builder import build_context
from .prompt_builder import (
    build_coverage_prompt,
    build_edge_prompt,
    build_failure_prompt,
    build_node_prompt,
)
from .provider import stream_completion
from .schemas import ExplainResult


class AIExplainerService:
    def __init__(
        self,
        *,
        cache: ExplanationCache | None = None,
        job_store: ExplanationJobStore | None = None,
    ) -> None:
        self.cache = cache or ExplanationCache(ttl_seconds=3600)
        self.job_store = job_store or ExplanationJobStore(ttl_seconds=3600)

    async def submit_job(
        self,
        *,
        explain_type: str,
        target_id: str,
        payload: Mapping[str, Any],
        user_id: str,
    ) -> Tuple[str, bool]:
        job_id = str(uuid.uuid4())
        normalized_target_id = (target_id or "unknown").strip() or "unknown"
        cache_key = self._cache_key(explain_type, normalized_target_id)

        await self.job_store.create_job(
            job_id=job_id,
            user_id=user_id,
            explain_type=explain_type,
            target_id=normalized_target_id,
        )

        cached = await self.cache.get(cache_key)
        if cached:
            result = ExplainResult.model_validate(cached)
            await self.job_store.append_event(
                job_id,
                {"type": "chunk", "text": result.explanation},
            )
            await self.job_store.append_event(
                job_id,
                {
                    "type": "final",
                    "explanation": result.explanation,
                    "confidence": result.confidence,
                    "relevant_lines": result.relevant_lines,
                },
            )
            await self.job_store.mark_completed(job_id, cache_hit=True)
            return job_id, True

        task_payload = dict(payload)
        asyncio.create_task(
            self._run_job(
                job_id=job_id,
                explain_type=explain_type,
                target_id=normalized_target_id,
                payload=task_payload,
                cache_key=cache_key,
            )
        )
        return job_id, False

    async def _run_job(
        self,
        *,
        job_id: str,
        explain_type: str,
        target_id: str,
        payload: Dict[str, Any],
        cache_key: str,
    ) -> None:
        await self.job_store.mark_running(job_id)
        try:
            context = build_context(explain_type, payload)
            prompt = self._build_prompt(explain_type, context)

            buffered: list[str] = []
            async for token in stream_completion(prompt):
                if not token:
                    continue
                buffered.append(token)
                await self.job_store.append_event(job_id, {"type": "chunk", "text": token})

            raw_text = "".join(buffered).strip()
            result = self._parse_result(raw_text=raw_text, context=context)
            await self.cache.set(cache_key, result.model_dump(), ttl_seconds=3600)
            await self.job_store.append_event(
                job_id,
                {
                    "type": "final",
                    "explanation": result.explanation,
                    "confidence": result.confidence,
                    "relevant_lines": result.relevant_lines,
                },
            )
            await self.job_store.mark_completed(job_id, cache_hit=False)
        except Exception as exc:
            await self.job_store.mark_error(job_id, str(exc))

    def _build_prompt(self, explain_type: str, context: Dict[str, Any]) -> str:
        if explain_type == "node":
            return build_node_prompt(context)
        if explain_type == "edge":
            return build_edge_prompt(context)
        if explain_type == "coverage":
            return build_coverage_prompt(context)
        if explain_type == "failure":
            return build_failure_prompt(context)
        return build_node_prompt(context)

    def _parse_result(self, *, raw_text: str, context: Dict[str, Any]) -> ExplainResult:
        payload = _extract_json(raw_text)
        if not payload:
            fallback_lines = _fallback_relevant_lines(context)
            return ExplainResult(
                explanation=raw_text or "Unable to produce a structured explanation.",
                confidence=0.35,
                relevant_lines=fallback_lines,
            )

        explanation = str(payload.get("explanation", "")).strip()
        if not explanation:
            explanation = raw_text.strip() or "No explanation generated."

        confidence = _safe_float(payload.get("confidence"), default=0.45)
        relevant_lines = payload.get("relevant_lines")
        if not isinstance(relevant_lines, list) or len(relevant_lines) < 2:
            relevant_lines = _fallback_relevant_lines(context)

        return ExplainResult(
            explanation=explanation,
            confidence=max(0.0, min(1.0, confidence)),
            relevant_lines=relevant_lines,
        )

    @staticmethod
    def _cache_key(explain_type: str, target_id: str) -> str:
        return f"explain:{explain_type}:{target_id}"


def _extract_json(text: str) -> Dict[str, Any]:
    stripped = text.strip()
    if not stripped:
        return {}

    # Direct JSON case.
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Markdown fenced JSON case.
    if "```" in stripped:
        sections = stripped.split("```")
        for section in sections:
            candidate = section.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                continue

    # Best-effort brace extraction.
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        candidate = stripped[start : end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            return {}
    return {}


def _fallback_relevant_lines(context: Mapping[str, Any]) -> list[int]:
    ir_node = context.get("ir_node")
    if isinstance(ir_node, dict):
        start = _safe_int(ir_node.get("source_start"), default=0)
        end = _safe_int(ir_node.get("source_end"), default=start)
        if start > 0:
            if end < start:
                end = start
            return [start, end]

        source_node = ir_node.get("source_node")
        if isinstance(source_node, dict):
            data = source_node.get("data", {})
            if isinstance(data, dict):
                start = _safe_int(data.get("source_start"), default=0)
                end = _safe_int(data.get("source_end"), default=start)
                if start > 0:
                    return [start, max(start, end)]

    edge = context.get("edge")
    if isinstance(edge, dict):
        source = edge.get("source")
        target = edge.get("target")
        for node in (source, target):
            if not isinstance(node, dict):
                continue
            data = node.get("data", {})
            if not isinstance(data, dict):
                continue
            start = _safe_int(data.get("source_start"), default=0)
            end = _safe_int(data.get("source_end"), default=start)
            if start > 0:
                return [start, max(start, end)]

    return [1, 1]


def _safe_float(value: Any, *, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, *, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


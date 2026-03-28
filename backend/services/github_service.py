from __future__ import annotations

import asyncio
import os
import re
import shutil
import tempfile
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, Generator, Iterable, List, Optional, Tuple
from urllib.parse import quote_plus

import httpx
from cryptography.fernet import Fernet

from backend.ir.transformer import ASTTransformer
from backend.modules.coverage import apply_coverage_to_flowchart, parse_coverage_payload
from backend.modules.dependency import DependencyModule
from backend.modules.flowchart import FlowchartModule
from backend.parsers.grammar_loader import GrammarLoader
from backend.github.store import GitHubStore, get_github_store


SUPPORTED_EXTENSIONS = {".py", ".js", ".ts", ".java"}
EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".java": "java",
}
IGNORED_DIRECTORIES = {".git", "node_modules", "venv", ".venv", "dist", "build", "__pycache__"}

REPO_URL_PATTERN = re.compile(
    r"^https?://github\.com/(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)
SSH_REPO_URL_PATTERN = re.compile(
    r"^git@github\.com:(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?$",
    re.IGNORECASE,
)


@dataclass
class ParsedRepoURL:
    owner: str
    repo: str
    clone_url: str


class GitHubService:
    def __init__(self, store: Optional[GitHubStore] = None) -> None:
        self.store = store or get_github_store()

        self.client_id = os.getenv("GITHUB_CLIENT_ID", "")
        self.client_secret = os.getenv("GITHUB_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/v1/github/callback")
        self.scope = os.getenv("CODEFLOWX_GITHUB_SCOPE", "read:user")
        self.auth_url = "https://github.com/login/oauth/authorize"
        self.token_url = "https://github.com/login/oauth/access_token"

        base_storage = os.getenv("CODEFLOWX_GITHUB_REPO_STORAGE")
        if base_storage:
            self.repo_storage_root = Path(base_storage).expanduser().resolve()
        else:
            self.repo_storage_root = Path(tempfile.gettempdir()) / "repos"
        self.repo_storage_root.mkdir(parents=True, exist_ok=True)

        fernet_key = os.getenv("CODEFLOWX_GITHUB_FERNET_KEY") or os.getenv("GITHUB_TOKEN_FERNET_KEY")
        self._fernet = self._build_fernet(fernet_key)

        try:
            self.clone_timeout_seconds = max(20, int(os.getenv("CODEFLOWX_GITHUB_CLONE_TIMEOUT_SECONDS", "180")))
        except ValueError:
            self.clone_timeout_seconds = 180

        try:
            self.max_file_bytes = max(4096, int(os.getenv("CODEFLOWX_GITHUB_MAX_FILE_BYTES", "786432")))
        except ValueError:
            self.max_file_bytes = 786432

    @staticmethod
    def _build_fernet(raw_key: Optional[str]) -> Fernet:
        key = (raw_key or "").strip().encode("utf8")
        if key:
            try:
                return Fernet(key)
            except Exception:
                pass
        return Fernet(Fernet.generate_key())

    def create_oauth_state(self, user_id: str) -> str:
        return self.store.create_oauth_state(user_id=user_id)

    def build_authorization_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scope,
            "state": state,
            "allow_signup": "true",
        }
        encoded = "&".join(f"{key}={quote_plus(str(value))}" for key, value in params.items())
        return f"{self.auth_url}?{encoded}"

    async def exchange_code_for_token(self, code: str) -> str:
        if not self.client_id or not self.client_secret:
            raise RuntimeError("GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.")

        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "CodeFlowX+-GitHub-Integration",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(self.token_url, data=payload, headers=headers)

        if response.status_code >= 400:
            raise RuntimeError(f"GitHub token exchange failed ({response.status_code}).")

        data = response.json()
        access_token = str(data.get("access_token", "")).strip()
        if not access_token:
            description = str(data.get("error_description") or data.get("error") or "Token missing in GitHub response.")
            raise RuntimeError(description)

        return access_token

    def encrypt_token(self, token: str) -> str:
        return self._fernet.encrypt(token.encode("utf8")).decode("utf8")

    def decrypt_token(self, encrypted_token: str) -> str:
        return self._fernet.decrypt(encrypted_token.encode("utf8")).decode("utf8")

    def store_user_token(self, user_id: str, token: str) -> None:
        encrypted = self.encrypt_token(token)
        self.store.set_encrypted_token(user_id, encrypted)

    def get_user_token(self, user_id: str) -> Optional[str]:
        encrypted = self.store.get_encrypted_token(user_id)
        if not encrypted:
            return None
        try:
            return self.decrypt_token(encrypted)
        except Exception:
            return None

    def parse_repo_url(self, repo_url: str) -> ParsedRepoURL:
        normalized = str(repo_url or "").strip()
        if not normalized:
            raise ValueError("repo_url is required.")

        match = REPO_URL_PATTERN.match(normalized) or SSH_REPO_URL_PATTERN.match(normalized)
        if not match:
            raise ValueError("Invalid repository URL. Expected https://github.com/<owner>/<repo>.")

        owner = match.group("owner")
        repo = match.group("repo")
        clone_url = f"https://github.com/{owner}/{repo}.git"
        return ParsedRepoURL(owner=owner, repo=repo, clone_url=clone_url)

    def create_repository_record(self, user_id: str, repo_url: str) -> Dict[str, Any]:
        parsed = self.parse_repo_url(repo_url)
        record = self.store.create_repo(
            user_id=user_id,
            repo_url=repo_url,
            owner=parsed.owner,
            name=parsed.repo,
            clone_url=parsed.clone_url,
        )
        return record.to_dict()

    def _inject_token(self, clone_url: str, token: Optional[str]) -> str:
        if not token:
            return clone_url
        if not clone_url.startswith("https://github.com/"):
            return clone_url
        safe = quote_plus(token)
        return clone_url.replace("https://", f"https://x-access-token:{safe}@", 1)

    async def clone_repository(self, repo_id: str, clone_url: str, token: Optional[str] = None) -> str:
        destination = self.repo_storage_root / repo_id
        if destination.exists():
            shutil.rmtree(destination, ignore_errors=True)
        destination.mkdir(parents=True, exist_ok=True)

        auth_url = self._inject_token(clone_url, token)

        def _clone() -> None:
            try:
                from git import Repo
            except Exception as exc:  # pragma: no cover
                raise RuntimeError("GitPython is required for repository cloning.") from exc

            Repo.clone_from(
                auth_url,
                str(destination),
                depth=1,
                single_branch=True,
            )

        try:
            await asyncio.wait_for(asyncio.to_thread(_clone), timeout=float(self.clone_timeout_seconds))
        except asyncio.TimeoutError as exc:
            shutil.rmtree(destination, ignore_errors=True)
            raise TimeoutError("Repository clone timed out. Try a smaller repo or increase timeout.") from exc
        except Exception as exc:
            shutil.rmtree(destination, ignore_errors=True)
            raise RuntimeError("Repository clone failed. Verify repository URL and access permissions.") from exc

        return str(destination)

    def detect_supported_files(self, repo_path: str) -> List[str]:
        base = Path(repo_path)
        if not base.exists():
            return []

        discovered: List[str] = []
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES]
            root_path = Path(root)
            for file_name in files:
                suffix = Path(file_name).suffix.lower()
                if suffix not in SUPPORTED_EXTENSIONS:
                    continue
                absolute = root_path / file_name
                relative = absolute.relative_to(base).as_posix()
                discovered.append(relative)

        discovered.sort()
        return discovered

    def detect_coverage_files(self, repo_path: str) -> List[str]:
        matches: List[str] = []
        base = Path(repo_path)
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES]
            root_path = Path(root)
            for file_name in files:
                lowered = file_name.lower()
                if lowered in {"coverage.xml", "lcov.info"}:
                    matches.append((root_path / file_name).as_posix())
        return sorted(matches)

    @staticmethod
    def _find_syntax_issue(node: Any) -> Optional[Dict[str, int]]:
        stack = [node]
        while stack:
            current = stack.pop(0)
            is_missing = bool(getattr(current, "is_missing", False))
            if current.type == "ERROR" or is_missing:
                return {
                    "line": int(current.start_point[0]) + 1,
                    "column": int(current.start_point[1]) + 1,
                }
            stack.extend(list(current.children))
        return None

    @staticmethod
    def _ir_to_dict(node: Any) -> Dict[str, Any]:
        return {
            "id": node.id,
            "type": node.type.value,
            "language": node.language,
            "name": node.name,
            "source_start": node.source_start,
            "source_end": node.source_end,
            "children": [GitHubService._ir_to_dict(child) for child in node.children],
            "metadata": node.metadata,
        }

    @staticmethod
    def _iter_ir_nodes(ir_payload: Dict[str, Any]) -> Generator[Dict[str, Any], None, None]:
        stack = [ir_payload]
        while stack:
            node = stack.pop()
            if not isinstance(node, dict):
                continue
            yield node
            children = node.get("children", [])
            if isinstance(children, list):
                for child in children:
                    if isinstance(child, dict):
                        stack.append(child)

    def _extract_function_records(
        self,
        *,
        file_path: str,
        language: str,
        ir_payload: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []
        for node in self._iter_ir_nodes(ir_payload):
            if str(node.get("type", "")).strip() != "function_def":
                continue
            name = str(node.get("name", "")).strip() or "anonymous"
            ir_node_id = str(node.get("id", "")).strip()
            records.append(
                {
                    "name": name,
                    "path": file_path,
                    "language": language,
                    "ir_node_id": ir_node_id,
                    "line": int(node.get("source_start", 0) or 0),
                    "qualified_name": f"{file_path}:{name}",
                }
            )
        return records

    def _count_classes(self, ir_payload: Dict[str, Any]) -> int:
        count = 0
        for node in self._iter_ir_nodes(ir_payload):
            if str(node.get("type", "")).strip() == "class_def":
                count += 1
        return count

    def analyze_file(self, repo_path: str, relative_path: str) -> Dict[str, Any]:
        absolute_path = Path(repo_path) / relative_path
        suffix = absolute_path.suffix.lower()
        language = EXTENSION_TO_LANGUAGE.get(suffix)
        if not language:
            raise ValueError(f"Unsupported language for file: {relative_path}")

        if not absolute_path.exists() or not absolute_path.is_file():
            raise FileNotFoundError(f"File not found: {relative_path}")

        if absolute_path.stat().st_size > self.max_file_bytes:
            raise ValueError(f"File too large for parsing: {relative_path}")

        source = absolute_path.read_text(encoding="utf8", errors="ignore")
        if not source.strip():
            raise ValueError(f"File is empty: {relative_path}")

        tree = GrammarLoader.parse(source, language)
        if not tree:
            raise RuntimeError(f"Failed to parse file: {relative_path}")

        syntax_issue = self._find_syntax_issue(tree.root_node)
        if syntax_issue or bool(getattr(tree.root_node, "has_error", False)):
            raise ValueError(
                f"Syntax error in {relative_path} at line {syntax_issue.get('line', 1) if syntax_issue else 1}"
            )

        transformer = ASTTransformer(language, source)
        ir_tree = transformer.transform(tree.root_node)
        if ir_tree is None:
            raise RuntimeError(f"IR transform failed for: {relative_path}")

        ir_payload = self._ir_to_dict(ir_tree)
        flowchart = FlowchartModule().generate(ir_tree)
        dependency = DependencyModule(source_code=source, language=language, module_path=relative_path).generate(ir_tree)
        function_records = self._extract_function_records(file_path=relative_path, language=language, ir_payload=ir_payload)
        class_count = self._count_classes(ir_payload)

        return {
            "path": relative_path,
            "language": language,
            "source_bytes": len(source.encode("utf8")),
            "ir": ir_payload,
            "flowchart": {
                "nodes": flowchart.get("nodes", []),
                "edges": flowchart.get("edges", []),
            },
            "dependency": {
                "nodes": dependency.get("nodes", []),
                "edges": dependency.get("edges", []),
                "clusters": dependency.get("clusters", []),
                "call_resolution_map": dependency.get("call_resolution_map", {}),
            },
            "function_records": function_records,
            "class_count": class_count,
        }

    @staticmethod
    def _chunked(items: List[str], size: int) -> Generator[List[str], None, None]:
        for i in range(0, len(items), size):
            yield items[i:i + size]

    @staticmethod
    def _map_coverage_by_ir_node_id(
        flow_nodes: Iterable[Dict[str, Any]],
        node_coverage_map: Dict[str, Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        coverage_by_ir: Dict[str, Dict[str, Any]] = {}
        for node in flow_nodes:
            node_id = str(node.get("id", "")).strip()
            data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
            ir_node_id = str(data.get("ir_node_id", "")).strip()
            if not node_id or not ir_node_id:
                continue
            coverage = node_coverage_map.get(node_id)
            if coverage:
                coverage_by_ir[ir_node_id] = dict(coverage)
        return coverage_by_ir

    def _apply_coverage_to_files(self, repo_path: str, file_results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        coverage_files = self.detect_coverage_files(repo_path)
        if not coverage_files:
            return {
                "coverage_files": [],
                "summary": {
                    "total_nodes": 0,
                    "covered": 0,
                    "partial": 0,
                    "uncovered": 0,
                    "dead": 0,
                    "coverage_percent": 0.0,
                },
                "coverage_by_file": {},
            }

        aggregate_summary = {
            "total_nodes": 0,
            "covered": 0,
            "partial": 0,
            "uncovered": 0,
            "dead": 0,
            "coverage_percent": 0.0,
        }
        coverage_by_file: Dict[str, Dict[str, Any]] = {}

        for coverage_path in coverage_files:
            try:
                raw_bytes = Path(coverage_path).read_bytes()
                parsed = parse_coverage_payload(Path(coverage_path).name, raw_bytes)
            except Exception:
                continue

            for file_path, file_result in file_results.items():
                flowchart = file_result.get("flowchart", {}) if isinstance(file_result.get("flowchart"), dict) else {}
                nodes = flowchart.get("nodes", []) if isinstance(flowchart.get("nodes"), list) else []
                edges = flowchart.get("edges", []) if isinstance(flowchart.get("edges"), list) else []
                if not nodes:
                    continue

                merged = apply_coverage_to_flowchart(nodes=nodes, edges=edges, parsed=parsed)
                node_coverage_map = merged.get("node_coverage_map", {})
                coverage_by_ir = self._map_coverage_by_ir_node_id(merged.get("nodes", []), node_coverage_map)

                file_result["flowchart"] = {
                    "nodes": merged.get("nodes", []),
                    "edges": merged.get("edges", []),
                }
                file_result["coverage"] = {
                    "format": parsed.format,
                    "node_coverage_map": node_coverage_map,
                    "coverage_node_coverage_map": coverage_by_ir,
                    "summary": merged.get("summary", {}),
                }
                coverage_by_file[file_path] = file_result["coverage"]

                summary = merged.get("summary", {}) if isinstance(merged.get("summary"), dict) else {}
                aggregate_summary["total_nodes"] += int(summary.get("total_nodes", 0) or 0)
                aggregate_summary["covered"] += int(summary.get("covered", 0) or 0)
                aggregate_summary["partial"] += int(summary.get("partial", 0) or 0)
                aggregate_summary["uncovered"] += int(summary.get("uncovered", 0) or 0)
                aggregate_summary["dead"] += int(summary.get("dead", 0) or 0)

        total_nodes = aggregate_summary["total_nodes"]
        aggregate_summary["coverage_percent"] = round(
            (aggregate_summary["covered"] / total_nodes) * 100.0,
            2,
        ) if total_nodes else 0.0

        return {
            "coverage_files": coverage_files,
            "summary": aggregate_summary,
            "coverage_by_file": coverage_by_file,
        }

    @staticmethod
    def build_file_tree(paths: List[str]) -> List[Dict[str, Any]]:
        root: Dict[str, Any] = {"name": "", "path": "", "type": "directory", "children": {}}

        for path in sorted(paths):
            parts = [part for part in path.split("/") if part]
            cursor = root
            assembled: List[str] = []
            for i, part in enumerate(parts):
                assembled.append(part)
                joined = "/".join(assembled)
                is_leaf = i == len(parts) - 1
                children = cursor.setdefault("children", {})
                if part not in children:
                    children[part] = {
                        "name": part,
                        "path": joined,
                        "type": "file" if is_leaf else "directory",
                        "children": {},
                    }
                cursor = children[part]

        def _flatten(node: Dict[str, Any]) -> Dict[str, Any]:
            children = node.get("children", {})
            if isinstance(children, dict):
                ordered = [
                    _flatten(children[key])
                    for key in sorted(children.keys(), key=lambda item: (children[item]["type"] == "file", item.lower()))
                ]
            else:
                ordered = []
            return {
                "name": node.get("name", ""),
                "path": node.get("path", ""),
                "type": node.get("type", "directory"),
                "children": ordered,
            }

        top_children = root.get("children", {})
        return [_flatten(top_children[key]) for key in sorted(top_children.keys(), key=lambda item: item.lower())]

    def merge_repository_graph(
        self,
        *,
        file_results: Dict[str, Dict[str, Any]],
        function_records: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []
        module_relationships: Dict[Tuple[str, str], int] = {}

        for file_path, file_result in file_results.items():
            dependency = file_result.get("dependency", {}) if isinstance(file_result.get("dependency"), dict) else {}
            dep_nodes = dependency.get("nodes", []) if isinstance(dependency.get("nodes"), list) else []
            dep_edges = dependency.get("edges", []) if isinstance(dependency.get("edges"), list) else []

            local_to_global: Dict[str, str] = {}
            node_module_map: Dict[str, str] = {}

            for node in dep_nodes:
                local_id = str(node.get("id", "")).strip()
                if not local_id:
                    continue
                global_id = f"{file_path}::{local_id}"
                local_to_global[local_id] = global_id
                module_name = str(node.get("module", "")).strip() or file_path
                node_module_map[global_id] = module_name
                enriched = dict(node)
                enriched["id"] = global_id
                enriched["file_path"] = file_path
                nodes.append(enriched)

            for edge in dep_edges:
                source_local = str(edge.get("source", "")).strip()
                target_local = str(edge.get("target", "")).strip()
                if not source_local or not target_local:
                    continue
                source_global = local_to_global.get(source_local, f"{file_path}::{source_local}")
                target_global = local_to_global.get(target_local, f"{file_path}::{target_local}")

                enriched_edge = dict(edge)
                enriched_edge["id"] = f"{file_path}::{edge.get('id', f'{source_local}-{target_local}')}"
                enriched_edge["source"] = source_global
                enriched_edge["target"] = target_global
                enriched_edge["file_path"] = file_path
                edges.append(enriched_edge)

                source_module = node_module_map.get(source_global, file_path)
                target_module = node_module_map.get(target_global, file_path)
                if source_module != target_module:
                    key = (source_module, target_module)
                    module_relationships[key] = module_relationships.get(key, 0) + 1

        function_registry: Dict[str, List[Dict[str, Any]]] = {}
        for record in function_records:
            name = str(record.get("name", "")).strip()
            if not name:
                continue
            function_registry.setdefault(name, []).append(record)

        relationships = [
            {
                "source_module": source,
                "target_module": target,
                "count": count,
            }
            for (source, target), count in sorted(module_relationships.items(), key=lambda item: (-item[1], item[0][0], item[0][1]))
        ]

        return {
            "nodes": nodes,
            "edges": edges,
            "module_relationships": relationships,
            "function_registry": function_registry,
        }

    @staticmethod
    def _score_search_record(record: Dict[str, Any], query: str) -> float:
        q = query.strip().lower()
        if not q:
            return 0.0

        name = str(record.get("name", "")).strip().lower()
        path = str(record.get("path", "")).strip().lower()

        if not name:
            return 0.0

        if name == q:
            return 1.0
        if name.startswith(q):
            return 0.93
        if q in name:
            return 0.84

        score = SequenceMatcher(None, q, name).ratio() * 0.72
        if q in path:
            score += 0.08
        return score

    def search_functions(
        self,
        *,
        search_index: List[Dict[str, Any]],
        query: str,
        cursor: Optional[str],
        limit: int,
    ) -> Dict[str, Any]:
        ranked: List[Tuple[float, Dict[str, Any]]] = []
        for record in search_index:
            score = self._score_search_record(record, query)
            if score > 0.22:
                ranked.append((score, record))

        ranked.sort(key=lambda item: item[0], reverse=True)

        start = 0
        if cursor:
            try:
                start = max(0, int(cursor))
            except ValueError:
                start = 0

        page = ranked[start:start + limit]
        next_cursor = str(start + limit) if (start + limit) < len(ranked) else None

        return {
            "total": len(ranked),
            "results": [
                {
                    "name": rec.get("name", ""),
                    "path": rec.get("path", ""),
                    "language": rec.get("language", ""),
                    "ir_node_id": rec.get("ir_node_id", ""),
                    "line": rec.get("line", 0),
                    "score": round(score, 4),
                }
                for score, rec in page
            ],
            "next_cursor": next_cursor,
            "cursor": cursor,
        }

    def analyze_repository(self, repo_id: str) -> Dict[str, Any]:
        record = self.store.get_repo(repo_id)
        if not record:
            raise ValueError("Repository not found")

        if not record.local_path:
            raise ValueError("Repository clone path is not set")

        repo_path = record.local_path
        files = self.detect_supported_files(repo_path)

        self.store.clear_cancel_requested(repo_id)
        self.store.set_progress(
            repo_id,
            {
                "status": "processing",
                "total_files": len(files),
                "files_parsed": 0,
                "current_file": "",
                "error": None,
            },
        )

        file_results: Dict[str, Dict[str, Any]] = {}
        function_records: List[Dict[str, Any]] = []
        total_classes = 0
        parse_errors: List[Dict[str, str]] = []

        parsed_count = 0
        for chunk in self._chunked(files, 20):
            for relative_path in chunk:
                if self.store.is_cancel_requested(repo_id):
                    self.store.set_progress(
                        repo_id,
                        {
                            "status": "cancelled",
                            "total_files": len(files),
                            "files_parsed": parsed_count,
                            "current_file": relative_path,
                            "error": "Analysis cancelled by user",
                        },
                    )
                    return {
                        "status": "cancelled",
                        "repo_id": repo_id,
                        "files": file_results,
                    }

                self.store.set_progress(
                    repo_id,
                    {
                        "status": "processing",
                        "total_files": len(files),
                        "files_parsed": parsed_count,
                        "current_file": relative_path,
                        "error": None,
                    },
                )

                try:
                    analyzed = self.analyze_file(repo_path, relative_path)
                    file_results[relative_path] = analyzed
                    function_records.extend(analyzed.get("function_records", []))
                    total_classes += int(analyzed.get("class_count", 0) or 0)
                except Exception as exc:
                    parse_errors.append({"path": relative_path, "error": str(exc)})

                parsed_count += 1
                self.store.set_progress(
                    repo_id,
                    {
                        "status": "processing",
                        "total_files": len(files),
                        "files_parsed": parsed_count,
                        "current_file": relative_path,
                        "error": None,
                    },
                )

        graph = self.merge_repository_graph(file_results=file_results, function_records=function_records)
        file_tree = self.build_file_tree(files)
        coverage_payload = self._apply_coverage_to_files(repo_path, file_results)

        stats = {
            "total_files": len(files),
            "total_functions": len(function_records),
            "total_classes": total_classes,
            "total_dependency_nodes": len(graph.get("nodes", [])),
            "total_dependency_edges": len(graph.get("edges", [])),
        }

        payload = {
            "repo_id": repo_id,
            "repo_url": record.repo_url,
            "owner": record.owner,
            "name": record.name,
            "status": "completed",
            "graph": graph,
            "files": file_results,
            "file_tree": file_tree,
            "search_index": function_records,
            "stats": stats,
            "parse_errors": parse_errors,
            "coverage": coverage_payload,
            "updated_at_ms": int(time.time() * 1000),
        }

        self.store.set_analysis_payload(repo_id, payload)
        self.store.set_progress(
            repo_id,
            {
                "status": "completed",
                "total_files": len(files),
                "files_parsed": len(files),
                "current_file": "",
                "error": None,
            },
        )
        return payload


GITHUB_SERVICE = GitHubService()


def get_github_service() -> GitHubService:
    return GITHUB_SERVICE

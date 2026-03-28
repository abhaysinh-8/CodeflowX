from __future__ import annotations

from dataclasses import dataclass, asdict, field
from difflib import SequenceMatcher
import hashlib
import re
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from backend.ir.ir_node import IRNode, IRNodeType


KNOWN_EXTERNAL_PREFIXES = {
    "requests",
    "http",
    "https",
    "axios",
    "fetch",
    "urllib",
    "psycopg2",
    "sqlite3",
    "pymongo",
    "redis",
    "sqlalchemy",
    "os",
    "pathlib",
    "subprocess",
    "fs",
    "path",
}

NON_EXTERNAL_BUILTINS = {
    "print",
    "len",
    "range",
    "map",
    "filter",
    "sum",
    "min",
    "max",
    "abs",
    "console.log",
}


@dataclass
class DependencyNodeRecord:
    id: str
    type: str
    name: str
    signature: str
    docstring: str
    module: str
    x: float = 0
    y: float = 0
    ir_node_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DependencyEdgeRecord:
    id: str
    source: str
    target: str
    type: str
    label: str


@dataclass
class ClusterRecord:
    id: str
    type: str
    name: str
    module: str
    node_ids: List[str]
    x: float = 0
    y: float = 0
    width: float = 360
    height: float = 160


def rank_dependency_nodes(nodes: Sequence[Dict[str, Any]], query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Simple fuzzy ranking used by /dependency/search."""
    q = query.strip().lower()
    if not q:
        return []

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for node in nodes:
        name = str(node.get("name", "")).lower()
        module = str(node.get("module", "")).lower()
        base = 0.0
        if name == q:
            base = 1.0
        elif name.startswith(q):
            base = 0.92
        elif q in name:
            base = 0.82
        else:
            base = SequenceMatcher(None, q, name).ratio() * 0.7

        if q in module:
            base += 0.08

        if base > 0.25:
            scored.append((base, node))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [item[1] for item in scored[:limit]]


def build_subgraph(
    nodes: Sequence[Dict[str, Any]],
    edges: Sequence[Dict[str, Any]],
    node_id: str,
    hops: int = 1,
) -> Dict[str, List[Dict[str, Any]]]:
    """Return an N-hop neighborhood around a node id."""
    if hops < 1:
        hops = 1

    node_lookup = {n["id"]: n for n in nodes}
    if node_id not in node_lookup:
        return {"nodes": [], "edges": []}

    adjacency: Dict[str, Set[str]] = {}
    for edge in edges:
        s = edge["source"]
        t = edge["target"]
        adjacency.setdefault(s, set()).add(t)
        adjacency.setdefault(t, set()).add(s)

    visited: Set[str] = {node_id}
    frontier: Set[str] = {node_id}

    for _ in range(hops):
        next_frontier: Set[str] = set()
        for current in frontier:
            for neighbor in adjacency.get(current, set()):
                if neighbor not in visited:
                    visited.add(neighbor)
                    next_frontier.add(neighbor)
        frontier = next_frontier
        if not frontier:
            break

    result_edges: List[Dict[str, Any]] = []
    for edge in edges:
        if edge["source"] in visited and edge["target"] in visited:
            result_edges.append(edge)

    result_nodes = [node_lookup[nid] for nid in visited if nid in node_lookup]
    return {"nodes": result_nodes, "edges": result_edges}


class DependencyModule:
    """
    Build a dependency graph from CodeFlowX IR.

    Outputs:
    - nodes: function/module/class/external/entrypoint
    - edges: calls/imports/inherits/depends_on/triggers
    - clusters: module/class cluster boxes with position hints
    """

    def __init__(self, source_code: str, language: str, module_path: str = "main"):
        self.source_code = source_code
        self.language = language
        self.module_path = module_path or "main"
        self.lines = source_code.splitlines()
        self.module_name = self._normalize_module_name(module_path, language)

        self.nodes: Dict[str, DependencyNodeRecord] = {}
        self.edges: Dict[Tuple[str, str, str], DependencyEdgeRecord] = {}
        self.clusters: Dict[str, ClusterRecord] = {}
        self.cluster_members: Dict[str, Set[str]] = {}

        self.function_ids_by_name: Dict[str, List[str]] = {}
        self.class_ids_by_name: Dict[str, str] = {}
        self.function_context: Dict[str, Dict[str, Any]] = {}
        self.imports: Set[str] = set()
        self.import_roots: Set[str] = set()
        self.import_alias_to_module: Dict[str, str] = {}
        self.imported_symbol_to_module: Dict[str, str] = {}
        self.call_resolution_map: Dict[str, Dict[str, Any]] = {}

        self._module_node_id = self._ensure_node(
            node_type="module",
            name=self.module_name,
            signature=self.module_name,
            docstring="",
            module=self.module_name,
            ir_node_id=None,
        )
        module_cluster_id = self._cluster_id("module", self.module_name)
        self._ensure_cluster("module", self.module_name, self.module_name, module_cluster_id)
        self._add_to_cluster(module_cluster_id, self._module_node_id)

    def generate(self, ir_root: IRNode) -> Dict[str, Any]:
        self.attach_ir_root(ir_root)
        (
            self.imports,
            self.import_alias_to_module,
            self.imported_symbol_to_module,
        ) = self._collect_import_context_from_source()
        self.import_roots = {imp.split(".")[0] for imp in self.imports}

        # Pass 1: collect symbols (functions/classes) and base grouping.
        self._walk_ir(ir_root, current_function_id=None, current_class_id=None)
        # Pass 2: resolve call edges once symbol tables are complete.
        self._walk_calls(ir_root, current_function_id=None, current_class_id=None)
        self._register_inherits_edges()
        self._register_import_edges()
        self._register_trigger_edges()
        self._layout_nodes()
        self._layout_clusters()

        return {
            "nodes": [asdict(node) for node in self.nodes.values()],
            "edges": [asdict(edge) for edge in self.edges.values()],
            "clusters": [asdict(cluster) for cluster in self.clusters.values()],
            "call_resolution_map": self.call_resolution_map,
        }

    def _walk_ir(
        self,
        node: IRNode,
        current_function_id: Optional[str],
        current_class_id: Optional[str],
    ) -> None:
        active_function_id = current_function_id
        active_class_id = current_class_id

        if node.type == IRNodeType.CLASS_DEF:
            class_name = node.name or self._fallback_name(node, prefix="Class")
            class_node_id = self._ensure_node(
                node_type="class",
                name=class_name,
                signature=f"class {class_name}",
                docstring=self._extract_python_docstring(node),
                module=self.module_name,
                ir_node_id=node.id,
                metadata={"raw_type": node.metadata.get("raw_type", "")},
            )
            self.class_ids_by_name[class_name] = class_node_id
            active_class_id = class_node_id

            module_cluster_id = self._cluster_id("module", self.module_name)
            class_cluster_id = self._cluster_id("class", class_name)
            self._ensure_cluster("class", class_name, self.module_name, class_cluster_id)
            self._add_to_cluster(module_cluster_id, class_node_id)
            self._add_to_cluster(class_cluster_id, class_node_id)

        elif node.type == IRNodeType.FUNCTION_DEF:
            function_name = node.name or self._fallback_name(node, prefix="fn")
            parent_class_name = self._node_name(active_class_id)
            node_type = "method" if parent_class_name else "function"
            if function_name == "main":
                node_type = "entrypoint"

            signature = self._extract_signature(node, default_name=function_name)
            docstring = self._extract_python_docstring(node)

            function_node_id = self._ensure_node(
                node_type=node_type,
                name=function_name,
                signature=signature,
                docstring=docstring,
                module=self.module_name,
                ir_node_id=node.id,
                metadata={"class_name": parent_class_name or ""},
            )
            active_function_id = function_node_id
            self.function_ids_by_name.setdefault(function_name, []).append(function_node_id)
            self.function_context[function_node_id] = {
                "class_id": active_class_id,
                "class_name": parent_class_name,
            }

            module_cluster_id = self._cluster_id("module", self.module_name)
            self._add_to_cluster(module_cluster_id, function_node_id)
            if active_class_id:
                class_cluster_id = self._cluster_id("class", parent_class_name or "")
                self._add_to_cluster(class_cluster_id, function_node_id)

        for child in node.children:
            self._walk_ir(
                child,
                current_function_id=active_function_id,
                current_class_id=active_class_id,
            )

    def _walk_calls(
        self,
        node: IRNode,
        current_function_id: Optional[str],
        current_class_id: Optional[str],
    ) -> None:
        active_function_id = current_function_id
        active_class_id = current_class_id

        if node.type == IRNodeType.CLASS_DEF:
            class_name = node.name or self._fallback_name(node, prefix="Class")
            active_class_id = self.class_ids_by_name.get(class_name, active_class_id)

        elif node.type == IRNodeType.FUNCTION_DEF:
            function_name = node.name or self._fallback_name(node, prefix="fn")
            candidates = self.function_ids_by_name.get(function_name, [])
            if candidates:
                if active_class_id:
                    class_name = self._node_name(active_class_id)
                    scoped = [
                        fid for fid in candidates
                        if self.nodes.get(fid) and self.nodes[fid].metadata.get("class_name") == (class_name or "")
                    ]
                    active_function_id = scoped[0] if scoped else candidates[0]
                else:
                    active_function_id = candidates[0]

        elif node.type == IRNodeType.CALL:
            call_name = (node.name or "").strip()
            if call_name:
                caller_id = active_function_id or active_class_id or self._module_node_id
                self._register_call_edge(
                    caller_id=caller_id,
                    call_name=call_name,
                    call_node_ir_id=node.id,
                    caller_class_id=active_class_id,
                )

        for child in node.children:
            self._walk_calls(
                child,
                current_function_id=active_function_id,
                current_class_id=active_class_id,
            )

    def _register_call_edge(
        self,
        caller_id: str,
        call_name: str,
        call_node_ir_id: Optional[str] = None,
        caller_class_id: Optional[str] = None,
    ) -> None:
        canonical = call_name.strip()
        if not canonical:
            return

        resolved = self._resolve_function_target(
            call_name=canonical,
            caller_class_id=caller_class_id,
        )
        if resolved:
            target_function_id, resolution_type = resolved
            self._add_edge(caller_id, target_function_id, "calls", "Calls")
            self._record_call_resolution(
                call_node_ir_id=call_node_ir_id,
                call_name=canonical,
                target_node_id=target_function_id,
                resolution_type=resolution_type,
            )
            return

        root = canonical.split(".")[0]
        if root in self.class_ids_by_name:
            class_target_id = self.class_ids_by_name[root]
            self._add_edge(caller_id, class_target_id, "calls", "Calls")
            self._record_call_resolution(
                call_node_ir_id=call_node_ir_id,
                call_name=canonical,
                target_node_id=class_target_id,
                resolution_type="class_call",
            )
            return

        if not self._is_external_call(canonical):
            self._record_call_resolution(
                call_node_ir_id=call_node_ir_id,
                call_name=canonical,
                target_node_id=None,
                resolution_type="unresolved",
            )
            return

        service_name, service_type = self._normalize_external_service(canonical)
        external_node_id = self._ensure_node(
            node_type="external",
            name=service_name,
            signature=service_name,
            docstring="",
            module=self.module_name,
            ir_node_id=None,
            metadata={"service_type": service_type},
        )
        self._add_edge(caller_id, external_node_id, "depends_on", "Depends On")
        self._record_call_resolution(
            call_node_ir_id=call_node_ir_id,
            call_name=canonical,
            target_node_id=external_node_id,
            resolution_type="external",
        )

    def _register_import_edges(self) -> None:
        for module_name in sorted(self.imports):
            import_node_id = self._ensure_node(
                node_type="module",
                name=module_name,
                signature=module_name,
                docstring="Imported module",
                module=module_name,
                ir_node_id=None,
                metadata={"imported": True},
            )
            self._add_edge(self._module_node_id, import_node_id, "imports", "Imports")

    def _register_inherits_edges(self) -> None:
        for class_name, class_node_id in list(self.class_ids_by_name.items()):
            class_node = self.nodes[class_node_id]
            ir_node_id = class_node.ir_node_id
            if not ir_node_id:
                continue

            class_ir = self._find_ir_by_id(ir_node_id)
            if class_ir is None:
                continue

            snippet = self._snippet(class_ir)
            parents = self._extract_inheritance_targets(snippet)
            for parent in parents:
                parent_node_id = self.class_ids_by_name.get(parent)
                if not parent_node_id:
                    parent_node_id = self._ensure_node(
                        node_type="class",
                        name=parent,
                        signature=f"class {parent}",
                        docstring="External or unresolved base class",
                        module=self.module_name,
                        ir_node_id=None,
                        metadata={"external": True},
                    )
                self._add_edge(class_node_id, parent_node_id, "inherits", "Inherits")

    def _register_trigger_edges(self) -> None:
        if self.language != "python":
            return

        decorators_by_function = self._extract_python_decorators()
        for function_name, decorators in decorators_by_function.items():
            if not decorators:
                continue
            if not any(self._is_trigger_decorator(d) for d in decorators):
                continue

            target_ids = self.function_ids_by_name.get(function_name, [])
            for target in target_ids:
                self._add_edge(self._module_node_id, target, "triggers", "Triggers")

    def _resolve_function_target(
        self,
        call_name: str,
        caller_class_id: Optional[str] = None,
    ) -> Optional[Tuple[str, str]]:
        # 1) Exact local symbol first.
        direct = self.function_ids_by_name.get(call_name)
        if direct:
            scoped = self._pick_scoped_candidate(direct, caller_class_id)
            if scoped:
                return scoped, "local_symbol"

        # 2) Scoped method resolution for dotted calls (self.foo(), this.foo(), Class.foo()).
        if "." in call_name:
            owner = call_name.split(".")[0]
            suffix = call_name.split(".")[-1]
            by_suffix = self.function_ids_by_name.get(suffix, [])
            if by_suffix:
                if owner in {"self", "this"} and caller_class_id:
                    scoped = self._pick_scoped_candidate(by_suffix, caller_class_id)
                    if scoped:
                        return scoped, "scoped_method"
                if owner in self.class_ids_by_name:
                    owner_name = owner
                    scoped = [
                        fid
                        for fid in by_suffix
                        if self.nodes.get(fid)
                        and self.nodes[fid].metadata.get("class_name") == owner_name
                    ]
                    if scoped:
                        return scoped[0], "scoped_method"
                fallback = self._pick_scoped_candidate(by_suffix, caller_class_id)
                if fallback:
                    return fallback, "local_suffix"

        # 3) Non-dotted fallback to same-class first, then module-level symbol.
        direct_suffix = self.function_ids_by_name.get(call_name, [])
        if direct_suffix:
            scoped = self._pick_scoped_candidate(direct_suffix, caller_class_id)
            if scoped:
                return scoped, "local_symbol"
        return None

    def _is_external_call(self, call_name: str) -> bool:
        if call_name in NON_EXTERNAL_BUILTINS:
            return False

        root = call_name.split(".")[0]
        if root in NON_EXTERNAL_BUILTINS:
            return False
        if root in self.function_ids_by_name:
            return False
        if root in self.class_ids_by_name:
            return False
        # Import-aware matching first (alias/symbol/module), then heuristic fallbacks.
        if root in self.import_alias_to_module:
            return True
        if call_name in self.imported_symbol_to_module:
            return True
        if root in self.imported_symbol_to_module:
            return True
        if root in self.import_roots:
            return True
        return root in KNOWN_EXTERNAL_PREFIXES

    def _normalize_external_service(self, call_name: str) -> Tuple[str, str]:
        root = call_name.split(".")[0]
        if root in self.import_alias_to_module:
            root = self.import_alias_to_module[root].split(".")[0]
        elif call_name in self.imported_symbol_to_module:
            root = self.imported_symbol_to_module[call_name].split(".")[0]
        elif root in self.imported_symbol_to_module:
            root = self.imported_symbol_to_module[root].split(".")[0]

        service_type = "LIB"
        if root in {"requests", "axios", "fetch", "http", "https", "urllib"}:
            service_type = "HTTP"
        elif root in {"psycopg2", "sqlite3", "pymongo", "redis", "sqlalchemy"}:
            service_type = "DB"
        elif root in {"os", "pathlib", "subprocess", "fs", "path"}:
            service_type = "OS/FS"
        return root, service_type

    def _collect_import_context_from_source(
        self,
    ) -> Tuple[Set[str], Dict[str, str], Dict[str, str]]:
        imports: Set[str] = set()
        alias_to_module: Dict[str, str] = {}
        symbol_to_module: Dict[str, str] = {}
        text = self.source_code

        if self.language == "python":
            for match in re.finditer(
                r"^\s*import\s+([A-Za-z0-9_\.]+)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?",
                text,
                flags=re.MULTILINE,
            ):
                module_name = match.group(1)
                alias = match.group(2)
                imports.add(module_name)
                if alias:
                    alias_to_module[alias] = module_name
                else:
                    alias_to_module[module_name.split(".")[0]] = module_name

            for match in re.finditer(
                r"^\s*from\s+([A-Za-z0-9_\.]+)\s+import\s+(.+)$",
                text,
                flags=re.MULTILINE,
            ):
                module_name = match.group(1)
                import_clause = match.group(2).strip()
                imports.add(module_name)
                if import_clause == "*":
                    continue
                for raw_part in import_clause.split(","):
                    part = raw_part.strip()
                    if not part:
                        continue
                    alias_match = re.match(
                        r"([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?",
                        part,
                    )
                    if not alias_match:
                        continue
                    symbol = alias_match.group(1)
                    alias = alias_match.group(2) or symbol
                    symbol_to_module[alias] = module_name

        elif self.language in {"javascript", "typescript"}:
            for match in re.finditer(r"import\s+[^;]*?\s+from\s+[\"']([^\"']+)[\"']", text):
                imports.add(match.group(1))
            for match in re.finditer(r"import\s+[\"']([^\"']+)[\"']", text):
                imports.add(match.group(1))
            for match in re.finditer(r"require\(\s*[\"']([^\"']+)[\"']\s*\)", text):
                imports.add(match.group(1))
            for match in re.finditer(
                r"import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+[\"']([^\"']+)[\"']",
                text,
            ):
                alias_to_module[match.group(1)] = match.group(2)
            for match in re.finditer(
                r"import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:,\s*\{[^}]*\})?\s+from\s+[\"']([^\"']+)[\"']",
                text,
            ):
                alias_to_module.setdefault(match.group(1), match.group(2))
            for match in re.finditer(
                r"import\s+(?:[A-Za-z_$][A-Za-z0-9_$]*\s*,\s*)?\{([^}]+)\}\s+from\s+[\"']([^\"']+)[\"']",
                text,
            ):
                members = match.group(1)
                module_name = match.group(2)
                for raw_part in members.split(","):
                    part = raw_part.strip()
                    if not part:
                        continue
                    alias_match = re.match(
                        r"([A-Za-z_$][A-Za-z0-9_$]*)(?:\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*))?",
                        part,
                    )
                    if not alias_match:
                        continue
                    symbol = alias_match.group(1)
                    alias = alias_match.group(2) or symbol
                    symbol_to_module[alias] = module_name
            for match in re.finditer(
                r"(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\(\s*[\"']([^\"']+)[\"']\s*\)",
                text,
            ):
                alias_to_module[match.group(1)] = match.group(2)

        elif self.language == "java":
            for match in re.finditer(r"^\s*import\s+([A-Za-z0-9_\.]+)\s*;", text, flags=re.MULTILINE):
                fq_name = match.group(1)
                imports.add(fq_name)
                simple_name = fq_name.split(".")[-1]
                if simple_name and simple_name != "*":
                    symbol_to_module[simple_name] = fq_name

        return imports, alias_to_module, symbol_to_module

    def _pick_scoped_candidate(
        self,
        candidates: Sequence[str],
        caller_class_id: Optional[str],
    ) -> Optional[str]:
        if not candidates:
            return None

        if caller_class_id:
            class_name = self._node_name(caller_class_id) or ""
            scoped = [
                fid
                for fid in candidates
                if self.nodes.get(fid)
                and self.nodes[fid].metadata.get("class_name") == class_name
            ]
            if scoped:
                return scoped[0]

        module_level = [
            fid
            for fid in candidates
            if self.nodes.get(fid)
            and not str(self.nodes[fid].metadata.get("class_name", "")).strip()
        ]
        if module_level:
            return module_level[0]
        return candidates[0]

    def _record_call_resolution(
        self,
        call_node_ir_id: Optional[str],
        call_name: str,
        target_node_id: Optional[str],
        resolution_type: str,
    ) -> None:
        if not call_node_ir_id:
            return
        target_ir_id: Optional[str] = None
        if target_node_id and target_node_id in self.nodes:
            target_ir_id = self.nodes[target_node_id].ir_node_id
        self.call_resolution_map[call_node_ir_id] = {
            "call_name": call_name,
            "target_dependency_node_id": target_node_id,
            "target_ir_node_id": target_ir_id,
            "resolution_type": resolution_type,
        }

    def _extract_python_decorators(self) -> Dict[str, List[str]]:
        result: Dict[str, List[str]] = {}
        pending_decorators: List[str] = []

        for raw_line in self.lines:
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("@"):
                pending_decorators.append(line[1:])
                continue

            fn_match = re.match(r"def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", line)
            if fn_match:
                fn_name = fn_match.group(1)
                if pending_decorators:
                    result[fn_name] = list(pending_decorators)
                pending_decorators = []
            else:
                pending_decorators = []
        return result

    def _is_trigger_decorator(self, decorator: str) -> bool:
        lower = decorator.lower()
        tokens = ("route", "event", "handler", "listener", "on_")
        return any(tok in lower for tok in tokens)

    def _extract_inheritance_targets(self, class_snippet: str) -> List[str]:
        targets: List[str] = []
        snippet = class_snippet.strip()

        py_match = re.search(r"class\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]+)\)", snippet)
        if py_match:
            for part in py_match.group(1).split(","):
                name = part.strip()
                if name:
                    targets.append(name)

        js_match = re.search(r"class\s+[A-Za-z_][A-Za-z0-9_]*\s+extends\s+([A-Za-z_][A-Za-z0-9_]*)", snippet)
        if js_match:
            targets.append(js_match.group(1))

        java_match = re.search(r"class\s+[A-Za-z_][A-Za-z0-9_]*\s+extends\s+([A-Za-z_][A-Za-z0-9_]*)", snippet)
        if java_match:
            targets.append(java_match.group(1))

        impl_match = re.search(r"implements\s+([A-Za-z0-9_,\s]+)", snippet)
        if impl_match:
            for part in impl_match.group(1).split(","):
                name = part.strip()
                if name:
                    targets.append(name)
        return list(dict.fromkeys(targets))

    def _extract_signature(self, node: IRNode, default_name: str) -> str:
        snippet = self._snippet(node).strip()
        if not snippet:
            return f"{default_name}(...)"

        first_line = snippet.splitlines()[0].strip()
        if self.language == "python":
            match = re.match(r"def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)", first_line)
            if match:
                return f"{match.group(1)}({match.group(2)})"
            return f"{default_name}(...)"

        if self.language in {"javascript", "typescript"}:
            fn_match = re.search(r"function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)", first_line)
            if fn_match:
                return f"{fn_match.group(1)}({fn_match.group(2)})"
            method_match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)\s*\{?", first_line)
            if method_match:
                return f"{method_match.group(1)}({method_match.group(2)})"
            return f"{default_name}(...)"

        if self.language == "java":
            java_match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)", first_line)
            if java_match:
                return f"{java_match.group(1)}({java_match.group(2)})"
            return f"{default_name}(...)"

        return f"{default_name}(...)"

    def _extract_python_docstring(self, node: IRNode) -> str:
        if self.language != "python":
            return ""
        snippet = self._snippet(node)
        if not snippet:
            return ""
        triple = re.search(r'"""(.*?)"""', snippet, flags=re.DOTALL)
        if triple:
            return " ".join(triple.group(1).strip().split())
        single = re.search(r"'''(.*?)'''", snippet, flags=re.DOTALL)
        if single:
            return " ".join(single.group(1).strip().split())
        return ""

    def _layout_nodes(self) -> None:
        grouped: Dict[str, List[str]] = {
            "module": [],
            "class": [],
            "entrypoint": [],
            "function": [],
            "method": [],
            "external": [],
        }
        for node_id, node in self.nodes.items():
            grouped.setdefault(node.type, []).append(node_id)

        x_by_type = {
            "module": 40,
            "class": 300,
            "entrypoint": 620,
            "function": 620,
            "method": 860,
            "external": 1160,
        }
        y_offsets = {key: 40 for key in x_by_type}

        for node_type in ("module", "class", "entrypoint", "function", "method", "external"):
            for node_id in sorted(grouped.get(node_type, [])):
                node = self.nodes[node_id]
                node.x = x_by_type[node_type]
                node.y = y_offsets[node_type]
                y_offsets[node_type] += 120

    def _layout_clusters(self) -> None:
        for cluster_id, cluster in self.clusters.items():
            members = [self.nodes[nid] for nid in self.cluster_members.get(cluster_id, set()) if nid in self.nodes]
            if not members:
                continue
            min_x = min(node.x for node in members)
            min_y = min(node.y for node in members)
            max_x = max(node.x for node in members)
            max_y = max(node.y for node in members)
            cluster.x = max(0, min_x - 60)
            cluster.y = max(0, min_y - 50)
            cluster.width = max(320, (max_x - min_x) + 260)
            cluster.height = max(180, (max_y - min_y) + 140)
            cluster.node_ids = sorted(self.cluster_members.get(cluster_id, set()))

    def _ensure_node(
        self,
        node_type: str,
        name: str,
        signature: str,
        docstring: str,
        module: str,
        ir_node_id: Optional[str],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        node_id = self._node_id(node_type, module, name)
        if node_id in self.nodes:
            existing = self.nodes[node_id]
            if ir_node_id and not existing.ir_node_id:
                existing.ir_node_id = ir_node_id
            if metadata:
                existing.metadata.update(metadata)
            return node_id

        self.nodes[node_id] = DependencyNodeRecord(
            id=node_id,
            type=node_type,
            name=name,
            signature=signature,
            docstring=docstring,
            module=module,
            ir_node_id=ir_node_id,
            metadata=metadata or {},
        )
        return node_id

    def _add_edge(self, source: str, target: str, edge_type: str, label: str) -> None:
        if source == target:
            return
        key = (source, target, edge_type)
        if key in self.edges:
            return
        edge_id = f"edge-{len(self.edges) + 1}-{self._short_hash(f'{source}->{target}:{edge_type}')}"
        self.edges[key] = DependencyEdgeRecord(
            id=edge_id,
            source=source,
            target=target,
            type=edge_type,
            label=label,
        )

    def _ensure_cluster(self, cluster_type: str, name: str, module: str, cluster_id: str) -> None:
        if cluster_id not in self.clusters:
            self.clusters[cluster_id] = ClusterRecord(
                id=cluster_id,
                type=cluster_type,
                name=name,
                module=module,
                node_ids=[],
            )
            self.cluster_members[cluster_id] = set()

    def _add_to_cluster(self, cluster_id: str, node_id: str) -> None:
        if cluster_id not in self.cluster_members:
            self.cluster_members[cluster_id] = set()
        self.cluster_members[cluster_id].add(node_id)

    def _snippet(self, node: IRNode) -> str:
        start_byte = int(node.metadata.get("start_byte", -1))
        end_byte = int(node.metadata.get("end_byte", -1))
        if start_byte < 0 or end_byte <= start_byte:
            return ""
        try:
            return self.source_code.encode("utf8")[start_byte:end_byte].decode("utf8")
        except Exception:
            return ""

    def _node_name(self, node_id: Optional[str]) -> Optional[str]:
        if not node_id:
            return None
        node = self.nodes.get(node_id)
        return node.name if node else None

    def _node_id(self, node_type: str, module: str, name: str) -> str:
        return f"{node_type}-{self._short_hash(f'{node_type}:{module}:{name}')}"

    def _cluster_id(self, cluster_type: str, name: str) -> str:
        return f"cluster-{cluster_type}-{self._short_hash(f'{cluster_type}:{name}')}"

    def _short_hash(self, raw: str) -> str:
        return hashlib.md5(raw.encode("utf8")).hexdigest()[:12]

    def _normalize_module_name(self, module_path: str, language: str) -> str:
        if module_path and module_path.strip():
            return module_path.strip()
        ext = {
            "python": "py",
            "javascript": "js",
            "typescript": "ts",
            "java": "java",
        }.get(language, "txt")
        return f"main.{ext}"

    def _fallback_name(self, node: IRNode, prefix: str) -> str:
        return f"{prefix}_{self._short_hash(node.id)[:6]}"

    def _find_ir_by_id(self, target_id: str) -> Optional[IRNode]:
        root = getattr(self, "_ir_root", None)
        if root is None:
            return None

        stack = [root]
        while stack:
            current = stack.pop()
            if current.id == target_id:
                return current
            stack.extend(current.children)
        return None

    def attach_ir_root(self, ir_root: IRNode) -> None:
        self._ir_root = ir_root

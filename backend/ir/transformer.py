import hashlib
import uuid
from typing import Any, List, Optional
from backend.ir.ir_node import IRNode, IRNodeType

class ASTTransformer:
    """Transforms tree-sitter AST nodes into language-agnostic IRNodes."""
    
    def __init__(self, language: str, source_code: str):
        self.language = language
        self.source_code = source_code
        self.source_bytes = bytes(source_code, "utf8")

    def generate_uuid(
        self,
        node_type: str,
        start_byte: int,
        end_byte: int,
        parent_type: str,
        depth: int,
        path_signature: str,
    ) -> str:
        """Generates a deterministic UUID based on node properties and stable context."""
        hash_input = (
            f"{self.language}:{node_type}:{start_byte}:{end_byte}:"
            f"{parent_type}:{depth}:{path_signature}"
        )
        hash_val = hashlib.md5(hash_input.encode()).hexdigest()
        return str(uuid.UUID(hash_val))

    def get_node_text(self, node: Any) -> str:
        """Extracts text for the given node from source code."""
        return self.source_bytes[node.start_byte:node.end_byte].decode("utf8")

    def transform(self, node: Any) -> Optional[IRNode]:
        """Entry point for transformation."""
        if not node:
            return None
        
        ir_node = self._visit(
            node=node,
            parent_type="root",
            depth=0,
            path_signature="0",
        )
        return ir_node

    def _visit(
        self,
        node: Any,
        parent_type: str,
        depth: int,
        path_signature: str,
    ) -> Optional[IRNode]:
        """Recursive visitor function."""
        if not node.is_named and node.type not in ("{", "}", "(", ")", "[", "]", ";"):
             return None

        node_type = self._map_type(node.type)
        node_name = self._extract_name(node)
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        
        ir_node = IRNode(
            id=self.generate_uuid(
                node_type=node.type,
                start_byte=node.start_byte,
                end_byte=node.end_byte,
                parent_type=parent_type,
                depth=depth,
                path_signature=path_signature,
            ),
            type=node_type,
            language=self.language,
            name=node_name,
            # Line-oriented ranges so frontend editor highlighting is accurate.
            source_start=start_line,
            source_end=end_line,
            children=[],
            metadata={
                "raw_type": node.type,
                "start_byte": node.start_byte,
                "end_byte": node.end_byte,
                "start_column": node.start_point[1] + 1,
                "end_column": node.end_point[1] + 1,
            }
        )

        # Visit children
        for i in range(node.child_count):
            child = node.child(i)
            # Filter out non-named nodes generally, but keep them for structure if needed
            if not child.is_named:
                continue
            
            child_ir = self._visit(
                node=child,
                parent_type=node.type,
                depth=depth + 1,
                path_signature=f"{path_signature}.{i}",
            )
            if child_ir:
                ir_node.children.append(child_ir)
                
        return ir_node

    def _map_type(self, ts_type: str) -> IRNodeType:
        """Maps tree-sitter types to IRNodeTypes across Python, JS, Java."""
        mapping = {
            # Python
            "function_definition": IRNodeType.FUNCTION_DEF,
            "if_statement": IRNodeType.IF_STMT,
            "for_statement": IRNodeType.FOR_LOOP,
            "while_statement": IRNodeType.WHILE_LOOP,
            "for_in_statement": IRNodeType.FOR_LOOP,
            "return_statement": IRNodeType.RETURN,
            "call": IRNodeType.CALL,
            "try_statement": IRNodeType.TRY_EXCEPT,
            "class_definition": IRNodeType.CLASS_DEF,
            "assignment": IRNodeType.ASSIGNMENT,
            "augmented_assignment": IRNodeType.ASSIGNMENT,
            "expression_statement": IRNodeType.OTHER,
            
            # JavaScript
            "function_declaration": IRNodeType.FUNCTION_DEF,
            "generator_function_declaration": IRNodeType.FUNCTION_DEF,
            "arrow_function": IRNodeType.FUNCTION_DEF,
            "function": IRNodeType.FUNCTION_DEF,
            "method_definition": IRNodeType.FUNCTION_DEF,
            "lexical_declaration": IRNodeType.ASSIGNMENT,
            "variable_declaration": IRNodeType.ASSIGNMENT,
            "assignment_expression": IRNodeType.ASSIGNMENT,
            "call_expression": IRNodeType.CALL,
            "class_declaration": IRNodeType.CLASS_DEF,
            "for_in_statement": IRNodeType.FOR_LOOP,
            "for_of_statement": IRNodeType.FOR_LOOP,
            
            # Java
            "method_declaration": IRNodeType.FUNCTION_DEF,
            "constructor_declaration": IRNodeType.FUNCTION_DEF,
            "variable_declarator": IRNodeType.ASSIGNMENT,
            "method_invocation": IRNodeType.CALL,
            "class_declaration": IRNodeType.CLASS_DEF,
            "interface_declaration": IRNodeType.CLASS_DEF,
            
            # Common
            "if_statement": IRNodeType.IF_STMT,
            "for_statement": IRNodeType.FOR_LOOP,
            "while_statement": IRNodeType.WHILE_LOOP,
            "try_statement": IRNodeType.TRY_EXCEPT,
            "return_statement": IRNodeType.RETURN,
            "block": IRNodeType.BLOCK,
            "program": IRNodeType.BLOCK,
            "module": IRNodeType.BLOCK,
        }
        return mapping.get(ts_type, IRNodeType.OTHER)

    def _extract_name(self, node: Any) -> str:
        """Heuristically extracts a 'name' for the node."""
        if node.type in (
            "function_definition",
            "function_declaration",
            "class_definition",
            "class_declaration",
            "method_declaration",
            "method_definition",
        ):
            for i in range(node.child_count):
                child = node.child(i)
                if child.type in ("identifier", "property_identifier"):
                    return self.get_node_text(child)
        
        if node.type in ("call", "call_expression", "method_invocation"):
            for i in range(node.child_count):
                child = node.child(i)
                if child.type in ("identifier", "attribute", "member_expression", "field_access"):
                    return self.get_node_text(child)
                    
        return ""

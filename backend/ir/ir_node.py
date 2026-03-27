from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict
from uuid import UUID

class IRNodeType(str, Enum):
    FUNCTION_DEF = "function_def"
    IF_STMT = "if_stmt"
    FOR_LOOP = "for_loop"
    WHILE_LOOP = "while_loop"
    RETURN = "return"
    CALL = "call"
    TRY_EXCEPT = "try_except"
    CLASS_DEF = "class_def"
    ASSIGNMENT = "assignment"
    BLOCK = "block"
    OTHER = "other"

@dataclass
class IRNode:
    id: str # Deterministic UUID string
    type: IRNodeType
    language: str
    name: str
    source_start: int
    source_end: int
    children: List['IRNode'] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)

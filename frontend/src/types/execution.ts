export type RuntimeValueType = 'int' | 'str' | 'list' | 'dict' | 'bool' | 'NoneType';
export type RuntimeScope = 'local' | 'global';
export type RuntimeChangeType = 'added' | 'changed' | 'removed' | 'unchanged';
export type RuntimeBranch = 'true' | 'false' | 'loop' | 'exception' | null;
export type RuntimeAnimationHint = 'forward' | 'backtrack' | 'exception';

export interface ExecutionVariableState {
  value: unknown;
  type: RuntimeValueType;
  scope: RuntimeScope;
  prev_value: unknown | null;
  change_type: RuntimeChangeType;
}

export interface ExecutionCallStackFrame {
  function_name: string;
  file: string;
  source_line: number;
  ir_node_id: string;
}

export interface ExecutionEdgeTraversal {
  from_id: string;
  to_id: string;
  label: string;
}

export interface ExecutionStep {
  step_id: number;
  active_node_id: string;
  prev_node_id: string | null;
  variables: Record<string, ExecutionVariableState>;
  call_stack: ExecutionCallStackFrame[];
  branch_taken: RuntimeBranch;
  loop_counts: Record<string, number>;
  edge_traversed: ExecutionEdgeTraversal;
  animation_hint: RuntimeAnimationHint;
}

export interface BreakpointHit {
  node_id: string;
  step_id: number;
  hit_count: number;
  timestamp_ms: number;
}

export interface ExecutionCreateResponse {
  status: 'success' | 'error';
  job_id?: string;
  total_steps?: number;
  steps?: ExecutionStep[];
  breakpoint_node_ids?: string[];
  error?: string;
}

import FunctionNode from './FunctionNode';
import DecisionNode from './DecisionNode';
import LoopNode from './LoopNode';
import TerminalNode from './TerminalNode';
import CallNode from './CallNode';
import TryCatchNode from './TryCatchNode';

/**
 * nodeTypes map for React Flow.
 * All 6 custom node shapes supported by CodeFlowX+.
 */
export const nodeTypes = {
  function_def: FunctionNode,
  if_stmt: DecisionNode,
  for_loop: LoopNode,
  while_loop: LoopNode,
  terminal: TerminalNode,
  call: CallNode,
  try_except: TryCatchNode,
};

export {
  FunctionNode,
  DecisionNode,
  LoopNode,
  TerminalNode,
  CallNode,
  TryCatchNode,
};

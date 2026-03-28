import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './useStore';

describe('useStore cross-view sync', () => {
  beforeEach(() => {
    useStore.setState({
      syncViewsEnabled: true,
      selectedNodeId: null,
      selectedNodeMeta: null,
      selectionHistory: [],
      selectionHistoryIndex: -1,
      selectionPulseNodeId: null,
      selectionPulseToken: 0,
      selectionPulseAt: 0,
      irNodeLookup: {},
      failedDependencyNodeIds: [],
      failureAffectedNodes: [],
      failureAffectedByIrNode: {},
      failureAffectedByDependencyNode: {},
      failureUnreachableFlowchartNodeIds: [],
      failureBlastRadius: 0,
    });
  });

  it('tracks selection history and back/forward navigation', () => {
    const state = useStore.getState();
    state.selectNode('ir-a', 'flowchart');
    state.selectNode('ir-b', 'dependency');

    let next = useStore.getState();
    expect(next.selectedNodeId).toBe('ir-b');
    expect(next.selectionHistory).toEqual(['ir-a', 'ir-b']);
    expect(next.selectionHistoryIndex).toBe(1);

    next.goSelectionBack();
    next = useStore.getState();
    expect(next.selectedNodeId).toBe('ir-a');
    expect(next.selectionHistoryIndex).toBe(0);

    next.goSelectionForward();
    next = useStore.getState();
    expect(next.selectedNodeId).toBe('ir-b');
    expect(next.selectionHistoryIndex).toBe(1);
  });

  it('does not update selectedNodeId when sync is disabled', () => {
    useStore.getState().selectNode('ir-a', 'flowchart');
    useStore.getState().setSyncViewsEnabled(false);
    useStore.getState().selectNode('ir-b', 'execution');

    const state = useStore.getState();
    expect(state.selectedNodeId).toBe('ir-a');
    expect(state.selectionHistory).toEqual(['ir-a']);
  });

  it('rejects non-lookup selection IDs when lookup is available', () => {
    useStore.setState({
      irNodeLookup: {
        'ir-only': { dependency_node_ids: [] },
      },
    });
    useStore.getState().selectNode('node-xyz', 'flowchart');

    const state = useStore.getState();
    expect(state.selectedNodeId).toBeNull();
  });

  it('stores selection metadata and failure simulation maps', () => {
    useStore.getState().selectNode('ir-meta', 'dependency');
    useStore.getState().setFailureSimulationResult({
      failedDependencyNodeIds: ['dep-a'],
      affectedNodes: [
        {
          dependency_node_id: 'dep-a',
          ir_node_id: 'ir-a',
          severity: 'failed',
        },
        {
          dependency_node_id: 'dep-b',
          ir_node_id: 'ir-b',
          severity: 'directly_affected',
        },
      ],
      unreachableFlowchartNodeIds: ['node-1'],
      blastRadius: 1,
    });

    const state = useStore.getState();
    expect(state.selectedNodeMeta?.source).toBe('dependency');
    expect(state.failureAffectedByIrNode['ir-a']).toBe('failed');
    expect(state.failureAffectedByDependencyNode['dep-b']).toBe('directly_affected');
    expect(state.failureUnreachableFlowchartNodeIds).toEqual(['node-1']);
  });
});

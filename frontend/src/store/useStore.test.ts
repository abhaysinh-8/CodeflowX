import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './useStore';

describe('useStore cross-view sync', () => {
  beforeEach(() => {
    useStore.setState({
      syncViewsEnabled: true,
      selectedNodeId: null,
      selectionHistory: [],
      selectionHistoryIndex: -1,
      selectionPulseNodeId: null,
      selectionPulseToken: 0,
      selectionPulseAt: 0,
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
});

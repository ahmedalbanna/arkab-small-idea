import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { snapshotService } from '../services/snapshotService';

// Mock snapshotService
vi.mock('../services/snapshotService', () => ({
  snapshotService: {
    saveSnapshot: vi.fn().mockImplementation((content) => Promise.resolve({
      id: 'test-id',
      timestamp: Date.now(),
      content,
      wordCount: content.split(/\s+/).length
    })),
    getSnapshots: vi.fn().mockResolvedValue([]),
    clearAllSnapshots: vi.fn().mockResolvedValue(undefined),
  }
}));

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.setState({
      pages: [{ 
        id: 'default', 
        title: 'Chapter 1', 
        content: '# Welcome to Ink & Quill\n\nStart writing...',
        isTypewriter: false,
        isFocusMode: false,
        wordGoal: 0,
        snapshots: [],
        updatedAt: Date.now()
      }],
      activePageIds: ['default'],
      semanticClusters: [],
    });
    vi.clearAllMocks();
  });

  it('should update page content', () => {
    const { setPageContent } = useEditorStore.getState();
    setPageContent('default', 'New content');
    expect(useEditorStore.getState().pages[0].content).toBe('New content');
  });

  it('should add a new page', () => {
    const { addPage } = useEditorStore.getState();
    addPage('New Chapter', 'Chapter content');
    const state = useEditorStore.getState();
    expect(state.pages.length).toBe(2);
    expect(state.pages[1].title).toBe('New Chapter');
    expect(state.pages[1].content).toBe('Chapter content');
    expect(state.activePageIds).toContain(state.pages[1].id);
  });

  it('should add snapshots', async () => {
    const { addSnapshot } = useEditorStore.getState();
    await addSnapshot('default', 'Snapshot content');
    expect(useEditorStore.getState().pages[0].snapshots.length).toBe(1);
    expect(useEditorStore.getState().pages[0].snapshots[0].content).toBe('Snapshot content');
    expect(snapshotService.saveSnapshot).toHaveBeenCalledWith('Snapshot content', undefined);
  });

  it('should set word goal for a page', () => {
    const { setPageSettings } = useEditorStore.getState();
    setPageSettings('default', { wordGoal: 1000 });
    expect(useEditorStore.getState().pages[0].wordGoal).toBe(1000);
  });

  it('should wipe page content', () => {
    const { wipePage } = useEditorStore.getState();
    wipePage('default');
    expect(useEditorStore.getState().pages[0].content).toBe('');
  });
});

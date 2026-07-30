import { act, renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';

import { PublishService } from '@/application/services/domains';
import { gatherDatabasePublishData } from '@/application/services/js-services/publish-database-data';
import { getView } from '@/application/services/js-services/http/view-api';
import { View, ViewLayout } from '@/application/types';
import { AuthInternalContext, AuthInternalContextType } from '@/components/app/contexts/AuthInternalContext';

import { usePageOperations } from '../usePageOperations';

jest.mock('@/application/services/domains', () => ({
  BillingService: {},
  FileService: {},
  PageService: {},
  PublishService: {
    publish: jest.fn(async () => undefined),
    unpublish: jest.fn(),
  },
  ViewService: {},
}));

jest.mock('@/application/services/js-services/cached-api', () => ({
  clearPublishViewInfoCache: jest.fn(),
}));

jest.mock('@/application/services/js-services/publish-database-data', () => ({
  gatherDatabasePublishData: jest.fn(async () => new Uint8Array([1, 2, 3])),
}));

jest.mock('@/application/services/js-services/http/publish-api', () => ({
  publishCollabs: jest.fn(async () => undefined),
}));

jest.mock('@/application/services/js-services/http/view-api', () => ({
  getView: jest.fn(),
}));

jest.mock('@/utils/runtime-config', () => ({
  getConfigValue: (_key: string, fallback: string) => fallback,
}));

function createView(overrides: Partial<View>): View {
  return {
    view_id: 'view-id',
    name: 'View',
    icon: null,
    layout: ViewLayout.Document,
    extra: { is_space: false },
    children: [],
    is_published: false,
    is_private: false,
    ...overrides,
  };
}

function renderUsePageOperations(options?: { outlineRef?: MutableRefObject<View[] | undefined> }) {
  const workspaceId = 'workspace-id';
  const authContextValue: AuthInternalContextType = {
    currentWorkspaceId: workspaceId,
    isAuthenticated: true,
    onChangeWorkspace: () => Promise.resolve(),
  };
  const loadOutline = jest.fn(async () => undefined);
  const outlineRef = options?.outlineRef ?? { current: undefined };

  const rendered = renderHook(
    () =>
      usePageOperations({
        outlineRef,
        loadOutline,
      }),
    {
      wrapper: ({ children }) => (
        <AuthInternalContext.Provider value={authContextValue}>{children}</AuthInternalContext.Provider>
      ),
    }
  );

  return {
    ...rendered,
    loadOutline,
    workspaceId,
  };
}

describe('usePageOperations loadDescendantViews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flattens nested descendants, excludes the root, and resumes past the depth boundary', async () => {
    (getView as jest.Mock).mockImplementation(async (_workspaceId: string, viewId: string) => {
      if (viewId === 'root-id') {
        return createView({
          view_id: 'root-id',
          children: [
            createView({ view_id: 'child-a', name: 'Child A', is_published: true }),
            // Simulates a node whose own children weren't included in this
            // fetch (e.g. the depth-10 boundary was hit) — has_children is
            // true but children is empty, so it should be re-fetched.
            createView({ view_id: 'child-b', name: 'Child B', has_children: true, children: [] }),
          ],
        });
      }

      if (viewId === 'child-b') {
        return createView({
          view_id: 'child-b',
          children: [createView({ view_id: 'grandchild-c', name: 'Grandchild C', is_published: false })],
        });
      }

      throw new Error(`Unexpected getView call for ${viewId}`);
    });

    const { result } = renderUsePageOperations();

    let descendants: View[] = [];

    await act(async () => {
      descendants = await result.current.loadDescendantViews('root-id');
    });

    expect(descendants.map((v) => v.view_id).sort()).toEqual(['child-a', 'child-b', 'grandchild-c']);
    expect(getView).toHaveBeenCalledWith('workspace-id', 'root-id', 10);
    expect(getView).toHaveBeenCalledWith('workspace-id', 'child-b', 10);
  });

  it('treats database container tabs as a single node instead of independent subpages', async () => {
    (getView as jest.Mock).mockImplementation(async (_workspaceId: string, viewId: string) => {
      if (viewId === 'root-id') {
        return createView({
          view_id: 'root-id',
          children: [
            createView({
              view_id: 'grid-id',
              layout: ViewLayout.Grid,
              extra: { is_space: false, is_database_container: true },
              children: [
                createView({ view_id: 'board-id', layout: ViewLayout.Board }),
                createView({ view_id: 'calendar-id', layout: ViewLayout.Calendar }),
              ],
            }),
          ],
        });
      }

      throw new Error(`Unexpected getView call for ${viewId}`);
    });

    const { result } = renderUsePageOperations();

    let descendants: View[] = [];

    await act(async () => {
      descendants = await result.current.loadDescendantViews('root-id');
    });

    expect(descendants).toHaveLength(1);
    expect(descendants[0].view_id).toBe('grid-id');
  });
});

describe('usePageOperations publishSubtree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includeDrafts=true publishes every descendant and reloads the outline once', async () => {
    const { result, loadOutline } = renderUsePageOperations();
    const onProgress = jest.fn();

    const descendants = [
      createView({ view_id: 'published-a', is_published: true }),
      createView({ view_id: 'draft-b', is_published: false }),
      createView({ view_id: 'published-c', is_published: true }),
    ];

    let outcome;

    await act(async () => {
      outcome = await result.current.publishSubtree(descendants, { includeDrafts: true }, onProgress);
    });

    expect(PublishService.publish).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ succeeded: 3, failed: 0, errors: [] });
    expect(loadOutline).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenLastCalledWith(3, 3);
  });

  it('includeDrafts=false only republishes descendants that are already published', async () => {
    const { result, loadOutline } = renderUsePageOperations();

    const descendants = [
      createView({ view_id: 'published-a', is_published: true }),
      createView({ view_id: 'draft-b', is_published: false }),
      createView({ view_id: 'published-c', is_published: true }),
    ];

    await act(async () => {
      await result.current.publishSubtree(descendants, { includeDrafts: false });
    });

    expect(PublishService.publish).toHaveBeenCalledTimes(2);
    expect(PublishService.publish).toHaveBeenCalledWith('workspace-id', 'published-a', expect.anything());
    expect(PublishService.publish).toHaveBeenCalledWith('workspace-id', 'published-c', expect.anything());
    expect(PublishService.publish).not.toHaveBeenCalledWith('workspace-id', 'draft-b', expect.anything());
    // Single outline reload despite publishing two descendants individually.
    expect(loadOutline).toHaveBeenCalledTimes(1);
  });

  it('carries all sibling tabs as visibleViewIds when publishing a database container node', async () => {
    const { result } = renderUsePageOperations();

    const descendants = [
      createView({
        view_id: 'grid-id',
        layout: ViewLayout.Grid,
        extra: { is_space: false, is_database_container: true },
        is_published: false,
        children: [
          createView({ view_id: 'board-id', layout: ViewLayout.Board }),
          createView({ view_id: 'calendar-id', layout: ViewLayout.Calendar }),
        ],
      }),
    ];

    await act(async () => {
      await result.current.publishSubtree(descendants, { includeDrafts: true });
    });

    expect(gatherDatabasePublishData).toHaveBeenCalledWith(
      'grid-id',
      ['grid-id', 'board-id', 'calendar-id'],
      undefined
    );
  });

  it('aggregates per-view failures without failing the whole batch', async () => {
    const { result } = renderUsePageOperations();

    (PublishService.publish as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    const descendants = [
      createView({ view_id: 'a', is_published: true }),
      createView({ view_id: 'b', is_published: true }),
    ];

    let outcome;

    await act(async () => {
      outcome = await result.current.publishSubtree(descendants, { includeDrafts: true });
    });

    expect(outcome).toEqual({
      succeeded: 1,
      failed: 1,
      errors: [{ view: expect.objectContaining({ view_id: 'a' }), error: expect.any(Error) }],
    });
  });
});

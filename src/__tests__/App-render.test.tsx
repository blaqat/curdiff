/**
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { expect, test, vi } from 'vite-plus/test';
import App from '../App.tsx';
import { defaultConfig } from '../config/defaults.ts';
import type { RepositoryState } from '../types.ts';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const createStorage = () => {
  const map = new Map<string, string>();
  return {
    clear: () => {
      map.clear();
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  } satisfies Storage;
};

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: createStorage(),
  writable: true,
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverMock,
  writable: true,
});

const repositoryState = {
  branch: 'main',
  files: [],
  generatedAt: 1,
  launchPath: '/repo',
  root: '/repo',
  source: { type: 'working-tree' },
} satisfies RepositoryState;

const waitFor = async (assertion: () => void) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  throw lastError;
};

test('repository changes show the update banner without refreshing the working tree', async () => {
  let onRepositoryChanged: ((change: { root: string }) => void) | null = null;
  const getRepositoryState = vi.fn(async () => repositoryState);

  window.codiff = {
    askReviewAssistant: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getConfig: vi.fn(async () => defaultConfig),
    getDiffImageContent: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getDiffSectionContent: vi.fn(async () => {
      throw new Error('Unexpected diff section load.');
    }),
    getGitIdentity: vi.fn(async () => ({
      email: 'reviewer@example.com',
      name: 'Reviewer',
    })),
    getLaunchOptions: vi.fn(async () => ({
      repositoryPathProvided: true,
      walkthrough: false,
    })),
    getPreferences: vi.fn(async () => ({
      askModel: defaultConfig.settings.askModel,
      copyCommentsOnClose: true,
      lastRepositoryPath: '/repo',
      showWhitespace: false,
      theme: 'system' as const,
      walkthroughModel: defaultConfig.settings.walkthroughModel,
    })),
    getRepositoryHistory: vi.fn(async () => ({
      entries: [],
      root: '/repo',
    })),
    getRepositoryState,
    getTerminalHelperStatus: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    getWalkthrough: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    installTerminalHelper: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    listModels: vi.fn(async () => [
      {
        id: 'composer-2.5',
        label: 'composer-2.5',
        parameters: [
          {
            id: 'thinking',
            label: 'Thinking',
            values: [
              { label: 'Low', value: 'low' },
              { label: 'High', value: 'high' },
            ],
          },
        ],
        variants: [
          {
            isDefault: true,
            label: 'Default',
            params: [{ id: 'thinking', value: 'low' }],
          },
          {
            label: 'Fast',
            params: [{ id: 'thinking', value: 'high' }],
          },
        ],
      },
    ]),
    onConfigChanged: vi.fn(() => () => {}),
    onCopyPendingCommentsRequest: vi.fn(() => () => {}),
    onFindInDiffs: vi.fn(() => () => {}),
    onRepositoryChanged: vi.fn((callback) => {
      onRepositoryChanged = callback;
      return () => {
        onRepositoryChanged = null;
      };
    }),
    openConfigFile: vi.fn(async () => {}),
    openFile: vi.fn(async () => {}),
    showInFolder: vi.fn(async () => {}),
    submitPullRequestComment: vi.fn(async () => {
      throw new Error('Unexpected pull request comment submit.');
    }),
    submitPullRequestReview: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {}),
  };

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;

  try {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await waitFor(() => {
      expect(container.querySelector('.loading')).toBeNull();
      expect(onRepositoryChanged).not.toBeNull();
    });

    expect(container.querySelector('.repository-change-banner.visible')).toBeNull();
    expect(getRepositoryState).toHaveBeenCalledTimes(1);

    await act(async () => {
      onRepositoryChanged?.({ root: '/repo' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('.repository-change-banner.visible')).not.toBeNull();
    expect(getRepositoryState).toHaveBeenCalledTimes(1);
  } finally {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
  }
});

test('walkthrough launch flag does not auto-fetch walkthrough', async () => {
  const getWalkthrough = vi.fn(async () => ({
    reason: 'Unavailable in tests.',
    status: 'unavailable' as const,
  }));

  window.codiff = {
    askReviewAssistant: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getConfig: vi.fn(async () => defaultConfig),
    getDiffImageContent: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getDiffSectionContent: vi.fn(async () => {
      throw new Error('Unexpected diff section load.');
    }),
    getGitIdentity: vi.fn(async () => ({
      email: 'reviewer@example.com',
      name: 'Reviewer',
    })),
    getLaunchOptions: vi.fn(async () => ({
      repositoryPathProvided: true,
      walkthrough: true,
    })),
    getPreferences: vi.fn(async () => ({
      askModel: defaultConfig.settings.askModel,
      copyCommentsOnClose: true,
      lastRepositoryPath: '/repo',
      showWhitespace: false,
      theme: 'system' as const,
      walkthroughModel: defaultConfig.settings.walkthroughModel,
    })),
    getRepositoryHistory: vi.fn(async () => ({
      entries: [],
      root: '/repo',
    })),
    getRepositoryState: vi.fn(async () => ({
      branch: 'main',
      files: [
        {
          fingerprint: 'abc',
          path: 'src/index.ts',
          sections: [],
          status: 'modified' as const,
        },
      ],
      generatedAt: 1,
      launchPath: '/repo',
      root: '/repo',
      source: { type: 'working-tree' as const },
    })),
    getTerminalHelperStatus: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    getWalkthrough,
    installTerminalHelper: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    listModels: vi.fn(async () => [
      {
        id: 'composer-2.5',
        label: 'composer-2.5',
        parameters: [
          {
            id: 'thinking',
            label: 'Thinking',
            values: [
              { label: 'Low', value: 'low' },
              { label: 'High', value: 'high' },
            ],
          },
        ],
        variants: [
          {
            isDefault: true,
            label: 'Default',
            params: [{ id: 'thinking', value: 'low' }],
          },
          {
            label: 'Fast',
            params: [{ id: 'thinking', value: 'high' }],
          },
        ],
      },
    ]),
    onConfigChanged: vi.fn(() => () => {}),
    onCopyPendingCommentsRequest: vi.fn(() => () => {}),
    onFindInDiffs: vi.fn(() => () => {}),
    onRepositoryChanged: vi.fn(() => () => {}),
    openConfigFile: vi.fn(async () => {}),
    openFile: vi.fn(async () => {}),
    showInFolder: vi.fn(async () => {}),
    submitPullRequestComment: vi.fn(async () => {
      throw new Error('Unexpected pull request comment submit.');
    }),
    submitPullRequestReview: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {}),
  };

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;

  try {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await waitFor(() => {
      expect(container.querySelector('.loading')).toBeNull();
      expect(container.querySelector('.sidebar-walkthrough-start')).not.toBeNull();
    });

    expect(getWalkthrough).not.toHaveBeenCalled();
  } finally {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
  }
});

test('walkthrough start failure stays on walkthrough tab and shows error', async () => {
  const getWalkthrough = vi.fn(async () => ({
    reason: 'Cursor did not return JSON.',
    status: 'unavailable' as const,
  }));

  window.codiff = {
    askReviewAssistant: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getConfig: vi.fn(async () => defaultConfig),
    getDiffImageContent: vi.fn(async () => ({
      reason: 'Unavailable in tests.',
      status: 'unavailable' as const,
    })),
    getDiffSectionContent: vi.fn(async () => {
      throw new Error('Unexpected diff section load.');
    }),
    getGitIdentity: vi.fn(async () => ({
      email: 'reviewer@example.com',
      name: 'Reviewer',
    })),
    getLaunchOptions: vi.fn(async () => ({
      repositoryPathProvided: true,
      walkthrough: false,
    })),
    getPreferences: vi.fn(async () => ({
      askModel: defaultConfig.settings.askModel,
      copyCommentsOnClose: true,
      lastRepositoryPath: '/repo',
      showWhitespace: false,
      theme: 'system' as const,
      walkthroughModel: defaultConfig.settings.walkthroughModel,
    })),
    getRepositoryHistory: vi.fn(async () => ({
      entries: [],
      root: '/repo',
    })),
    getRepositoryState: vi.fn(async () => ({
      branch: 'main',
      files: [
        {
          fingerprint: 'abc',
          path: 'src/index.ts',
          sections: [],
          status: 'modified' as const,
        },
      ],
      generatedAt: 1,
      launchPath: '/repo',
      root: '/repo',
      source: { type: 'working-tree' as const },
    })),
    getTerminalHelperStatus: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    getWalkthrough,
    installTerminalHelper: vi.fn(async () => ({
      command: 'codiff',
      installed: true,
      path: '/usr/local/bin/codiff',
    })),
    listModels: vi.fn(async () => [
      {
        id: 'composer-2.5',
        label: 'composer-2.5',
      },
    ]),
    onConfigChanged: vi.fn(() => () => {}),
    onCopyPendingCommentsRequest: vi.fn(() => () => {}),
    onFindInDiffs: vi.fn(() => () => {}),
    onRepositoryChanged: vi.fn(() => () => {}),
    openConfigFile: vi.fn(async () => {}),
    openFile: vi.fn(async () => {}),
    showInFolder: vi.fn(async () => {}),
    submitPullRequestComment: vi.fn(async () => {
      throw new Error('Unexpected pull request comment submit.');
    }),
    submitPullRequestReview: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {}),
  };

  const container = document.createElement('div');
  document.body.append(container);
  let root: Root | null = null;

  try {
    await act(async () => {
      root = createRoot(container);
      root.render(<App />);
    });

    await waitFor(() => {
      expect(container.querySelector('.loading')).toBeNull();
    });

    const walkthroughTab = container.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    await act(async () => {
      walkthroughTab.click();
    });

    await waitFor(() => {
      expect(container.querySelector('.sidebar-walkthrough-start-button')).not.toBeNull();
    });

    const startButton = container.querySelector(
      '.sidebar-walkthrough-start-button',
    ) as HTMLButtonElement;
    await act(async () => {
      startButton.click();
    });

    await waitFor(() => {
      expect(getWalkthrough).toHaveBeenCalledTimes(1);
      expect(container.querySelector('.sidebar-walkthrough-status strong')?.textContent).toBe(
        'Walkthrough unavailable',
      );
      expect(container.querySelector('.sidebar-walkthrough-status span')?.textContent).toBe(
        'Cursor did not return JSON.',
      );
      expect(walkthroughTab.getAttribute('aria-selected')).toBe('true');
    });
  } finally {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
  }
});

import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, test, vi } from 'vite-plus/test';

const require = createRequire(import.meta.url);

const loadLoginShellEnv = () =>
  require('../main/login-shell-env.cjs') as {
    shouldResolveShellEnv: () => boolean;
  };

beforeEach(() => {
  vi.resetModules();
  delete process.env.CODIFF_CLI;
  delete process.env.CODIFF_DISABLE_SHELL_ENV;
  delete process.env.CURSOR_API_KEY;
});

afterEach(() => {
  delete process.env.CODIFF_CLI;
  delete process.env.CODIFF_DISABLE_SHELL_ENV;
  delete process.env.CURSOR_API_KEY;
});

test('shouldResolveShellEnv skips when launched from the CLI wrapper', () => {
  process.env.CODIFF_CLI = '1';
  const { shouldResolveShellEnv } = loadLoginShellEnv();
  expect(shouldResolveShellEnv()).toBe(false);
});

test('shouldResolveShellEnv skips when CURSOR_API_KEY is already set', () => {
  process.env.CURSOR_API_KEY = 'cursor_test';
  const { shouldResolveShellEnv } = loadLoginShellEnv();
  expect(shouldResolveShellEnv()).toBe(false);
});

test('shouldResolveShellEnv skips when explicitly disabled', () => {
  process.env.CODIFF_DISABLE_SHELL_ENV = '1';
  const { shouldResolveShellEnv } = loadLoginShellEnv();
  expect(shouldResolveShellEnv()).toBe(false);
});

test('shouldResolveShellEnv runs on macOS when the key is missing', () => {
  if (process.platform === 'win32') {
    return;
  }

  const { shouldResolveShellEnv } = loadLoginShellEnv();
  expect(shouldResolveShellEnv()).toBe(true);
});

import { createRequire } from 'node:module';
import { expect, test } from 'vite-plus/test';

const require = createRequire(import.meta.url);
const { createEditorOpener } = require('../main/editor.cjs') as {
  createEditorOpener: (options: {
    platform?: NodeJS.Platform;
    shell: {
      openPath: (path: string) => Promise<string>;
    };
  }) => {
    getEditorCommands: (absolutePath: string) => Array<{
      args: Array<string>;
      command: string;
    }>;
    parseEditorCommand: (command: string) => Array<string>;
  };
};

test('prefers Cursor CLI before VS Code', () => {
  const opener = createEditorOpener({
    shell: { openPath: async () => '' },
  });

  const commands = opener.getEditorCommands('/repo/src/App.tsx');
  const cursorIndex = commands.findIndex((c) => c.command === 'cursor' && c.args[0] === '-g');
  const codeIndex = commands.findIndex((c) => c.command === 'code' && c.args[0] === '-g');

  expect(cursorIndex).toBeGreaterThanOrEqual(0);
  expect(codeIndex).toBeGreaterThanOrEqual(0);
  expect(cursorIndex).toBeLessThan(codeIndex);
});

test('includes macOS Cursor app launch', () => {
  const opener = createEditorOpener({
    platform: 'darwin',
    shell: { openPath: async () => '' },
  });

  expect(opener.getEditorCommands('/repo/src/App.tsx')).toContainEqual({
    args: ['-a', 'Cursor', '/repo/src/App.tsx'],
    command: 'open',
  });
});

test('falls back to the macOS default text editor for text files without app associations', () => {
  const opener = createEditorOpener({
    platform: 'darwin',
    shell: {
      openPath: async () => '',
    },
  });

  expect(opener.getEditorCommands('/Users/test/.codiff/codiff.jsonc')).toContainEqual({
    args: ['-t', '/Users/test/.codiff/codiff.jsonc'],
    command: 'open',
  });
});

test('parses custom editor commands with quoted arguments', () => {
  const opener = createEditorOpener({
    shell: {
      openPath: async () => '',
    },
  });

  expect(opener.parseEditorCommand('editor --goto "{file}"')).toEqual([
    'editor',
    '--goto',
    '{file}',
  ]);
});

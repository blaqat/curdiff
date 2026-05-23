import { createRequire } from 'node:module';
import { expect, test } from 'vite-plus/test';

const require = createRequire(import.meta.url);
const {
  CURSOR_UNAVAILABLE_CODE,
  CURSOR_UNAVAILABLE_MESSAGE,
  isCursorUnavailableError,
  isModelAvailabilityError,
  normalizeModelSelection,
  parseJSONMessage,
  resolveModelSelection,
  reconcileModelSelection,
  runCursorAgent,
} = require('../cursor-agent.cjs') as {
  CURSOR_UNAVAILABLE_CODE: string;
  CURSOR_UNAVAILABLE_MESSAGE: string;
  isCursorUnavailableError: (error: unknown) => boolean;
  isModelAvailabilityError: (value: string) => boolean;
  normalizeModelSelection: (
    model: string | { id: string; params?: Array<{ id: string; value: string }> } | undefined,
  ) => { id: string; params?: Array<{ id: string; value: string }> };
  parseJSONMessage: (message: string) => unknown;
  resolveModelSelection: (
    requestModel:
      | string
      | { id: string; params?: Array<{ id: string; value: string }> }
      | undefined,
    configId: string,
    configParams: Array<{ id: string; value: string }> | undefined,
  ) => { id: string; params?: Array<{ id: string; value: string }> };
  reconcileModelSelection: (
    models: Array<{
      id: string;
      parameters?: Array<{
        id: string;
        values: Array<{ value: string }>;
      }>;
      variants?: Array<{
        isDefault?: boolean;
        params: Array<{ id: string; value: string }>;
      }>;
    }>,
    selection: { id: string; params?: Array<{ id: string; value: string }> },
  ) => { id: string; params?: Array<{ id: string; value: string }> };
  runCursorAgent: (options: {
    model?: string | { id: string; params?: Array<{ id: string; value: string }> };
    prompt: string;
    repoRoot: string;
    schema: unknown;
    timeoutMs?: number;
  }) => Promise<string>;
};

test('parseJSONMessage accepts raw JSON', () => {
  expect(parseJSONMessage('{"version":1,"reply":"ok"}')).toEqual({
    reply: 'ok',
    version: 1,
  });
});

test('parseJSONMessage extracts JSON embedded in prose', () => {
  expect(parseJSONMessage('Here you go:\n{"version":1,"reply":"ok"}\nDone.')).toEqual({
    reply: 'ok',
    version: 1,
  });
});

test('parseJSONMessage throws when no JSON is present', () => {
  expect(() => parseJSONMessage('not json')).toThrow('Cursor did not return JSON.');
});

test('isCursorUnavailableError recognizes unavailable code', () => {
  expect(
    isCursorUnavailableError(
      Object.assign(new Error(CURSOR_UNAVAILABLE_MESSAGE), { code: CURSOR_UNAVAILABLE_CODE }),
    ),
  ).toBe(true);
  expect(isCursorUnavailableError(new Error('other'))).toBe(false);
});

test('isModelAvailabilityError detects model access failures', () => {
  expect(isModelAvailabilityError('You do not have access to model composer-2.5.')).toBe(true);
  expect(isModelAvailabilityError('network timeout')).toBe(false);
});

test('normalizeModelSelection preserves params', () => {
  expect(
    normalizeModelSelection({
      id: 'composer-2.5',
      params: [{ id: 'thinking', value: 'high' }],
    }),
  ).toEqual({
    id: 'composer-2.5',
    params: [{ id: 'thinking', value: 'high' }],
  });
});

test('resolveModelSelection prefers request params over config params', () => {
  expect(
    resolveModelSelection(
      {
        id: 'composer-2.5',
        params: [{ id: 'thinking', value: 'high' }],
      },
      'auto',
      [{ id: 'thinking', value: 'low' }],
    ),
  ).toEqual({
    id: 'composer-2.5',
    params: [{ id: 'thinking', value: 'high' }],
  });
});

test('resolveModelSelection falls back to config params for string model', () => {
  expect(resolveModelSelection('composer-2.5', 'auto', [{ id: 'thinking', value: 'low' }])).toEqual(
    {
      id: 'composer-2.5',
      params: [{ id: 'thinking', value: 'low' }],
    },
  );
});

test('reconcileModelSelection drops stale params and fills defaults', () => {
  expect(
    reconcileModelSelection(
      [
        {
          id: 'composer-2.5',
          parameters: [
            {
              id: 'thinking',
              values: [{ value: 'low' }, { value: 'high' }],
            },
          ],
          variants: [
            {
              isDefault: true,
              params: [{ id: 'thinking', value: 'low' }],
            },
          ],
        },
      ],
      {
        id: 'composer-2.5',
        params: [{ id: 'thinking', value: 'invalid' }],
      },
    ),
  ).toEqual({
    id: 'composer-2.5',
    params: [{ id: 'thinking', value: 'low' }],
  });
});

test('runCursorAgent throws when CURSOR_API_KEY is missing', async () => {
  const previousKey = process.env.CURSOR_API_KEY;
  delete process.env.CURSOR_API_KEY;

  try {
    await expect(
      runCursorAgent({
        prompt: 'test',
        repoRoot: process.cwd(),
        schema: { type: 'object' },
      }),
    ).rejects.toMatchObject({ code: CURSOR_UNAVAILABLE_CODE });
  } finally {
    if (previousKey == null) {
      delete process.env.CURSOR_API_KEY;
    } else {
      process.env.CURSOR_API_KEY = previousKey;
    }
  }
});

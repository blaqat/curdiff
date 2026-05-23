import { createRequire } from 'node:module';
import { expect, test } from 'vite-plus/test';

const require = createRequire(import.meta.url);
const { normalizeWalkthrough } = require('../walkthrough.cjs') as {
  normalizeWalkthrough: (
    input: unknown,
    files: ReadonlyArray<{ path: string }>,
  ) => {
    groups: ReadonlyArray<{
      files: ReadonlyArray<{
        action: string;
        context: string;
        impact: string;
        path: string;
        reason: string;
      }>;
      reason: string;
      title: string;
    }>;
    summary: {
      focus: string;
      skim: string;
    };
    version: 1;
  };
};

test('normalizes conceptual walkthrough fields', () => {
  const walkthrough = normalizeWalkthrough(
    {
      groups: [
        {
          files: [
            {
              action: 'scan',
              context: 'Defines the walkthrough prompt and schema shape.',
              impact: 'contained',
              path: 'electron/walkthrough.cjs',
              reason: 'Rewrites the walkthrough prompt for conceptual grouping.',
            },
          ],
          reason: 'Adds AI-sorted conceptual sections for navigation.',
          title: 'Walkthrough conceptual grouping',
        },
        {
          files: [
            {
              action: 'scan',
              context: 'Documents the new walkthrough behavior.',
              impact: 'contained',
              path: 'README.md',
              reason: 'Updates user-facing documentation.',
            },
          ],
          reason: 'Minor documentation updates.',
          title: 'Documentation updates',
        },
      ],
      summary: {
        focus: 'The walkthrough now groups files by conceptual change.',
        skim: 'Documentation and minor supporting files follow the main change.',
      },
      version: 1,
    },
    [{ path: 'electron/walkthrough.cjs' }, { path: 'README.md' }],
  );

  expect(walkthrough.summary).toEqual({
    focus: 'The walkthrough now groups files by conceptual change.',
    skim: 'Documentation and minor supporting files follow the main change.',
  });
  expect(walkthrough.groups[0].files[0]).toEqual({
    action: 'scan',
    context: 'Defines the walkthrough prompt and schema shape.',
    impact: 'contained',
    path: 'electron/walkthrough.cjs',
    reason: 'Rewrites the walkthrough prompt for conceptual grouping.',
  });
  expect(walkthrough.groups[1].title).toBe('Documentation updates');
});

test('normalizes multi-file concept groups', () => {
  const walkthrough = normalizeWalkthrough(
    {
      groups: [
        {
          files: [
            {
              action: 'scan',
              context: 'Implements the PolicyAdmin service layer.',
              impact: 'contained',
              path: 'src/policy_admin.py',
              reason: 'Adds CRUD and validation for policy records.',
            },
            {
              action: 'scan',
              context: 'Covers PolicyAdmin behavior.',
              impact: 'contained',
              path: 'tests/test_policy_admin.py',
              reason: 'Adds tests for validation and persistence.',
            },
          ],
          reason: 'Introduces a new service layer for policy administration.',
          title: 'New PolicyAdmin service layer',
        },
      ],
      summary: {
        focus: 'Adds a PolicyAdmin service layer with tests.',
        skim: 'No secondary changes in this example.',
      },
      version: 1,
    },
    [{ path: 'src/policy_admin.py' }, { path: 'tests/test_policy_admin.py' }],
  );

  expect(walkthrough.groups[0]?.files).toHaveLength(2);
  expect(walkthrough.groups[0]?.files.map((file) => file.path)).toEqual([
    'src/policy_admin.py',
    'tests/test_policy_admin.py',
  ]);
});

test('adds missing files after the ranked walkthrough', () => {
  const walkthrough = normalizeWalkthrough(
    {
      groups: [
        {
          files: [
            {
              action: 'scan',
              context: 'Defines shared renderer types.',
              impact: 'contained',
              path: 'src/types.ts',
              reason: 'Updates walkthrough types.',
            },
          ],
          reason: 'Shared type contract updates.',
          title: 'Shared types',
        },
      ],
      summary: {
        focus: 'Updates shared types for the walkthrough.',
        skim: 'Any ungrouped files appear at the end.',
      },
      version: 1,
    },
    [{ path: 'src/types.ts' }, { path: 'src/App.css' }],
  );

  expect(walkthrough.groups.at(-1)).toEqual({
    files: [
      {
        action: 'scan',
        context: 'Not grouped by the walkthrough.',
        impact: 'contained',
        path: 'src/App.css',
        reason: 'Included in the diff but not assigned to a concept section.',
      },
    ],
    reason: 'Files not included in the walkthrough response.',
    title: 'Other changes',
  });
});

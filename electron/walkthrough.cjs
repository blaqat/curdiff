// @ts-check

const {
  CURSOR_UNAVAILABLE_CODE,
  isCursorUnavailableError,
  parseJSONMessage,
  runCursorAgent,
  WALKTHROUGH_TIMEOUT_MS,
} = require('./cursor-agent.cjs');
const { cleanText, normalizeEnum, oneLine, truncate } = require('./text-utils.cjs');

const MAX_TOTAL_PATCH_CHARS = 160_000;
const MAX_SECTION_PATCH_CHARS = 4_000;

/**
 * @typedef {import('../src/types.ts').ChangedFile} ChangedFile
 * @typedef {import('../src/types.ts').DiffSection} DiffSection
 * @typedef {import('../src/types.ts').RepositoryState} RepositoryState
 * @typedef {{ model?: string }} CursorAgentOptions
 */

const walkthroughSchema = {
  additionalProperties: false,
  properties: {
    groups: {
      items: {
        additionalProperties: false,
        properties: {
          files: {
            items: {
              additionalProperties: false,
              properties: {
                action: { enum: ['review', 'scan', 'skim'], type: 'string' },
                context: { type: 'string' },
                impact: { enum: ['wide', 'contained', 'mechanical'], type: 'string' },
                path: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['path', 'reason', 'context', 'action', 'impact'],
              type: 'object',
            },
            type: 'array',
          },
          reason: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['title', 'reason', 'files'],
        type: 'object',
      },
      type: 'array',
    },
    summary: {
      additionalProperties: false,
      properties: {
        focus: { type: 'string' },
        skim: { type: 'string' },
      },
      required: ['focus', 'skim'],
      type: 'object',
    },
    version: { const: 1, type: 'number' },
  },
  required: ['version', 'summary', 'groups'],
  type: 'object',
};

/** @param {string} patch */
const countPatchLines = (patch) => {
  let additions = 0;
  let deletions = 0;

  for (const line of patch.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      continue;
    }

    if (line.startsWith('+')) {
      additions += 1;
      continue;
    }

    if (line.startsWith('-')) {
      deletions += 1;
    }
  }

  return { additions, deletions };
};

/** @param {ChangedFile} file */
const getFileLineStats = (file) => {
  let additions = 0;
  let deletions = 0;

  for (const section of file.sections) {
    if (section.binary) {
      continue;
    }

    const stats = countPatchLines(section.patch || '');
    additions += stats.additions;
    deletions += stats.deletions;
  }

  return { additions, deletions };
};

/** @param {DiffSection} section @param {number} remainingBudget */
const buildPatchExcerpt = (section, remainingBudget) => {
  const summary = section.summary?.reason ? `Summary: ${section.summary.reason}\n` : '';
  const patch = section.patch || '';
  const maxLength = Math.max(
    0,
    Math.min(MAX_SECTION_PATCH_CHARS, remainingBudget - summary.length),
  );

  if (maxLength === 0) {
    return summary || '[patch omitted: budget exhausted]';
  }

  return `${summary}${truncate(patch, maxLength)}`;
};

/** @param {RepositoryState} state */
const buildPromptInput = (state) => {
  let remainingPatchBudget = MAX_TOTAL_PATCH_CHARS;

  return {
    files: state.files.map((file) => {
      const lineStats = getFileLineStats(file);

      return {
        additions: lineStats.additions,
        deletions: lineStats.deletions,
        oldPath: file.oldPath,
        path: file.path,
        sections: file.sections.map((section) => {
          const patchExcerpt = buildPatchExcerpt(section, remainingPatchBudget);
          remainingPatchBudget = Math.max(0, remainingPatchBudget - patchExcerpt.length);

          return {
            binary: section.binary,
            kind: section.kind,
            loadState: section.loadState,
            patchExcerpt,
            summary: section.summary?.reason,
          };
        }),
        status: file.status,
      };
    }),
    generatedAt: state.generatedAt,
    root: state.root,
    source: state.source,
  };
};

/** @param {RepositoryState} state */
const buildPrompt = (
  state,
) => `You are helping Codiff organize a diff into conceptual change sections.

Return an AI-sorted navigation view of the change, not review findings.
Do not inspect the repository or run shell commands; use only the digest below.
Your job is to group related files into named concepts and order those concepts from biggest or most important change to smallest or least important.
Use every provided path exactly once.

Grouping rules:
- Group by related change, not directory or file type.
- One section = one inferred concept; a section may span multiple files (implementation + tests + plugin wiring + config).
- Prefer grouping tests with the code they exercise when clearly related in the same concept section.
- Within a multi-file section, list implementation files before test files.

Section ordering (importance-first):
- Order sections from biggest or most important change to smallest or least important.
- Rank by conceptual weight and diff magnitude: new features, core logic, API or schema changes, and cross-cutting behavior come first; docs, config tweaks, generated files, and mechanical churn come last.
- Tests usually last: test files, fixtures, and snapshots typically belong in later sections, either at the end of a concept section or in dedicated test sections near the bottom.
- Do not promote test-only sections ahead of the implementation changes they validate unless the test change is itself the primary purpose of the PR.
- Use additions and deletions in the digest as a signal for relative size and importance alongside semantic role.

For each section:
- title: short concept name a human would use in a PR summary, such as "New PolicyAdmin service layer" or "Discord $policy command". Avoid generic labels like "Frontend files", "Tests", "Miscellaneous", or "Other changed files".
- reason: one sentence synthesizing what changed in that conceptual chunk.

For each file:
- context: this file's role in the concept, max 180 characters.
- reason: concise note on what changed in this file, max 140 characters.
- action: always "scan".
- impact: always "contained".

The summary must be exactly two short sentences split into focus and skim: focus is the main themes of the overall change; skim is secondary or minor areas touched.
Do not invent bugs.
Do not produce review comments.
Do not say "looks good".
Do not mention files that were not provided.
Return JSON only.

Repository change digest:
${JSON.stringify(buildPromptInput(state), null, 2)}
`;

/** @param {any} input @param {ReadonlyArray<ChangedFile>} files */
const normalizeWalkthrough = (input, files) => {
  const pathSet = new Set(files.map((file) => file.path));
  const seen = new Set();
  const groups = [];
  const actions = new Set(['review', 'scan', 'skim']);
  const impacts = new Set(['wide', 'contained', 'mechanical']);

  for (const group of Array.isArray(input?.groups) ? input.groups : []) {
    const nextFiles = [];

    for (const file of Array.isArray(group?.files) ? group.files : []) {
      const path = oneLine(file?.path);
      if (!pathSet.has(path) || seen.has(path)) {
        continue;
      }

      seen.add(path);
      nextFiles.push({
        action: normalizeEnum(file?.action, actions, 'scan'),
        context: cleanText(file?.context, 'Part of this conceptual change.'),
        impact: normalizeEnum(file?.impact, impacts, 'contained'),
        path,
        reason: cleanText(file?.reason, 'Changed in this part of the diff.'),
      });
    }

    if (nextFiles.length > 0) {
      groups.push({
        files: nextFiles,
        reason: cleanText(group?.reason, 'These files implement the same conceptual change.'),
        title: cleanText(group?.title, 'Change section'),
      });
    }
  }

  const missingFiles = files
    .filter((file) => !seen.has(file.path))
    .map((file) => ({
      action: 'scan',
      context: 'Not grouped by the walkthrough.',
      impact: 'contained',
      path: file.path,
      reason: 'Included in the diff but not assigned to a concept section.',
    }));

  if (missingFiles.length > 0) {
    groups.push({
      files: missingFiles,
      reason: 'Files not included in the walkthrough response.',
      title: 'Other changes',
    });
  }

  if (groups.length === 0 && files.length > 0) {
    throw new Error('Walkthrough did not return any changed files.');
  }

  return {
    groups,
    summary: {
      focus: cleanText(input?.summary?.focus, 'Main themes of this change.'),
      skim: cleanText(input?.summary?.skim, 'Secondary or minor areas touched.'),
    },
    version: 1,
  };
};

/** @param {RepositoryState} state @param {CursorAgentOptions} agentOptions */
const readWalkthrough = async (state, agentOptions) => {
  if (state.files.length === 0) {
    return {
      status: 'ready',
      walkthrough: {
        groups: [],
        summary: {
          focus: 'No changed files.',
          skim: 'Nothing to skim.',
        },
        version: 1,
      },
    };
  }

  try {
    const prompt = buildPrompt(state);
    const timeoutSeconds = Math.round(WALKTHROUGH_TIMEOUT_MS / 1000);
    const startedAt = Date.now();
    console.error(
      `[codiff:walkthrough] start files=${state.files.length} promptChars=${prompt.length} timeout=${timeoutSeconds}s model=${typeof agentOptions.model === 'object' ? agentOptions.model?.id : (agentOptions.model ?? 'default')}`,
    );

    const response = await runCursorAgent({
      model: agentOptions.model,
      prompt,
      repoRoot: state.root,
      schema: walkthroughSchema,
      timeoutMs: WALKTHROUGH_TIMEOUT_MS,
      useSandbox: false,
    });
    const parsed = parseJSONMessage(response);

    console.error(
      `[codiff:walkthrough] ready elapsedMs=${Date.now() - startedAt} responseChars=${response.length}`,
    );

    return {
      status: 'ready',
      walkthrough: normalizeWalkthrough(parsed, state.files),
    };
  } catch (error) {
    if (isCursorUnavailableError(error)) {
      console.error(
        `[codiff:walkthrough] unavailable code=${CURSOR_UNAVAILABLE_CODE} reason=${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        code: CURSOR_UNAVAILABLE_CODE,
        reason: error instanceof Error ? error.message : String(error),
        status: 'unavailable',
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[codiff:walkthrough] failed reason=${message}`);
    if (/timed out/i.test(message)) {
      const timeoutSeconds = Math.round(WALKTHROUGH_TIMEOUT_MS / 1000);
      return {
        reason: `Cursor walkthrough timed out after ${timeoutSeconds}s with no response. Try a faster model, reduce changed files, or set CODIFF_DEBUG_CURSOR=1 and check the Electron terminal for timing logs.`,
        status: 'unavailable',
      };
    }

    return {
      reason: message,
      status: 'unavailable',
    };
  }
};

module.exports = {
  buildPrompt,
  normalizeWalkthrough,
  readWalkthrough,
  walkthroughSchema,
};

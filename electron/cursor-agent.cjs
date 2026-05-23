// @ts-check

const CURSOR_TIMEOUT_MS = 45_000;
const WALKTHROUGH_TIMEOUT_MS = 180_000;
const CURSOR_UNAVAILABLE_CODE = 'CURSOR_UNAVAILABLE';
const CURSOR_UNAVAILABLE_MESSAGE =
  'Cursor is unavailable. Set CURSOR_API_KEY from Cursor Dashboard → Integrations and restart Codiff.';
const DEFAULT_MODEL = 'composer-2.5';
const FALLBACK_MODEL = 'auto';
/** @type {ReadonlyArray<string>} */
const FALLBACK_MODELS = Object.freeze([DEFAULT_MODEL, FALLBACK_MODEL]);
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * @typedef {{ id: string; value: string }} ModelParameterValue
 * @typedef {{
 *   id: string;
 *   label?: string;
 *   parameters?: Array<{
 *     id: string;
 *     label?: string;
 *     values: Array<{ value: string; label?: string }>;
 *   }>;
 *   variants?: Array<{
 *     label: string;
 *     description?: string;
 *     isDefault?: boolean;
 *     params: ModelParameterValue[];
 *   }>;
 * }} CodiffModel
 * @typedef {{ id: string; params?: ModelParameterValue[] }} ModelSelection
 * @typedef {{
 *   repoRoot: string;
 *   prompt: string;
 *   schema: unknown;
 *   model?: string | ModelSelection;
 *   timeoutMs?: number;
 *   useSandbox?: boolean;
 * }} RunCursorAgentOptions
 */

/** @type {{ expiresAt: number; models: CodiffModel[] } | null} */
let modelsCache = null;

/** @param {string} [detail] */
const createCursorUnavailableError = (detail) =>
  Object.assign(
    new Error(detail ? `${CURSOR_UNAVAILABLE_MESSAGE} ${detail}` : CURSOR_UNAVAILABLE_MESSAGE),
    { code: CURSOR_UNAVAILABLE_CODE },
  );

/** @returns {string | undefined} */
const getCursorApiKey = () => {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  return apiKey || undefined;
};

/** @param {string} scope @param {string} message @param {Record<string, unknown>} [details] */
const debugCursorLog = (scope, message, details) => {
  if (process.env.CODIFF_DEBUG_CURSOR !== '1') {
    return;
  }

  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  console.error(`[codiff:${scope}] ${message}${suffix}`);
};

/** @param {unknown} error */
const isCursorUnavailableError = (error) =>
  Boolean(
    error && typeof error === 'object' && 'code' in error && error.code === CURSOR_UNAVAILABLE_CODE,
  );

/** @param {string} value */
const isModelAvailabilityError = (value) =>
  /\b(?:model_not_found|unknown model|invalid model|model is not available|not available for|not supported|does not have access|do not have access|don't have access|access to model|403|404)\b/i.test(
    value,
  );

/** @param {string} message @returns {unknown} */
const parseJSONMessage = (message) => {
  try {
    return JSON.parse(message);
  } catch {
    const match = message.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Cursor did not return JSON.');
    }

    return JSON.parse(match[0]);
  }
};

/** @param {string} prompt @param {unknown} schema */
const appendSchemaInstruction = (prompt, schema) =>
  `${prompt}

Respond with ONLY valid JSON matching this schema (no markdown fences, no prose):
${JSON.stringify(schema, null, 2)}`;

/** @param {string} message */
const isSandboxUnsupportedError = (message) =>
  /sandboxing is not supported|sandbox is not supported/i.test(message);

/** @param {unknown} value @returns {ModelParameterValue[]} */
const normalizeModelParams = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.id === 'string' &&
        typeof entry.value === 'string' &&
        entry.id.trim().length > 0 &&
        entry.value.trim().length > 0,
    )
    .map((entry) => ({
      id: entry.id.trim(),
      value: entry.value.trim(),
    }));
};

/** @param {string | ModelSelection | undefined} model @returns {ModelSelection} */
const normalizeModelSelection = (model) => {
  if (!model) {
    return { id: DEFAULT_MODEL };
  }

  if (typeof model === 'string') {
    const id = model.trim();
    return { id: id || DEFAULT_MODEL };
  }

  const id = typeof model.id === 'string' && model.id.trim() ? model.id.trim() : DEFAULT_MODEL;
  const params = normalizeModelParams(model.params);
  return params.length > 0 ? { id, params } : { id };
};

/** @param {string | undefined} label @param {string | undefined} value */
const formatSelectLabel = (label, value) => {
  const candidate = (typeof label === 'string' && label.trim() ? label : value)?.trim?.() ?? '';
  if (!candidate) {
    return '';
  }

  const iconMatch = candidate.match(/^:icon-([a-z0-9-]+):$/i);
  if (iconMatch) {
    const iconName = iconMatch[1].toLowerCase();
    const known = {
      brain: 'Thinking',
      bolt: 'Fast',
      zap: 'Fast',
    };
    return (
      known[iconName] ?? iconName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  if (candidate === 'false') {
    return 'Off';
  }

  if (candidate === 'true') {
    return 'On';
  }

  return candidate;
};

/** @param {unknown} parameter */
const normalizeParameterDefinition = (parameter) => {
  if (!parameter || typeof parameter !== 'object' || typeof parameter.id !== 'string') {
    return null;
  }

  const values = Array.isArray(parameter.values)
    ? parameter.values
        .filter(
          (entry) =>
            entry && typeof entry === 'object' && typeof entry.value === 'string' && entry.value,
        )
        .map((entry) => ({
          label: formatSelectLabel(
            typeof entry.displayName === 'string' ? entry.displayName : undefined,
            entry.value,
          ),
          value: entry.value,
        }))
    : [];

  if (values.length === 0) {
    return null;
  }

  return {
    id: parameter.id,
    label:
      formatSelectLabel(
        typeof parameter.displayName === 'string' ? parameter.displayName : undefined,
        parameter.id,
      ) || undefined,
    values,
  };
};

/** @param {unknown} variant */
const normalizeVariant = (variant) => {
  if (!variant || typeof variant !== 'object' || typeof variant.displayName !== 'string') {
    return null;
  }

  const params = normalizeModelParams(variant.params);
  if (params.length === 0) {
    return null;
  }

  return {
    description:
      typeof variant.description === 'string' && variant.description.trim()
        ? variant.description
        : undefined,
    isDefault: variant.isDefault === true,
    label: variant.displayName,
    params,
  };
};

/** @param {unknown} model @returns {CodiffModel | null} */
const normalizeListedModel = (model) => {
  if (!model || typeof model !== 'object' || typeof model.id !== 'string' || !model.id.trim()) {
    return null;
  }

  const label =
    typeof model.displayName === 'string' && model.displayName.trim()
      ? model.displayName
      : typeof model.name === 'string' && model.name.trim()
        ? model.name
        : model.id;
  const parameters = Array.isArray(model.parameters)
    ? model.parameters
        .map((parameter) => normalizeParameterDefinition(parameter))
        .filter((parameter) => parameter != null)
    : [];
  const variants = Array.isArray(model.variants)
    ? model.variants
        .map((variant) => normalizeVariant(variant))
        .filter((variant) => variant != null)
    : [];

  return {
    id: model.id,
    label,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(variants.length > 0 ? { variants } : {}),
  };
};

/**
 * @param {string} repoRoot
 * @param {string} prompt
 * @param {unknown} schema
 * @param {ModelSelection} modelSelection
 * @param {number} timeoutMs
 * @param {boolean} useSandbox
 */
const invokeCursorAgent = async (
  repoRoot,
  prompt,
  schema,
  modelSelection,
  timeoutMs,
  useSandbox,
) => {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    throw createCursorUnavailableError();
  }

  const model = normalizeModelSelection(modelSelection);
  const fullPrompt = appendSchemaInstruction(prompt, schema);
  const startedAt = Date.now();
  const { Agent, CursorAgentError } = await import('@cursor/sdk');

  debugCursorLog('cursor-agent', 'prompt start', {
    model: model.id,
    promptChars: fullPrompt.length,
    sandbox: useSandbox,
    timeoutMs,
  });

  /** @type {Promise<string>} */
  const promptPromise = (async () => {
    try {
      const result = await Agent.prompt(fullPrompt, {
        apiKey,
        model: {
          id: model.id,
          ...(model.params?.length ? { params: [...model.params] } : {}),
        },
        local: {
          cwd: repoRoot,
          settingSources: [],
          ...(useSandbox ? { sandboxOptions: { enabled: true } } : {}),
        },
      });

      debugCursorLog('cursor-agent', 'prompt finished', {
        durationMs: result.durationMs ?? Date.now() - startedAt,
        elapsedMs: Date.now() - startedAt,
        model: model.id,
        responseChars: typeof result.result === 'string' ? result.result.length : 0,
        status: result.status,
      });

      if (result.status === 'error') {
        const detail =
          typeof result.error === 'string' && result.error.trim()
            ? result.error.trim()
            : typeof result.message === 'string' && result.message.trim()
              ? result.message.trim()
              : '';
        throw new Error(
          detail
            ? `Cursor agent run failed (${result.id}): ${detail}`
            : `Cursor agent run failed (${result.id}).`,
        );
      }

      const text = typeof result.result === 'string' ? result.result : '';
      if (!text.trim()) {
        throw new Error('Cursor returned an empty response.');
      }

      return text;
    } catch (error) {
      if (error instanceof CursorAgentError) {
        const message = error.message.trim();
        if (/api key|unauthorized|401|403|authentication/i.test(message)) {
          throw createCursorUnavailableError(message);
        }

        if (useSandbox && isSandboxUnsupportedError(message)) {
          throw Object.assign(new Error(message), { code: 'CURSOR_SANDBOX_UNSUPPORTED' });
        }

        throw createCursorUnavailableError(message || 'Cursor agent startup failed.');
      }

      throw error;
    }
  })();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      // Agent.prompt disposes on completion; one-shot calls cannot be cancelled cleanly on timeout.
      debugCursorLog('cursor-agent', 'prompt timed out', {
        elapsedMs: Date.now() - startedAt,
        model: model.id,
        promptChars: fullPrompt.length,
        timeoutMs,
      });
      reject(new Error(`Cursor timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promptPromise, timeoutPromise]);
};

/** @param {string} repoRoot @param {string} prompt @param {unknown} schema @param {ModelSelection} modelSelection @param {number} timeoutMs */
const invokeWithSandboxFallback = async (repoRoot, prompt, schema, modelSelection, timeoutMs) => {
  try {
    return await invokeCursorAgent(repoRoot, prompt, schema, modelSelection, timeoutMs, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'CURSOR_SANDBOX_UNSUPPORTED'
    ) {
      return invokeCursorAgent(repoRoot, prompt, schema, modelSelection, timeoutMs, false);
    }

    if (isSandboxUnsupportedError(message)) {
      return invokeCursorAgent(repoRoot, prompt, schema, modelSelection, timeoutMs, false);
    }

    throw error;
  }
};

/** @param {RunCursorAgentOptions} options @returns {Promise<string>} */
const runCursorAgent = async (options) => {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    throw createCursorUnavailableError();
  }

  const selection = normalizeModelSelection(options.model);
  const timeoutMs = options.timeoutMs ?? CURSOR_TIMEOUT_MS;
  const useSandbox = options.useSandbox !== false;
  const fallbackId = selection.id === FALLBACK_MODEL ? DEFAULT_MODEL : FALLBACK_MODEL;

  /** @param {ModelSelection} activeSelection @returns {Promise<string>} */
  const invoke = async (activeSelection) =>
    useSandbox
      ? invokeWithSandboxFallback(
          options.repoRoot,
          options.prompt,
          options.schema,
          activeSelection,
          timeoutMs,
        )
      : invokeCursorAgent(
          options.repoRoot,
          options.prompt,
          options.schema,
          activeSelection,
          timeoutMs,
          false,
        );

  try {
    return await invoke(selection);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      isCursorUnavailableError(error) ||
      selection.id === fallbackId ||
      !isModelAvailabilityError(message)
    ) {
      throw error;
    }

    return invoke({ id: fallbackId });
  }
};

/** @returns {Promise<CodiffModel[]>} */
const listCursorModels = async () => {
  if (modelsCache && modelsCache.expiresAt > Date.now()) {
    return modelsCache.models;
  }

  const apiKey = getCursorApiKey();
  if (!apiKey) {
    return FALLBACK_MODELS.map((id) => ({ id, label: id }));
  }

  try {
    const { Cursor } = await import('@cursor/sdk');
    const models = await Cursor.models.list({ apiKey });
    const normalized = models
      .map((model) => normalizeListedModel(model))
      .filter((model) => model != null);

    if (normalized.length > 0) {
      modelsCache = {
        expiresAt: Date.now() + MODELS_CACHE_TTL_MS,
        models: normalized,
      };
      return normalized;
    }
  } catch {
    // Fall through to static defaults.
  }

  return FALLBACK_MODELS.map((id) => ({ id, label: id }));
};

/** @param {CodiffModel[]} models @param {ModelSelection} selection @returns {ModelSelection} */
const reconcileModelSelection = (models, selection) => {
  const normalized = normalizeModelSelection(selection);
  const model = models.find((entry) => entry.id === normalized.id) ?? models[0];
  const id = model?.id ?? normalized.id;
  const modelMeta = models.find((entry) => entry.id === id);

  const defaultParams = (() => {
    if (!modelMeta) {
      return [];
    }

    const defaultVariant =
      modelMeta.variants?.find((variant) => variant.isDefault) ?? modelMeta.variants?.[0];
    if (defaultVariant) {
      return defaultVariant.params.map((param) => ({ ...param }));
    }

    if (modelMeta.parameters) {
      return modelMeta.parameters
        .map((parameter) => ({
          id: parameter.id,
          value: parameter.values[0]?.value ?? '',
        }))
        .filter((param) => param.value.length > 0);
    }

    return [];
  })();

  if (!modelMeta || defaultParams.length === 0) {
    return normalized.params?.length ? { id, params: [...normalized.params] } : { id };
  }

  const params = (normalized.params ?? []).filter((param) => {
    const definition = modelMeta.parameters?.find((entry) => entry.id === param.id);
    return definition?.values.some((value) => value.value === param.value);
  });

  if (params.length === 0) {
    return { id, params: defaultParams };
  }

  for (const definition of modelMeta.parameters ?? []) {
    if (!params.some((param) => param.id === definition.id)) {
      const fallback = definition.values[0]?.value;
      if (fallback) {
        params.push({ id: definition.id, value: fallback });
      }
    }
  }

  return { id, params };
};

/** @param {string | ModelSelection | undefined} requestModel @param {string} configId @param {ModelParameterValue[] | undefined} configParams @returns {ModelSelection} */
const resolveModelSelection = (requestModel, configId, configParams) => {
  if (requestModel && typeof requestModel === 'object' && requestModel.id) {
    const selection = normalizeModelSelection(requestModel);
    if (!selection.params?.length && configParams?.length) {
      return { id: selection.id, params: configParams };
    }
    return selection;
  }

  const id =
    typeof requestModel === 'string' && requestModel.trim() ? requestModel.trim() : configId;
  return configParams?.length ? { id, params: configParams } : { id };
};

module.exports = {
  CURSOR_TIMEOUT_MS,
  CURSOR_UNAVAILABLE_CODE,
  CURSOR_UNAVAILABLE_MESSAGE,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  FALLBACK_MODELS,
  WALKTHROUGH_TIMEOUT_MS,
  isCursorUnavailableError,
  isModelAvailabilityError,
  listCursorModels,
  normalizeModelSelection,
  parseJSONMessage,
  reconcileModelSelection,
  resolveModelSelection,
  runCursorAgent,
};

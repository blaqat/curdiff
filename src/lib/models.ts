export type ModelParameterValue = {
  id: string;
  value: string;
};

export type ModelParameterDefinition = {
  id: string;
  label?: string;
  values: ReadonlyArray<{ label?: string; value: string }>;
};

export type ModelVariant = {
  description?: string;
  isDefault?: boolean;
  label: string;
  params: ReadonlyArray<ModelParameterValue>;
};

export type CodiffModel = {
  id: string;
  label?: string;
  parameters?: ReadonlyArray<ModelParameterDefinition>;
  variants?: ReadonlyArray<ModelVariant>;
};

export type ModelSelection = {
  id: string;
  params?: ReadonlyArray<ModelParameterValue>;
};

export const getModelById = (
  models: ReadonlyArray<CodiffModel>,
  id: string,
): CodiffModel | undefined => models.find((model) => model.id === id);

export const sortModels = (models: ReadonlyArray<CodiffModel>): Array<CodiffModel> =>
  [...models].sort((left, right) =>
    (left.label ?? left.id).localeCompare(right.label ?? right.id, undefined, {
      sensitivity: 'base',
    }),
  );

export const filterModels = (
  models: ReadonlyArray<CodiffModel>,
  query: string,
): Array<CodiffModel> => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...models];
  }

  return models.filter((model) => {
    const label = (model.label ?? model.id).toLowerCase();
    const id = model.id.toLowerCase();
    return label.includes(normalized) || id.includes(normalized);
  });
};

export const resolveDefaultParams = (
  model: CodiffModel | undefined,
): Array<ModelParameterValue> => {
  if (!model) {
    return [];
  }

  const defaultVariant =
    model.variants?.find((variant) => variant.isDefault) ?? model.variants?.[0];
  if (defaultVariant) {
    return defaultVariant.params.map((param) => ({ ...param }));
  }

  if (model.parameters) {
    return model.parameters
      .map((parameter) => ({
        id: parameter.id,
        value: parameter.values[0]?.value ?? '',
      }))
      .filter((param) => param.value.length > 0);
  }

  return [];
};

export const mergeParamValue = (
  params: ReadonlyArray<ModelParameterValue>,
  id: string,
  value: string,
): Array<ModelParameterValue> => {
  const next = params.filter((param) => param.id !== id);
  if (value.length > 0) {
    next.push({ id, value });
  }
  return next;
};

export const findMatchingVariant = (
  model: CodiffModel,
  params: ReadonlyArray<ModelParameterValue>,
): ModelVariant | undefined =>
  model.variants?.find(
    (variant) =>
      variant.params.length === params.length &&
      variant.params.every((variantParam) =>
        params.some((param) => param.id === variantParam.id && param.value === variantParam.value),
      ),
  );

export const normalizeModelSelection = (
  model: string | ModelSelection | undefined,
): ModelSelection | undefined => {
  if (!model) {
    return undefined;
  }

  if (typeof model === 'string') {
    const id = model.trim();
    return id.length > 0 ? { id } : undefined;
  }

  const id = model.id.trim();
  if (id.length === 0) {
    return undefined;
  }

  const params = model.params?.filter((param) => param.id.length > 0 && param.value.length > 0);
  return params && params.length > 0 ? { id, params } : { id };
};

export const reconcileModelSelection = (
  models: ReadonlyArray<CodiffModel>,
  selection: ModelSelection,
): ModelSelection => {
  const model = getModelById(models, selection.id);
  const id = model?.id ?? models[0]?.id ?? selection.id;
  const modelMeta = getModelById(models, id);
  const defaultParams = resolveDefaultParams(modelMeta);

  if (!modelMeta || defaultParams.length === 0) {
    return { id, params: selection.params?.length ? [...selection.params] : undefined };
  }

  const params = (selection.params ?? []).filter((param) => {
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

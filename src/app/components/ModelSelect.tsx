import { useMemo } from 'react';
import { sortModels } from '../../lib/models.ts';
import { formatSelectLabel } from '../../lib/select-labels.ts';
import type { CodiffModel } from '../../types.ts';
import { SearchableSelect } from './SearchableSelect.tsx';

export function ModelSelect({
  compact = false,
  disabled = false,
  models,
  onChange,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  models: ReadonlyArray<CodiffModel>;
  onChange: (modelId: string) => void;
  value: string;
}) {
  const options = useMemo(
    () =>
      (models.length > 0 ? sortModels(models) : [{ id: value, label: value }]).map((model) => ({
        id: model.id,
        label: formatSelectLabel(model.label, model.id),
      })),
    [models, value],
  );

  return (
    <SearchableSelect
      compact={compact}
      disabled={disabled}
      onChange={onChange}
      options={options}
      searchPlaceholder="Search models…"
      title="Choose model"
      value={value}
    />
  );
}

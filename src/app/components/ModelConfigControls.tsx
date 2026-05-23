import { mergeParamValue } from '../../lib/models.ts';
import { formatSelectLabel } from '../../lib/select-labels.ts';
import type { CodiffModel, ModelParameterValue } from '../../types.ts';
import { SearchableSelect } from './SearchableSelect.tsx';

function ParameterSelect({
  compact = false,
  disabled = false,
  onChange,
  parameter,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  onChange: (nextValue: string) => void;
  parameter: NonNullable<CodiffModel['parameters']>[number];
  value: string;
}) {
  const label = parameter.label ?? parameter.id;
  const options = parameter.values.map((option) => ({
    id: option.value,
    label: formatSelectLabel(option.label, option.value),
  }));

  return (
    <SearchableSelect
      compact={compact}
      disabled={disabled}
      onChange={onChange}
      options={options}
      searchPlaceholder={`Search ${label}…`}
      title={label}
      value={value}
    />
  );
}

export function ModelConfigControls({
  compact = false,
  disabled = false,
  model,
  onParamsChange,
  params,
}: {
  compact?: boolean;
  disabled?: boolean;
  model: CodiffModel | undefined;
  onParamsChange: (params: Array<ModelParameterValue>) => void;
  params: ReadonlyArray<ModelParameterValue>;
}) {
  const parameters = model?.parameters ?? [];

  if (parameters.length === 0) {
    return null;
  }

  const getParamValue = (paramId: string) => {
    const current = params.find((param) => param.id === paramId)?.value;
    if (current) {
      return current;
    }

    return parameters.find((parameter) => parameter.id === paramId)?.values[0]?.value ?? '';
  };

  if (compact) {
    return (
      <div className="model-config-controls compact">
        {parameters.map((parameter) => (
          <ParameterSelect
            compact
            disabled={disabled}
            key={parameter.id}
            onChange={(value) => onParamsChange(mergeParamValue(params, parameter.id, value))}
            parameter={parameter}
            value={getParamValue(parameter.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="model-config-controls">
      {parameters.map((parameter) => (
        <label className="sidebar-walkthrough-start-field" key={parameter.id}>
          <span>{parameter.label ?? parameter.id}</span>
          <ParameterSelect
            disabled={disabled}
            onChange={(value) => onParamsChange(mergeParamValue(params, parameter.id, value))}
            parameter={parameter}
            value={getParamValue(parameter.id)}
          />
        </label>
      ))}
    </div>
  );
}

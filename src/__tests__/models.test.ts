import { expect, test } from 'vite-plus/test';
import {
  filterModels,
  findMatchingVariant,
  mergeParamValue,
  reconcileModelSelection,
  resolveDefaultParams,
  sortModels,
} from '../lib/models.ts';
import type { CodiffModel } from '../types.ts';

const composerModel: CodiffModel = {
  id: 'composer-2.5',
  label: 'Composer 2.5',
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
};

test('resolveDefaultParams prefers default variant', () => {
  expect(resolveDefaultParams(composerModel)).toEqual([{ id: 'thinking', value: 'low' }]);
});

test('mergeParamValue replaces a single parameter', () => {
  expect(mergeParamValue([{ id: 'thinking', value: 'low' }], 'thinking', 'high')).toEqual([
    { id: 'thinking', value: 'high' },
  ]);
});

test('findMatchingVariant detects preset match', () => {
  expect(findMatchingVariant(composerModel, [{ id: 'thinking', value: 'high' }])?.label).toBe(
    'Fast',
  );
});

test('reconcileModelSelection falls back to default params for unknown values', () => {
  expect(
    reconcileModelSelection([composerModel], {
      id: 'composer-2.5',
      params: [{ id: 'thinking', value: 'invalid' }],
    }),
  ).toEqual({
    id: 'composer-2.5',
    params: [{ id: 'thinking', value: 'low' }],
  });
});

test('sortModels orders by label', () => {
  const models: Array<CodiffModel> = [
    { id: 'z-model', label: 'Zeta' },
    { id: 'a-model', label: 'Alpha' },
    composerModel,
  ];

  expect(sortModels(models).map((model) => model.id)).toEqual([
    'a-model',
    'composer-2.5',
    'z-model',
  ]);
});

test('filterModels matches label and id', () => {
  const models: Array<CodiffModel> = [
    { id: 'composer-2.5', label: 'Composer 2.5' },
    { id: 'gpt-5', label: 'GPT-5' },
  ];

  expect(filterModels(models, 'composer').map((model) => model.id)).toEqual(['composer-2.5']);
  expect(filterModels(models, 'gpt-5').map((model) => model.id)).toEqual(['gpt-5']);
  expect(filterModels(models, '')).toHaveLength(2);
});

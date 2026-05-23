import { expect, test } from 'vite-plus/test';
import { filterSelectOptions } from '../app/components/SearchableSelect.tsx';

test('filterSelectOptions matches label and id', () => {
  const options = [
    { id: 'low', label: 'Low' },
    { id: 'high', label: 'High' },
  ];

  expect(filterSelectOptions(options, 'high').map((option) => option.id)).toEqual(['high']);
  expect(filterSelectOptions(options, '')).toHaveLength(2);
});

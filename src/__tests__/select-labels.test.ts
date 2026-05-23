import { expect, test } from 'vite-plus/test';
import { formatSelectLabel } from '../lib/select-labels.ts';

test('formatSelectLabel maps icon tokens to readable labels', () => {
  expect(formatSelectLabel(':icon-brain:')).toBe('Thinking');
  expect(formatSelectLabel(undefined, ':icon-brain:')).toBe('Thinking');
  expect(formatSelectLabel(':icon-zap:')).toBe('Fast');
});

test('formatSelectLabel preserves normal labels', () => {
  expect(formatSelectLabel('High', 'high')).toBe('High');
  expect(formatSelectLabel(undefined, 'false')).toBe('Off');
  expect(formatSelectLabel(undefined, 'true')).toBe('On');
});

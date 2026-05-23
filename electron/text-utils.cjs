// @ts-check

/** @param {unknown} value @param {string} [fallback] */
const oneLine = (value, fallback = '') =>
  (typeof value === 'string' ? value : fallback).replace(/\s+/g, ' ').trim();

/** @param {string} value @param {number} maxLength */
const truncate = (value, maxLength) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n...[truncated]`;
};

/** @param {unknown} value @param {string} [fallback] */
const cleanText = (value, fallback = '') =>
  oneLine(value, fallback).replace(/\s*\.{3}\[truncated]$/i, '');

/** @template T @param {unknown} value @param {ReadonlySet<T>} allowed @param {T} fallback */
const normalizeEnum = (value, allowed, fallback) =>
  allowed.has(/** @type {T} */ (value)) ? /** @type {T} */ (value) : fallback;

module.exports = {
  cleanText,
  normalizeEnum,
  oneLine,
  truncate,
};

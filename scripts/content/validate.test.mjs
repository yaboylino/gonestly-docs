import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectKeys, validateTranslations } from './validate.mjs';

describe('validateTranslations', () => {
  it('accepts languages with the same keys', () => {
    const problems = validateTranslations({ en: { a: { b: 'B' } }, nl: { a: { b: 'Bee' } } }, 'en');
    assert.deepEqual(problems, []);
    assert.deepEqual([...collectKeys({ a: { b: 'B' }, c: 'C' })], ['a.b', 'c']);
  });

  it('reports missing, extra and empty keys and dashes', () => {
    const problems = validateTranslations(
      { en: { a: 'A', b: 'B', d: 'D' }, nl: { a: '', c: 'C', d: 'x — y' } },
      'en',
    );
    assert.deepEqual(problems, [
      'src/i18n/nl.json: the key "b" is missing',
      'src/i18n/nl.json: the key "a" has no text',
      'src/i18n/nl.json: the key "c" does not exist in en.json',
      'src/i18n/nl.json: the key "d" contains a dash used as punctuation',
    ]);
  });
});

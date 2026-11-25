/** Returns every leaf key of a nested translation object, e.g. "nav.sections.overview". */
export function collectKeys(object, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      for (const nested of collectKeys(value, full)) keys.add(nested);
    } else {
      keys.add(full);
    }
  }
  return keys;
}

export const DASHES = /[\u2013\u2014]/;

/** Checks that every language has exactly the keys of the default language and no empty values. */
export function validateTranslations(translations, defaultLanguage) {
  const problems = [];
  const reference = collectKeys(translations[defaultLanguage]);
  for (const [lang, object] of Object.entries(translations)) {
    const keys = collectKeys(object);
    for (const key of reference) {
      if (!keys.has(key)) problems.push(`src/i18n/${lang}.json: the key "${key}" is missing`);
    }
    for (const key of keys) {
      if (!reference.has(key))
        problems.push(
          `src/i18n/${lang}.json: the key "${key}" does not exist in ${defaultLanguage}.json`,
        );
      const value = key.split('.').reduce((node, part) => node?.[part], object);
      if (typeof value !== 'string' || value.trim() === '') {
        problems.push(`src/i18n/${lang}.json: the key "${key}" has no text`);
      } else if (DASHES.test(value)) {
        problems.push(
          `src/i18n/${lang}.json: the key "${key}" contains a dash used as punctuation`,
        );
      }
    }
  }
  return problems;
}

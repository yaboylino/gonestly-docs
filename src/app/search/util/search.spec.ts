import { describe, expect, it } from 'vitest';

import type { SearchEntry } from '../models/search-entry';
import { search } from './search';

const entries: SearchEntry[] = [
  {
    slug: 'modules',
    title: 'Modules',
    id: null,
    heading: null,
    text: 'A module groups related providers.',
  },
  {
    slug: 'modules',
    title: 'Modules',
    id: 'global-modules',
    heading: 'Global modules',
    text: 'Global modules are visible everywhere.',
  },
  {
    slug: 'configuration',
    title: 'Configuratie',
    id: null,
    heading: null,
    text: 'Laad de configuratie uit omgevingsvariabelen.',
  },
  {
    slug: 'testing',
    title: 'Testing',
    id: 'overrides',
    heading: 'Overrides',
    text: 'Replace a provider with a fake module in tests.',
  },
];

describe('search', () => {
  it('ranks title and heading matches above text matches', () => {
    const results = search(entries, 'module');
    expect(results.map((r) => r.entry.id)).toEqual([null, 'global-modules', 'overrides']);
  });

  it('requires every word of the query', () => {
    expect(search(entries, 'global everywhere').map((r) => r.entry.id)).toEqual(['global-modules']);
    expect(search(entries, 'global missing')).toEqual([]);
  });

  it('ignores case and diacritics', () => {
    expect(search(entries, 'CONFIGURATIE')[0].entry.slug).toBe('configuration');
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(search(entries, '   ')).toEqual([]);
    expect(search(entries, 'module', 1)).toHaveLength(1);
  });

  it('builds a snippet around the first match', () => {
    const [result] = search(entries, 'fake');
    expect(result.snippet).toContain('fake module');
  });
});

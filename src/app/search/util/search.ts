import type { SearchEntry } from '../models/search-entry';
import type { SearchResult } from '../models/search-result';
import { normalize } from './normalize';

const SNIPPET_RADIUS = 70;

function wordStartMatch(haystack: string, token: string): boolean {
  return haystack.startsWith(token) || haystack.includes(` ${token}`);
}

function snippet(text: string, token: string): string {
  const index = normalize(text).indexOf(token);
  if (index < 0)
    return text.length > SNIPPET_RADIUS * 2 ? `${text.slice(0, SNIPPET_RADIUS * 2)}...` : text;
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(text.length, index + token.length + SNIPPET_RADIUS);
  return `${start > 0 ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`;
}

/** Ranks the entries that contain every word of the query, best matches first. */
export function search(entries: readonly SearchEntry[], query: string, limit = 8): SearchResult[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const phrase = tokens.join(' ');

  const results: SearchResult[] = [];
  for (const entry of entries) {
    const title = normalize(entry.title);
    // A page's introduction has no heading; its title then counts as one.
    const heading = normalize(entry.heading ?? entry.title);
    const text = normalize(entry.text);

    let score = 0;
    let matchedAll = true;
    for (const token of tokens) {
      let tokenScore = 0;
      if (title.includes(token)) tokenScore += wordStartMatch(title, token) ? 10 : 6;
      if (heading.includes(token)) tokenScore += wordStartMatch(heading, token) ? 8 : 5;
      if (text.includes(token)) tokenScore += 1;
      if (tokenScore === 0) {
        matchedAll = false;
        break;
      }
      score += tokenScore;
    }
    if (!matchedAll) continue;
    if (heading.includes(phrase) || title.includes(phrase)) score += 8;
    if (entry.heading === null) score += 2;
    results.push({ entry, score, snippet: snippet(entry.text, tokens[0]) });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

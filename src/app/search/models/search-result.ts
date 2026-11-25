import type { SearchEntry } from './search-entry';

export interface SearchResult {
  entry: SearchEntry;
  score: number;
  snippet: string;
}

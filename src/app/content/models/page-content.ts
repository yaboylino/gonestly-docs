import type { Heading } from './heading';

export interface PageContent {
  slug: string;
  title: string;
  description: string;
  html: string;
  headings: Heading[];
}

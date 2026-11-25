import type { NavArea } from '../models/nav-area';
import type { NavItem } from '../models/nav-item';

/** Returns the pages before and after the given page within its area. */
export function adjacentPages(
  area: NavArea,
  slug: string,
): { previous: NavItem | null; next: NavItem | null } {
  const items = area.sections.flatMap((s) => s.items);
  const index = items.findIndex((i) => i.slug === slug);
  if (index < 0) return { previous: null, next: null };
  return { previous: items[index - 1] ?? null, next: items[index + 1] ?? null };
}

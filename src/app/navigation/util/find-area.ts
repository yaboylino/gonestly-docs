import type { NavArea } from '../models/nav-area';

/** Returns the area that contains the page, or the first area for unknown pages. */
export function findArea(areas: NavArea[], slug: string | null): NavArea {
  return (
    areas.find((area) => area.sections.some((s) => s.items.some((i) => i.slug === slug))) ??
    areas[0]
  );
}

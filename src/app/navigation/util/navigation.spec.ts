import { describe, expect, it } from 'vitest';

import type { NavArea } from '../models/nav-area';
import { adjacentPages } from './adjacent-pages';
import { findArea } from './find-area';

const areas: NavArea[] = [
  {
    id: 'docs',
    label: 'rail.docs',
    icon: 'book-open-text',
    sections: [
      { label: 'a', items: [{ slug: 'intro', label: 'x', icon: 'house' }] },
      {
        label: 'b',
        items: [
          { slug: 'modules', label: 'x', icon: 'cube' },
          { slug: 'providers', label: 'x', icon: 'cube' },
        ],
      },
    ],
  },
  {
    id: 'roadmap',
    label: 'rail.roadmap',
    icon: 'map-trifold',
    sections: [{ label: 'c', items: [{ slug: 'roadmap', label: 'x', icon: 'flag-banner' }] }],
  },
];

describe('findArea', () => {
  it('returns the area that contains the page', () => {
    expect(findArea(areas, 'roadmap').id).toBe('roadmap');
    expect(findArea(areas, 'providers').id).toBe('docs');
  });

  it('falls back to the first area', () => {
    expect(findArea(areas, null).id).toBe('docs');
    expect(findArea(areas, 'unknown').id).toBe('docs');
  });
});

describe('adjacentPages', () => {
  it('crosses section boundaries within an area', () => {
    const { previous, next } = adjacentPages(areas[0], 'modules');
    expect(previous?.slug).toBe('intro');
    expect(next?.slug).toBe('providers');
  });

  it('has no neighbours at the edges or for unknown pages', () => {
    expect(adjacentPages(areas[0], 'intro').previous).toBeNull();
    expect(adjacentPages(areas[0], 'providers').next).toBeNull();
    expect(adjacentPages(areas[0], 'unknown')).toEqual({ previous: null, next: null });
  });
});

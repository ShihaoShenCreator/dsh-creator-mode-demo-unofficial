/**
 * Registry of the four landmark models, with the gallery copy beside each one.
 *
 * Builds are memoised: switching back to a landmark reuses the triangle array
 * instead of re-running the generator, and a failing model reports a message
 * instead of taking the whole page down.
 */
import { build as buildEiffel } from '../models/eiffel.js';
import { build as buildGreatWall } from '../models/great-wall.js';
import { build as buildForbiddenCity } from '../models/forbidden-city.js';
import { build as buildTajMahal } from '../models/taj-mahal.js';

const cache = new Map();

const ENTRIES = [
  {
    id: 'eiffel',
    build: buildEiffel,
    title: 'Eiffel Tower',
    place: 'Paris, France',
    blurb:
      'Three tiers of wrought iron over four splayed arches — the silhouette that has stood in for Paris since 1889.',
    titleKey: 'eiffel.name',
    placeKey: 'eiffel.place',
    blurbKey: 'eiffel.blurb',
  },
  {
    id: 'great-wall',
    build: buildGreatWall,
    title: 'Great Wall',
    place: 'Badaling, China',
    blurb:
      'A crenellated parapet riding a mountain ridge, punctuated by square watchtowers that carried beacon fires.',
    titleKey: 'wall.name',
    placeKey: 'wall.place',
    blurbKey: 'wall.blurb',
  },
  {
    id: 'forbidden-city',
    build: buildForbiddenCity,
    title: 'Forbidden City',
    place: 'Beijing, China',
    blurb:
      'Vermilion walls and imperial yellow hip roofs around the Hall of Supreme Harmony, raised on a white marble terrace.',
    titleKey: 'forbidden-city.name',
    placeKey: 'forbidden-city.place',
    blurbKey: 'forbidden-city.blurb',
  },
  {
    id: 'taj-mahal',
    build: buildTajMahal,
    title: 'Taj Mahal',
    place: 'Agra, India',
    blurb:
      'A marble onion dome flanked by four minarets, mirrored in a long reflecting pool on the river terrace.',
    titleKey: 'taj-mahal.name',
    placeKey: 'taj-mahal.place',
    blurbKey: 'taj-mahal.blurb',
  },
];

/** Build (once) and return the triangle array for one landmark. */
export function loadModel(id) {
  if (cache.has(id)) {
    const cached = cache.get(id);
    if (cached instanceof Error) throw cached;
    return cached;
  }
  const entry = ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`unknown landmark: ${id}`);
  try {
    const tris = entry.build();
    cache.set(id, tris);
    return tris;
  } catch (err) {
    const wrapped = err instanceof Error ? err : new Error(String(err));
    cache.set(id, wrapped);
    throw wrapped;
  }
}

export function listLandmarks() {
  return ENTRIES;
}

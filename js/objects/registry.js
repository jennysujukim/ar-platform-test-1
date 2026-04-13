/**
 * registry.js — maps object keys → Three.js creator functions
 *
 * To add a new object:
 *   1. Create  js/objects/<key>.js  exporting a  create<Name>()  function.
 *   2. Import it here and add an entry to REGISTRY.
 *   3. Add the same key to  js/config.js  (used by the QR generator page).
 */
import { createHeart } from './heart.js';
// import { createStar }  from './star.js';   // ← uncomment when ready

const REGISTRY = {
  heart: {
    key:         'heart',
    name:        'Heart',
    description: 'A red 3D heart that bursts into view',
    color:       '#ff1744',
    create:      createHeart,
  },

  // star: {
  //   key:         'star',
  //   name:        'Star',
  //   description: 'A golden 3D star',
  //   color:       '#FFD700',
  //   create:      createStar,
  // },
};

/** Returns the config for the given key, or null if not found. */
export function getObjectConfig(key) {
  return REGISTRY[key] ?? null;
}

/** Returns all registered object configs as an array. */
export function getAllObjects() {
  return Object.values(REGISTRY);
}

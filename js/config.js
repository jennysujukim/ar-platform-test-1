/**
 * AR Object Registry Config
 * ─────────────────────────
 * Add a new entry here + create  js/objects/<key>.js  to register a new AR object.
 * Each object's QR code is automatically generated on  qr.html.
 */
export const AR_OBJECTS = [
  {
    key: 'heart',
    name: 'Heart',
    description: 'A red 3D heart that bursts into view',
    color: '#ff1744',
  },

  // ── Future objects ──────────────────────────────────────────────────────────
  // Uncomment and add the matching js/objects/star.js to activate.
  //
  // {
  //   key: 'star',
  //   name: 'Star',
  //   description: 'A golden 3D star',
  //   color: '#FFD700',
  // },
];

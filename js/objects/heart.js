/**
 * heart.js — Red 3D heart mesh
 *
 * Built entirely with Three.js procedural geometry (no external file needed).
 * Shape: classic heart curve extruded along Z with bevel for roundness.
 * Material: MeshStandardMaterial with PBR for realistic lighting.
 */
import * as THREE from 'three';

export function createHeart() {
  const shape    = buildHeartShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth:          0.28,
    bevelEnabled:   true,
    bevelThickness: 0.10,
    bevelSize:      0.07,
    bevelSegments:  6,
  });

  // Center geometry so the pivot is the heart's centroid
  geometry.center();

  const material = new THREE.MeshStandardMaterial({
    color:     0xff1744,   // vivid red
    emissive:  0x5c0011,   // dark-red self-glow
    roughness: 0.28,
    metalness: 0.15,
    envMapIntensity: 1.0,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // The Three.js heart shape bezier is drawn with Y pointing up.
  // ExtrudeGeometry extrudes along +Z, so after geometry.center() the heart
  // faces +Z directly toward the camera — no rotation needed.
  // Flip on Y so the heart isn't mirrored (bezier starts on the right lobe).
  mesh.rotation.y = Math.PI;

  return mesh;
}

/**
 * Classic heart bezier path — normalised to ≈ 2.2 × 1.9 units.
 * Derived from the Three.js examples heart curve, scaled by 0.12.
 */
function buildHeartShape() {
  const s = 0.12;   // scale factor
  const shape = new THREE.Shape();

  shape.moveTo(      5 * s,  5 * s);
  shape.bezierCurveTo(5 * s,  5 * s,  4 * s,       0,       0,       0);
  shape.bezierCurveTo(-6 * s,      0, -6 * s,  7 * s, -6 * s,  7 * s);
  shape.bezierCurveTo(-6 * s, 11 * s, -3 * s, 15.4 * s, 5 * s, 19 * s);
  shape.bezierCurveTo(12 * s, 15.4 * s, 16 * s, 11 * s, 16 * s,  7 * s);
  shape.bezierCurveTo(16 * s,  7 * s, 16 * s,       0, 10 * s,       0);
  shape.bezierCurveTo( 7 * s,       0,  5 * s,  5 * s,  5 * s,  5 * s);

  return shape;
}

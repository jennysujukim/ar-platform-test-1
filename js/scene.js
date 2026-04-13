/**
 * scene.js — Three.js AR scene
 *
 * Layout:
 *   • Transparent renderer sits over the live camera video
 *   • Object starts tiny + far away → springs to full size (pop from back to front)
 *   • After landing: gentle float + slow auto-rotate
 *   • Pointer drag (mouse or touch) rotates the object; momentum carries on release
 */
import * as THREE from 'three';

// ── Module-level state ────────────────────────────────────────────────────────
let renderer, scene, camera, mesh;
let rafId       = null;
let startTime   = null;
let animDone    = false;

// Interaction
let isDragging      = false;
let prevX = 0, prevY = 0;
let velX  = 0, velY  = 0;

// ── Constants ─────────────────────────────────────────────────────────────────
const POP_DURATION = 1.4;   // seconds for the pop-up animation
const POP_START_Z  = -12;   // Z world-space start (far back)
const POP_END_Z    =  0;    // Z world-space end   (front / centre)

// ── Public API ────────────────────────────────────────────────────────────────
export function initScene(canvas, objectConfig) {
  // Renderer — transparent so the camera video shows through
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);     // fully transparent

  // Scene
  scene = new THREE.Scene();

  // Perspective camera — positioned along +Z looking toward origin
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 5);

  // ── Lighting ────────────────────────────────────────────────────────────────
  // Soft ambient base
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  // Key light — warm, from upper-right
  const key = new THREE.DirectionalLight(0xfff0f0, 1.6);
  key.position.set(4, 8, 6);
  scene.add(key);

  // Fill light — cool pink, from left
  const fill = new THREE.DirectionalLight(0xff88aa, 0.7);
  fill.position.set(-5, 2, 4);
  scene.add(fill);

  // Rim / back light — adds depth
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, -6, -6);
  scene.add(rim);

  // ── 3D Object ───────────────────────────────────────────────────────────────
  mesh = objectConfig.create();
  mesh.scale.set(0.001, 0.001, 0.001);   // start invisible
  mesh.position.z = POP_START_Z;
  scene.add(mesh);

  // ── Interaction ─────────────────────────────────────────────────────────────
  setupPointerInteraction(canvas);

  // ── Resize ──────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

export function startAnimation() {
  startTime = null;
  animDone  = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}

// ── Animation loop ────────────────────────────────────────────────────────────
function tick(ts) {
  rafId = requestAnimationFrame(tick);

  if (startTime === null) startTime = ts;
  const elapsed = (ts - startTime) / 1000;   // seconds

  if (!animDone) {
    // ── Phase 1: Pop-up (back → front + spring scale) ──────────────────────
    if (elapsed < POP_DURATION) {
      const t     = elapsed / POP_DURATION;
      const scale = easeOutElastic(t);        // springs past 1 then settles
      mesh.scale.set(scale, scale, scale);
      mesh.position.z = POP_START_Z + (POP_END_Z - POP_START_Z) * easeOutCubic(t);
      // Slight spin during entrance for visual flair
      mesh.rotation.y = (1 - easeOutCubic(t)) * Math.PI * 1.5;
    } else {
      // Snap to final values
      mesh.scale.set(1, 1, 1);
      mesh.position.z = POP_END_Z;
      animDone = true;
    }
  } else {
    // ── Phase 2: Idle — float + slow rotate (+ user drag override) ─────────
    const idleT = elapsed - POP_DURATION;

    // Gentle vertical float
    mesh.position.y = Math.sin(idleT * 1.1) * 0.13;

    if (!isDragging) {
      // Apply drag momentum with damping
      velY *= 0.92;
      velX *= 0.92;
      mesh.rotation.y += velY + 0.004;   // slow auto-rotate
      mesh.rotation.x += velX;
      // Clamp X tilt so heart doesn't flip fully
      mesh.rotation.x = Math.max(-0.6, Math.min(0.6, mesh.rotation.x));
    }
  }

  renderer.render(scene, camera);
}

// ── Easing functions ──────────────────────────────────────────────────────────
function easeOutElastic(t) {
  // Elastic spring — overshoots ~10% then settles
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ── Pointer (mouse + touch) drag interaction ──────────────────────────────────
function setupPointerInteraction(canvas) {
  canvas.addEventListener('pointerdown', e => {
    if (!animDone) return;
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    velX = velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!isDragging || !mesh) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    const sensitivity = 0.012;
    mesh.rotation.y += dx * sensitivity;
    mesh.rotation.x += dy * sensitivity;
    mesh.rotation.x = Math.max(-0.6, Math.min(0.6, mesh.rotation.x));
    velY = dx * sensitivity;
    velX = dy * sensitivity;
    prevX = e.clientX;
    prevY = e.clientY;
  });

  const endDrag = () => { isDragging = false; };
  canvas.addEventListener('pointerup',    endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}

/**
 * main.js — entry point
 * Reads ?object= from the URL, orchestrates permission flow, then hands off
 * to camera.js and scene.js.
 */
import { initCamera }  from './camera.js';
import { initScene, startAnimation } from './scene.js';
import { getObjectConfig } from './objects/registry.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $permission = document.getElementById('permission-screen');
const $loading    = document.getElementById('loading-screen');
const $error      = document.getElementById('error-screen');
const $errorMsg   = document.getElementById('error-msg');
const $hint       = document.getElementById('ui-hint');

// ── Which object to show (from QR code URL param) ─────────────────────────────
const params     = new URLSearchParams(window.location.search);
const objectKey  = params.get('object') || 'heart';

// ── Start flow ────────────────────────────────────────────────────────────────
async function startAR() {
  show($loading);

  try {
    // 1. Camera
    const video = document.getElementById('camera-feed');
    await initCamera(video);

    // 2. Resolve 3D object
    const config = getObjectConfig(objectKey);
    if (!config) throw new Error(`Unknown AR object: "${objectKey}"`);

    // 3. Build Three.js scene
    const canvas = document.getElementById('ar-canvas');
    initScene(canvas, config);

    // 4. Begin pop-up animation
    hide($loading);
    startAnimation();

    // Show drag hint after animation settles
    setTimeout(() => $hint.classList.remove('hidden'), 1800);

  } catch (err) {
    hide($loading);
    $errorMsg.textContent = err.message || 'Failed to start AR experience.';
    show($error);
  }
}

// ── Button listeners ──────────────────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', () => {
  hide($permission);
  startAR();
});

document.getElementById('retry-btn').addEventListener('click', () => {
  hide($error);
  startAR();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden');    }

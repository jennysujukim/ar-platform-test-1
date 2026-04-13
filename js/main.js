/**
 * main.js — entry point
 *
 * Orchestrates the permission flow, shows compile-progress feedback,
 * then hands off to scene.js (MindAR image tracking).
 */
import { initARScene }    from './scene.js';
import { getObjectConfig } from './objects/registry.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $permission  = document.getElementById('permission-screen');
const $loading     = document.getElementById('loading-screen');
const $loadingMsg  = document.getElementById('loading-msg');
const $compileWrap = document.getElementById('compile-progress');
const $compileBar  = document.getElementById('compile-bar');
const $error       = document.getElementById('error-screen');
const $errorMsg    = document.getElementById('error-msg');
const $scanOverlay = document.getElementById('scan-overlay');
const $hint        = document.getElementById('ui-hint');

// ── Which AR object to show (from QR code URL param) ─────────────────────────
const params    = new URLSearchParams(window.location.search);
const objectKey = params.get('object') || 'heart';

// ── Start flow ────────────────────────────────────────────────────────────────
async function startAR() {
  show($loading);
  $loadingMsg.textContent = 'Preparing AR\u2026';

  try {
    const config = getObjectConfig(objectKey);
    if (!config) throw new Error(`Unknown AR object: "${objectKey}"`);

    await initARScene(config, {

      // Called during in-browser target compilation (0 → 1)
      onCompileProgress(p) {
        $loadingMsg.textContent = 'Compiling target\u2026';
        show($compileWrap);
        $compileBar.style.width = `${Math.round(p * 100)}%`;
        if (p >= 1) {
          hide($compileWrap);
          $loadingMsg.textContent = 'Starting camera\u2026';
        }
      },

      // Called once the MindAR camera is live and tracking has started
      onReady() {
        hide($loading);
        show($scanOverlay);
      },

      // Marker detected — hide scanning overlay, show drag hint after pop lands
      onTargetFound() {
        hide($scanOverlay);
        setTimeout(() => show($hint), 1800);
      },

      // Marker lost — re-show scanning overlay and hide drag hint
      onTargetLost() {
        show($scanOverlay);
        hide($hint);
      },
    });

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

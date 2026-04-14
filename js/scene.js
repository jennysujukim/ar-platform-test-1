/**
 * scene.js — MindAR image-tracking AR scene
 *
 * Flow:
 *   1. Load heart-marker.png and compile it to a .mind target (in-browser).
 *      Compiled bytes are cached in localStorage so subsequent visits are instant.
 *   2. Initialise MindARThree — it manages the camera feed, renderer, scene and camera.
 *   3. Attach the 3D heart to an anchor that is pinned to the detected marker.
 *   4. On target-found: run the pop-up entrance animation, then idle float.
 *   5. On target-lost: hide the heart until the marker is found again.
 *   6. Pointer drag rotates the heart while it is visible.
 */
import * as THREE from 'three';
import { MindARThree } from 'mindar-image-three';
import { Compiler } from 'mindar-image';

// ── Constants ─────────────────────────────────────────────────────────────────
const TARGET_SRC  = 'assets/targets/heart-marker.png';
const CACHE_KEY   = 'ar-heart-mind-v2';  // bumped → forces recompile with enhanced marker
const BASE_SCALE  = 0.12;   // heart size relative to the marker (≈ 2.2 * 0.12 = 0.26 units wide)
const POP_DUR     = 1.4;    // seconds for the entrance pop animation

// ── Module state ──────────────────────────────────────────────────────────────
let mindarThree = null;
let heartMesh   = null;

// animation
let animActive  = false;
let animDone    = false;
let animStart   = null;   // timestamp (ms) when current entrance started

// pointer drag
let isDragging = false;
let prevX = 0, prevY = 0;
let velX  = 0, velY  = 0;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * initARScene
 *   Compiles the target image, boots MindAR, wires up events and the render loop.
 *
 * @param {Object} objectConfig  - registry entry; must have a `.create()` method
 * @param {Object} callbacks
 *   .onCompileProgress(0–1)  — called during in-browser compilation
 *   .onReady()               — called once MindAR camera feed is live
 *   .onTargetFound()         — called when the marker enters the camera view
 *   .onTargetLost()          — called when the marker leaves the camera view
 */
export async function initARScene(objectConfig, callbacks = {}) {
  const { onCompileProgress, onReady, onTargetFound, onTargetLost, onMarkerReady } = callbacks;

  // 1. Build feature-rich enhanced marker canvas, compile to .mind ─────────────
  const { mindUrl, markerDataUrl } = await compileTarget(TARGET_SRC, onCompileProgress);

  // Expose the printable marker to the UI before camera starts
  onMarkerReady?.(markerDataUrl);

  // 2. Initialise MindARThree ──────────────────────────────────────────────────
  mindarThree = new MindARThree({
    container:        document.getElementById('ar-container'),
    imageTargetSrc:   mindUrl,
    maxTrack:         1,
    uiLoading:        'no',
    uiScanning:       'no',
    uiError:          'no',
    // Tracking smoothness: lower filterMinCF = smoother but more lag;
    // higher filterBeta = faster catch-up on fast movement.
    filterMinCF:      0.001,
    filterBeta:       0.01,
    // Tolerance before confirming / dropping a tracked target (frames).
    warmupTolerance:  3,
    missTolerance:    10,
  });

  const { renderer, scene, camera } = mindarThree;

  // 3. Lighting (mirrors the original scene.js) ────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xfff0f0, 1.6);
  key.position.set(4, 8, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xff88aa, 0.7);
  fill.position.set(-5, 2, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, -6, -6);
  scene.add(rim);

  // 4. 3D heart mesh ────────────────────────────────────────────────────────────
  heartMesh = objectConfig.create();
  heartMesh.visible = false;
  heartMesh.scale.setScalar(0.001);

  // 5. Anchor the heart to image-target #0 ─────────────────────────────────────
  const anchor = mindarThree.addAnchor(0);
  anchor.group.add(heartMesh);
  // Lift slightly above the flat marker surface so it "pops out"
  heartMesh.position.set(0, 0, 0.05);

  // 6. Target found / lost callbacks ───────────────────────────────────────────
  anchor.onTargetFound = () => {
    heartMesh.visible = true;
    heartMesh.scale.setScalar(0.001);
    heartMesh.rotation.set(0, Math.PI, 0);
    animActive = true;
    animDone   = false;
    animStart  = null;
    onTargetFound?.();
  };

  anchor.onTargetLost = () => {
    heartMesh.visible = false;
    animActive = false;
    animDone   = false;
    onTargetLost?.();
  };

  // 7. Pointer drag interaction ─────────────────────────────────────────────────
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';

  canvas.addEventListener('pointerdown', e => {
    if (!animDone || !heartMesh.visible) return;
    isDragging = true;
    prevX = e.clientX; prevY = e.clientY;
    velX = velY = 0;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    const s  = 0.012;
    heartMesh.rotation.y += dx * s;
    heartMesh.rotation.x += dy * s;
    heartMesh.rotation.x = Math.max(-0.6, Math.min(0.6, heartMesh.rotation.x));
    velY = dx * s;
    velX = dy * s;
    prevX = e.clientX; prevY = e.clientY;
  });

  const endDrag = () => { isDragging = false; };
  canvas.addEventListener('pointerup',     endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // 8. Animation loop ───────────────────────────────────────────────────────────
  renderer.setAnimationLoop(ts => {
    if (animActive && heartMesh.visible) {
      if (animStart === null) animStart = ts;
      const elapsed = (ts - animStart) / 1000;

      if (!animDone) {
        if (elapsed < POP_DUR) {
          // Entrance: elastic pop + spin
          const t = elapsed / POP_DUR;
          const s = easeOutElastic(t) * BASE_SCALE;
          heartMesh.scale.setScalar(s);
          heartMesh.rotation.y = Math.PI + (1 - easeOutCubic(t)) * Math.PI * 1.5;
        } else {
          heartMesh.scale.setScalar(BASE_SCALE);
          animDone = true;
        }
      } else {
        // Idle: gentle float + slow auto-rotate
        const idleT = elapsed - POP_DUR;
        heartMesh.position.set(0, Math.sin(idleT * 1.1) * 0.015, 0.05);

        if (!isDragging) {
          velY *= 0.92;
          velX *= 0.92;
          heartMesh.rotation.y += velY + 0.004;
          heartMesh.rotation.x += velX;
          heartMesh.rotation.x = Math.max(-0.6, Math.min(0.6, heartMesh.rotation.x));
        }
      }
    }

    renderer.render(scene, camera);
  });

  // 9. Start tracking (requests camera permission internally) ──────────────────
  await mindarThree.start();
  onReady?.();
}

// ── In-browser .mind compilation ──────────────────────────────────────────────

async function compileTarget(imagePath, onProgress) {
  // Always build the enhanced canvas so we can show users exactly what to scan.
  const canvas = await buildEnhancedMarkerCanvas(imagePath);
  const markerDataUrl = canvas.toDataURL('image/png');

  // Return cached compiled data from localStorage (skip slow recompilation)
  const cached = loadFromCache();
  if (cached) return { mindUrl: cached, markerDataUrl };

  // Compile the enhanced canvas via MindAR's built-in Compiler
  const compiler = new Compiler();
  await compiler.compileImageTargets([canvas], progress => {
    onProgress?.(progress);
  });

  const buffer = await compiler.exportData();
  saveToCache(buffer);

  return { mindUrl: bufferToBlobUrl(buffer), markerDataUrl };
}

/**
 * buildEnhancedMarkerCanvas
 *
 * Draws a feature-rich 512×512 marker that MindAR can reliably detect.
 * A plain heart silhouette has too few keypoints; this version adds:
 *   • QR-code-style finder squares in three corners  (high-contrast edges)
 *   • A dense dot grid across the background         (distributed keypoints)
 *   • A bold decorative border with tick marks       (structured edges)
 *   • The original heart centred at full size        (the recognisable symbol)
 *   • "AR HEART" / "SCAN ME" text labels             (additional features)
 *
 * The SAME image is both compiled for tracking and shown to the user to scan,
 * so there is no mismatch between the target and the physical marker.
 */
async function buildEnhancedMarkerCanvas(imagePath) {
  const S   = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  // ── Dot grid — spreads keypoints uniformly across the surface ───────────────
  ctx.fillStyle = '#cccccc';
  const STEP = 20;
  for (let gx = STEP; gx < S; gx += STEP) {
    for (let gy = STEP; gy < S; gy += STEP) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Helper: QR-code-style finder square ─────────────────────────────────────
  const drawFinder = (cx, cy, sz = 64) => {
    // Three nested squares: filled-black / filled-white / filled-black
    [sz, sz * 0.75, sz * 0.5].forEach((s, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    });
  };

  drawFinder(52, 52);         // top-left
  drawFinder(S - 52, 52);    // top-right
  drawFinder(52, S - 52);    // bottom-left

  // ── Decorative red border frame ─────────────────────────────────────────────
  const INSET = 90;
  ctx.strokeStyle = '#cc0022';
  ctx.lineWidth   = 5;
  ctx.strokeRect(INSET, INSET, S - INSET * 2, S - INSET * 2);

  // Tick marks along the border edges (add structured high-contrast features)
  ctx.fillStyle = '#cc0022';
  for (let p = INSET + 15; p < S - INSET; p += 25) {
    ctx.fillRect(p,         INSET - 6,   4, 10);   // top
    ctx.fillRect(p,         S - INSET - 4, 4, 10); // bottom
    ctx.fillRect(INSET - 6, p,           10,  4);  // left
    ctx.fillRect(S - INSET - 4, p,       10,  4);  // right
  }

  // ── "AR HEART" label at top ─────────────────────────────────────────────────
  ctx.fillStyle  = '#000000';
  ctx.font       = 'bold 26px Arial, Helvetica, sans-serif';
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AR HEART', S / 2, 52);

  // ── Original heart image centred ────────────────────────────────────────────
  const img      = await loadImage(imagePath);
  const heartSz  = 280;
  const hx = (S - heartSz) / 2;
  const hy = (S - heartSz) / 2 + 10;
  ctx.drawImage(img, hx, hy, heartSz, heartSz);

  // ── "SCAN ME" label at bottom ───────────────────────────────────────────────
  ctx.fillStyle  = '#333333';
  ctx.font       = '20px Arial, Helvetica, sans-serif';
  ctx.fillText('SCAN ME', S / 2, S - 30);

  return canvas;
}

function loadFromCache() {
  try {
    const b64 = localStorage.getItem(CACHE_KEY);
    if (!b64) return null;
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bufferToBlobUrl(bytes.buffer);
  } catch {
    return null;
  }
}

function saveToCache(buffer) {
  try {
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    localStorage.setItem(CACHE_KEY, btoa(binary));
  } catch {
    // Storage quota exceeded — skip silently
  }
}

function bufferToBlobUrl(buffer) {
  return URL.createObjectURL(new Blob([buffer]));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img    = new Image();
    img.onload   = () => resolve(img);
    img.onerror  = reject;
    img.crossOrigin = 'anonymous';
    img.src      = src;
  });
}

// ── Easing functions ──────────────────────────────────────────────────────────

function easeOutElastic(t) {
  const c4 = (2 * Math.PI) / 3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

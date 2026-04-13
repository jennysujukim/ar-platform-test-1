/**
 * camera.js — getUserMedia wrapper
 * Prefers the rear camera on mobile; falls back to any camera.
 */
export async function initCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Your browser does not support camera access.');
  }

  let stream;

  // Try rear (environment) camera first, fall back to any camera
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }

  videoEl.srcObject = stream;

  // Wait for video metadata so dimensions are known
  await new Promise((resolve, reject) => {
    videoEl.onloadedmetadata = resolve;
    videoEl.onerror = reject;
  });

  await videoEl.play();
  return stream;
}

/**
 * Utilities for yielding control to the browser to prevent UI freezing
 * during long-running computations.
 */

/**
 * Yield control to the browser to prevent UI freezing.
 * Uses requestAnimationFrame when available, falls back to setTimeout.
 * 
 * This function schedules two animation frames to ensure the browser
 * has time to process events and update the UI before continuing.
 */
export function yieldToBrowser(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}


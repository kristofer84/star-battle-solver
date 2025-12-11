import { beforeEach } from "vitest";

// Polyfill requestAnimationFrame for jsdom (it may not be available or may hang in test environment)
// Always use setTimeout-based implementation in tests to avoid hanging
if (typeof window !== 'undefined') {
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    // Use setTimeout as fallback for test environment to avoid hanging
    // This ensures the promise resolves immediately
    return setTimeout(() => {
      try {
        callback(performance.now());
      } catch (e) {
        // Ignore errors in test environment
      }
    }, 0) as unknown as number;
  };
  
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id: number) => {
      clearTimeout(id);
    };
  }
}

beforeEach((ctx) => {
  // Get the test name from the task
  const testName = ctx.task?.name || 'unknown test';
  console.log(`→ Running: ${testName}`);
});


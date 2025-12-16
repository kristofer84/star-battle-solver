/**
 * Debug flag for entanglement debugging
 * Set to true to enable ENTANGLEMENT DEBUG console logs
 * Can be controlled via environment variable or set programmatically
 */

// Check for environment variable (for Node.js environments)
let debugEnabled = false;

if (typeof process !== 'undefined' && process.env) {
  debugEnabled = process.env.ENTANGLEMENT_DEBUG === 'true' || process.env.ENTANGLEMENT_DEBUG === '1';
}

// Allow programmatic control
let _debugFlag = debugEnabled;

/**
 * Enable or disable entanglement debug logging
 */
export function setEntanglementDebug(enabled: boolean): void {
  _debugFlag = enabled;
}

/**
 * Check if entanglement debug logging is enabled
 */
export function isEntanglementDebugEnabled(): boolean {
  return _debugFlag;
}

/**
 * Log a debug message only if debug is enabled
 */
export function logEntanglementDebug(...args: unknown[]): void {
  if (_debugFlag) {
    console.log(...args);
  }
}

/**
 * Log a debug warning only if debug is enabled
 */
export function warnEntanglementDebug(...args: unknown[]): void {
  if (_debugFlag) {
    console.warn(...args);
  }
}



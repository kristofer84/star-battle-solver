import type { PuzzleDef, PuzzleState, CellState, Coords } from '../types/puzzle';
import { createEmptyPuzzleState } from '../types/puzzle';
import { yieldToBrowser } from './yieldUtils';

/**
 * Specialized row-by-row solver for 10×10, 2★ Star Battle puzzles.
 * This is used only in tests; it assumes size === 10 and starsPerUnit === 2.
 */
export function solvePuzzle(def: PuzzleDef): PuzzleState | null {
  if (def.size !== 10 || def.starsPerUnit !== 2) {
    return null;
  }

  const size = def.size;
  const starsPerUnit = def.starsPerUnit;
  const regionIds = Array.from(new Set(def.regions.flat()));

  // Column and region star counts accumulated as we go.
  const colCounts = new Array(size).fill(0);
  const regionCounts = new Map<number, number>();

  // Store chosen star columns for each row to materialize the solution later.
  const rowStars: [number, number][] = new Array(size);

  function rowHasCapacityAfter(r: number): boolean {
    // For columns, ensure that with remaining rows we can still reach 2 stars.
    for (let c = 0; c < size; c += 1) {
      const remainingRows = size - (r + 1);
      if (colCounts[c] > starsPerUnit) return false;
      if (colCounts[c] + remainingRows < starsPerUnit) return false;
    }
    return true;
  }

  function solveRow(row: number, prevCols: number[]): boolean {
    if (row === size) {
      // All rows assigned; verify exact quotas.
      for (let c = 0; c < size; c += 1) {
        if (colCounts[c] !== starsPerUnit) return false;
      }
      for (const id of regionIds) {
        if ((regionCounts.get(id) ?? 0) !== starsPerUnit) return false;
      }
      return true;
    }

    // Try all column pairs (c1,c2) with |c1-c2| >= 2 for this row.
    for (let c1 = 0; c1 < size; c1 += 1) {
      for (let c2 = c1 + 2; c2 < size; c2 += 1) {
        const cols = [c1, c2];

        // Check adjacency with previous row's stars.
        let ok = true;
        for (const pc of prevCols) {
          for (const cc of cols) {
            if (Math.abs(pc - cc) <= 1) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;

        // Column and region quota checks for this row.
        for (const cc of cols) {
          if (colCounts[cc] >= starsPerUnit) {
            ok = false;
            break;
          }
          const regionId = def.regions[row][cc];
          const currentRegionCount = regionCounts.get(regionId) ?? 0;
          if (currentRegionCount >= starsPerUnit) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;

        // Apply this row's stars.
        for (const cc of cols) {
          colCounts[cc] += 1;
          const regionId = def.regions[row][cc];
          regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);
        }
        rowStars[row] = [c1, c2];

        // Feasibility check with remaining rows.
        if (rowHasCapacityAfter(row) && solveRow(row + 1, cols)) {
          return true;
        }

        // Undo.
        for (const cc of cols) {
          colCounts[cc] -= 1;
          const regionId = def.regions[row][cc];
          regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) - 1);
        }
      }
    }

    return false;
  }

  const success = solveRow(0, []);
  if (!success) return null;

  const state = createEmptyPuzzleState(def);
  for (let r = 0; r < size; r += 1) {
    const [c1, c2] = rowStars[r];
    state.cells[r][c1] = 'star';
    state.cells[r][c2] = 'star';
  }

  return state;
}

/**
 * Options for solution counting
 */
export interface CountSolutionsOptions {
  /** Maximum number of solutions to count before stopping (default: Infinity) */
  maxCount?: number;
  /** Timeout in milliseconds (default: 5000ms) */
  timeoutMs?: number;
  /** Maximum search depth (default: Infinity) */
  maxDepth?: number;
}

/**
 * Result of solution counting
 */
export interface CountSolutionsResult {
  /** Number of solutions found (may be capped by maxCount) */
  count: number;
  /** Whether the search was stopped early due to timeout */
  timedOut: boolean;
  /** Whether the search was stopped early due to reaching maxCount */
  cappedAtMax: boolean;
}

/**
 * Count the number of solutions for a given puzzle state.
 * This uses backtracking to explore all possible completions of the puzzle.
 * 
 * @param state - The current puzzle state (may be partially filled)
 * @param options - Options for controlling the search
 * @returns Result containing count, timeout status, and capped status
 */
export function countSolutions(
  state: PuzzleState,
  options: CountSolutionsOptions = {}
): CountSolutionsResult {
  const {
    maxCount = Infinity,
    timeoutMs = 2000,
    maxDepth = Infinity,
  } = options;

  const def = state.def;
  const size = def.size;
  const starsPerUnit = def.starsPerUnit;
  const regionIds = Array.from(new Set(def.regions.flat()));

  // Start timing
  const startTime = Date.now();
  let timedOut = false;
  let solutionCount = 0;

  // Track current state of stars
  const cells: CellState[][] = state.cells.map(row => [...row]);
  const rowCounts = new Array(size).fill(0);
  const colCounts = new Array(size).fill(0);
  const regionCounts = new Map<number, number>();

  // Initialize counts from existing state
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] === 'star') {
        rowCounts[r]++;
        colCounts[c]++;
        const regionId = def.regions[r][c];
        regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);
      }
    }
  }

  // Bail out early if the provided state already violates quotas or adjacency.
  for (let r = 0; r < size; r++) {
    if (rowCounts[r] > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false };
    }
  }
  for (let c = 0; c < size; c++) {
    if (colCounts[c] > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false };
    }
  }
  for (const id of regionIds) {
    if ((regionCounts.get(id) ?? 0) > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false };
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] !== 'star') continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (cells[nr][nc] === 'star') {
              return { count: 0, timedOut: false, cappedAtMax: false };
            }
          }
        }
      }
    }
  }

  // Find all empty cells
  const emptyCells: Coords[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] === 'empty') {
        emptyCells.push({ row: r, col: c });
      }
    }
  }

  /**
   * Check if placing a star at (row, col) is valid
   */
  function canPlaceStar(row: number, col: number): boolean {
    // Check row/col/region quotas
    if (rowCounts[row] >= starsPerUnit) return false;
    if (colCounts[col] >= starsPerUnit) return false;
    const regionId = def.regions[row][col];
    if ((regionCounts.get(regionId) ?? 0) >= starsPerUnit) return false;

    // Check adjacency (no stars in 8 surrounding cells)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (cells[nr][nc] === 'star') return false;
        }
      }
    }

    // Check 2×2 blocks
    for (let dr = -1; dr <= 0; dr++) {
      for (let dc = -1; dc <= 0; dc++) {
        const r0 = row + dr;
        const c0 = col + dc;
        if (r0 >= 0 && r0 < size - 1 && c0 >= 0 && c0 < size - 1) {
          // Check if this 2×2 block already has a star
          let hasStarInBlock = false;
          for (let br = 0; br < 2; br++) {
            for (let bc = 0; bc < 2; bc++) {
              const checkRow = r0 + br;
              const checkCol = c0 + bc;
              if (checkRow === row && checkCol === col) continue;
              if (cells[checkRow][checkCol] === 'star') {
                hasStarInBlock = true;
                break;
              }
            }
            if (hasStarInBlock) break;
          }
          if (hasStarInBlock) return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if the current state can still reach a valid solution
   */
  function canReachSolution(): boolean {
    // Count remaining empty cells per unit
    const rowEmptyCounts = new Array(size).fill(0);
    const colEmptyCounts = new Array(size).fill(0);
    const regionEmptyCounts = new Map<number, number>();

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cells[r][c] === 'empty') {
          rowEmptyCounts[r]++;
          colEmptyCounts[c]++;
          const regionId = def.regions[r][c];
          regionEmptyCounts.set(regionId, (regionEmptyCounts.get(regionId) ?? 0) + 1);
        }
      }
    }

    // Check if any unit can't reach required stars
    for (let r = 0; r < size; r++) {
      const needed = starsPerUnit - rowCounts[r];
      if (needed > rowEmptyCounts[r]) return false;
    }
    for (let c = 0; c < size; c++) {
      const needed = starsPerUnit - colCounts[c];
      if (needed > colEmptyCounts[c]) return false;
    }
    for (const id of regionIds) {
      const needed = starsPerUnit - (regionCounts.get(id) ?? 0);
      const available = regionEmptyCounts.get(id) ?? 0;
      if (needed > available) return false;
    }

    return true;
  }

  /**
   * Backtracking search
   */
  function search(depth: number): void {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      return;
    }

    // Check depth limit
    if (depth > maxDepth) {
      return;
    }

    // Check if we've found enough solutions
    if (solutionCount >= maxCount) {
      return;
    }

    // Early pruning: check if solution is still reachable
    if (!canReachSolution()) {
      return;
    }

    // Find next empty cell
    let nextCell: Coords | null = null;
    for (const cell of emptyCells) {
      if (cells[cell.row][cell.col] === 'empty') {
        nextCell = cell;
        break;
      }
    }

    // If no empty cells, check if this is a valid solution
    if (nextCell === null) {
      // Verify all units have exactly starsPerUnit stars
      let isValid = true;
      for (let r = 0; r < size; r++) {
        if (rowCounts[r] !== starsPerUnit) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        for (let c = 0; c < size; c++) {
          if (colCounts[c] !== starsPerUnit) {
            isValid = false;
            break;
          }
        }
      }
      if (isValid) {
        for (const id of regionIds) {
          if ((regionCounts.get(id) ?? 0) !== starsPerUnit) {
            isValid = false;
            break;
          }
        }
      }

      if (isValid) {
        solutionCount++;
      }
      return;
    }

    const { row, col } = nextCell;

    // Try placing a star
    if (canPlaceStar(row, col)) {
      cells[row][col] = 'star';
      rowCounts[row]++;
      colCounts[col]++;
      const regionId = def.regions[row][col];
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);

      search(depth + 1);

      // Backtrack
      cells[row][col] = 'empty';
      rowCounts[row]--;
      colCounts[col]--;
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) - 1);
    }

    // Try placing a cross (or leaving empty)
    if (!timedOut && solutionCount < maxCount) {
      cells[row][col] = 'cross';
      search(depth + 1);
      cells[row][col] = 'empty';
    }
  }

  search(0);

  return {
    count: solutionCount,
    timedOut,
    cappedAtMax: solutionCount >= maxCount && !timedOut,
  };
}

/**
 * Async/cooperative variant of countSolutions().
 *
 * - Periodically yields to the browser so the UI can paint (via rAF when available).
 * - Supports cancellation via AbortSignal.
 *
 * This is intended for interactive UI flows (schema forcedness verification, etc.).
 */
export interface CountSolutionsAsyncOptions extends CountSolutionsOptions {
  signal?: AbortSignal;
  /** Minimum time between yields (ms). Default: 16 (≈ 1 frame). */
  yieldEveryMs?: number;
}

export interface CountSolutionsAsyncResult extends CountSolutionsResult {
  aborted: boolean;
}
export async function countSolutionsAsync(
  state: PuzzleState,
  options: CountSolutionsAsyncOptions = {}
): Promise<CountSolutionsAsyncResult> {
  const {
    maxCount = Infinity,
    timeoutMs = 2000,
    maxDepth = Infinity,
    signal,
    yieldEveryMs = 16,
  } = options;

  const def = state.def;
  const size = def.size;
  const starsPerUnit = def.starsPerUnit;
  const regionIds = Array.from(new Set(def.regions.flat()));

  const startTime = Date.now();
  let lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let timedOut = false;
  let aborted = false;
  let solutionCount = 0;

  const cells: CellState[][] = state.cells.map(row => [...row]);
  const rowCounts = new Array(size).fill(0);
  const colCounts = new Array(size).fill(0);
  const regionCounts = new Map<number, number>();

  // Initialize counts from existing state
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] === 'star') {
        rowCounts[r]++;
        colCounts[c]++;
        const regionId = def.regions[r][c];
        regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);
      }
    }
  }

  // Early bail if already invalid.
  for (let r = 0; r < size; r++) {
    if (rowCounts[r] > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false, aborted: false };
    }
  }
  for (let c = 0; c < size; c++) {
    if (colCounts[c] > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false, aborted: false };
    }
  }
  for (const id of regionIds) {
    if ((regionCounts.get(id) ?? 0) > starsPerUnit) {
      return { count: 0, timedOut: false, cappedAtMax: false, aborted: false };
    }
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] !== 'star') continue;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (cells[nr][nc] === 'star') {
              return { count: 0, timedOut: false, cappedAtMax: false, aborted: false };
            }
          }
        }
      }
    }
  }

  const emptyCells: Coords[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cells[r][c] === 'empty') {
        emptyCells.push({ row: r, col: c });
      }
    }
  }

  function canPlaceStar(row: number, col: number): boolean {
    if (rowCounts[row] >= starsPerUnit) return false;
    if (colCounts[col] >= starsPerUnit) return false;
    const regionId = def.regions[row][col];
    if ((regionCounts.get(regionId) ?? 0) >= starsPerUnit) return false;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (cells[nr][nc] === 'star') return false;
        }
      }
    }

    for (let dr = -1; dr <= 0; dr++) {
      for (let dc = -1; dc <= 0; dc++) {
        const r0 = row + dr;
        const c0 = col + dc;
        if (r0 >= 0 && r0 < size - 1 && c0 >= 0 && c0 < size - 1) {
          let hasStarInBlock = false;
          for (let br = 0; br < 2; br++) {
            for (let bc = 0; bc < 2; bc++) {
              const checkRow = r0 + br;
              const checkCol = c0 + bc;
              if (checkRow === row && checkCol === col) continue;
              if (cells[checkRow][checkCol] === 'star') {
                hasStarInBlock = true;
                break;
              }
            }
            if (hasStarInBlock) break;
          }
          if (hasStarInBlock) return false;
        }
      }
    }

    return true;
  }

  function canReachSolution(): boolean {
    const rowEmptyCounts = new Array(size).fill(0);
    const colEmptyCounts = new Array(size).fill(0);
    const regionEmptyCounts = new Map<number, number>();

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cells[r][c] === 'empty') {
          rowEmptyCounts[r]++;
          colEmptyCounts[c]++;
          const regionId = def.regions[r][c];
          regionEmptyCounts.set(regionId, (regionEmptyCounts.get(regionId) ?? 0) + 1);
        }
      }
    }

    for (let r = 0; r < size; r++) {
      const needed = starsPerUnit - rowCounts[r];
      if (needed > rowEmptyCounts[r]) return false;
    }
    for (let c = 0; c < size; c++) {
      const needed = starsPerUnit - colCounts[c];
      if (needed > colEmptyCounts[c]) return false;
    }
    for (const id of regionIds) {
      const needed = starsPerUnit - (regionCounts.get(id) ?? 0);
      const available = regionEmptyCounts.get(id) ?? 0;
      if (needed > available) return false;
    }

    return true;
  }

  let nodesVisited = 0;

  async function maybeYield(): Promise<void> {
    if (signal?.aborted) {
      aborted = true;
      timedOut = true; // treat as "stop now"
      return;
    }
    if (yieldEveryMs <= 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastYieldTime >= yieldEveryMs) {
      await yieldToBrowser();
      lastYieldTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
  }

  async function search(depth: number): Promise<void> {
    if (signal?.aborted) {
      aborted = true;
      timedOut = true;
      return;
    }
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      return;
    }
    if (depth > maxDepth) return;
    if (solutionCount >= maxCount) return;
    if (!canReachSolution()) return;

    nodesVisited++;
    if ((nodesVisited & 0x3ff) === 0) {
      await maybeYield();
      if (timedOut) return;
    }

    let nextCell: Coords | null = null;
    for (const cell of emptyCells) {
      if (cells[cell.row][cell.col] === 'empty') {
        nextCell = cell;
        break;
      }
    }

    if (nextCell === null) {
      let isValid = true;
      for (let r = 0; r < size; r++) {
        if (rowCounts[r] !== starsPerUnit) {
          isValid = false;
          break;
        }
      }
      if (isValid) {
        for (let c = 0; c < size; c++) {
          if (colCounts[c] !== starsPerUnit) {
            isValid = false;
            break;
          }
        }
      }
      if (isValid) {
        for (const id of regionIds) {
          if ((regionCounts.get(id) ?? 0) !== starsPerUnit) {
            isValid = false;
            break;
          }
        }
      }
      if (isValid) {
        solutionCount++;
      }
      return;
    }

    const { row, col } = nextCell;

    if (canPlaceStar(row, col)) {
      cells[row][col] = 'star';
      rowCounts[row]++;
      colCounts[col]++;
      const regionId = def.regions[row][col];
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) + 1);

      await search(depth + 1);

      cells[row][col] = 'empty';
      rowCounts[row]--;
      colCounts[col]--;
      regionCounts.set(regionId, (regionCounts.get(regionId) ?? 0) - 1);
      if (timedOut || solutionCount >= maxCount) return;
    }

    if (!timedOut && solutionCount < maxCount) {
      cells[row][col] = 'cross';
      await search(depth + 1);
      cells[row][col] = 'empty';
    }
  }

  await search(0);

  return {
    count: solutionCount,
    timedOut,
    cappedAtMax: solutionCount >= maxCount && !timedOut,
    aborted,
  };
}


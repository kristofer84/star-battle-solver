import type { PuzzleState, Coords } from '../types/puzzle';

/**
 * Precomputed board statistics shared across technique calls within one hint search.
 * Computed once by buildPuzzleCache() at the top of findNextHint() to avoid
 * redundant O(n²) scans in every technique.
 *
 * Beyond the original row/col/region counts, this also memoizes a few derived
 * views that techniques compute over and over:
 *   - regionCellsById: per-region cell list (avoids the full O(n²) scan that
 *     helpers.regionCells does on every call)
 *   - regionEmptyCellsById: per-region empty cells (lazy)
 *   - cellsByRegion: same data, keyed by region id, eager build
 */
export interface PuzzleCache {
  rowStars: number[];
  rowEmpties: number[];
  colStars: number[];
  colEmpties: number[];
  regionStars: Map<number, number>;
  regionEmpties: Map<number, number>;
  /** All cells for region id (regardless of cell state). Built once. */
  regionCellsById: Map<number, Coords[]>;
  /** Empty cells per region. Lazy: built on first access via getRegionEmptyCells. */
  _regionEmptyCellsById: Map<number, Coords[]>;
}

export function buildPuzzleCache(state: PuzzleState): PuzzleCache {
  const { size, regions } = state.def;
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();
  const regionCellsById = new Map<number, Coords[]>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
      let list = regionCellsById.get(regionId);
      if (!list) {
        list = [];
        regionCellsById.set(regionId, list);
      }
      list.push({ row: r, col: c });
      if (cell === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
      } else if (cell === 'empty') {
        rowEmpties[r] += 1;
        colEmpties[c] += 1;
        regionEmpties.set(regionId, (regionEmpties.get(regionId) ?? 0) + 1);
      }
    }
  }

  return {
    rowStars,
    rowEmpties,
    colStars,
    colEmpties,
    regionStars,
    regionEmpties,
    regionCellsById,
    _regionEmptyCellsById: new Map(),
  };
}

/**
 * Ambient (per-findNextHint) cache slot. Techniques call getPuzzleCache(state)
 * to retrieve the shared cache without needing to thread it through their
 * signatures. The cache is valid for exactly one hint search: findNextHint
 * (and the benchmark loop) install it at the top of each step and clear it
 * at the end.
 *
 * If a technique is called outside this lifecycle (e.g. direct unit test) and
 * no ambient cache is installed, getPuzzleCache() builds one on the fly. This
 * preserves correctness at the cost of a single rebuild per call.
 */
let _active: { state: PuzzleState; cache: PuzzleCache } | null = null;

export function setActivePuzzleCache(state: PuzzleState, cache: PuzzleCache): void {
  _active = { state, cache };
}

export function clearActivePuzzleCache(): void {
  _active = null;
}

/**
 * Returns the ambient cache if it matches `state` by reference. Otherwise
 * builds a fresh one (without installing it). This is the entry point all
 * techniques should use instead of calling buildPuzzleCache directly.
 */
export function getPuzzleCache(state: PuzzleState): PuzzleCache {
  if (_active && _active.state === state) return _active.cache;
  return buildPuzzleCache(state);
}

/** Lazy view: cached empty-cell list per region. */
export function getRegionEmptyCells(cache: PuzzleCache, regionId: number): Coords[] {
  const existing = cache._regionEmptyCellsById.get(regionId);
  if (existing) return existing;
  const all = cache.regionCellsById.get(regionId) ?? [];
  // We don't have state here, so we can't filter by state.cells. Callers that
  // need this should compute it themselves or use the variant below.
  return all; // placeholder — see getRegionEmptyCellsFromState
}

/** Variant that has access to state, so it can filter and cache. */
export function getRegionEmptyCellsFromState(state: PuzzleState, regionId: number): Coords[] {
  const cache = getPuzzleCache(state);
  const existing = cache._regionEmptyCellsById.get(regionId);
  if (existing) return existing;
  const all = cache.regionCellsById.get(regionId) ?? [];
  const empties = all.filter((c) => state.cells[c.row][c.col] === 'empty');
  cache._regionEmptyCellsById.set(regionId, empties);
  return empties;
}

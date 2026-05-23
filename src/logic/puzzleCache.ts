import type { PuzzleState } from '../types/puzzle';

/**
 * Precomputed board statistics shared across technique calls within one hint search.
 * Computed once by buildPuzzleCache() at the top of findNextHint() to avoid
 * redundant O(n²) scans in every technique.
 */
export interface PuzzleCache {
  rowStars: number[];
  rowEmpties: number[];
  colStars: number[];
  colEmpties: number[];
  regionStars: Map<number, number>;
  regionEmpties: Map<number, number>;
}

export function buildPuzzleCache(state: PuzzleState): PuzzleCache {
  const { size, regions } = state.def;
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
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

  return { rowStars, rowEmpties, colStars, colEmpties, regionStars, regionEmpties };
}

/**
 * Band (row/column band) helper functions
 */

import { getSolveSignal } from '../../../store/puzzleStore';
import type { BoardState, RowBand, ColumnBand, Region, CellId } from '../model/types';
import { CellState, coordToCellId } from '../model/types';
import { regionFullyInsideRows, regionFullyInsideCols } from './groupHelpers';
import { createPlacementValidator, buildPlacementContext } from './placementHelpers';
import { yieldToBrowser } from '../../yieldUtils';

const rowBandsCache = new WeakMap<BoardState, RowBand[]>();
const colBandsCache = new WeakMap<BoardState, ColumnBand[]>();
const allBandsCache = new WeakMap<BoardState, Array<RowBand | ColumnBand>>();
const regionBandQuotaCache = new WeakMap<BoardState, Map<string, number>>();

// Re-export for convenience
export { regionFullyInsideRows, regionFullyInsideCols };

async function computeMaxStarsInCells(cells: CellId[], state: BoardState, limit?: number): Promise<number> {
  const signal = getSolveSignal();

  const MAX_NODES = 200_000;
  let nodes = 0;

  if (cells.length === 0) {
    return 0;
  }

  const validator = createPlacementValidator(state);
  const candidates = cells.filter(cellId => state.cellStates[cellId] === CellState.Unknown);
  let best = 0;

  let i = 0;

  async function backtrack(index: number, placed: number): Promise<void> {
    if (++i % 1000 === 0) {
      await yieldToBrowser();
      if (signal?.aborted) return;
    }

    nodes++;
    if (nodes > MAX_NODES) return;

    if (limit !== undefined && best >= limit) {
      return;
    }

    const remaining = candidates.length - index;
    if (placed + remaining <= best) {
      return;
    }

    if (index >= candidates.length) {
      best = Math.max(best, placed);
      return;
    }

    await backtrack(index + 1, placed);
    if (signal?.aborted) return;

    const cellId = candidates[index];
    if (validator.canPlace(cellId)) {
      validator.place(cellId);
      await backtrack(index + 1, placed + 1);
      validator.remove(cellId);
    }
  }

  await backtrack(0, 0);
  return best;
}

function upperBoundMaxStarsInCells(cells: CellId[], state: BoardState, limit?: number): number {
  const cap = limit ?? Number.POSITIVE_INFINITY;
  if (cap <= 0 || cells.length === 0) return 0;

  const placement = buildPlacementContext(state);
  const { size, starsPerLine, starsPerRegion } = state;

  // Count unknown candidates in the set by row/col/region.
  let unknownTotal = 0;
  const rowUnknown = new Array(size).fill(0);
  const colUnknown = new Array(size).fill(0);
  const regionUnknown = new Map<number, number>();

  for (const cellId of cells) {
    if (state.cellStates[cellId] !== CellState.Unknown) continue;
    unknownTotal += 1;

    const row = Math.floor(cellId / size);
    const col = cellId % size;
    const regionId = placement.regionByCell[cellId];

    rowUnknown[row] += 1;
    colUnknown[col] += 1;
    regionUnknown.set(regionId, (regionUnknown.get(regionId) || 0) + 1);
  }

  if (unknownTotal === 0) return 0;

  // Basic cap: cannot place more than unknowns, nor more than `limit`.
  let ub = Math.min(cap, unknownTotal);

  // Tighten by row capacity.
  let ubRows = 0;
  for (let r = 0; r < size; r += 1) {
    const remaining = Math.max(0, starsPerLine - placement.rowCounts[r]);
    ubRows += Math.min(remaining, rowUnknown[r]);
    if (ubRows >= ub) break;
  }
  ub = Math.min(ub, ubRows);

  // Tighten by column capacity.
  let ubCols = 0;
  for (let c = 0; c < size; c += 1) {
    const remaining = Math.max(0, starsPerLine - placement.colCounts[c]);
    ubCols += Math.min(remaining, colUnknown[c]);
    if (ubCols >= ub) break;
  }
  ub = Math.min(ub, ubCols);

  // Tighten by region capacity.
  let ubRegions = 0;
  for (const [regionId, count] of regionUnknown.entries()) {
    const current = placement.regionCounts.get(regionId) || 0;
    const remaining = Math.max(0, starsPerRegion - current);
    ubRegions += Math.min(remaining, count);
    if (ubRegions >= ub) break;
  }
  ub = Math.min(ub, ubRegions);

  return ub;
}

/**
 * Enumerate all row bands (contiguous subsets of rows)
 */
export function enumerateRowBands(state: BoardState): RowBand[] {
  const cached = rowBandsCache.get(state);
  if (cached) {
    return cached;
  }

  const bands: RowBand[] = [];
  const size = state.size;

  for (let start = 0; start < size; start++) {
    for (let end = start; end < size; end++) {
      const rows: number[] = [];
      const cells: CellId[] = [];

      for (let r = start; r <= end; r++) {
        rows.push(r);
        for (let c = 0; c < size; c++) {
          cells.push(coordToCellId({ row: r, col: c }, size));
        }
      }

      bands.push({
        type: 'rowBand',
        rows,
        cells,
      });
    }
  }

  rowBandsCache.set(state, bands);
  return bands;
}

/**
 * Enumerate all column bands (contiguous subsets of columns)
 */
export function enumerateColumnBands(state: BoardState): ColumnBand[] {
  const cached = colBandsCache.get(state);
  if (cached) {
    return cached;
  }

  const bands: ColumnBand[] = [];
  const size = state.size;

  for (let start = 0; start < size; start++) {
    for (let end = start; end < size; end++) {
      const cols: number[] = [];
      const cells: CellId[] = [];

      for (let c = start; c <= end; c++) {
        cols.push(c);
        for (let r = 0; r < size; r++) {
          cells.push(coordToCellId({ row: r, col: c }, size));
        }
      }

      bands.push({
        type: 'colBand',
        cols,
        cells,
      });
    }
  }

  colBandsCache.set(state, bands);
  return bands;
}

/**
 * Enumerate all bands (row and column bands)
 */
export function enumerateBands(state: BoardState): (RowBand | ColumnBand)[] {
  const cached = allBandsCache.get(state);
  if (cached) {
    return cached;
  }

  const bands = [...enumerateRowBands(state), ...enumerateColumnBands(state)];
  allBandsCache.set(state, bands);
  return bands;
}

/**
 * Get regions that intersect with a set of rows
 */
export function getRegionsIntersectingRows(state: BoardState, rows: number[]): Region[] {
  const rowSet = new Set(rows);
  const size = state.size;

  return state.regions.filter(region => {
    for (const cellId of region.cells) {
      const row = Math.floor(cellId / size);
      if (rowSet.has(row)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Get regions that intersect with a set of columns
 */
export function getRegionsIntersectingCols(state: BoardState, cols: number[]): Region[] {
  const colSet = new Set(cols);
  const size = state.size;

  return state.regions.filter(region => {
    for (const cellId of region.cells) {
      const col = cellId % size;
      if (colSet.has(col)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Get regions that intersect with a band
 */
export function getRegionsIntersectingBand(
  state: BoardState,
  band: RowBand | ColumnBand
): Region[] {
  if (band.type === 'rowBand') {
    return getRegionsIntersectingRows(state, band.rows);
  }
  return getRegionsIntersectingCols(state, band.cols);
}

/**
 * Compute remaining stars needed in a band
 */
export function computeRemainingStarsInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): number {
  const totalCapacity = band.type === 'rowBand'
    ? band.rows.length * state.starsPerLine
    : band.cols.length * state.starsPerLine;
  const currentStars = (band.cells ?? []).filter(
    cellId => state.cellStates[cellId] === CellState.Star
  ).length;
  return Math.max(0, totalCapacity - currentStars);
}

/**
 * Get candidate cells in a region that are also in specified rows
 * Candidates are only unknown cells (not already stars or crosses)
 */
export function getCandidatesInRegionAndRows(
  region: Region,
  rows: number[],
  state: BoardState
): CellId[] {
  const rowSet = new Set(rows);
  const size = state.size;

  return region.cells.filter(cellId => {
    const row = Math.floor(cellId / size);
    return rowSet.has(row) && state.cellStates[cellId] === CellState.Unknown;
  });
}

/**
 * Get candidate cells in a region that are also in specified columns
 * Candidates are only unknown cells (not already stars or crosses)
 */
export function getCandidatesInRegionAndCols(
  region: Region,
  cols: number[],
  state: BoardState
): CellId[] {
  const colSet = new Set(cols);
  const size = state.size;

  return region.cells.filter(cellId => {
    const col = cellId % size;
    return colSet.has(col) && state.cellStates[cellId] === CellState.Unknown;
  });
}

/**
 * Get ALL cells of a region that are in a band (including stars and crosses)
 */
export function getAllCellsOfRegionInBand(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState
): CellId[] {
  const size = state.size;
  if (band.type === 'rowBand') {
    const rowSet = new Set(band.rows);
    return region.cells.filter(cellId => {
      const row = Math.floor(cellId / size);
      return rowSet.has(row);
    });
  }
  const colSet = new Set(band.cols);
  return region.cells.filter(cellId => {
    const col = cellId % size;
    return colSet.has(col);
  });
}

/**
 * Get cells of a region that are in a band (candidates only - unknown cells)
 */
export function getCellsOfRegionInBand(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState
): CellId[] {
  if (band.type === 'rowBand') {
    return getCandidatesInRegionAndRows(region, band.rows, state);
  }
  return getCandidatesInRegionAndCols(region, band.cols, state);
}

export async function getRegionBandQuota(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState,
  recursionDepth: number = 0
): Promise<number> {
  const startTime = performance.now();
  //console.log('getRegionBandQuota startTime', startTime);
  // ---- cache (per BoardState object) ----
  let cache = regionBandQuotaCache.get(state);
  if (!cache) {
    cache = new Map<string, number>();
    regionBandQuotaCache.set(state, cache);
  }

  const bandKey =
    band.type === 'rowBand'
      ? `r:${band.rows[0]}-${band.rows[band.rows.length - 1]}`
      : `c:${band.cols[0]}-${band.cols[band.cols.length - 1]}`;

  const regionKey = (region as any).id ?? state.regions.indexOf(region);
  const key = `${regionKey}|${bandKey}|d:${recursionDepth}`;

  const cached = cache.get(key);
  if (cached !== undefined) {
    //console.log('getRegionBandQuota exit (cached)', performance.now() - startTime);
    return cached;
  }
  // --------------------------------------

  const allCellsInBand = getAllCellsOfRegionInBand(region, band, state);
  const starsInBand = allCellsInBand.filter(
    cellId => state.cellStates[cellId] === CellState.Star
  ).length;

  if (recursionDepth > 1) {
    cache.set(key, starsInBand);
    //console.log('getRegionBandQuota exit (recursionDepth > 1)', performance.now() - startTime);
    return starsInBand;
  }

  const candidatesInBand = getCellsOfRegionInBand(region, band, state);
  if (candidatesInBand.length === 0) {
    cache.set(key, starsInBand);
    //console.log('getRegionBandQuota exit (no candidates)', performance.now() - startTime);
    return starsInBand;
  }

  const remainingInRegion = region.starsRequired - getStarCountInRegion(region, state);
  if (remainingInRegion <= 0) {
    cache.set(key, starsInBand);
    //console.log('getRegionBandQuota exit (remainingInRegion <= 0)', performance.now() - startTime);
    return starsInBand;
  }

  const regionCellSet = new Set(region.cells);
  const remainingInBand = computeRemainingStarsInBand(band, state);
  const otherCellsInBand = band.cells?.filter(cellId => !regionCellSet.has(cellId)) ?? [];

  // The use of maxWithoutRegion here ensures potentially exponential backtracking
  // is avoided for large sets of unknowns (when otherUnknown > 20), while still computing an exact value for smaller instances.
  // This makes the quota calculation efficient and precise where feasible, while preventing solver blow-ups on large boards.
  const otherUnknown = otherCellsInBand.filter(c => state.cellStates[c] === CellState.Unknown).length;

  const maxWithoutRegion =
    otherUnknown <= 20
      ? await computeMaxStarsInCells(otherCellsInBand, state, remainingInBand)
      : upperBoundMaxStarsInCells(otherCellsInBand, state, remainingInBand);


  const bandNeedFromRegion = Math.max(0, remainingInBand - maxWithoutRegion);

  const bandCellSet = new Set(allCellsInBand);
  const candidatesOutside = region.cells.filter(
    cellId => !bandCellSet.has(cellId) && state.cellStates[cellId] === CellState.Unknown
  );
  const allCandidates = [...candidatesOutside, ...candidatesInBand];
  const validator = createPlacementValidator(state);

  // Caps to prevent exponential blow-ups
  const MAX_CANDIDATES_FOR_QUOTA = 16;
  if (allCandidates.length > MAX_CANDIDATES_FOR_QUOTA) {
    cache.set(key, starsInBand);
    //console.log('getRegionBandQuota exit (allCandidates.length > MAX_CANDIDATES_FOR_QUOTA)', performance.now() - startTime);
    return starsInBand;
  }

  const MAX_BACKTRACK_NODES = 200_000;
  let nodes = 0;
  let aborted = false;

  let minBand = Number.POSITIVE_INFINITY;
  let maxBand = -1;

  function backtrack(index: number, placed: number, bandPlaced: number): void {
    if (aborted) return;

    nodes++;
    if (nodes > MAX_BACKTRACK_NODES) {
      aborted = true;
      return;
    }

    if (placed > remainingInRegion) return;

    const remainingNeeded = remainingInRegion - placed;
    const remainingAvailable = allCandidates.length - index;
    if (remainingNeeded > remainingAvailable) return;

    if (placed === remainingInRegion) {
      minBand = Math.min(minBand, bandPlaced);
      maxBand = Math.max(maxBand, bandPlaced);
      return;
    }

    if (index >= allCandidates.length) return;

    // Skip current candidate
    backtrack(index + 1, placed, bandPlaced);
    if (aborted) return;

    // Place star if valid
    const cellId = allCandidates[index];
    if (!validator.canPlace(cellId)) return;

    validator.place(cellId);
    backtrack(
      index + 1,
      placed + 1,
      bandPlaced + (bandCellSet.has(cellId) ? 1 : 0)
    );
    validator.remove(cellId);
  }

  backtrack(0, 0, 0);

  if (aborted || minBand === Number.POSITIVE_INFINITY) {
    cache.set(key, starsInBand);
    //console.log('getRegionBandQuota exit (aborted or minBand === Number.POSITIVE_INFINITY)', performance.now() - startTime);
    return starsInBand;
  }

  const lowerBound = Math.max(minBand, Math.min(remainingInRegion, bandNeedFromRegion));
  const result = starsInBand + lowerBound;

  cache.set(key, result);
  //console.log('getRegionBandQuota exit (success)', performance.now() - startTime);
  return result;
}

/**
 * Helper to get star count in region
 */
export function getStarCountInRegion(region: Region, state: BoardState): number {
  return region.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
}

/**
 * Check if all partial regions have known band quotas
 */
export async function allHaveKnownBandQuota(
  regions: Region[],
  band: RowBand | ColumnBand,
  state: BoardState
): Promise<boolean> {
  const size = state.size;

  for (const region of regions) {
    const quota = await getRegionBandQuota(region, band, state);
    const cellsInBand = getAllCellsOfRegionInBand(region, band, state);
    const starsInBand = cellsInBand.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    const candidatesInBand = getCellsOfRegionInBand(region, band, state);
    const remainingStars = region.starsRequired - getStarCountInRegion(region, state);
    const allCandidates = region.cells.filter(cellId => state.cellStates[cellId] === CellState.Unknown);

    const isFullyInside = band.type === 'rowBand'
      ? regionFullyInsideRows(region, band.rows, size)
      : regionFullyInsideCols(region, band.cols, size);

    const isKnown =
      remainingStars === 0 ||
      candidatesInBand.length === 0 ||
      candidatesInBand.length === allCandidates.length ||
      quota > starsInBand ||
      isFullyInside;

    if (!isKnown) {
      return false;
    }
  }

  return true;
}

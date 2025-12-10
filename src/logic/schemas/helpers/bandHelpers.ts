/**
 * Band (row/column band) helper functions
 */

import type { BoardState, RowBand, ColumnBand, Region, CellId } from '../model/types';
import { CellState, cellIdToCoord, coordToCellId } from '../model/types';
import { areAdjacent } from './cellHelpers';
import { getCandidatesInGroup, regionFullyInsideRows, regionFullyInsideCols } from './groupHelpers';

// Re-export for convenience
export { regionFullyInsideRows, regionFullyInsideCols };

/**
 * Enumerate all row bands (contiguous subsets of rows)
 */
export function enumerateRowBands(state: BoardState): RowBand[] {
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

  return bands;
}

/**
 * Enumerate all column bands (contiguous subsets of columns)
 */
export function enumerateColumnBands(state: BoardState): ColumnBand[] {
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

  return bands;
}

/**
 * Enumerate all bands (row and column bands)
 */
export function enumerateBands(state: BoardState): (RowBand | ColumnBand)[] {
  return [...enumerateRowBands(state), ...enumerateColumnBands(state)];
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
  const currentStars = band.cells.filter(
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

interface PlacementContext {
  regionByCell: number[];
  rowCounts: number[];
  colCounts: number[];
  regionCounts: Map<number, number>;
  existingStars: Set<CellId>;
}

function buildPlacementContext(state: BoardState): PlacementContext {
  const { size, starsPerLine, starsPerRegion } = state;
  const regionByCell: number[] = new Array(size * size).fill(-1);
  const rowCounts = new Array(size).fill(0);
  const colCounts = new Array(size).fill(0);
  const regionCounts = new Map<number, number>();
  const existingStars: Set<CellId> = new Set();

  state.regions.forEach(region => {
    region.cells.forEach(cellId => {
      regionByCell[cellId] = region.id;
    });
  });

  state.cellStates.forEach((cellState, cellId) => {
    if (cellState !== CellState.Star) {
      return;
    }
    existingStars.add(cellId);
    const { row, col } = cellIdToCoord(cellId, size);
    rowCounts[row] += 1;
    colCounts[col] += 1;
    const regionId = regionByCell[cellId];
    regionCounts.set(regionId, (regionCounts.get(regionId) || 0) + 1);
  });

  for (let i = 0; i < size; i += 1) {
    rowCounts[i] = Math.min(rowCounts[i], starsPerLine);
    colCounts[i] = Math.min(colCounts[i], starsPerLine);
  }

  state.regions.forEach(region => {
    const current = regionCounts.get(region.id) || 0;
    regionCounts.set(region.id, Math.min(current, starsPerRegion));
  });

  return {
    regionByCell,
    rowCounts,
    colCounts,
    regionCounts,
    existingStars,
  };
}

function createPlacementValidator(state: BoardState) {
  const { size, starsPerLine, starsPerRegion } = state;
  const placementCtx = buildPlacementContext(state);
  const placements: Set<CellId> = new Set();

  function canPlace(cellId: CellId): boolean {
    if (state.cellStates[cellId] === CellState.Empty) {
      return false;
    }

    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];

    if (placementCtx.rowCounts[row] + 1 > starsPerLine) return false;
    if (placementCtx.colCounts[col] + 1 > starsPerLine) return false;
    if ((placementCtx.regionCounts.get(regionId) || 0) + 1 > starsPerRegion) return false;

    for (const existing of placementCtx.existingStars) {
      if (areAdjacent(existing, cellId, size)) {
        return false;
      }
    }

    for (const placed of placements) {
      if (areAdjacent(placed, cellId, size)) {
        return false;
      }
    }

    return true;
  }

  function place(cellId: CellId): void {
    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];
    placementCtx.rowCounts[row] += 1;
    placementCtx.colCounts[col] += 1;
    placementCtx.regionCounts.set(regionId, (placementCtx.regionCounts.get(regionId) || 0) + 1);
    placements.add(cellId);
  }

  function remove(cellId: CellId): void {
    const { row, col } = cellIdToCoord(cellId, size);
    const regionId = placementCtx.regionByCell[cellId];
    placementCtx.rowCounts[row] -= 1;
    placementCtx.colCounts[col] -= 1;
    placementCtx.regionCounts.set(regionId, (placementCtx.regionCounts.get(regionId) || 0) - 1);
    placements.delete(cellId);
  }

  return { canPlace, place, remove };
}

function computeMaxStarsInCells(cells: CellId[], state: BoardState): number {
  if (cells.length === 0) {
    return 0;
  }

  const validator = createPlacementValidator(state);
  const candidates = cells.filter(cellId => state.cellStates[cellId] === CellState.Unknown);
  let best = 0;

  function backtrack(index: number, placed: number): void {
    const remaining = candidates.length - index;
    if (placed + remaining <= best) {
      return;
    }

    if (index >= candidates.length) {
      best = Math.max(best, placed);
      return;
    }

    backtrack(index + 1, placed);

    const cellId = candidates[index];
    if (validator.canPlace(cellId)) {
      validator.place(cellId);
      backtrack(index + 1, placed + 1);
      validator.remove(cellId);
    }
  }

  backtrack(0, 0);
  return best;
}

export function getRegionBandQuota(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState,
  recursionDepth: number = 0
): number {
  const allCellsInBand = getAllCellsOfRegionInBand(region, band, state);
  const starsInBand = allCellsInBand.filter(
    cellId => state.cellStates[cellId] === CellState.Star
  ).length;

  if (recursionDepth > 1) {
    return starsInBand;
  }

  const candidatesInBand = getCellsOfRegionInBand(region, band, state);
  if (candidatesInBand.length === 0) {
    return starsInBand;
  }

  const size = state.size;
  if (band.type === 'rowBand') {
    if (regionFullyInsideRows(region, band.rows, size)) {
      return region.starsRequired;
    }
  } else if (regionFullyInsideCols(region, band.cols, size)) {
    return region.starsRequired;
  }

  const remainingInRegion = region.starsRequired - getStarCountInRegion(region, state);

  const maxInBandLocal = Math.min(
    remainingInRegion,
    computeMaxStarsInCells(candidatesInBand, state)
  );

  const bandCellSet = new Set(allCellsInBand);
  const outsideCells = region.cells.filter(cellId => !bandCellSet.has(cellId));
  const candidatesOutside = outsideCells.filter(cellId => state.cellStates[cellId] === CellState.Unknown);
  const maxOutsideBand = Math.min(
    remainingInRegion,
    computeMaxStarsInCells(candidatesOutside, state)
  );

  const minInBand = Math.max(0, remainingInRegion - maxOutsideBand);
  const maxInBand = Math.min(remainingInRegion, maxInBandLocal);

  if (minInBand === maxInBand) {
    return starsInBand + minInBand;
  }

  return starsInBand;
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
export function allHaveKnownBandQuota(
  regions: Region[],
  band: RowBand | ColumnBand,
  state: BoardState
): boolean {
  const size = state.size;

  for (const region of regions) {
    const quota = getRegionBandQuota(region, band, state);
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

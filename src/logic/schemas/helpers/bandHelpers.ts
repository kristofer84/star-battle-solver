/**
 * Band (row/column band) helper functions
 */

import type { BoardState, RowBand, ColumnBand, Region, CellId } from '../model/types';
import { coordToCellId } from '../model/types';
import { getCandidatesInGroup } from './groupHelpers';
import { regionFullyInsideRows, regionFullyInsideCols } from './groupHelpers';

/**
 * Enumerate all row bands (contiguous subsets of rows)
 */
export function enumerateRowBands(state: BoardState): RowBand[] {
  const bands: RowBand[] = [];
  const size = state.size;

  // Generate all contiguous row subsets
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

  // Generate all contiguous column subsets
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
    // Check if any cell of the region is in these rows
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
    // Check if any cell of the region is in these columns
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
  } else {
    return getRegionsIntersectingCols(state, band.cols);
  }
}

/**
 * Compute remaining stars needed in a band
 */
export function computeRemainingStarsInBand(
  band: RowBand | ColumnBand,
  state: BoardState
): number {
  if (band.type === 'rowBand') {
    const starsNeeded = band.rows.length * state.starsPerLine;
    const currentStars = band.cells.filter(
      cellId => state.cellStates[cellId] === 1 // CellState.Star
    ).length;
    return Math.max(0, starsNeeded - currentStars);
  } else {
    const starsNeeded = band.cols.length * state.starsPerLine;
    const currentStars = band.cells.filter(
      cellId => state.cellStates[cellId] === 1 // CellState.Star
    ).length;
    return Math.max(0, starsNeeded - currentStars);
  }
}

/**
 * Get candidate cells in a region that are also in specified rows
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
    return rowSet.has(row) && (state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1);
  });
}

/**
 * Get candidate cells in a region that are also in specified columns
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
    return colSet.has(col) && (state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1);
  });
}

/**
 * Get cells of a region that are in a band
 */
export function getCellsOfRegionInBand(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState
): CellId[] {
  if (band.type === 'rowBand') {
    return getCandidatesInRegionAndRows(region, band.rows, state);
  } else {
    return getCandidatesInRegionAndCols(region, band.cols, state);
  }
}

/**
 * Get region's band quota (number of stars region must place in band)
 * This computes the minimum required stars based on current constraints
 */
export function getRegionBandQuota(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState
): number {
  const cellsInBand = getCellsOfRegionInBand(region, band, state);
  const starsInBand = cellsInBand.filter(
    cellId => state.cellStates[cellId] === 1 // CellState.Star
  ).length;
  
  // If region is fully inside band, it must place all its stars there
  const size = state.size;
  if (band.type === 'rowBand') {
    if (regionFullyInsideRows(region, band.rows, size)) {
      return region.starsRequired;
    }
  } else {
    if (regionFullyInsideCols(region, band.cols, size)) {
      return region.starsRequired;
    }
  }
  
  // For partial regions, compute based on constraints
  const remainingStars = region.starsRequired - getStarCountInRegion(region, state);
  
  // Get candidate cells in band
  const candidatesInBand = cellsInBand.filter(
    cellId => state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1
  );
  
  // If all remaining candidates are in the band, region must place all remaining stars there
  const allCandidates = region.cells.filter(
    cellId => state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1
  );
  
  if (candidatesInBand.length === allCandidates.length && remainingStars > 0) {
    // All remaining candidates are in band, so region must place all remaining stars there
    return starsInBand + remainingStars;
  }
  
  // Otherwise, return current stars in band (minimum known)
  // This is conservative - we know at least this many stars are in the band
  return starsInBand;
}

/**
 * Helper to get star count in region
 */
function getStarCountInRegion(region: Region, state: BoardState): number {
  return region.cells.filter(cellId => state.cellStates[cellId] === 1).length;
}

/**
 * Check if all partial regions have known band quotas
 * A quota is "known" if we can compute it deterministically from constraints
 */
export function allHaveKnownBandQuota(
  regions: Region[],
  band: RowBand | ColumnBand,
  state: BoardState
): boolean {
  // Check if we can compute quotas for all regions
  for (const region of regions) {
    const quota = getRegionBandQuota(region, band, state);
    const cellsInBand = getCellsOfRegionInBand(region, band, state);
    const candidatesInBand = cellsInBand.filter(
      cellId => state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1
    );
    
    // A quota is "known" if:
    // 1. Region is fully inside band (quota = starsRequired)
    // 2. All remaining candidates are in band (quota = starsInBand + remainingStars)
    // 3. Region has no remaining stars (quota = starsInBand)
    const remainingStars = region.starsRequired - getStarCountInRegion(region, state);
    const allCandidates = region.cells.filter(
      cellId => state.cellStates[cellId] === 0 || state.cellStates[cellId] === 1
    );
    
    const isKnown = 
      remainingStars === 0 || // No remaining stars, quota is just current stars
      candidatesInBand.length === allCandidates.length || // All candidates in band
      quota === region.starsRequired; // Fully inside band
    
    if (!isKnown) {
      return false;
    }
  }
  
  return true;
}


/**
 * Band (row/column band) helper functions
 */

import type { BoardState, RowBand, ColumnBand, Region, CellId } from '../model/types';
import { coordToCellId } from '../model/types';
import { getCandidatesInGroup } from './groupHelpers';
import { regionFullyInsideRows, regionFullyInsideCols } from './groupHelpers';

// Re-export for convenience
export { regionFullyInsideRows, regionFullyInsideCols };

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
    // Only return unknown cells (CellState.Unknown = 0)
    return rowSet.has(row) && state.cellStates[cellId] === 0;
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
    // Only return unknown cells (CellState.Unknown = 0)
    return colSet.has(col) && state.cellStates[cellId] === 0;
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
  } else {
    const colSet = new Set(band.cols);
    return region.cells.filter(cellId => {
      const col = cellId % size;
      return colSet.has(col);
    });
  }
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
  } else {
    return getCandidatesInRegionAndCols(region, band.cols, state);
  }
}

/**
 * Compute what A1 would deduce for a region's quota in a band
 * This checks if the region is the only remaining region with candidates in the band
 */
function computeA1QuotaForRegion(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState
): number | null {
  const size = state.size;
  let rows: number[];
  let cols: number[];
  
  if (band.type === 'rowBand') {
    rows = band.rows;
    cols = undefined as any; // Not used for row bands
  } else {
    cols = band.cols;
    rows = undefined as any; // Not used for column bands
  }
  
  // Get all regions intersecting the band
  const allRegions = band.type === 'rowBand'
    ? getRegionsIntersectingRows(state, rows)
    : getRegionsIntersectingCols(state, cols);
  
  // Partition into full inside and partial
  const fullInside = allRegions.filter(r => {
    if (band.type === 'rowBand') {
      return regionFullyInsideRows(r, rows, size);
    } else {
      return regionFullyInsideCols(r, cols, size);
    }
  });
  
  const partial = allRegions.filter(r => {
    if (band.type === 'rowBand') {
      return !regionFullyInsideRows(r, rows, size);
    } else {
      return !regionFullyInsideCols(r, cols, size);
    }
  });
  
  // Compute stars forced by full inside regions
  const starsForcedFullInside = fullInside.reduce(
    (sum, r) => sum + r.starsRequired,
    0
  );
  
  // Compute stars forced by other partial regions
  // Try to get their quotas, but use conservative estimate (current stars) if quota is 0
  const otherPartial = partial.filter(r => r.id !== region.id);
  const starsForcedOtherPartial = otherPartial.reduce((sum, r) => {
    // Try to get quota (may use A1 logic recursively, but avoid infinite recursion)
    // For now, use a simple heuristic: if region has candidates only in this band, use remaining stars
    const allCells = getAllCellsOfRegionInBand(r, band, state);
    const stars = allCells.filter(c => state.cellStates[c] === 1).length;
    
    // Check if all remaining candidates are in this band
    const remainingStars = r.starsRequired - getStarCountInRegion(r, state);
    const candidatesInBand = allCells.filter(c => state.cellStates[c] === 0).length;
    const allCandidates = r.cells.filter(c => state.cellStates[c] === 0).length;
    
    if (candidatesInBand === allCandidates && remainingStars > 0) {
      // All candidates in band, so must place all remaining stars here
      return sum + stars + remainingStars;
    }
    
    // Otherwise, use conservative estimate (current stars)
    return sum + stars;
  }, 0);
  
  // Compute remaining stars needed in band
  const starsNeeded = band.type === 'rowBand'
    ? rows.length * state.starsPerLine
    : cols.length * state.starsPerLine;
  const currentStars = band.cells.filter(c => state.cellStates[c] === 1).length;
  const remainingStarsNeeded = starsNeeded - currentStars;
  
  const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
  const starsRemainingInR = remainingStarsNeeded - starsForcedInR;
  
  // Get candidates in target region within band
  const candInTargetBand = band.type === 'rowBand'
    ? getCandidatesInRegionAndRows(region, rows, state)
    : getCandidatesInRegionAndCols(region, cols, state);
  
  // Check if this region is the only one with candidates
  const otherPartialHaveCandidates = otherPartial.some(r => {
    const cand = band.type === 'rowBand'
      ? getCandidatesInRegionAndRows(r, rows, state)
      : getCandidatesInRegionAndCols(r, cols, state);
    return cand.length > 0;
  });
  
  // If other partial regions have no candidates, this region must take all remaining stars
  if (!otherPartialHaveCandidates && starsRemainingInR >= 0 && starsRemainingInR <= candInTargetBand.length) {
    return starsRemainingInR;
  }
  
  return null; // Can't deduce quota using A1 logic
}

/**
 * Get region's band quota (number of stars region must place in band)
 * This computes the minimum required stars based on current constraints
 * Now also checks if A1 logic would deduce a quota
 * 
 * @param recursionDepth - Internal parameter to prevent infinite recursion (max 2)
 */
export function getRegionBandQuota(
  region: Region,
  band: RowBand | ColumnBand,
  state: BoardState,
  recursionDepth: number = 0
): number {
  // Prevent infinite recursion - only allow one level of recursion
  // But at depth 1, we can still try A1 logic (which doesn't recurse into getRegionBandQuota)
  if (recursionDepth > 1) {
    // At max depth, return conservative estimate (current stars in band)
    const allCellsInBand = getAllCellsOfRegionInBand(region, band, state);
    return allCellsInBand.filter(cellId => state.cellStates[cellId] === 1).length;
  }
  // Get ALL cells in band (including stars/crosses) to count stars correctly
  const allCellsInBand = getAllCellsOfRegionInBand(region, band, state);
  const starsInBand = allCellsInBand.filter(
    cellId => state.cellStates[cellId] === 1 // CellState.Star
  ).length;
  
  // Get candidate cells in band (only unknown cells) for quota calculation
  const cellsInBand = getCellsOfRegionInBand(region, band, state);
  
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
  
  // Get candidate cells in band (only unknown cells)
  const candidatesInBand = cellsInBand.filter(
    cellId => state.cellStates[cellId] === 0 // CellState.Unknown
  );
  
  // If all remaining candidates are in the band, region must place all remaining stars there
  const allCandidates = region.cells.filter(
    cellId => state.cellStates[cellId] === 0 // CellState.Unknown
  );
  
  if (candidatesInBand.length === allCandidates.length && remainingStars > 0) {
    // All remaining candidates are in band, so region must place all remaining stars there
    return starsInBand + remainingStars;
  }
  
  // Try A3 logic: if we know quota in other bands, we can deduce quota in this band
  // For row bands: check other row bands that intersect this region but don't overlap with this band
  // Only try A3 at recursionDepth=0 to avoid circular dependencies
  if (band.type === 'rowBand' && recursionDepth === 0) {
    const allRowBands = enumerateRowBands(state);
    const intersectingBands = allRowBands.filter(b => {
      const regionCellsInBand = getAllCellsOfRegionInBand(region, b, state);
      return regionCellsInBand.length > 0;
    });
    
    // DEBUG: Log A3 attempt
    const debugA3 = typeof process !== 'undefined' && process.env?.DEBUG_A3 === 'true';
    if (debugA3) {
      console.log(`[A3 DEBUG] Region ${region.id}, Band rows ${band.rows.join(',')}, recursionDepth=${recursionDepth}`);
      console.log(`[A3 DEBUG] Intersecting bands: ${intersectingBands.length}`);
    }
    
    if (intersectingBands.length >= 2) {
      const thisRows = new Set(band.rows);
      
      // Find the band that contains all remaining region cells (not in this band)
      // This is the "complement" band for A3 logic
      const thisBandCells = new Set(getAllCellsOfRegionInBand(region, band, state));
      const allRegionCells = new Set(region.cells);
      const remainingCells = Array.from(allRegionCells).filter(c => !thisBandCells.has(c));
      
      // Find bands that contain all remaining cells
      const complementBands = intersectingBands.filter(b => {
        // Check if this is a different, non-overlapping band
        const otherRows = new Set(b.rows);
        const hasOverlap = Array.from(thisRows).some(r => otherRows.has(r));
        if (hasOverlap) return false;
        
        // Check if this band contains all remaining cells
        const bandCells = new Set(getAllCellsOfRegionInBand(region, b, state));
        const containsAllRemaining = remainingCells.every(c => bandCells.has(c));
        return containsAllRemaining;
      });
      
      // Sort by size (prefer smaller bands that still contain all remaining cells)
      complementBands.sort((a, b) => {
        const aSize = getAllCellsOfRegionInBand(region, a, state).length;
        const bSize = getAllCellsOfRegionInBand(region, b, state).length;
        return aSize - bSize;
      });
      
      if (debugA3) {
        console.log(`[A3 DEBUG] Remaining cells: ${remainingCells.length}`);
        console.log(`[A3 DEBUG] Complement bands (contain all remaining cells): ${complementBands.length}`);
        complementBands.forEach(b => {
          const candidates = getAllCellsOfRegionInBand(region, b, state)
            .filter(c => state.cellStates[c] === 0).length;
          console.log(`[A3 DEBUG]   Band rows ${b.rows.join(',')}: ${candidates} candidates`);
        });
      }
      
      // Try to compute quota for the complement band and see if we can deduce this band's quota
      // A3 logic: if we know quota in the complement band, we can deduce quota in this band
      // Use the smallest complement band (most specific)
      if (complementBands.length > 0) {
        const otherBand = complementBands[0];
        if (debugA3) {
          console.log(`[A3 DEBUG] Checking other band: rows ${otherBand.rows.join(',')}`);
        }
        
        // Use recursion depth + 1 to prevent infinite recursion
        const quota = getRegionBandQuota(region, otherBand, state, recursionDepth + 1);
        const otherBandStars = getAllCellsOfRegionInBand(region, otherBand, state)
          .filter(c => state.cellStates[c] === 1).length;
        
        // A quota is "known" if it's greater than current stars (meaning we deduced it)
        // or if all candidates are in that band (deterministic)
        const otherBandCandidates = getAllCellsOfRegionInBand(region, otherBand, state)
          .filter(c => state.cellStates[c] === 0).length;
        const allRegionCandidates = region.cells.filter(c => state.cellStates[c] === 0).length;
        const remainingInRegion = region.starsRequired - getStarCountInRegion(region, state);
        
        // A quota is "known" if:
        // 1. It's greater than or equal to current stars AND we deduced it (not just conservative default)
        // 2. All remaining candidates are in that band (deterministic)
        // 3. Region is fully inside that band (deterministic)
        const isFullyInside = band.type === 'rowBand'
          ? regionFullyInsideRows(region, otherBand.rows, size)
          : regionFullyInsideCols(region, otherBand.cols, size);
        
        // Check if quota was deduced (not just conservative default of current stars)
        // A quota is "known" if:
        // 1. It's greater than current stars (we deduced it) - this is the main case
        // 2. All remaining candidates are in that band (deterministic)
        // 3. Region is fully inside that band (deterministic)
        // Note: quota > otherBandStars is the key indicator that we deduced it (e.g., via A1)
        const quotaIsDeduced = quota > otherBandStars || 
                               (quota === otherBandStars && otherBandCandidates === allRegionCandidates && remainingInRegion > 0) ||
                               isFullyInside;
        
        if (debugA3) {
          console.log(`[A3 DEBUG] Other band quota: ${quota}, stars: ${otherBandStars}, candidates: ${otherBandCandidates}/${allRegionCandidates}`);
          console.log(`[A3 DEBUG] Remaining in region: ${remainingInRegion}, isFullyInside: ${isFullyInside}`);
          console.log(`[A3 DEBUG] quotaIsDeduced: ${quotaIsDeduced} (quota > stars: ${quota > otherBandStars}, allCandidatesInBand: ${otherBandCandidates === allRegionCandidates && remainingInRegion > 0})`);
        }
        
        if (quotaIsDeduced) {
          // A3 logic: region.starsRequired = quota in this band + quota in other band
          // Therefore: quota in this band = region.starsRequired - quota in other band
          const regionQuota = region.starsRequired;
          const targetBandQuota = regionQuota - quota;
          
          if (debugA3) {
            console.log(`[A3 DEBUG] A3 calculation: regionQuota=${regionQuota}, otherBandQuota=${quota}, targetBandQuota=${targetBandQuota}`);
            console.log(`[A3 DEBUG] Current stars in target band: ${starsInBand}`);
            console.log(`[A3 DEBUG] Condition check: targetBandQuota >= starsInBand (${targetBandQuota} >= ${starsInBand}) && targetBandQuota >= 0 (${targetBandQuota} >= 0)`);
          }
          
          // The quota must be at least the current stars in this band
          if (targetBandQuota >= starsInBand && targetBandQuota >= 0) {
            if (debugA3) {
              console.log(`[A3 DEBUG] A3 SUCCESS: Returning quota ${targetBandQuota} for band rows ${band.rows.join(',')}`);
            }
            return targetBandQuota;
          } else {
            if (debugA3) {
              console.log(`[A3 DEBUG] A3 FAILED: Condition not met (targetBandQuota=${targetBandQuota}, starsInBand=${starsInBand})`);
            }
          }
        } else {
          if (debugA3) {
            console.log(`[A3 DEBUG] A3 FAILED: quotaIsDeduced is false`);
          }
        }
      } else {
        if (debugA3) {
          console.log(`[A3 DEBUG] A3 SKIPPED: complementBands.length=${complementBands.length} (need > 0)`);
        }
      }
    } else {
      if (debugA3) {
        console.log(`[A3 DEBUG] A3 SKIPPED: intersectingBands.length=${intersectingBands.length} (need >= 2)`);
      }
    }
  }
  
  // Try to compute quota using A1 logic
  // This computes what A1 would deduce even if A1 doesn't fire (because it can't make cell-level deductions)
  // Only try A1 at recursion depth 0 or 1 (not deeper, to avoid infinite recursion)
  if (recursionDepth <= 1) {
    const a1Quota = computeA1QuotaForRegion(region, band, state);
    if (a1Quota !== null && a1Quota >= starsInBand) {
      return a1Quota;
    }
  }
  
  // Also try a more general A1 calculation: if this region is the only one with candidates
  // after accounting for other regions' quotas, we can deduce its quota
  let rows: number[];
  let cols: number[];
  
  if (band.type === 'rowBand') {
    rows = band.rows;
  } else {
    cols = band.cols;
  }
  
  // Get all regions intersecting the band
  const allRegions = band.type === 'rowBand'
    ? getRegionsIntersectingRows(state, rows)
    : getRegionsIntersectingCols(state, cols);
  
  // Partition into full inside and partial
  const fullInside = allRegions.filter(r => {
    if (band.type === 'rowBand') {
      return regionFullyInsideRows(r, rows, size);
    } else {
      return regionFullyInsideCols(r, cols, size);
    }
  });
  
  const partial = allRegions.filter(r => {
    if (band.type === 'rowBand') {
      return !regionFullyInsideRows(r, rows, size);
    } else {
      return !regionFullyInsideCols(r, cols, size);
    }
  });
  
  // Compute stars forced by full inside regions
  const starsForcedFullInside = fullInside.reduce(
    (sum, r) => sum + r.starsRequired,
    0
  );
  
  // Compute stars forced by other partial regions (using conservative estimates)
  const otherPartial = partial.filter(r => r.id !== region.id);
  const starsForcedOtherPartial = otherPartial.reduce((sum, r) => {
    // Use recursion depth + 1 to prevent infinite recursion
    const quota = getRegionBandQuota(r, band, state, recursionDepth + 1);
    if (quota > 0) {
      return sum + quota;
    }
    // Conservative: current stars in band
    const allCells = getAllCellsOfRegionInBand(r, band, state);
    const stars = allCells.filter(c => state.cellStates[c] === 1).length;
    const remainingStars = r.starsRequired - getStarCountInRegion(r, state);
    const candidatesInBand = allCells.filter(c => state.cellStates[c] === 0).length;
    const allCandidates = r.cells.filter(c => state.cellStates[c] === 0).length;
    
    if (candidatesInBand === allCandidates && remainingStars > 0) {
      return sum + stars + remainingStars;
    }
    return sum + stars;
  }, 0);
  
  // Compute remaining stars needed
  const starsNeeded = band.type === 'rowBand'
    ? rows.length * state.starsPerLine
    : cols.length * state.starsPerLine;
  const currentStars = band.cells.filter(c => state.cellStates[c] === 1).length;
  const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
  const starsRemainingInR = starsNeeded - starsForcedInR;
  
  // Get candidates in target region within band
  const candInTargetBand = band.type === 'rowBand'
    ? getCandidatesInRegionAndRows(region, rows, state)
    : getCandidatesInRegionAndCols(region, cols, state);
  
  // If remaining stars is positive and reasonable, use it as quota
  // This represents what A1 would deduce for this region
  if (starsRemainingInR > 0 && starsRemainingInR <= candInTargetBand.length && starsRemainingInR >= starsInBand) {
    return starsRemainingInR;
  }
  
  // Otherwise, return current stars in band (minimum known)
  // This is conservative - we know at least this many stars are in the band
  return starsInBand;
}

/**
 * Helper to get star count in region
 */
export function getStarCountInRegion(region: Region, state: BoardState): number {
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
      cellId => state.cellStates[cellId] === 0 // CellState.Unknown
    );
    
    // A quota is "known" if:
    // 1. Region is fully inside band (quota = starsRequired)
    // 2. All remaining candidates are in band (quota = starsInBand + remainingStars)
    // 3. Region has no remaining stars (quota = starsInBand)
    const remainingStars = region.starsRequired - getStarCountInRegion(region, state);
    const allCandidates = region.cells.filter(
      cellId => state.cellStates[cellId] === 0 // CellState.Unknown
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


import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction } from '../../types/deductions';
import { regionCells, rowCells, colCells, emptyCells, countStars, neighbors8, getCell, idToLetter, formatRow, formatCol } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `forced-placement-${hintCounter}`;
}

/**
 * Forced Placement technique:
 * 
 * If a region needs stars, and all possible valid placements for those stars
 * include a specific cell, then that cell must be a star.
 * 
 * This is the inverse of adjacent-exclusion: instead of "all placements are adjacent
 * to X, so X must be a cross", this is "all placements include X, so X must be a star".
 */
export function findForcedPlacementHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  
  // Maximum number of placement sets to generate before giving up (prevents UI freeze)
  const MAX_PLACEMENT_SETS = 1000;
  
  /**
   * Find all valid sets of N non-adjacent stars that can be placed in the given cells
   * Returns an array of placement sets, where each set is an array of N non-adjacent cells
   * Returns empty array if too many combinations would be generated (prevents UI freeze)
   * 
   * @param plannedStars - Stars already planned to be placed (for quota checking)
   */
  function findAllValidPlacementSets(
    candidateCells: Coords[],
    numStars: number,
    maxResults: number = MAX_PLACEMENT_SETS,
    plannedStars: Coords[] = []
  ): Coords[][] {
    if (numStars === 0) return [[]];
    if (candidateCells.length < numStars) return [];
    
    // Early exit: if the number of combinations would be too large, skip
    if (candidateCells.length > 20 && numStars > 1) {
      return [];
    }
    
    if (numStars === 1) {
      // For 1 star, return all cells that can contain a star
      return candidateCells
        .filter(cell => {
          // Check adjacency to existing stars
          const nbs = neighbors8(cell, size);
          if (nbs.some(nb => getCell(state, nb) === 'star')) {
            return false;
          }
          // Check adjacency to planned stars
          for (const planned of plannedStars) {
            const rowDiff = Math.abs(cell.row - planned.row);
            const colDiff = Math.abs(cell.col - planned.col);
            if (rowDiff <= 1 && colDiff <= 1) {
              return false;
            }
          }
          // Check row/column/region quotas (accounting for planned stars)
          const row = rowCells(state, cell.row);
          const col = colCells(state, cell.col);
          const cellRegionId = state.def.regions[cell.row][cell.col];
          const region = regionCells(state, cellRegionId);
          const plannedInRow = plannedStars.filter(p => p.row === cell.row).length;
          const plannedInCol = plannedStars.filter(p => p.col === cell.col).length;
          const plannedInRegion = plannedStars.filter(p => state.def.regions[p.row][p.col] === cellRegionId).length;
          if (countStars(state, row) + plannedInRow >= starsPerUnit) return false;
          if (countStars(state, col) + plannedInCol >= starsPerUnit) return false;
          if (countStars(state, region) + plannedInRegion >= starsPerUnit) return false;
          return true;
        })
        .map(cell => [cell]);
    }

    const results: Coords[][] = [];

    // Try each cell as the first star
    for (let i = 0; i < candidateCells.length; i++) {
      if (results.length >= maxResults) {
        // Hit limit - return empty to avoid incorrect deductions from partial results
        return [];
      }
      
      const firstCell = candidateCells[i];
      
      // Check if this cell can contain a star
      const nbs = neighbors8(firstCell, size);
      if (nbs.some(nb => getCell(state, nb) === 'star')) {
        continue; // Can't place star here (adjacent to existing star)
      }
      
      // Check adjacency to planned stars
      let adjacentToPlanned = false;
      for (const planned of plannedStars) {
        const rowDiff = Math.abs(firstCell.row - planned.row);
        const colDiff = Math.abs(firstCell.col - planned.col);
        if (rowDiff <= 1 && colDiff <= 1) {
          adjacentToPlanned = true;
          break;
        }
      }
      if (adjacentToPlanned) continue;
      
      // Check row/column/region quotas (accounting for planned stars)
      const row = rowCells(state, firstCell.row);
      const col = colCells(state, firstCell.col);
      const cellRegionId = state.def.regions[firstCell.row][firstCell.col];
      const region = regionCells(state, cellRegionId);
      const plannedInRow = plannedStars.filter(p => p.row === firstCell.row).length;
      const plannedInCol = plannedStars.filter(p => p.col === firstCell.col).length;
      const plannedInRegion = plannedStars.filter(p => state.def.regions[p.row][p.col] === cellRegionId).length;
      if (countStars(state, row) + plannedInRow >= starsPerUnit) continue;
      if (countStars(state, col) + plannedInCol >= starsPerUnit) continue;
      if (countStars(state, region) + plannedInRegion >= starsPerUnit) continue;

      // Find remaining cells that are not adjacent to firstCell
      const remainingCells = candidateCells.slice(i + 1).filter(cell => {
        const rowDiff = Math.abs(cell.row - firstCell.row);
        const colDiff = Math.abs(cell.col - firstCell.col);
        return !(rowDiff <= 1 && colDiff <= 1); // Not adjacent to firstCell
      });

      // Recursively find placements for remaining stars (including firstCell in planned stars)
      const remainingPlacements = findAllValidPlacementSets(
        remainingCells,
        numStars - 1,
        maxResults - results.length,
        [...plannedStars, firstCell]
      );

      // Combine firstCell with each remaining placement
      for (const remaining of remainingPlacements) {
        results.push([firstCell, ...remaining]);
        if (results.length >= maxResults) {
          // Hit limit - return empty to avoid incorrect deductions from partial results
          return [];
        }
      }
    }

    return results;
  }

  // Check each region
  for (let regionId = 0; regionId <= 9; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    
    const empties = emptyCells(state, region);
    if (empties.length === 0) continue;
    
    const starCount = countStars(state, region);
    const remaining = starsPerUnit - starCount;
    
    if (remaining <= 0) continue;
    
    // Skip if region has too many empty cells (would be too expensive)
    if (empties.length > 20) {
      continue;
    }
    
    // Filter out cells that can't contain stars (adjacent to existing stars or quota violations)
    const candidateCells = empties.filter(cell => {
      // Check adjacency to existing stars
      const nbs = neighbors8(cell, size);
      if (nbs.some(nb => getCell(state, nb) === 'star')) {
        return false;
      }
      // Check row/column/region quotas
      const row = rowCells(state, cell.row);
      const col = colCells(state, cell.col);
      const cellRegionId = state.def.regions[cell.row][cell.col];
      const region = regionCells(state, cellRegionId);
      if (countStars(state, row) >= starsPerUnit) return false;
      if (countStars(state, col) >= starsPerUnit) return false;
      if (countStars(state, region) >= starsPerUnit) return false;
      return true;
    });
    
    if (candidateCells.length < remaining) continue;
    
    // Find all valid placement sets for the required stars
    const allPlacementSets = findAllValidPlacementSets(
      candidateCells,
      remaining
    );

    // Debugging support: surface candidate counts for tests
    // console.log({ regionId, candidateCount: candidateCells.length, remaining, sets: allPlacementSets.length });
    
    if (allPlacementSets.length === 0) continue;
    
    // Find the intersection: cells that appear in ALL placement sets
    // Count how many times each cell appears across all placement sets
    const cellCounts = new Map<string, { cell: Coords; count: number }>();
    
    for (const placementSet of allPlacementSets) {
      for (const cell of placementSet) {
        const key = `${cell.row},${cell.col}`;
        const existing = cellCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          cellCounts.set(key, { cell, count: 1 });
        }
      }
    }
    
    // Find cells that appear in ALL placement sets
    const totalPlacements = allPlacementSets.length;
    const forcedCells: Coords[] = [];
    
    for (const [key, { cell, count }] of cellCounts.entries()) {
      if (count === totalPlacements) {
        // This cell appears in every valid placement set, so it must be a star
        // But only if it's not already a star
        if (getCell(state, cell) === 'empty') {
          forcedCells.push(cell);
        }
      }
    }
    
    if (forcedCells.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'forced-placement',
        resultCells: forcedCells,
        explanation: `Region ${idToLetter(regionId)} needs ${remaining} star(s). All possible valid placements for these stars include ${forcedCells.length === 1 ? 'this cell' : 'these cells'}, so ${forcedCells.length === 1 ? 'it' : 'they'} must be ${forcedCells.length === 1 ? 'a star' : 'stars'}.`,
        highlights: {
          regions: [regionId],
          cells: forcedCells,
        },
      };
    }
  }
  
  return null;
}

/**
 * Enumerate all valid star placements for a region.
 *
 * Returns null if the region needs no more stars or if enumeration was
 * skipped for cost reasons (too many empties, too many partial placements).
 *
 * The shape mirrors findForcedPlacementHint's internal enumeration so the
 * two stay in sync — but it is exposed so that findForcedPlacementResult
 * can also project placements onto rows and columns.
 */
function enumerateRegionPlacements(
  state: PuzzleState,
  regionId: number,
): { placementSets: Coords[][]; candidateCells: Coords[]; remaining: number } | null {
  const { size, starsPerUnit } = state.def;
  const MAX_PLACEMENT_SETS = 1000;

  const region = regionCells(state, regionId);
  if (!region.length) return null;

  const empties = emptyCells(state, region);
  if (empties.length === 0) return null;

  const starCount = countStars(state, region);
  const remaining = starsPerUnit - starCount;
  if (remaining <= 0) return null;

  // Skip if region has too many empty cells (would be too expensive)
  if (empties.length > 20) return null;

  // Filter to candidate cells (empties that could feasibly hold a star)
  const candidateCells = empties.filter((cell) => {
    const nbs = neighbors8(cell, size);
    if (nbs.some((nb) => getCell(state, nb) === 'star')) return false;
    const cellRegionId = state.def.regions[cell.row][cell.col];
    if (countStars(state, rowCells(state, cell.row)) >= starsPerUnit) return false;
    if (countStars(state, colCells(state, cell.col)) >= starsPerUnit) return false;
    if (countStars(state, regionCells(state, cellRegionId)) >= starsPerUnit) return false;
    return true;
  });

  if (candidateCells.length < remaining) return null;

  // Inline placement enumeration (state captured via closure on `state`).
  function findAllValidPlacementSets(
    cells: Coords[],
    numStars: number,
    maxResults: number,
    plannedStars: Coords[],
  ): Coords[][] {
    if (numStars === 0) return [[]];
    if (cells.length < numStars) return [];

    if (cells.length > 20 && numStars > 1) return [];

    if (numStars === 1) {
      return cells
        .filter((cell) => {
          const nbs = neighbors8(cell, size);
          if (nbs.some((nb) => getCell(state, nb) === 'star')) return false;
          for (const planned of plannedStars) {
            if (Math.abs(cell.row - planned.row) <= 1 && Math.abs(cell.col - planned.col) <= 1) {
              return false;
            }
          }
          const cellRegionId = state.def.regions[cell.row][cell.col];
          const plannedInRow = plannedStars.filter((p) => p.row === cell.row).length;
          const plannedInCol = plannedStars.filter((p) => p.col === cell.col).length;
          const plannedInRegion = plannedStars.filter(
            (p) => state.def.regions[p.row][p.col] === cellRegionId,
          ).length;
          if (countStars(state, rowCells(state, cell.row)) + plannedInRow >= starsPerUnit) return false;
          if (countStars(state, colCells(state, cell.col)) + plannedInCol >= starsPerUnit) return false;
          if (countStars(state, regionCells(state, cellRegionId)) + plannedInRegion >= starsPerUnit) return false;
          return true;
        })
        .map((cell) => [cell]);
    }

    const results: Coords[][] = [];
    for (let i = 0; i < cells.length; i++) {
      if (results.length >= maxResults) return [];
      const firstCell = cells[i];

      const nbs = neighbors8(firstCell, size);
      if (nbs.some((nb) => getCell(state, nb) === 'star')) continue;

      let adjacentToPlanned = false;
      for (const planned of plannedStars) {
        if (Math.abs(firstCell.row - planned.row) <= 1 && Math.abs(firstCell.col - planned.col) <= 1) {
          adjacentToPlanned = true;
          break;
        }
      }
      if (adjacentToPlanned) continue;

      const cellRegionId = state.def.regions[firstCell.row][firstCell.col];
      const plannedInRow = plannedStars.filter((p) => p.row === firstCell.row).length;
      const plannedInCol = plannedStars.filter((p) => p.col === firstCell.col).length;
      const plannedInRegion = plannedStars.filter(
        (p) => state.def.regions[p.row][p.col] === cellRegionId,
      ).length;
      if (countStars(state, rowCells(state, firstCell.row)) + plannedInRow >= starsPerUnit) continue;
      if (countStars(state, colCells(state, firstCell.col)) + plannedInCol >= starsPerUnit) continue;
      if (countStars(state, regionCells(state, cellRegionId)) + plannedInRegion >= starsPerUnit) continue;

      const remainingCells = cells.slice(i + 1).filter((cell) => {
        return !(
          Math.abs(cell.row - firstCell.row) <= 1 && Math.abs(cell.col - firstCell.col) <= 1
        );
      });

      const sub = findAllValidPlacementSets(remainingCells, numStars - 1, maxResults - results.length, [
        ...plannedStars,
        firstCell,
      ]);

      for (const r of sub) {
        results.push([firstCell, ...r]);
        if (results.length >= maxResults) return [];
      }
    }
    return results;
  }

  const placementSets = findAllValidPlacementSets(candidateCells, remaining, MAX_PLACEMENT_SETS, []);
  if (placementSets.length === 0) return null;

  return { placementSets, candidateCells, remaining };
}

/**
 * Project enumerated region placements onto rows and columns.
 *
 * For each row r (or column c), compute the minimum number of stars the
 * region places in that line across all valid placements. If the minimum is
 * positive, emit an AreaDeduction:
 *
 *   row r  must have ≥minStars stars among (region ∩ row r) empties.
 *
 * These per-line minStars facts feed the main solver's line-saturation
 * resolver, which combines disjoint subsets to force crosses elsewhere in the
 * line — the missing piece for cases where no single cell appears in every
 * region placement (which would already have triggered the hint path).
 */
function buildProjectionDeductions(
  state: PuzzleState,
  regionId: number,
  placementSets: Coords[][],
  candidateCells: Coords[],
): AreaDeduction[] {
  if (placementSets.length === 0) return [];
  const out: AreaDeduction[] = [];

  // Group candidate cells by row and by column for explanation/highlight.
  const rowsTouched = new Set<number>();
  const colsTouched = new Set<number>();
  for (const c of candidateCells) {
    rowsTouched.add(c.row);
    colsTouched.add(c.col);
  }

  for (const row of rowsTouched) {
    // Min stars region places in this row across all placements
    let minInRow = Infinity;
    for (const placement of placementSets) {
      const count = placement.reduce((acc, p) => acc + (p.row === row ? 1 : 0), 0);
      if (count < minInRow) minInRow = count;
    }
    if (minInRow < 1) continue;

    const rowCands = candidateCells.filter((c) => c.row === row);
    // Skip degenerate cases: if every empty in the row is in rowCands, this
    // gives no new info (the row's own quota already implies that). The
    // saturation resolver also needs cands to be a proper subset of the
    // line's empties to derive anything useful.
    const rowEmptiesAll = emptyCells(state, rowCells(state, row));
    if (rowCands.length === rowEmptiesAll.length) continue;
    if (rowCands.length === 0) continue;

    out.push({
      kind: 'area',
      technique: 'forced-placement',
      areaType: 'row',
      areaId: row,
      candidateCells: rowCands,
      minStars: minInRow,
      explanation: `Every valid placement of region ${idToLetter(regionId)}'s stars puts at least ${minInRow} star(s) in ${formatRow(row)}, all within ${rowCands.length} candidate cell(s).`,
    });
  }

  for (const col of colsTouched) {
    let minInCol = Infinity;
    for (const placement of placementSets) {
      const count = placement.reduce((acc, p) => acc + (p.col === col ? 1 : 0), 0);
      if (count < minInCol) minInCol = count;
    }
    if (minInCol < 1) continue;

    const colCands = candidateCells.filter((c) => c.col === col);
    const colEmptiesAll = emptyCells(state, colCells(state, col));
    if (colCands.length === colEmptiesAll.length) continue;
    if (colCands.length === 0) continue;

    out.push({
      kind: 'area',
      technique: 'forced-placement',
      areaType: 'column',
      areaId: col,
      candidateCells: colCands,
      minStars: minInCol,
      explanation: `Every valid placement of region ${idToLetter(regionId)}'s stars puts at least ${minInCol} star(s) in ${formatCol(col)}, all within ${colCands.length} candidate cell(s).`,
    });
  }

  return out;
}

/**
 * Find result with deductions support
 */
export function findForcedPlacementResult(state: PuzzleState): TechniqueResult {
  const deductions: Deduction[] = [];

  // Emit deductions for regions with constrained candidate cells.
  // Even if not all placements include the same cell, we can narrow down
  // candidates and project onto rows/columns.
  for (let regionId = 0; regionId <= 9; regionId += 1) {
    const data = enumerateRegionPlacements(state, regionId);
    if (!data) continue;

    const { placementSets, candidateCells, remaining } = data;

    // Region-level candidate restriction (existing behavior).
    const region = regionCells(state, regionId);
    const empties = emptyCells(state, region);
    if (candidateCells.length < empties.length && candidateCells.length >= remaining) {
      deductions.push({
        kind: 'area',
        technique: 'forced-placement',
        areaType: 'region',
        areaId: regionId,
        candidateCells,
        minStars: remaining,
        explanation: `Region ${idToLetter(regionId)} needs ${remaining} star(s), and only ${candidateCells.length} candidate cell(s) remain after filtering invalid placements.`,
      });
    }

    // New: per-line projections.
    deductions.push(...buildProjectionDeductions(state, regionId, placementSets, candidateCells));
  }

  // Try to find a clear hint first
  const hint = findForcedPlacementHint(state);
  if (hint) {
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

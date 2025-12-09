import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';
import { regionCells, rowCells, colCells, emptyCells, countStars, neighbors8, getCell, formatRow, formatCol, formatRegion, formatRegions } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `shared-row-column-${hintCounter}`;
}

/**
 * Shared Row/Column technique:
 * 
 * For each row/column, check if any areas have placements where one star is confined
 * to that specific row/column:
 * 
 * 1. If there's already a star in that row/column:
 *    - All other cells (except the area where we found the placement) shall be x'ed
 * 
 * 2. If there aren't any stars yet:
 *    - If there is any other area with the same type of placement (one star confined
 *      to that specific row/column), then all other cells in that row/column, except
 *      in those two areas, should be x'ed
 */
export function findSharedRowColumnHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  
  // Get all regions that need stars
  const allRegionIds = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      allRegionIds.add(state.def.regions[r][c]);
    }
  }
  
  // Helper: Find all valid placement sets for N stars in given cells (non-adjacent)
  function findAllValidPlacementSets(
    candidateCells: Coords[],
    numStars: number,
    maxResults: number = 100
  ): Coords[][] {
    if (numStars === 0) return [[]];
    if (candidateCells.length < numStars) return [];
    
    // Early exit for expensive computations
    if (candidateCells.length > 20 && numStars > 1) {
      return [];
    }
    
    if (numStars === 1) {
      return candidateCells
        .filter(cell => {
          const nbs = neighbors8(cell, size);
          return !nbs.some(nb => getCell(state, nb) === 'star');
        })
        .map(cell => [cell]);
    }

    const results: Coords[][] = [];

    for (let i = 0; i < candidateCells.length; i++) {
      if (results.length >= maxResults) {
        return [];
      }
      
      const firstCell = candidateCells[i];
      
      // Check if this cell can contain a star
      const nbs = neighbors8(firstCell, size);
      if (nbs.some(nb => getCell(state, nb) === 'star')) {
        continue;
      }

      // Find remaining cells that are not adjacent to firstCell
      const remainingCells = candidateCells.slice(i + 1).filter(cell => {
        const rowDiff = Math.abs(cell.row - firstCell.row);
        const colDiff = Math.abs(cell.col - firstCell.col);
        return !(rowDiff <= 1 && colDiff <= 1);
      });

      // Recursively find placements for remaining stars
      const remainingPlacements = findAllValidPlacementSets(
        remainingCells,
        numStars - 1,
        maxResults - results.length
      );

      for (const remaining of remainingPlacements) {
        results.push([firstCell, ...remaining]);
        if (results.length >= maxResults) {
          return [];
        }
      }
    }

    return results;
  }

  // Helper: Check if one star is confined to a specific row/column
  // This means: in ALL valid ways to place the required stars, at least one star must be in the target row/column
  function isOneStarConfinedToRow(
    regionId: number,
    needsStars: number,
    targetRow: number
  ): boolean {
    const region = regionCells(state, regionId);
    const regionEmpties = emptyCells(state, region);
    
    if (regionEmpties.length === 0 || needsStars === 0) return false;
    
    // Find all valid placement sets
    const allPlacementSets = findAllValidPlacementSets(regionEmpties, needsStars);
    
    if (allPlacementSets.length === 0) return false;
    
    // Check if ALL placement sets have at least one star in the target row
    return allPlacementSets.every(placementSet => 
      placementSet.some(cell => cell.row === targetRow)
    );
  }

  function isOneStarConfinedToCol(
    regionId: number,
    needsStars: number,
    targetCol: number
  ): boolean {
    const region = regionCells(state, regionId);
    const regionEmpties = emptyCells(state, region);
    
    if (regionEmpties.length === 0 || needsStars === 0) return false;
    
    // Find all valid placement sets
    const allPlacementSets = findAllValidPlacementSets(regionEmpties, needsStars);
    
    if (allPlacementSets.length === 0) return false;
    
    // Check if ALL placement sets have at least one star in the target column
    return allPlacementSets.every(placementSet => 
      placementSet.some(cell => cell.col === targetCol)
    );
  }

  // Helper: Find regions that need stars
  function getRegionsNeedingStars() {
    const regions: Array<{ regionId: number; needsStars: number; possiblePlacements: Coords[] }> = [];
    
    for (const regionId of allRegionIds) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionEmpties = emptyCells(state, region);
      const needsStars = starsPerUnit - regionStars;
      
      if (needsStars > 0 && regionEmpties.length > 0) {
        // Find cells that can actually contain a star (not adjacent to existing stars)
        const possiblePlacements = regionEmpties.filter(cell => {
          const nbs = neighbors8(cell, size);
          return !nbs.some(nb => getCell(state, nb) === 'star');
        });
        
        if (possiblePlacements.length > 0) {
          regions.push({
            regionId,
            needsStars,
            possiblePlacements,
          });
        }
      }
    }
    
    return regions;
  }
  
  const regionsNeedingStars = getRegionsNeedingStars();
  
  // Check each row
  for (let row = 0; row < size; row += 1) {
    const rowCellsList = rowCells(state, row);
    const starsInRow = countStars(state, rowCellsList);
    
    // Find regions where one star is confined to this row
    const confinedRegions = regionsNeedingStars.filter(reg => {
      return isOneStarConfinedToRow(reg.regionId, reg.needsStars, row);
    });
    
    if (confinedRegions.length === 0) continue;
    
    let forcedCrosses: Coords[] = [];
    let explanation = '';
    let highlightRegions: number[] = [];
    let highlightCells: Coords[] = [];
    
    if (starsInRow > 0) {
      // Case 1: Row already has a star
      // X out all other cells in the row (except cells in regions with confined placements)
      const regionIds = new Set(confinedRegions.map(reg => reg.regionId));
      const crosses = rowCellsList.filter(cell => {
        const cellRegionId = state.def.regions[cell.row][cell.col];
        return !regionIds.has(cellRegionId) && 
               getCell(state, cell) === 'empty';
      });
      
      if (crosses.length > 0) {
        forcedCrosses = crosses;
        highlightRegions = confinedRegions.map(reg => reg.regionId);
        // Get actual placement cells for highlighting (cells in the row from confined regions)
        const placementCellsInRow = rowCellsList.filter((cell: Coords) => {
          const cellRegionId = state.def.regions[cell.row][cell.col];
          return highlightRegions.includes(cellRegionId) && 
                 getCell(state, cell) === 'empty';
        });
        highlightCells = [
          ...placementCellsInRow,
          ...crosses
        ];
        const regionNames = formatRegions(highlightRegions);
        if (highlightRegions.length === 1) {
          explanation = `${regionNames} needs a star, and one star must be placed in ${formatRow(row)}. Since this row already has a star, all other cells in this row (outside ${regionNames}) must be crosses.`;
        } else {
          explanation = `${regionNames} need stars, and each region must place one star in ${formatRow(row)}. Since this row already has a star, all other cells in this row (outside these regions) must be crosses.`;
        }
      }
    } else {
      // Case 2: Row doesn't have a star yet
      // If there are 2+ regions with confined placements, X out all other cells
      // (except cells in those regions)
      if (confinedRegions.length >= 2) {
        const regionIds = new Set(confinedRegions.map(reg => reg.regionId));
        const crosses = rowCellsList.filter(cell => {
          const cellRegionId = state.def.regions[cell.row][cell.col];
          return !regionIds.has(cellRegionId) && 
                 getCell(state, cell) === 'empty';
        });
        
        if (crosses.length > 0) {
          forcedCrosses = crosses;
          highlightRegions = confinedRegions.map(reg => reg.regionId);
          // Get actual placement cells for highlighting (cells in the row from confined regions)
          const placementCellsInRow = rowCellsList.filter((cell: Coords) => {
            const cellRegionId = state.def.regions[cell.row][cell.col];
            return highlightRegions.includes(cellRegionId) && 
                   getCell(state, cell) === 'empty';
          });
          highlightCells = [
            ...placementCellsInRow,
            ...crosses
          ];
          const regionNames = formatRegions(highlightRegions);
          explanation = `${regionNames} both need stars, and each region must place one star in ${formatRow(row)}. Therefore, this row will have at least 2 stars (one from each region), so all other cells in this row must be crosses.`;
        }
      }
    }
    
    if (forcedCrosses.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'shared-row-column',
        resultCells: forcedCrosses,
        explanation,
        highlights: {
          rows: [row],
          regions: highlightRegions,
          cells: highlightCells,
        },
      };
    }
  }
  
  // Check each column
  for (let col = 0; col < size; col += 1) {
    const colCellsList = colCells(state, col);
    const starsInCol = countStars(state, colCellsList);
    
    // Find regions where one star is confined to this column
    const confinedRegions = regionsNeedingStars.filter(reg => {
      return isOneStarConfinedToCol(reg.regionId, reg.needsStars, col);
    });
    
    if (confinedRegions.length === 0) continue;
    
    let forcedCrosses: Coords[] = [];
    let explanation = '';
    let highlightRegions: number[] = [];
    let highlightCells: Coords[] = [];
    
    if (starsInCol > 0) {
      // Case 1: Column already has a star
      // X out all other cells in the column (except cells in regions with confined placements)
      const regionIds = new Set(confinedRegions.map(reg => reg.regionId));
      const crosses = colCellsList.filter(cell => {
        const cellRegionId = state.def.regions[cell.row][cell.col];
        return !regionIds.has(cellRegionId) && 
               getCell(state, cell) === 'empty';
      });
      
      if (crosses.length > 0) {
        forcedCrosses = crosses;
        highlightRegions = confinedRegions.map(reg => reg.regionId);
        // Get actual placement cells for highlighting (cells in the column from confined regions)
        const placementCellsInCol = colCellsList.filter((cell: Coords) => {
          const cellRegionId = state.def.regions[cell.row][cell.col];
          return highlightRegions.includes(cellRegionId) && 
                 getCell(state, cell) === 'empty';
        });
        highlightCells = [
          ...placementCellsInCol,
          ...crosses
        ];
        const regionNames = formatRegions(highlightRegions);
        if (highlightRegions.length === 1) {
          explanation = `${regionNames} needs a star, and one star must be placed in ${formatCol(col)}. Since this column already has a star, all other cells in this column (outside ${regionNames}) must be crosses.`;
        } else {
          explanation = `${regionNames} need stars, and each region must place one star in ${formatCol(col)}. Since this column already has a star, all other cells in this column (outside these regions) must be crosses.`;
        }
      }
    } else {
      // Case 2: Column doesn't have a star yet
      // If there are 2+ regions with confined placements, X out all other cells
      // (except cells in those regions)
      if (confinedRegions.length >= 2) {
        const regionIds = new Set(confinedRegions.map(reg => reg.regionId));
        const crosses = colCellsList.filter(cell => {
          const cellRegionId = state.def.regions[cell.row][cell.col];
          return !regionIds.has(cellRegionId) && 
                 getCell(state, cell) === 'empty';
        });
        
        if (crosses.length > 0) {
          forcedCrosses = crosses;
          highlightRegions = confinedRegions.map(reg => reg.regionId);
          // Get actual placement cells for highlighting (cells in the column from confined regions)
          const placementCellsInCol = colCellsList.filter((cell: Coords) => {
            const cellRegionId = state.def.regions[cell.row][cell.col];
            return highlightRegions.includes(cellRegionId) && 
                   getCell(state, cell) === 'empty';
          });
          highlightCells = [
            ...placementCellsInCol,
            ...crosses
          ];
          const regionNames = formatRegions(highlightRegions);
          explanation = `${regionNames} both need stars, and each region must place one star in ${formatCol(col)}. Therefore, this column will have at least 2 stars (one from each region), so all other cells in this column must be crosses.`;
        }
      }
    }
    
    if (forcedCrosses.length > 0) {
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'shared-row-column',
        resultCells: forcedCrosses,
        explanation,
        highlights: {
          cols: [col],
          regions: highlightRegions,
          cells: highlightCells,
        },
      };
    }
  }
  
  return null;
}

/**
 * Find result with deductions support
 */
export function findSharedRowColumnResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findSharedRowColumnHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Shared row/column finds forced crosses when regions share rows/columns.
  // We could emit CellDeduction for forced crosses,
  // but the technique uses expensive placement search and primarily produces hints directly.

  return { type: 'none' };
}

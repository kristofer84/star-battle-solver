import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { neighbors8 } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `pressured-exclusion-${hintCounter}`;
}

/**
 * Pressured Exclusion:
 * 
 * For each empty cell, consider placing a hypothetical star there.
 * If this would force cascading 2×2 violations or adjacency violations
 * that prevent some unit from reaching its required number of stars,
 * then that cell is a forced cross.
 * 
 * This is more sophisticated than basic exclusion because it considers
 * the forced consequences of placing a star, not just the immediate effect.
 */
export function findPressuredExclusionHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit, regions } = state.def;

  // Precompute star and empty counts per row/column/region
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();
  
  let totalMarks = 0; // Count of stars and crosses

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
      if (cell === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
        totalMarks += 1;
      } else if (cell === 'empty') {
        rowEmpties[r] += 1;
        colEmpties[c] += 1;
        regionEmpties.set(regionId, (regionEmpties.get(regionId) ?? 0) + 1);
      } else if (cell === 'cross') {
        totalMarks += 1;
      }
    }
  }
  
  // Pressured exclusion requires some existing constraints to work from
  // On an empty board, it's too speculative
  if (totalMarks === 0) {
    return null;
  }

  // Try each empty cell
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;

      const testCell: Coords = { row: r, col: c };
      
      // Simulate placing a star at this cell and check for cascading violations
      const result = simulateStarPlacement(state, testCell, {
        rowStars,
        rowEmpties,
        colStars,
        colEmpties,
        regionStars,
        regionEmpties,
      });

      if (result.breaksUnit) {
        const explanation = `If this cell contained a star, it would force ${result.reason}, making it impossible for ${result.affectedUnit} to reach ${starsPerUnit} stars. Therefore, this cell must be a cross.`;

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'pressured-exclusion',
          resultCells: [testCell],
          explanation,
          highlights: {
            cells: [testCell],
            rows: result.affectedUnitType === 'row' ? [result.affectedUnitId] : undefined,
            cols: result.affectedUnitType === 'col' ? [result.affectedUnitId] : undefined,
            // Don't highlight entire regions, just the specific cell
            regions: undefined,
          },
        };
      }
    }
  }

  return null;
}

interface UnitCounts {
  rowStars: number[];
  rowEmpties: number[];
  colStars: number[];
  colEmpties: number[];
  regionStars: Map<number, number>;
  regionEmpties: Map<number, number>;
}

interface SimulationResult {
  breaksUnit: boolean;
  reason?: string;
  affectedUnit?: string;
  affectedUnitType?: 'row' | 'col' | 'region';
  affectedUnitId?: number;
}

function simulateStarPlacement(
  state: PuzzleState,
  testCell: Coords,
  counts: UnitCounts,
): SimulationResult {
  const { size, starsPerUnit, regions } = state.def;
  const regionId = regions[testCell.row][testCell.col];

  // Track which cells would be forced to be crosses
  const forcedCrosses = new Set<string>();
  
  // Add the test cell as a hypothetical star
  const hypotheticalStars = new Set<string>();
  hypotheticalStars.add(`${testCell.row},${testCell.col}`);

  // 1. All adjacent cells would be forced to be crosses (adjacency constraint)
  const adjacent = neighbors8(testCell, size);
  for (const adj of adjacent) {
    if (state.cells[adj.row][adj.col] === 'empty') {
      forcedCrosses.add(`${adj.row},${adj.col}`);
    }
  }

  // 2. All cells in 2×2 blocks containing the test cell would be forced to be crosses
  for (let dr = -1; dr <= 0; dr += 1) {
    for (let dc = -1; dc <= 0; dc += 1) {
      const blockTopLeft = { row: testCell.row + dr, col: testCell.col + dc };
      if (
        blockTopLeft.row >= 0 &&
        blockTopLeft.col >= 0 &&
        blockTopLeft.row < size - 1 &&
        blockTopLeft.col < size - 1
      ) {
        // This is a valid 2×2 block containing testCell
        const block: Coords[] = [
          blockTopLeft,
          { row: blockTopLeft.row, col: blockTopLeft.col + 1 },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col + 1 },
        ];

        // All other cells in this block must be crosses
        for (const cell of block) {
          if (cell.row !== testCell.row || cell.col !== testCell.col) {
            if (state.cells[cell.row][cell.col] === 'empty') {
              forcedCrosses.add(`${cell.row},${cell.col}`);
            }
          }
        }
      }
    }
  }

  // Now check if any unit becomes unsatisfiable with these forced crosses
  // Check each unit (row, col, region) to see if it can still reach starsPerUnit
  
  // Check all rows
  for (let row = 0; row < size; row += 1) {
    const stars = counts.rowStars[row];
    let empties = counts.rowEmpties[row];
    
    // Adjust for the test cell if it's in this row
    const isTestCellInRow = row === testCell.row;
    if (isTestCellInRow) {
      empties -= 1; // testCell is no longer empty
    }
    
    // Count how many empties in this row are forced to be crosses
    let forcedCrossesInRow = 0;
    for (let col = 0; col < size; col += 1) {
      if (state.cells[row][col] === 'empty' && forcedCrosses.has(`${row},${col}`)) {
        forcedCrossesInRow += 1;
      }
    }
    
    const remainingEmpties = empties - forcedCrossesInRow;
    // If test cell is in this row, it will have a star, so we need one fewer
    const remainingStars = starsPerUnit - stars - (isTestCellInRow ? 1 : 0);
    
    if (remainingStars > remainingEmpties) {
      // This row can't reach its quota
      const violationType = forcedCrossesInRow > 0 ? '2×2 and adjacency violations' : 'violations';
      return {
        breaksUnit: true,
        reason: violationType,
        affectedUnit: `row ${row + 1}`,
        affectedUnitType: 'row',
        affectedUnitId: row,
      };
    }
  }

  // Check all columns
  for (let col = 0; col < size; col += 1) {
    const stars = counts.colStars[col];
    let empties = counts.colEmpties[col];
    
    // Adjust for the test cell if it's in this column
    const isTestCellInCol = col === testCell.col;
    if (isTestCellInCol) {
      empties -= 1;
    }
    
    // Count forced crosses in this column
    let forcedCrossesInCol = 0;
    for (let row = 0; row < size; row += 1) {
      if (state.cells[row][col] === 'empty' && forcedCrosses.has(`${row},${col}`)) {
        forcedCrossesInCol += 1;
      }
    }
    
    const remainingEmpties = empties - forcedCrossesInCol;
    // If test cell is in this column, it will have a star, so we need one fewer
    const remainingStars = starsPerUnit - stars - (isTestCellInCol ? 1 : 0);
    
    if (remainingStars > remainingEmpties) {
      const violationType = forcedCrossesInCol > 0 ? '2×2 and adjacency violations' : 'violations';
      return {
        breaksUnit: true,
        reason: violationType,
        affectedUnit: `column ${col + 1}`,
        affectedUnitType: 'col',
        affectedUnitId: col,
      };
    }
  }

  // Check all regions
  const allRegionIds = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      allRegionIds.add(regions[r][c]);
    }
  }

  for (const regId of allRegionIds) {
    const stars = counts.regionStars.get(regId) ?? 0;
    let empties = counts.regionEmpties.get(regId) ?? 0;
    
    // Adjust for the test cell if it's in this region
    // The test cell will have a star, so we need one fewer star
    const isTestCellInRegion = regId === regionId;
    if (isTestCellInRegion) {
      empties -= 1;
    }
    
    // Count forced crosses in this region
    let forcedCrossesInRegion = 0;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (regions[r][c] === regId && state.cells[r][c] === 'empty' && forcedCrosses.has(`${r},${c}`)) {
          forcedCrossesInRegion += 1;
        }
      }
    }
    
    const remainingEmpties = empties - forcedCrossesInRegion;
    // If test cell is in this region, it will have a star, so we need one fewer
    const remainingStars = starsPerUnit - stars - (isTestCellInRegion ? 1 : 0);
    
    if (remainingStars > remainingEmpties) {
      const violationType = forcedCrossesInRegion > 0 ? '2×2 and adjacency violations' : 'violations';
      return {
        breaksUnit: true,
        reason: violationType,
        affectedUnit: `region ${regId}`,
        affectedUnitType: 'region',
        affectedUnitId: regId,
      };
    }
  }

  return { breaksUnit: false };
}

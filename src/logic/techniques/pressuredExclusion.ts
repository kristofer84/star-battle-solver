import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';
import { neighbors8 } from '../helpers';
import { countSolutions } from '../search';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `pressured-exclusion-${hintCounter}`;
}

/**
 * Shallow clone of a puzzle state for hypothesis testing
 */
function cloneState(state: PuzzleState): PuzzleState {
  return {
    def: state.def,
    cells: state.cells.map((row) => [...row]),
  };
}

/**
 * Pressured Exclusion:
 * 
 * For each empty cell, consider placing a hypothetical star there.
 * If this would force cascading 2×2 violations or adjacency violations
 * that prevent some unit from reaching its required number of stars,
 * then that cell is a forced cross.
 * 
 * IMPORTANT: We now additionally verify soundness by checking that the
 * "star" hypothesis actually leads to zero valid completions using the
 * backtracking solver. If a completion still exists, we do NOT mark the
 * cell as a cross.
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
        // EXTRA SOUNDNESS CHECK:
        // Before we claim this cell must be a cross, verify that
        // there is truly no valid completion with a star here.
        const starState = cloneState(state);
        starState.cells[testCell.row][testCell.col] = 'star';
        const sol = countSolutions(starState, {
          maxCount: 1,
          timeoutMs: 2000,
          maxDepth: 200,
        });

        // Only if there is PROVABLY no solution with a star here do we
        // consider marking it as a forced cross.
        if (!sol.timedOut && sol.count === 0) {
          // EXTRA SAFETY GUARD:
          // Do not let pressured-exclusion be the technique that exhausts
          // all remaining candidates in a row/column/region. If turning this
          // cell into a cross would immediately make any containing unit
          // arithmetically unsatisfiable on its own, we skip this hint and
          // let a more direct technique (or the solver) handle it.
          const row = testCell.row;
          const col = testCell.col;
          const regionId = regions[row][col];

          // Row guard
          let rowEmptiesAfter = rowEmpties[row];
          if (state.cells[row][col] === 'empty') {
            rowEmptiesAfter -= 1;
          }
          const rowRemainingStars = starsPerUnit - rowStars[row];
          // If placing this cross would leave insufficient cells for remaining stars, skip this hint
          // We need: rowEmptiesAfter > rowRemainingStars (more empty cells than stars needed)
          if (rowRemainingStars >= rowEmptiesAfter) {
            continue;
          }

          // Column guard
          let colEmptiesAfter = colEmpties[col];
          if (state.cells[row][col] === 'empty') {
            colEmptiesAfter -= 1;
          }
          const colRemainingStars = starsPerUnit - colStars[col];
          // If placing this cross would leave insufficient cells for remaining stars, skip this hint
          // We need: colEmptiesAfter > colRemainingStars (more empty cells than stars needed)
          if (colRemainingStars >= colEmptiesAfter) {
            continue;
          }

          // Region guard
          let regionEmptiesAfter = regionEmpties.get(regionId) ?? 0;
          if (state.cells[row][col] === 'empty') {
            regionEmptiesAfter -= 1;
          }
          const regionStarsCount = regionStars.get(regionId) ?? 0;
          const regionRemainingStars = starsPerUnit - regionStarsCount;
          // If placing this cross would leave insufficient cells for remaining stars, skip this hint
          // We need: regionEmptiesAfter > regionRemainingStars (more empty cells than stars needed)
          if (regionRemainingStars >= regionEmptiesAfter) {
            continue;
          }

          const explanation = `If this cell contained a star, it would force ${result.reason}, making it impossible for ${result.affectedUnit} to reach ${starsPerUnit} stars. Therefore, this cell must be a cross.`;

          // Ensure affectedUnitId is defined (it should be when breaksUnit is true)
          if (result.affectedUnitId === undefined) {
            continue;
          }

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
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findPressuredExclusionResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findPressuredExclusionHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Pressured exclusion finds cells that would break units if they were stars.
  // We could emit CellDeduction for excluded cells,
  // but the technique uses expensive simulation and primarily produces hints directly.

  return { type: 'none' };
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
        const block: Coords[] = [
          blockTopLeft,
          { row: blockTopLeft.row, col: blockTopLeft.col + 1 },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col + 1 },
        ];

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
    const isTestCellInRow = row === testCell.row;
    if (isTestCellInRow) {
      empties -= 1;
    }
    let forcedCrossesInRow = 0;
    for (let col = 0; col < size; col += 1) {
      if (state.cells[row][col] === 'empty' && forcedCrosses.has(`${row},${col}`)) {
        forcedCrossesInRow += 1;
      }
    }
    const remainingEmpties = empties - forcedCrossesInRow;
    const remainingStars = starsPerUnit - stars - (isTestCellInRow ? 1 : 0);
    if (remainingStars > remainingEmpties) {
      const violationType = forcedCrossesInRow > 0 ? '2×2 and adjacency violations' : 'violations';
      return {
        breaksUnit: true,
        reason: violationType,
        affectedUnit: `row ${row}`,
        affectedUnitType: 'row',
        affectedUnitId: row,
      };
    }
  }

  // Check all columns
  for (let col = 0; col < size; col += 1) {
    const stars = counts.colStars[col];
    let empties = counts.colEmpties[col];
    const isTestCellInCol = col === testCell.col;
    if (isTestCellInCol) {
      empties -= 1;
    }
    let forcedCrossesInCol = 0;
    for (let row = 0; row < size; row += 1) {
      if (state.cells[row][col] === 'empty' && forcedCrosses.has(`${row},${col}`)) {
        forcedCrossesInCol += 1;
      }
    }
    const remainingEmpties = empties - forcedCrossesInCol;
    const remainingStars = starsPerUnit - stars - (isTestCellInCol ? 1 : 0);
    if (remainingStars > remainingEmpties) {
      const violationType = forcedCrossesInCol > 0 ? '2×2 and adjacency violations' : 'violations';
      return {
        breaksUnit: true,
        reason: violationType,
        affectedUnit: `column ${col}`,
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
    const isTestCellInRegion = regId === regionId;
    if (isTestCellInRegion) {
      empties -= 1;
    }
    let forcedCrossesInRegion = 0;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (regions[r][c] === regId && state.cells[r][c] === 'empty' && forcedCrosses.has(`${r},${c}`)) {
          forcedCrossesInRegion += 1;
        }
      }
    }
    const remainingEmpties = empties - forcedCrossesInRegion;
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

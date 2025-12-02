import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  getCell,
  rowCells,
  colCells,
  regionCells,
  emptyCells,
  countStars,
  neighbors8,
  formatRow,
  formatCol,
  formatRegion,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `entanglement-${hintCounter}`;
}

/**
 * Entanglement technique:
 *
 * When multiple constraints interact in complex ways, they can force specific cells
 * even when no single constraint alone would force them. This technique looks for
 * situations where:
 * - Multiple units (rows, columns, regions) have limited placement options
 * - These units share cells, creating interdependencies
 * - The combination of constraints forces specific placements
 *
 * Example:
 * - Row 3 needs 1 more star and has only 2 possible positions: (3,4) and (3,7)
 * - Column 4 needs 1 more star and has only 2 possible positions: (3,4) and (6,4)
 * - Region 5 needs 1 more star and has only 2 possible positions: (3,7) and (6,4)
 * - These constraints entangle: if (3,4) is not a star, then (3,7) must be (row 3),
 *   which forces (6,4) to be a star (region 5), which forces (3,4) to be a star (column 4)
 * - This contradiction means (3,4) must be a star
 */
export function findEntanglementHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Find all constrained units (units with limited placement options)
  const constrainedUnits = findConstrainedUnits(state);

  if (constrainedUnits.length < 2) return null;

  // Look for entangled constraints
  for (let i = 0; i < constrainedUnits.length; i += 1) {
    for (let j = i + 1; j < constrainedUnits.length; j += 1) {
      const unit1 = constrainedUnits[i];
      const unit2 = constrainedUnits[j];

      // Check if these units share cells (potential entanglement)
      const sharedCells = findSharedCells(unit1.possibleCells, unit2.possibleCells);

      if (sharedCells.length > 0) {
        // Analyze the entanglement
        const forcedCells = analyzeEntanglement(state, [unit1, unit2], constrainedUnits);

        if (forcedCells.length > 0) {
          // Filter out any forced stars that would be adjacent to other forced stars
          const validForcedCells = filterValidForcedCells(state, forcedCells);
          
          if (validForcedCells.length === 0) {
            continue; // Skip if no valid forced cells remain
          }

          const regions = new Set<number>();
          const rows = new Set<number>();
          const cols = new Set<number>();

          for (const unit of [unit1, unit2]) {
            if (unit.type === 'region') regions.add(unit.id);
            if (unit.type === 'row') rows.add(unit.id);
            if (unit.type === 'col') cols.add(unit.id);
          }

          const unitDesc1 = formatUnit(unit1);
          const unitDesc2 = formatUnit(unit2);

          return {
            id: nextHintId(),
            kind: validForcedCells[0].kind,
            technique: 'entanglement',
            resultCells: validForcedCells.map((fc) => fc.cell),
            explanation: `Entanglement: ${unitDesc1} and ${unitDesc2} have limited placement options that interact. When these constraints are combined, specific cells are forced.`,
            highlights: {
              cells: [
                ...unit1.possibleCells,
                ...unit2.possibleCells,
                ...validForcedCells.map((fc) => fc.cell),
              ],
              rows: rows.size > 0 ? Array.from(rows) : undefined,
              cols: cols.size > 0 ? Array.from(cols) : undefined,
              regions: regions.size > 0 ? Array.from(regions) : undefined,
            },
          };
        }
      }
    }
  }

  // Try more complex entanglements with 3+ units
  for (let i = 0; i < constrainedUnits.length; i += 1) {
    for (let j = i + 1; j < constrainedUnits.length; j += 1) {
      for (let k = j + 1; k < constrainedUnits.length; k += 1) {
        const units = [constrainedUnits[i], constrainedUnits[j], constrainedUnits[k]];

        // Check if these units form an entangled system
        if (hasSharedCells(units)) {
          const forcedCells = analyzeEntanglement(state, units, constrainedUnits);

          if (forcedCells.length > 0) {
            // Filter out any forced stars that would be adjacent to other forced stars
            const validForcedCells = filterValidForcedCells(state, forcedCells);
            
            if (validForcedCells.length === 0) {
              continue; // Skip if no valid forced cells remain
            }

            const regions = new Set<number>();
            const rows = new Set<number>();
            const cols = new Set<number>();

            for (const unit of units) {
              if (unit.type === 'region') regions.add(unit.id);
              if (unit.type === 'row') rows.add(unit.id);
              if (unit.type === 'col') cols.add(unit.id);
            }

            const unitDescs = units.map(formatUnit).join(', ');

            return {
              id: nextHintId(),
              kind: validForcedCells[0].kind,
              technique: 'entanglement',
              resultCells: validForcedCells.map((fc) => fc.cell),
              explanation: `Entanglement: ${unitDescs} have limited placement options that interact. When these constraints are combined, specific cells are forced.`,
              highlights: {
                cells: [
                  ...units.flatMap((u) => u.possibleCells),
                  ...validForcedCells.map((fc) => fc.cell),
                ],
                rows: rows.size > 0 ? Array.from(rows) : undefined,
                cols: cols.size > 0 ? Array.from(cols) : undefined,
                regions: regions.size > 0 ? Array.from(regions) : undefined,
              },
            };
          }
        }
      }
    }
  }

  return null;
}

interface ConstrainedUnit {
  type: 'row' | 'col' | 'region';
  id: number;
  starsNeeded: number;
  possibleCells: Coords[];
}

interface ForcedCell {
  cell: Coords;
  kind: 'place-star' | 'place-cross';
}

/**
 * Find all units that have limited placement options (2-4 possible cells for remaining stars)
 */
function findConstrainedUnits(state: PuzzleState): ConstrainedUnit[] {
  const { size, starsPerUnit } = state.def;
  const constrained: ConstrainedUnit[] = [];

  // Check rows
  for (let row = 0; row < size; row += 1) {
    const cells = rowCells(state, row);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      // Filter to viable cells (not blocked by constraints)
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'row',
          id: row,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  // Check columns
  for (let col = 0; col < size; col += 1) {
    const cells = colCells(state, col);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'col',
          id: col,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  // Check regions
  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const cells = regionCells(state, regionId);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    const starsNeeded = starsPerUnit - stars;

    if (starsNeeded > 0 && empties.length >= starsNeeded && empties.length <= 4) {
      const viableCells = empties.filter((cell) => isViableForStar(state, cell));

      if (viableCells.length >= starsNeeded && viableCells.length <= 4) {
        constrained.push({
          type: 'region',
          id: regionId,
          starsNeeded,
          possibleCells: viableCells,
        });
      }
    }
  }

  return constrained;
}

/**
 * Check if a cell is viable for placing a star (not blocked by basic constraints)
 */
function isViableForStar(state: PuzzleState, cell: Coords): boolean {
  // Check adjacency constraint
  const neighbors = neighbors8(cell, state.def.size);
  for (const neighbor of neighbors) {
    if (getCell(state, neighbor) === 'star') return false;
  }

  // Check 2×2 constraint
  for (let dr = -1; dr <= 0; dr += 1) {
    for (let dc = -1; dc <= 0; dc += 1) {
      const topLeft = { row: cell.row + dr, col: cell.col + dc };
      if (
        topLeft.row >= 0 &&
        topLeft.col >= 0 &&
        topLeft.row < state.def.size - 1 &&
        topLeft.col < state.def.size - 1
      ) {
        const block: Coords[] = [
          topLeft,
          { row: topLeft.row, col: topLeft.col + 1 },
          { row: topLeft.row + 1, col: topLeft.col },
          { row: topLeft.row + 1, col: topLeft.col + 1 },
        ];

        const starsInBlock = block.filter((c) => getCell(state, c) === 'star').length;
        if (starsInBlock >= 1) return false;
      }
    }
  }

  return true;
}

/**
 * Find cells that appear in both lists
 */
function findSharedCells(cells1: Coords[], cells2: Coords[]): Coords[] {
  const shared: Coords[] = [];

  for (const c1 of cells1) {
    for (const c2 of cells2) {
      if (c1.row === c2.row && c1.col === c2.col) {
        shared.push(c1);
        break;
      }
    }
  }

  return shared;
}

/**
 * Check if a list of units has any shared cells
 */
function hasSharedCells(units: ConstrainedUnit[]): boolean {
  for (let i = 0; i < units.length; i += 1) {
    for (let j = i + 1; j < units.length; j += 1) {
      const shared = findSharedCells(units[i].possibleCells, units[j].possibleCells);
      if (shared.length > 0) return true;
    }
  }
  return false;
}

/**
 * Analyze entangled constraints to find forced cells
 */
function analyzeEntanglement(
  state: PuzzleState,
  entangledUnits: ConstrainedUnit[],
  allConstrainedUnits: ConstrainedUnit[]
): ForcedCell[] {
  const forcedCells: ForcedCell[] = [];

  // Collect all cells involved in the entanglement
  const allCells = new Set<string>();
  for (const unit of entangledUnits) {
    for (const cell of unit.possibleCells) {
      allCells.add(`${cell.row},${cell.col}`);
    }
  }

  // For each cell in the entanglement, test if it's forced
  for (const cellKey of allCells) {
    const [row, col] = cellKey.split(',').map(Number);
    const cell = { row, col };

    // Test hypothesis: what if this cell is NOT a star?
    const testState = simulateCross(state, cell);

    // Check if this leads to a contradiction in any of the entangled units
    let contradiction = false;

    for (const unit of entangledUnits) {
      // Count remaining viable cells for this unit
      const viableCells = unit.possibleCells.filter((c) => {
        if (c.row === cell.row && c.col === cell.col) return false;
        return isViableForStar(testState, c);
      });

      // If we don't have enough viable cells for the stars needed, contradiction
      if (viableCells.length < unit.starsNeeded) {
        contradiction = true;
        break;
      }
    }

    if (contradiction) {
      forcedCells.push({ cell, kind: 'place-star' });
    }
  }

  // Also check for forced crosses: cells that would create contradictions if they were stars
  const allPossibleCells = entangledUnits.flatMap((u) => u.possibleCells);
  const uniqueCells = deduplicateCells(allPossibleCells);

  for (const cell of uniqueCells) {
    // Skip if already identified as forced star
    if (forcedCells.some((fc) => fc.cell.row === cell.row && fc.cell.col === cell.col)) {
      continue;
    }

    // Test hypothesis: what if this cell IS a star?
    const testState = simulateStar(state, cell);

    // Check if this leads to a contradiction
    let contradiction = false;

    for (const unit of entangledUnits) {
      // Count remaining viable cells for this unit
      const viableCells = unit.possibleCells.filter((c) => {
        if (c.row === cell.row && c.col === cell.col) {
          // This cell is now a star, so it counts toward the unit
          return cellInUnit(c, unit);
        }
        return isViableForStar(testState, c);
      });

      const starsInUnit = countStarsInUnit(testState, unit);

      // If we have too many stars or not enough space for remaining stars
      if (starsInUnit > state.def.starsPerUnit) {
        contradiction = true;
        break;
      }

      const starsNeeded = state.def.starsPerUnit - starsInUnit;
      if (viableCells.length < starsNeeded) {
        contradiction = true;
        break;
      }
    }

    if (contradiction) {
      forcedCells.push({ cell, kind: 'place-cross' });
    }
  }

  return forcedCells;
}

/**
 * Simulate placing a cross at a cell
 */
function simulateCross(state: PuzzleState, cell: Coords): PuzzleState {
  const newCells = state.cells.map((row) => [...row]);
  newCells[cell.row][cell.col] = 'cross';
  return { def: state.def, cells: newCells };
}

/**
 * Simulate placing a star at a cell
 */
function simulateStar(state: PuzzleState, cell: Coords): PuzzleState {
  const newCells = state.cells.map((row) => [...row]);
  newCells[cell.row][cell.col] = 'star';
  return { def: state.def, cells: newCells };
}

/**
 * Check if a cell belongs to a unit
 */
function cellInUnit(cell: Coords, unit: ConstrainedUnit): boolean {
  if (unit.type === 'row') return cell.row === unit.id;
  if (unit.type === 'col') return cell.col === unit.id;
  // region - need to check the region map
  return false; // Simplified for now
}

/**
 * Count stars in a specific unit
 */
function countStarsInUnit(state: PuzzleState, unit: ConstrainedUnit): number {
  let cells: Coords[];

  if (unit.type === 'row') {
    cells = rowCells(state, unit.id);
  } else if (unit.type === 'col') {
    cells = colCells(state, unit.id);
  } else {
    cells = regionCells(state, unit.id);
  }

  return countStars(state, cells);
}

/**
 * Remove duplicate cells from a list
 */
function deduplicateCells(cells: Coords[]): Coords[] {
  const seen = new Set<string>();
  const result: Coords[] = [];

  for (const cell of cells) {
    const key = `${cell.row},${cell.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cell);
    }
  }

  return result;
}

/**
 * Format a unit for display in explanation
 */
function formatUnit(unit: ConstrainedUnit): string {
  if (unit.type === 'row') {
    return formatRow(unit.id).toLowerCase();
  } else if (unit.type === 'col') {
    return formatCol(unit.id).toLowerCase();
  } else {
    return `region ${formatRegion(unit.id)}`;
  }
}

/**
 * Filter forced cells to ensure stars are not adjacent to each other
 * If multiple stars would be placed and they're adjacent, only return the first one
 * (or return none if we can't determine which is correct)
 */
function filterValidForcedCells(state: PuzzleState, forcedCells: ForcedCell[]): ForcedCell[] {
  const starCells = forcedCells.filter((fc) => fc.kind === 'place-star');
  const crossCells = forcedCells.filter((fc) => fc.kind === 'place-cross');

  // Crosses can always be placed together, no adjacency issues
  const validCells: ForcedCell[] = [...crossCells];

  // For stars, check adjacency
  if (starCells.length === 0) {
    return validCells;
  }

  if (starCells.length === 1) {
    // Single star - check if it's adjacent to existing stars
    const star = starCells[0].cell;
    const neighbors = neighbors8(star, state.def.size);
    const hasAdjacentStar = neighbors.some((nb) => getCell(state, nb) === 'star');
    if (!hasAdjacentStar) {
      validCells.push(starCells[0]);
    }
    return validCells;
  }

  // Multiple stars - check adjacency between forced stars and against existing stars
  // Only include stars that are not adjacent to any other forced star AND not adjacent to existing stars
  for (const starCell of starCells) {
    const star = starCell.cell;
    
    // Check if this star is adjacent to any other forced star
    let isAdjacentToOtherForcedStar = false;
    for (const otherStarCell of starCells) {
      if (otherStarCell === starCell) continue;
      const otherStar = otherStarCell.cell;
      const rowDiff = Math.abs(star.row - otherStar.row);
      const colDiff = Math.abs(star.col - otherStar.col);
      if (rowDiff <= 1 && colDiff <= 1 && (rowDiff > 0 || colDiff > 0)) {
        isAdjacentToOtherForcedStar = true;
        break;
      }
    }
    
    // Check if this star is adjacent to any existing star
    const neighbors = neighbors8(star, state.def.size);
    const hasAdjacentExistingStar = neighbors.some((nb) => getCell(state, nb) === 'star');
    
    // Only add if not adjacent to other forced stars or existing stars
    if (!isAdjacentToOtherForcedStar && !hasAdjacentExistingStar) {
      validCells.push(starCell);
    }
  }

  return validCells;
}

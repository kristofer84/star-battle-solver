import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  getCell,
  neighbors8,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `squeeze-${hintCounter}`;
}

/**
 * Squeeze technique:
 * 
 * Identifies units where stars must fit into constrained spaces due to
 * crosses and 2×2 blocks. When a unit needs stars but only has a narrow
 * corridor of valid placements, this forces specific star placements.
 * 
 * The technique looks for:
 * - Units that need more stars
 * - Constrained spaces where stars can be placed (avoiding crosses and 2×2 violations)
 * - Situations where the constrained space forces specific placements
 */
export function findSqueezeHint(state: PuzzleState): Hint | null {
  // TEMPORARILY DISABLED: The squeeze technique has soundness issues that need to be resolved.
  // The logic for determining when placements are forced is complex and can violate unit constraints.
  // TODO: Fix the soundness issues and re-enable this technique.
  return null;
  
  /* DISABLED CODE:
  const { size, starsPerUnit } = state.def;

  // Check each unit type (rows, columns, regions)
  
  // Check rows
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const hint = checkUnitForSqueeze(state, row, 'row', r);
    if (hint) return hint;
  }
  
  // Check columns
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const hint = checkUnitForSqueeze(state, col, 'col', c);
    if (hint) return hint;
  }
  
  // Check regions
  for (let regionId = 1; regionId <= size; regionId += 1) {
    const region = regionCells(state, regionId);
    const hint = checkUnitForSqueeze(state, region, 'region', regionId);
    if (hint) return hint;
  }

  return null;
  */
}

function checkUnitForSqueeze(
  state: PuzzleState,
  unitCells: Coords[],
  unitType: 'row' | 'col' | 'region',
  unitId: number
): Hint | null {
  const { starsPerUnit } = state.def;
  
  const stars = countStars(state, unitCells);
  const remaining = starsPerUnit - stars;
  
  if (remaining <= 0) return null;
  
  const empties = emptyCells(state, unitCells);
  if (empties.length === 0) return null;
  
  // Find valid placements (cells where a star could be placed without immediate violations)
  const validPlacements = empties.filter((cell) => isValidPlacement(state, cell));
  
  if (validPlacements.length === 0) return null;
  
  // Look for squeeze patterns: when valid placements form narrow corridors
  // and the number of stars needed forces specific placements
  
  // Pattern 1: If valid placements equal remaining stars, all must be stars
  // DISABLED: This pattern has soundness issues when valid placements span multiple units
  // that are already near capacity. Keeping the code for future fix.
  if (false && validPlacements.length === remaining) {
    // Before suggesting all placements, verify this wouldn't violate other unit constraints
    // For each valid placement, check if placing a star there would cause its row/col/region to exceed quota
    
    // First, filter out any placements that would individually cause a violation
    const safePlacements = validPlacements.filter(cell => {
      const cellRow = rowCells(state, cell.row);
      const cellCol = colCells(state, cell.col);
      const cellRegionId = state.def.regions[cell.row][cell.col];
      const cellRegion = regionCells(state, cellRegionId);
      
      const rowStars = countStars(state, cellRow);
      const colStars = countStars(state, cellCol);
      const regionStars = countStars(state, cellRegion);
      
      // Check if this cell's units are already at capacity
      return rowStars < starsPerUnit && colStars < starsPerUnit && regionStars < starsPerUnit;
    });
    
    // If we filtered out any placements, we can't use this pattern
    if (safePlacements.length < validPlacements.length) {
      // Some placements would violate - fall through to other patterns
    } else {
      // Now check if placing ALL of them together would cause any unit to exceed quota
      // Count current stars per row
      const starsPerRow = new Map<number, number>();
      for (let r = 0; r < state.def.size; r++) {
        const row = rowCells(state, r);
        starsPerRow.set(r, countStars(state, row));
      }
      
      // Count current stars per column
      const starsPerCol = new Map<number, number>();
      for (let c = 0; c < state.def.size; c++) {
        const col = colCells(state, c);
        starsPerCol.set(c, countStars(state, col));
      }
      
      // Count current stars per region
      const starsPerRegion = new Map<number, number>();
      for (let regionId = 1; regionId <= state.def.size; regionId++) {
        const region = regionCells(state, regionId);
        starsPerRegion.set(regionId, countStars(state, region));
      }
      
      // Add the new stars from valid placements
      for (const cell of validPlacements) {
        starsPerRow.set(cell.row, starsPerRow.get(cell.row)! + 1);
        starsPerCol.set(cell.col, starsPerCol.get(cell.col)! + 1);
        const regionId = state.def.regions[cell.row][cell.col];
        starsPerRegion.set(regionId, starsPerRegion.get(regionId)! + 1);
      }
      
      // Check if any unit would exceed quota
      let wouldViolate = false;
      for (const [_, count] of starsPerRow) {
        if (count > starsPerUnit) {
          wouldViolate = true;
          break;
        }
      }
      if (!wouldViolate) {
        for (const [_, count] of starsPerCol) {
          if (count > starsPerUnit) {
            wouldViolate = true;
            break;
          }
        }
      }
      if (!wouldViolate) {
        for (const [_, count] of starsPerRegion) {
          if (count > starsPerUnit) {
            wouldViolate = true;
            break;
          }
        }
      }
      
      if (wouldViolate) {
        // Can't place all stars - would violate constraints
        // Fall through to other patterns
      } else {
        const unitName = unitType === 'row' ? `Row ${unitId + 1}` :
                         unitType === 'col' ? `Column ${unitId + 1}` :
                         `Region ${unitId}`;
        
        const explanation = `${unitName} needs ${remaining} more star(s). Due to crosses and 2×2 constraints, only ${validPlacements.length} cell(s) can contain stars, so all must be stars.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'squeeze',
          resultCells: validPlacements,
          explanation,
          highlights: {
            [unitType === 'row' ? 'rows' : unitType === 'col' ? 'cols' : 'regions']: [unitId],
            cells: validPlacements,
          },
        };
      }
    }
  }
  
  // Pattern 2: Look for narrow corridors where adjacency forces specific placements
  // If we have a corridor of N cells and need K stars, and placing stars
  // in certain positions would block too many other positions due to adjacency,
  // we can force specific placements
  
  if (remaining === 1 && validPlacements.length <= 3) {
    // Check if any valid placement would block all others due to adjacency
    for (const candidate of validPlacements) {
      const otherPlacements = validPlacements.filter((p) => 
        p.row !== candidate.row || p.col !== candidate.col
      );
      
      // Check if placing a star at candidate would make all other placements invalid
      const wouldBlockAll = otherPlacements.every((other) => {
        // Check if other is adjacent to candidate
        const rowDiff = Math.abs(other.row - candidate.row);
        const colDiff = Math.abs(other.col - candidate.col);
        return rowDiff <= 1 && colDiff <= 1;
      });
      
      if (wouldBlockAll && otherPlacements.length > 0) {
        // This candidate is the only valid placement
        const unitName = unitType === 'row' ? `Row ${unitId + 1}` :
                         unitType === 'col' ? `Column ${unitId + 1}` :
                         `Region ${unitId}`;
        
        const explanation = `${unitName} needs 1 more star. The valid placements form a narrow corridor, and only cell (${candidate.row + 1}, ${candidate.col + 1}) doesn't block all other positions through adjacency.`;
        
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'squeeze',
          resultCells: [candidate],
          explanation,
          highlights: {
            [unitType === 'row' ? 'rows' : unitType === 'col' ? 'cols' : 'regions']: [unitId],
            cells: [candidate],
          },
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if a cell is a valid placement for a star (doesn't immediately violate constraints)
 */
function isValidPlacement(state: PuzzleState, cell: Coords): boolean {
  // Cell must be empty
  if (getCell(state, cell) !== 'empty') return false;
  
  // Check if placing a star here would create a 2×2 block with another star
  for (let dr = -1; dr <= 0; dr += 1) {
    for (let dc = -1; dc <= 0; dc += 1) {
      const blockTopLeft = { row: cell.row + dr, col: cell.col + dc };
      if (
        blockTopLeft.row >= 0 &&
        blockTopLeft.col >= 0 &&
        blockTopLeft.row < state.def.size - 1 &&
        blockTopLeft.col < state.def.size - 1
      ) {
        const block: Coords[] = [
          blockTopLeft,
          { row: blockTopLeft.row, col: blockTopLeft.col + 1 },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col },
          { row: blockTopLeft.row + 1, col: blockTopLeft.col + 1 },
        ];
        
        // Count stars in this block (excluding the candidate cell)
        const starsInBlock = block.filter((c) => 
          (c.row !== cell.row || c.col !== cell.col) && getCell(state, c) === 'star'
        ).length;
        
        if (starsInBlock >= 1) {
          return false; // Would create 2×2 with multiple stars
        }
      }
    }
  }
  
  // Check if any adjacent cell has a star
  const adjacent = neighbors8(cell, state.def.size);
  for (const adj of adjacent) {
    if (getCell(state, adj) === 'star') {
      return false; // Would be adjacent to a star
    }
  }
  
  return true;
}

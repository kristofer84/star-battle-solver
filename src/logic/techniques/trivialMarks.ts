import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { rowCells, colCells, regionCells, emptyCells, neighbors8, countStars, formatRow, formatCol, formatRegion } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `trivial-${hintCounter}`;
}

export function findTrivialMarksHint(state: PuzzleState): Hint | null {
  const size = state.def.size;
  const starsPerUnit = state.def.starsPerUnit;

  // Precompute star and empty counts for guard checks (needed for both unit saturation and star adjacency)
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = state.def.regions[r][c];
      if (cell === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
      } else if (cell === 'empty') {
        rowEmpties[r] += 1;
        colEmpties[c] += 1;
        regionEmpties.set(regionId, (regionEmpties.get(regionId) ?? 0) + 1);
      }
    }
  }

  // 1) Unit saturation: row / column / region already has all its stars -> remaining empties are crosses.
  for (let r = 0; r < size; r += 1) {
    if (rowStars[r] === starsPerUnit && rowEmpties[r] > 0) {
      const row = rowCells(state, r);
      const empties = emptyCells(state, row);
      if (!empties.length) continue;
      
      // EXTRA SAFETY GUARD: Don't mark crosses that would exhaust other units
      // We need to check all crosses together, not individually, since they're all being placed at once
      const safeCrosses = empties.filter((cross) => {
        const col = cross.col;
        const regionId = state.def.regions[cross.row][cross.col];
        
        // Count how many crosses from this row would be placed in the same column
        const crossesInSameCol = empties.filter(e => e.col === col).length;
        
        // Column guard - check if placing ALL crosses in this column would exhaust it
        let colEmptiesAfter = colEmpties[col] - crossesInSameCol;
        const colRemainingStars = starsPerUnit - colStars[col];
        if (colRemainingStars >= colEmptiesAfter) {
          return false; // Would exhaust or exactly fill the column
        }
        
        // Count how many crosses from this row would be placed in the same region
        const crossesInSameRegion = empties.filter(e => 
          state.def.regions[e.row][e.col] === regionId
        ).length;
        
        // Region guard - check if placing ALL crosses in this region would exhaust it
        let regionEmptiesAfter = (regionEmpties.get(regionId) ?? 0) - crossesInSameRegion;
        const regionStarsCount = regionStars.get(regionId) ?? 0;
        const regionRemainingStars = starsPerUnit - regionStarsCount;
        if (regionRemainingStars >= regionEmptiesAfter) {
          return false; // Would exhaust or exactly fill the region
        }
        
        return true; // Safe to place cross
      });
      
      if (safeCrosses.length === 0) {
        continue; // All crosses would exhaust other units
      }
      
      // If we filtered out some crosses, we can't mark all empties as crosses
      // This means the row saturation deduction doesn't apply
      if (safeCrosses.length < empties.length) {
        continue; // Can't mark all empties, so skip this deduction
      }
      
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'trivial-marks',
        resultCells: safeCrosses,
        explanation: `${formatRow(r)} already has ${starsPerUnit} stars, so all remaining empty cells in that row must be crosses.`,
        highlights: { rows: [r], cells: safeCrosses },
      };
    }
  }

  for (let c = 0; c < size; c += 1) {
    if (colStars[c] === starsPerUnit && colEmpties[c] > 0) {
      const col = colCells(state, c);
      const empties = emptyCells(state, col);
      if (!empties.length) continue;
      
      // EXTRA SAFETY GUARD: Don't mark crosses that would exhaust other units
      // We need to check all crosses together, not individually, since they're all being placed at once
      const safeCrosses = empties.filter((cross) => {
        const row = cross.row;
        const regionId = state.def.regions[row][cross.col];
        
        // Count how many crosses from this column would be placed in the same row
        const crossesInSameRow = empties.filter(e => e.row === row).length;
        
        // Row guard - check if placing ALL crosses in this row would exhaust it
        let rowEmptiesAfter = rowEmpties[row] - crossesInSameRow;
        const rowRemainingStars = starsPerUnit - rowStars[row];
        if (rowRemainingStars >= rowEmptiesAfter) {
          return false; // Would exhaust or exactly fill the row
        }
        
        // Count how many crosses from this column would be placed in the same region
        const crossesInSameRegion = empties.filter(e => 
          state.def.regions[e.row][e.col] === regionId
        ).length;
        
        // Region guard - check if placing ALL crosses in this region would exhaust it
        let regionEmptiesAfter = (regionEmpties.get(regionId) ?? 0) - crossesInSameRegion;
        const regionStarsCount = regionStars.get(regionId) ?? 0;
        const regionRemainingStars = starsPerUnit - regionStarsCount;
        if (regionRemainingStars >= regionEmptiesAfter) {
          return false; // Would exhaust or exactly fill the region
        }
        
        return true; // Safe to place cross
      });
      
      if (safeCrosses.length === 0) {
        continue; // All crosses would exhaust other units
      }
      
      // If we filtered out some crosses, we can't mark all empties as crosses
      // This means the column saturation deduction doesn't apply
      if (safeCrosses.length < empties.length) {
        continue; // Can't mark all empties, so skip this deduction
      }
      
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'trivial-marks',
        resultCells: safeCrosses,
        explanation: `${formatCol(c)} already has ${starsPerUnit} stars, so all remaining empty cells in that column must be crosses.`,
        highlights: { cols: [c], cells: safeCrosses },
      };
    }
  }

  for (let regionId = 1; regionId <= 10; regionId += 1) {
    const regionStarCount = regionStars.get(regionId) ?? 0;
    const regionEmptyCount = regionEmpties.get(regionId) ?? 0;
    if (regionStarCount === starsPerUnit && regionEmptyCount > 0) {
      const region = regionCells(state, regionId);
      if (!region.length) continue;
      const empties = emptyCells(state, region);
      if (!empties.length) continue;
      
      // EXTRA SAFETY GUARD: Don't mark crosses that would exhaust other units
      // We need to check all crosses together, not individually, since they're all being placed at once
      const safeCrosses = empties.filter((cross) => {
        const row = cross.row;
        const col = cross.col;
        
        // Count how many crosses from this region would be placed in the same row
        const crossesInSameRow = empties.filter(e => e.row === row).length;
        
        // Row guard - check if placing ALL crosses in this row would exhaust it
        let rowEmptiesAfter = rowEmpties[row] - crossesInSameRow;
        const rowRemainingStars = starsPerUnit - rowStars[row];
        if (rowRemainingStars >= rowEmptiesAfter) {
          return false; // Would exhaust or exactly fill the row
        }
        
        // Count how many crosses from this region would be placed in the same column
        const crossesInSameCol = empties.filter(e => e.col === col).length;
        
        // Column guard - check if placing ALL crosses in this column would exhaust it
        let colEmptiesAfter = colEmpties[col] - crossesInSameCol;
        const colRemainingStars = starsPerUnit - colStars[col];
        if (colRemainingStars >= colEmptiesAfter) {
          return false; // Would exhaust or exactly fill the column
        }
        
        return true; // Safe to place cross
      });
      
      if (safeCrosses.length === 0) {
        continue; // All crosses would exhaust other units
      }
      
      // If we filtered out some crosses, we can't mark all empties as crosses
      // This means the region saturation deduction doesn't apply
      if (safeCrosses.length < empties.length) {
        continue; // Can't mark all empties, so skip this deduction
      }
      
      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'trivial-marks',
        resultCells: safeCrosses,
        explanation: `Region ${formatRegion(regionId)} already has ${starsPerUnit} stars, so all remaining empty cells in that region must be crosses.`,
        highlights: { regions: [regionId], cells: safeCrosses },
      };
    }
  }

  // 2) Star adjacency: each placed star forces its 8 neighbors to be crosses.
  const forcedCrosses: Coords[] = [];
  const highlightCells: Coords[] = [];

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      const center: Coords = { row: r, col: c };
      const nbs = neighbors8(center, size);
      for (const nb of nbs) {
        if (state.cells[nb.row][nb.col] === 'empty') {
          forcedCrosses.push(nb);
        }
      }
      highlightCells.push(center);
    }
  }

  if (forcedCrosses.length) {
    // Deduplicate forcedCrosses
    const key = (c: Coords) => `${c.row},${c.col}`;
    const seen = new Set<string>();
    const unique = forcedCrosses.filter((c) => {
      const k = key(c);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // EXTRA SAFETY GUARD:
    // Do not let trivial-marks (star adjacency) place crosses that would exhaust
    // all remaining candidates in a row/column/region. If placing a cross would
    // leave insufficient or exactly enough cells for remaining stars, skip it.
    const safeCrosses = unique.filter((cross) => {
      const row = cross.row;
      const col = cross.col;
      const regionId = state.def.regions[row][col];

      // Row guard
      let rowEmptiesAfter = rowEmpties[row];
      if (state.cells[row][col] === 'empty') {
        rowEmptiesAfter -= 1;
      }
      const rowRemainingStars = starsPerUnit - rowStars[row];
      if (rowRemainingStars >= rowEmptiesAfter) {
        return false; // Would exhaust or exactly fill the row
      }

      // Column guard
      let colEmptiesAfter = colEmpties[col];
      if (state.cells[row][col] === 'empty') {
        colEmptiesAfter -= 1;
      }
      const colRemainingStars = starsPerUnit - colStars[col];
      if (colRemainingStars >= colEmptiesAfter) {
        return false; // Would exhaust or exactly fill the column
      }

      // Region guard
      let regionEmptiesAfter = regionEmpties.get(regionId) ?? 0;
      if (state.cells[row][col] === 'empty') {
        regionEmptiesAfter -= 1;
      }
      const regionStarsCount = regionStars.get(regionId) ?? 0;
      const regionRemainingStars = starsPerUnit - regionStarsCount;
      if (regionRemainingStars >= regionEmptiesAfter) {
        return false; // Would exhaust or exactly fill the region
      }

      return true; // Safe to place cross
    });

    if (safeCrosses.length === 0) {
      return null; // All crosses would exhaust units, skip this hint
    }

    return {
      id: nextHintId(),
      kind: 'place-cross',
      technique: 'trivial-marks',
      resultCells: safeCrosses,
      explanation:
        'A star cannot touch another star, so all empty neighbors of existing stars must be crosses.',
      highlights: { cells: [...highlightCells, ...safeCrosses] },
    };
  }

  return null;
}



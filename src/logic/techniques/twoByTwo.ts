import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, BlockDeduction } from '../../types/deductions';
import { emptyCells } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `twobytwo-${hintCounter}`;
}

export function findTwoByTwoHint(state: PuzzleState): Hint | null {
  const size = state.def.size;
  const starsPerUnit = state.def.starsPerUnit;

  // Precompute star and empty counts for guard checks
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

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      let starCount = 0;
      for (const cell of block) {
        if (state.cells[cell.row][cell.col] === 'star') {
          starCount += 1;
        }
      }
      if (starCount === 1) {
        const empties = emptyCells(state, block);
        if (empties.length) {
          // EXTRA SAFETY GUARD:
          // Do not let two-by-two place crosses that would exhaust
          // all remaining candidates in a row/column/region. If placing a cross would
          // leave insufficient or exactly enough cells for remaining stars, skip it.
          const safeCrosses = empties.filter((cross) => {
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
            continue; // All crosses would exhaust units, skip this 2x2 block
          }

          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'two-by-two',
            resultCells: safeCrosses,
            explanation:
              'Any 2×2 block may contain at most one star. This 2×2 already has a star, so all remaining empty cells in the block must be crosses.',
            highlights: { cells: block },
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
export function findTwoByTwoResult(state: PuzzleState): TechniqueResult {
  const size = state.def.size;
  const deductions: Deduction[] = [];

  // Check all 2x2 blocks
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      let starCount = 0;
      for (const cell of block) {
        if (state.cells[cell.row][cell.col] === 'star') {
          starCount += 1;
        }
      }

      // If block has 1 star, emit block deduction
      if (starCount === 1) {
        const bRow = Math.floor(r / 2);
        const bCol = Math.floor(c / 2);
        deductions.push({
          kind: 'block',
          technique: 'two-by-two',
          block: { bRow, bCol },
          maxStars: 1,
          explanation: `2×2 block at (${r},${c}) already has 1 star, so cannot have more.`,
        });
      }
    }
  }

  // Try to find a clear hint first
  const hint = findTwoByTwoHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}



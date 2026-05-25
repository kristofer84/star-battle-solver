import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, CellDeduction } from '../../types/deductions';
import { emptyCells } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `twobytwo-${hintCounter}`;
}

export function findTwoByTwoHint(state: PuzzleState): Hint | null {
  const size = state.def.size;

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
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'two-by-two',
            resultCells: empties,
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
  const deductions: CellDeduction[] = [];

  // Check all 2x2 blocks — emit direct cell deductions for empty cells in 1-star blocks
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
        if (state.cells[cell.row][cell.col] === 'star') starCount += 1;
      }
      if (starCount === 1) {
        for (const cell of block) {
          if (state.cells[cell.row][cell.col] === 'empty') {
            deductions.push({
              kind: 'cell',
              type: 'forceEmpty',
              cell,
              technique: 'two-by-two',
              explanation: `2×2 block at (${r},${c}) has a star; (${cell.row},${cell.col}) must be a cross.`,
            });
          }
        }
      }
    }
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}



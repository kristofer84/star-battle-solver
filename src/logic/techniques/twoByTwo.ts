import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, CellDeduction } from '../../types/deductions';
import { emptyCells, idToLetter } from '../helpers';
import { subsetContainsStar } from '../regionCandidatesCache';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `twobytwo-${hintCounter}`;
}

export function findTwoByTwoHint(state: PuzzleState): Hint | null {
  const { size, regions } = state.def;

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

      // Must-have-star case: if the 2×2 is fully inside one region and the
      // region cache says every valid placement uses some cell of this 2×2,
      // then the 2×2 contains exactly one star (combined with the at-most-1
      // adjacency rule). If three of its cells are already crossed, the
      // remaining empty cell is a forced star.
      if (starCount === 0) {
        const regionId = regions[block[0].row][block[0].col];
        let allSameRegion = true;
        for (let i = 1; i < block.length; i += 1) {
          if (regions[block[i].row][block[i].col] !== regionId) {
            allSameRegion = false;
            break;
          }
        }
        if (!allSameRegion) continue;
        const empties = emptyCells(state, block);
        if (empties.length !== 1) continue;
        const mustHaveStar = subsetContainsStar(state, regionId, block);
        if (mustHaveStar !== true) continue;
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'two-by-two',
          resultCells: empties,
          explanation:
            `Region ${idToLetter(regionId)}: every valid star placement uses some cell of this 2×2, ` +
            `and three of its cells are already crossed — so (${empties[0].row},${empties[0].col}) is a forced star.`,
          highlights: { regions: [regionId], cells: block },
        };
      }
    }
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findTwoByTwoResult(state: PuzzleState): TechniqueResult {
  const { size, regions } = state.def;
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
        continue;
      }

      // Must-have-star + at-most-1 = exactly-1 star. Currently the only
      // concrete deduction it yields is forced-star when 3 cells are crossed.
      if (starCount === 0) {
        const regionId = regions[block[0].row][block[0].col];
        let allSameRegion = true;
        for (let i = 1; i < block.length; i += 1) {
          if (regions[block[i].row][block[i].col] !== regionId) {
            allSameRegion = false;
            break;
          }
        }
        if (!allSameRegion) continue;
        const empties = emptyCells(state, block);
        if (empties.length !== 1) continue;
        if (subsetContainsStar(state, regionId, block) !== true) continue;
        deductions.push({
          kind: 'cell',
          type: 'forceStar',
          cell: empties[0],
          technique: 'two-by-two',
          explanation:
            `Region ${idToLetter(regionId)}: every valid star placement uses some cell of this 2×2 ` +
            `and three cells are already crossed; (${empties[0].row},${empties[0].col}) is a forced star.`,
        });
      }
    }
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}



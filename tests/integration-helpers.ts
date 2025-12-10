import {
  DEFAULT_SIZE,
  DEFAULT_STARS_PER_UNIT,
  type PuzzleDef,
  type PuzzleState,
  createEmptyPuzzleState,
} from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { TEST_REGIONS } from './testBoard';

/**
 * Shared helper functions for integration tests
 */

export function makeDef(regions?: number[][]): PuzzleDef {
  return {
    size: DEFAULT_SIZE,
    starsPerUnit: DEFAULT_STARS_PER_UNIT,
    regions: regions || TEST_REGIONS,
  };
}

export function makeState(regions?: number[][]): PuzzleState {
  return createEmptyPuzzleState(makeDef(regions));
}

export async function applyHint(state: PuzzleState): Promise<boolean> {
  const hint = await findNextHint(state);
  if (!hint) return false;
  
  // Check if resultCells exists and is iterable
  if (!hint.resultCells || !Array.isArray(hint.resultCells)) {
    return false;
  }
  
  for (const cell of hint.resultCells) {
    // For schema-based hints with mixed types, use schemaCellTypes
    let value: 'star' | 'cross';
    if (hint.schemaCellTypes) {
      const cellType = hint.schemaCellTypes.get(`${cell.row},${cell.col}`);
      value = cellType === 'star' ? 'star' : 'cross';
    } else {
      value = hint.kind === 'place-star' ? 'star' : 'cross';
    }
    state.cells[cell.row][cell.col] = value;
  }
  
  return true;
}


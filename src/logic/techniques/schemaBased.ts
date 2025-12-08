/**
 * Schema-Based Technique
 * 
 * Uses the schema-based logical engine to find hints.
 * This integrates the new schema system with the existing technique framework.
 */

import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { findSchemaHints } from '../schemas/runtime';
import { colCells, neighbors8, rowCells } from '../helpers';
import { validateState } from '../validation';

/**
 * Find hint using schema-based system
 */
export function findSchemaBasedHint(state: PuzzleState): Hint | null {
  const hint = findSchemaHints(state);
  if (!hint) return null;

  const forcedStars = hint.forcedStars ?? [];
  const forcedCrosses = hint.forcedCrosses ?? [];
  const hasStars = forcedStars.length > 0;
  const hasCrosses = forcedCrosses.length > 0;

  if (!hasStars && !hasCrosses) {
    return null;
  }

  const kind: 'place-star' | 'place-cross' = hasStars ? 'place-star' : 'place-cross';
  const resultCells =
    (hasStars ? forcedStars : forcedCrosses).map(cell => ({ row: cell.row, col: cell.col }));

  // Validate that applying the hint would keep the puzzle state sound.
  // Schema-based logic is experimental, so we defensively verify the
  // deductions before surfacing them to the user/tests.
  const candidateState = state.cells.map(row => [...row]);

  for (const cell of forcedStars) {
    if (candidateState[cell.row][cell.col] === 'cross') {
      return null;
    }
    candidateState[cell.row][cell.col] = 'star';
  }

  for (const cell of forcedCrosses) {
    if (candidateState[cell.row][cell.col] === 'star') {
      return null;
    }
    candidateState[cell.row][cell.col] = 'cross';
  }

  const { size, starsPerUnit, regions } = state.def;

  // Quota and adjacency checks
  for (let r = 0; r < size; r += 1) {
    const row = rowCells({ ...state, cells: candidateState }, r);
    if (row.filter(c => c === 'star').length > starsPerUnit) return null;
  }

  for (let c = 0; c < size; c += 1) {
    const col = colCells({ ...state, cells: candidateState }, c);
    if (col.filter(cell => cell === 'star').length > starsPerUnit) return null;
  }

  const regionStarCounts = new Map<number, number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (candidateState[r][c] !== 'star') continue;
      const regionId = regions[r][c];
      regionStarCounts.set(regionId, (regionStarCounts.get(regionId) || 0) + 1);

      if (regionStarCounts.get(regionId)! > starsPerUnit) {
        return null;
      }

      const nbs = neighbors8({ row: r, col: c }, size);
      for (const nb of nbs) {
        if (candidateState[nb.row][nb.col] === 'star') {
          return null;
        }
      }
    }
  }

  if (validateState({ ...state, cells: candidateState }).length > 0) {
    return null;
  }

  return {
    id: hint.id,
    kind,
    technique: 'schema-based',
    resultCells,
    explanation: hint.explanation,
    highlights: hint.highlights,
  };
}


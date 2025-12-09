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
// Ensure schemas are registered when this technique is loaded
import '../schemas/index';

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

  // When both stars and crosses are present, we need to return both
  // Use schemaCellTypes to track which cells are stars vs crosses
  const kind: 'place-star' | 'place-cross' = hasStars ? 'place-star' : 'place-cross';
  const resultCells: Array<{ row: number; col: number }> = [];
  const schemaCellTypes = new Map<string, 'star' | 'cross'>();
  
  // Add all stars and crosses to resultCells, but filter out cells that are already correctly filled
  for (const cell of forcedStars) {
    // Skip if cell is already a star
    if (state.cells[cell.row][cell.col] === 'star') continue;
    // Skip if cell is already a cross (conflict)
    if (state.cells[cell.row][cell.col] === 'cross') continue;
    resultCells.push({ row: cell.row, col: cell.col });
    schemaCellTypes.set(`${cell.row},${cell.col}`, 'star');
  }
  for (const cell of forcedCrosses) {
    // Skip if cell is already a cross
    if (state.cells[cell.row][cell.col] === 'cross') continue;
    // Skip if cell is already a star (conflict)
    if (state.cells[cell.row][cell.col] === 'star') continue;
    resultCells.push({ row: cell.row, col: cell.col });
    schemaCellTypes.set(`${cell.row},${cell.col}`, 'cross');
  }
  
  // If no valid cells to change, return null
  if (resultCells.length === 0) {
    return null;
  }

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
    // Include schemaCellTypes when both stars and crosses are present
    schemaCellTypes: hasStars && hasCrosses ? schemaCellTypes : undefined,
  };
}


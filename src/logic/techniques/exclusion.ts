import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction } from '../../types/deductions';
import { formatRow, formatCol, idToLetter } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `exclusion-${hintCounter}`;
}

/**
 * Exclusion:
 *
 * For each empty cell, hypothetically place a star there.
 * If that single placement would immediately make some row, column, or region
 * unable to reach its required star count, the cell must be a cross.
 *
 * Two failure modes are checked per unit:
 *   - Star count would exceed the quota (remaining < 0)
 *   - Too few empty cells remain to satisfy the remaining quota (remaining > empties)
 */
export function findExclusionHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit, regions } = state.def;

  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
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

  function wouldBreakUnit(stars: number, empties: number): boolean {
    const remaining = starsPerUnit - (stars + 1);
    if (remaining < 0) return true;
    if (remaining > empties - 1) return true;
    return false;
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      const regionId = regions[r][c];

      const breaksRow = wouldBreakUnit(rowStars[r], rowEmpties[r]);
      const breaksCol = wouldBreakUnit(colStars[c], colEmpties[c]);
      const breaksRegion = wouldBreakUnit(regionStars.get(regionId) ?? 0, regionEmpties.get(regionId) ?? 0);

      if (!breaksRow && !breaksCol && !breaksRegion) continue;

      const cell: Coords = { row: r, col: c };
      const reasons: string[] = [];
      if (breaksRow) reasons.push(formatRow(r));
      if (breaksCol) reasons.push(formatCol(c));
      if (breaksRegion) reasons.push(`Region ${idToLetter(regionId)}`);

      const explanation = `Placing a star here would make ${reasons.join(' and ')} unable to fit its required ${starsPerUnit} star${starsPerUnit === 1 ? '' : 's'}, so this cell must be a cross.`;

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'exclusion',
        resultCells: [cell],
        explanation,
        highlights: {
          rows: breaksRow ? [r] : undefined,
          cols: breaksCol ? [c] : undefined,
          regions: breaksRegion ? [regionId] : undefined,
          cells: [cell],
        },
      };
    }
  }

  return null;
}

export function findExclusionResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit, regions } = state.def;
  const deductions: Deduction[] = [];

  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
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

  function wouldBreakUnit(stars: number, empties: number): boolean {
    const remaining = starsPerUnit - (stars + 1);
    if (remaining < 0) return true;
    if (remaining > empties - 1) return true;
    return false;
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      const regionId = regions[r][c];

      const breaksRow = wouldBreakUnit(rowStars[r], rowEmpties[r]);
      const breaksCol = wouldBreakUnit(colStars[c], colEmpties[c]);
      const breaksRegion = wouldBreakUnit(regionStars.get(regionId) ?? 0, regionEmpties.get(regionId) ?? 0);

      if (!breaksRow && !breaksCol && !breaksRegion) continue;

      const reasons: string[] = [];
      if (breaksRow) reasons.push(formatRow(r));
      if (breaksCol) reasons.push(formatCol(c));
      if (breaksRegion) reasons.push(`Region ${idToLetter(regionId)}`);

      deductions.push({
        kind: 'cell',
        technique: 'exclusion',
        cell: { row: r, col: c },
        type: 'forceEmpty',
        explanation: `Placing a star here would break ${reasons.join(' and ')}.`,
      });
    }
  }

  const hint = findExclusionHint(state);
  if (hint) {
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

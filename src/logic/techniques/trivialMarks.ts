import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction } from '../../types/deductions';
import { rowCells, colCells, regionCells, emptyCells, neighbors8, countStars, formatRow, formatCol, idToLetter } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `trivial-${hintCounter}`;
}

export function findTrivialMarksHint(state: PuzzleState): Hint | null {
  const size = state.def.size;
  const starsPerUnit = state.def.starsPerUnit;

  // 1) Unit saturation: row already has all its stars → remaining empties are crosses.
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    if (countStars(state, row) === starsPerUnit) {
      const empties = emptyCells(state, row);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'trivial-marks',
          resultCells: empties,
          explanation: `${formatRow(r)} already has its ${starsPerUnit} star${starsPerUnit === 1 ? '' : 's'}. No more stars can go in that row, so all remaining empty cells must be crosses.`,
          highlights: { rows: [r], cells: empties },
        };
      }
    }
  }

  // 2) Unit saturation: column.
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    if (countStars(state, col) === starsPerUnit) {
      const empties = emptyCells(state, col);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'trivial-marks',
          resultCells: empties,
          explanation: `${formatCol(c)} already has its ${starsPerUnit} star${starsPerUnit === 1 ? '' : 's'}. No more stars can go in that column, so all remaining empty cells must be crosses.`,
          highlights: { cols: [c], cells: empties },
        };
      }
    }
  }

  // 3) Unit saturation: region.
  for (let regionId = 0; regionId < size; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    if (countStars(state, region) === starsPerUnit) {
      const empties = emptyCells(state, region);
      if (empties.length > 0) {
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'trivial-marks',
          resultCells: empties,
          explanation: `Region ${idToLetter(regionId)} already has its ${starsPerUnit} star${starsPerUnit === 1 ? '' : 's'}. No more stars can go in that region, so all remaining empty cells must be crosses.`,
          highlights: { regions: [regionId], cells: empties },
        };
      }
    }
  }

  // 4) Star adjacency: stars cannot touch each other, so empty neighbors must be crosses.
  const forcedCrossMap = new Map<string, Coords>();
  const starCells: Coords[] = [];

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      starCells.push({ row: r, col: c });
      for (const nb of neighbors8({ row: r, col: c }, size)) {
        if (state.cells[nb.row][nb.col] === 'empty') {
          forcedCrossMap.set(`${nb.row},${nb.col}`, nb);
        }
      }
    }
  }

  if (forcedCrossMap.size > 0) {
    const unique = Array.from(forcedCrossMap.values());
    return {
      id: nextHintId(),
      kind: 'place-cross',
      technique: 'trivial-marks',
      resultCells: unique,
      explanation: 'Stars cannot touch each other, not even diagonally. All empty cells next to an existing star must be crosses.',
      highlights: { cells: [...starCells, ...unique] },
    };
  }

  return null;
}

export function findTrivialMarksResult(state: PuzzleState): TechniqueResult {
  const size = state.def.size;
  const starsPerUnit = state.def.starsPerUnit;
  const deductions: Deduction[] = [];

  // 1) Unit saturation deductions.
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    if (countStars(state, row) === starsPerUnit) {
      const empties = emptyCells(state, row);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'trivial-marks',
          areaType: 'row',
          areaId: r,
          candidateCells: empties,
          maxStars: 0,
          explanation: `${formatRow(r)} already has all its stars.`,
        });
      }
    }
  }

  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    if (countStars(state, col) === starsPerUnit) {
      const empties = emptyCells(state, col);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'trivial-marks',
          areaType: 'column',
          areaId: c,
          candidateCells: empties,
          maxStars: 0,
          explanation: `${formatCol(c)} already has all its stars.`,
        });
      }
    }
  }

  for (let regionId = 0; regionId < size; regionId += 1) {
    const region = regionCells(state, regionId);
    if (!region.length) continue;
    if (countStars(state, region) === starsPerUnit) {
      const empties = emptyCells(state, region);
      if (empties.length > 0) {
        deductions.push({
          kind: 'area',
          technique: 'trivial-marks',
          areaType: 'region',
          areaId: regionId,
          candidateCells: empties,
          maxStars: 0,
          explanation: `Region ${idToLetter(regionId)} already has all its stars.`,
        });
      }
    }
  }

  // 2) Star adjacency deductions.
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      for (const nb of neighbors8({ row: r, col: c }, size)) {
        if (state.cells[nb.row][nb.col] === 'empty') {
          deductions.push({
            kind: 'cell',
            technique: 'trivial-marks',
            cell: nb,
            type: 'forceEmpty',
            explanation: `Adjacent to star at (${r},${c}).`,
          });
        }
      }
    }
  }

  const hint = findTrivialMarksHint(state);
  if (hint) {
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

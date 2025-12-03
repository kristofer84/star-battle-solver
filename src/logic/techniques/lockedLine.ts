import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  colCells,
  formatCol,
  formatRegion,
  formatRow,
  neighbors8,
  regionCells,
  rowCells,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `locked-line-${hintCounter}`;
}

/**
 * Locked Line:
 *
 * When all viable cells for the remaining stars in a region fall in a single row
 * or column, any other cells in that line outside the region cannot contain a
 * star and must be crossed out.
 */
function computeCounts(state: PuzzleState) {
  const { size } = state.def;
  const rowStars = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const regionStars = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        const regionId = state.def.regions[r][c];
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
      }
    }
  }

  return { rowStars, colStars, regionStars };
}

function cellKey(cell: Coords): string {
  return `${cell.row},${cell.col}`;
}

function getViableCellsForRegion(
  state: PuzzleState,
  regionId: number,
  rowStars: number[],
  colStars: number[],
): Coords[] {
  const { starsPerUnit } = state.def;
  const cells = regionCells(state, regionId);
  const viable: Coords[] = [];

  for (const cell of cells) {
    const cellState = state.cells[cell.row][cell.col];

    if (cellState === 'cross') continue;
    if (cellState === 'star') {
      viable.push(cell);
      continue;
    }

    if (rowStars[cell.row] >= starsPerUnit) continue;
    if (colStars[cell.col] >= starsPerUnit) continue;

    const hasAdjacentStar = neighbors8(cell, state.def.size).some(nb => state.cells[nb.row][nb.col] === 'star');
    if (!hasAdjacentStar) {
      viable.push(cell);
    }
  }

  return viable;
}

export function findLockedLineHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const { rowStars, colStars, regionStars } = computeCounts(state);

  for (let regionId = 1; regionId <= size; regionId += 1) {
    const existingStars = regionStars.get(regionId) ?? 0;
    const needsStars = starsPerUnit - existingStars;
    if (needsStars <= 0) continue;

    const viableCells = getViableCellsForRegion(state, regionId, rowStars, colStars);
    if (viableCells.length < needsStars || viableCells.length === 0) continue;

    const rowSet = new Set(viableCells.map(c => c.row));
    const colSet = new Set(viableCells.map(c => c.col));

    if (rowSet.size === 1) {
      const [targetRow] = Array.from(rowSet);
      const regionCellKeys = new Set(viableCells.map(cellKey));
      const crosses = rowCells(state, targetRow).filter(cell => {
        if (regionCellKeys.has(cellKey(cell))) return false;
        if (state.cells[cell.row][cell.col] !== 'empty') return false;
        return state.def.regions[cell.row][cell.col] !== regionId;
      });

      if (crosses.length === 0) continue;

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'locked-line',
        resultCells: crosses,
        explanation: `All possible cells for region ${formatRegion(regionId)} are in ${formatRow(targetRow)}, so every other cell in that row must be a cross.`,
        highlights: { rows: [targetRow], regions: [regionId], cells: crosses },
      };
    }

    if (colSet.size === 1) {
      const [targetCol] = Array.from(colSet);
      const regionCellKeys = new Set(viableCells.map(cellKey));
      const crosses = colCells(state, targetCol).filter(cell => {
        if (regionCellKeys.has(cellKey(cell))) return false;
        if (state.cells[cell.row][cell.col] !== 'empty') return false;
        return state.def.regions[cell.row][cell.col] !== regionId;
      });

      if (crosses.length === 0) continue;

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'locked-line',
        resultCells: crosses,
        explanation: `All possible cells for region ${formatRegion(regionId)} are in ${formatCol(targetCol)}, so every other cell in that column must be a cross.`,
        highlights: { cols: [targetCol], regions: [regionId], cells: crosses },
      };
    }
  }

  return null;
}

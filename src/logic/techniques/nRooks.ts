import type { Hint } from '../../types/hints';
import type { Coords, PuzzleState } from '../../types/puzzle';
import { colCells, getCell, neighbors8, regionCells, rowCells } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `n-rooks-${hintCounter}`;
}

export interface BlockCoords {
  bRow: number;
  bCol: number;
}

export function blockId(block: BlockCoords): number {
  return block.bRow * 5 + block.bCol;
}

export function idToBlock(id: number): BlockCoords {
  return { bRow: Math.floor(id / 5), bCol: id % 5 };
}

export function cellsInBlock(block: BlockCoords): Coords[] {
  const baseRow = 2 * block.bRow;
  const baseCol = 2 * block.bCol;
  return [
    { row: baseRow, col: baseCol },
    { row: baseRow, col: baseCol + 1 },
    { row: baseRow + 1, col: baseCol },
    { row: baseRow + 1, col: baseCol + 1 },
  ];
}

export function blockOfCell(cell: Coords): BlockCoords {
  return {
    bRow: Math.floor(cell.row / 2),
    bCol: Math.floor(cell.col / 2),
  };
}

type BlockStatus = 'must-empty' | 'unknown';

export interface BlockInfo {
  coords: BlockCoords;
  status: BlockStatus;
  hasFixedStar: boolean;
  cells: Coords[];
}

interface BlockRowInfo {
  row: number;
  empties: BlockInfo[];
  unknowns: BlockInfo[];
}

interface BlockColInfo {
  col: number;
  empties: BlockInfo[];
  unknowns: BlockInfo[];
}

function isFixedStar(state: PuzzleState, cell: Coords): boolean {
  return getCell(state, cell) === 'star';
}

function isImpossibleStarCell(state: PuzzleState, cell: Coords): boolean {
  const cellState = getCell(state, cell);
  if (cellState === 'cross') return true;
  if (cellState === 'star') return false;

  const { starsPerUnit } = state.def;
  const rowStarCount = countStarsInUnit(state, rowCells(state, cell.row));
  const colStarCount = countStarsInUnit(state, colCells(state, cell.col));
  if (rowStarCount >= starsPerUnit) return true;
  if (colStarCount >= starsPerUnit) return true;

  const regionId = state.def.regions[cell.row][cell.col];
  const regionStarCount = countStarsInUnit(state, regionCells(state, regionId));
  if (regionStarCount >= starsPerUnit) return true;

  const adjacentToStar = neighbors8(cell, state.def.size).some((neighbor) =>
    isFixedStar(state, neighbor)
  );
  if (adjacentToStar) return true;

  return false;
}

function countStarsInUnit(state: PuzzleState, cells: Coords[]): number {
  return cells.reduce((acc, coords) => (getCell(state, coords) === 'star' ? acc + 1 : acc), 0);
}

export function analyseBlocks(state: PuzzleState): BlockInfo[] {
  const blocks: BlockInfo[] = [];

  for (let bRow = 0; bRow < 5; bRow += 1) {
    for (let bCol = 0; bCol < 5; bCol += 1) {
      const coords = { bRow, bCol };
      const cells = cellsInBlock(coords);
      const hasFixedStar = cells.some((cell) => isFixedStar(state, cell));
      const status = blockIsProvedEmpty(state, cells) ? 'must-empty' : 'unknown';
      blocks.push({ coords, status, hasFixedStar, cells });
    }
  }

  return blocks;
}

function blockIsProvedEmpty(state: PuzzleState, cells: Coords[]): boolean {
  return cells.every((cell) => isImpossibleStarCell(state, cell));
}

function buildBlockRowInfo(blocks: BlockInfo[]): BlockRowInfo[] {
  const rows: BlockRowInfo[] = [];
  for (let bRow = 0; bRow < 5; bRow += 1) {
    const rowBlocks = blocks.filter((block) => block.coords.bRow === bRow);
    rows.push({
      row: bRow,
      empties: rowBlocks.filter((block) => block.status === 'must-empty'),
      unknowns: rowBlocks.filter(
        (block) => block.status === 'unknown' && !block.hasFixedStar,
      ),
    });
  }
  return rows;
}

function buildBlockColInfo(
  blocks: BlockInfo[],
  blockRows: BlockRowInfo[],
): BlockColInfo[] {
  const rowsWithoutEmpty = new Set(
    blockRows.filter((row) => row.empties.length === 0).map((row) => row.row),
  );

  const cols: BlockColInfo[] = [];
  for (let bCol = 0; bCol < 5; bCol += 1) {
    const colBlocks = blocks.filter((block) => block.coords.bCol === bCol);
    cols.push({
      col: bCol,
      empties: colBlocks.filter((block) => block.status === 'must-empty'),
      unknowns: colBlocks.filter(
        (block) =>
          block.status === 'unknown' &&
          !block.hasFixedStar &&
          rowsWithoutEmpty.has(block.coords.bRow),
      ),
    });
  }
  return cols;
}

function findForcedEmptyByRowAndCol(
  rows: BlockRowInfo[],
  cols: BlockColInfo[],
): BlockInfo | null {
  for (const row of rows) {
    if (row.empties.length >= 1) continue;

    for (const cand of row.unknowns) {
      const { bRow, bCol } = cand.coords;
      const colInfo = cols.find((c) => c.col === bCol)!;

      if (colInfo.empties.some((b) => b.coords.bRow !== bRow)) continue;

      const others = colInfo.unknowns.filter((b) => b.coords.bRow !== bRow);

      if (colInfo.empties.length === 0 && others.length === 0) {
        return cand;
      }
    }
  }

  return null;
}

function createEmptyBlockHint(block: BlockInfo): Hint {
  const { bRow, bCol } = block.coords;
  const cells = block.cells;
  const rowNumbers = [...new Set(cells.map((cell) => cell.row))];
  const colNumbers = [...new Set(cells.map((cell) => cell.col))];

  const description =
    `N-Rooks (2×2 blocks): block row ${bRow + 1} and block column ${bCol + 1} each need exactly one empty block. ` +
    'This block is the only remaining candidate for both, so all of its cells must be crossed.';

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'n-rooks',
    resultCells: cells,
    explanation: description,
    highlights: {
      cells,
      rows: rowNumbers,
      cols: colNumbers,
    },
  };
}

export function findNRooksHint(state: PuzzleState): Hint | null {
  if (state.def.size !== 10 || state.def.starsPerUnit !== 2) return null;

  const blocks = analyseBlocks(state);
  const blockRows = buildBlockRowInfo(blocks);
  const blockCols = buildBlockColInfo(blocks, blockRows);

  const forcedEmpty = findForcedEmptyByRowAndCol(blockRows, blockCols);

  if (!forcedEmpty) return null;

  return createEmptyBlockHint(forcedEmpty);
}


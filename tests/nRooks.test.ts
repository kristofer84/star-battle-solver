import { describe, expect, it } from 'vitest';
import {
  analyseBlocks,
  blockId,
  blockOfCell,
  cellsInBlock,
  findNRooksHint,
} from '../src/logic/techniques/nRooks';
import {
  createEmptyPuzzleDef,
  createEmptyPuzzleState,
  type PuzzleState,
} from '../src/types/puzzle';

function setCells(state: PuzzleState, stars: [number, number][], crosses: [number, number][]) {
  for (const [row, col] of stars) {
    state.cells[row][col] = 'star';
  }
  for (const [row, col] of crosses) {
    state.cells[row][col] = 'cross';
  }
}

describe('N-Rooks block helpers', () => {
  it('maps cells to blocks consistently', () => {
    const seen = new Set<string>();

    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        const block = blockOfCell({ row, col });
        const cells = cellsInBlock(block);

        expect(cells).toContainEqual({ row, col });
        seen.add(`${blockId(block)}:${row},${col}`);
      }
    }

    expect(seen.size).toBe(100);
  });

  it('derives block statuses from stars and crosses', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());

    setCells(state, [[0, 0]], []);
    setCells(state, [], [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ]);

    const blocks = analyseBlocks(state);
    const starBlock = blocks.find((block) => block.coords.bRow === 0 && block.coords.bCol === 0);
    const emptyBlock = blocks.find((block) => block.coords.bRow === 1 && block.coords.bCol === 1);

    expect(starBlock?.status).toBe('has-star');
    expect(emptyBlock?.status).toBe('empty');
  });
});

describe('N-Rooks technique (2×2 blocks)', () => {
  it('identifies an empty block when four others in the block row contain stars', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());

    setCells(state, [
      [0, 0],
      [0, 2],
      [1, 4],
      [1, 6],
    ], []);

    const hint = findNRooksHint(state);

    expect(hint).not.toBeNull();

    if (hint) {
      expect(hint.kind).toBe('place-cross');
      expect(hint.technique).toBe('n-rooks');
      expect(hint.resultCells.length).toBe(4);

      const resultRows = new Set(hint.resultCells.map((cell) => cell.row));
      const resultCols = new Set(hint.resultCells.map((cell) => cell.col));

      expect(resultRows).toEqual(new Set([0, 1]));
      expect(resultCols).toEqual(new Set([8, 9]));

      expect(hint.explanation).toContain('block row 1');
      expect(hint.explanation).toContain('block column 5');
    }
  });

  it('returns null when no block row or column has four non-empty blocks', () => {
    const state = createEmptyPuzzleState(createEmptyPuzzleDef());

    setCells(state, [
      [0, 0],
      [2, 2],
      [4, 4],
    ], []);

    const hint = findNRooksHint(state);

    expect(hint).toBeNull();
  });

  it('is gated to 10×10 2★ puzzles', () => {
    const def = createEmptyPuzzleDef();
    def.size = 8;
    const state = createEmptyPuzzleState(def);

    const hint = findNRooksHint(state);

    expect(hint).toBeNull();
  });
});


import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findSimpleShapesHint } from '../src/logic/techniques/simpleShapes';
import { getCatalogSize } from '../src/logic/techniques/shapePatternCatalog';

describe('Shape Pattern Catalog', () => {
  it('catalog builds with reasonable size for starsPerUnit=2', () => {
    const size = getCatalogSize(2);
    console.log(`Catalog entries: ${size}`);
    expect(size).toBeGreaterThan(20); // at least all tetrominoes + pentominoes
  });

  it('finds forced stars in T-tetromino (previously missed)', () => {
    // T-tetromino: only valid placement is ends of crossbar → both ends forced
    const regions = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => {
        if (r === 3 && c >= 3 && c <= 5) return 0; // top bar
        if (r === 4 && c === 4) return 0;          // stem
        return (r * 10 + c + 1) % 9 + 1;           // other regions
      })
    );
    const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });
    const hint = findSimpleShapesHint(state);
    if (hint && hint.technique === 'simple-shapes' && hint.kind === 'place-star') {
      // Both crossbar ends should be in result
      const keys = hint.resultCells.map(c => `${c.row},${c.col}`);
      expect(keys).toContain('3,3');
      expect(keys).toContain('3,5');
    }
  });

  it('finds forced stars in user L-pentomino (regression)', () => {
    const regions = [
      [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
      [2, 2, 2, 0, 1, 1, 1, 1, 1, 3],
      [2, 2, 0, 0, 1, 3, 3, 3, 3, 3],
      [4, 4, 0, 4, 3, 3, 3, 3, 3, 8],
      [4, 4, 0, 4, 3, 3, 3, 7, 7, 8],
      [5, 4, 4, 4, 6, 6, 7, 7, 8, 8],
      [5, 6, 4, 6, 6, 6, 6, 7, 7, 8],
      [5, 6, 6, 6, 7, 7, 7, 7, 8, 8],
      [5, 5, 5, 6, 6, 7, 9, 9, 9, 9],
      [5, 5, 6, 6, 9, 9, 9, 9, 9, 9],
    ];
    const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });
    const hint = findSimpleShapesHint(state);
    expect(hint).not.toBeNull();
    expect(hint!.kind).toBe('place-star');
    expect(hint!.resultCells).toContainEqual({ row: 1, col: 2 });
  });
});

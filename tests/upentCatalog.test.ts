import { describe, expect, it } from 'vitest';
import { lookupPattern } from '../src/logic/techniques/shapePatternCatalog';

describe('shapePatternCatalog — in-shape forced crosses', () => {
  it('U-pentomino (opens up): bottom-middle cell is a forced cross at 2★', () => {
    const cells: [number, number][] = [[8,7],[8,9],[9,7],[9,8],[9,9]];
    const result = lookupPattern(cells, 2);
    expect(result).not.toBeNull();
    expect(result!.forcedCrosses).toContainEqual([9, 8]);
  });

  it('U-pentomino (opens down): top-middle cell is a forced cross at 2★', () => {
    const cells: [number, number][] = [[0,0],[0,2],[1,0],[1,1],[1,2]];
    // canonical-down: [[0,0],[0,1],[0,2],[1,0],[1,2]] — the "notch" (0,1) is outside
    // here we test the up-orientation; the absent (0,1) is OUTSIDE the cells we pass
    const result = lookupPattern(cells, 2);
    expect(result).not.toBeNull();
    expect(result!.forcedCrosses).toContainEqual([0, 1]);
  });
});

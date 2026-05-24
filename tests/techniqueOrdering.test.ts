import { describe, it, expect } from 'vitest';
import { techniquesInOrder, techniqueNameById, findNextHint } from '../src/logic/techniques';
import type { TechniqueId } from '../src/types/hints';
import { createEmptyPuzzleDef, createEmptyPuzzleState } from '../src/types/puzzle';
import { TEST_REGIONS } from './testBoard';

describe('Technique Ordering', () => {
  it('should have all techniques in the correct order per requirements', () => {
    // Ordering: basics first, then exclusion family (O(n²)) before expensive counting/search.
    // Exclusion moved before counting; entanglement moved after schema-based (O(n³)+).
    const expectedOrder: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'saturation',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'band-block-deficit',
      'shared-row-column',
      'cross-empty-patterns',
      'cross-pressure',
      'forced-placement',
      'line-case-split',
      'undercounting',
      'overcounting',
      'square-counting',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'fish',
      'n-rooks',
      'schema-based',
      'entanglement-patterns',
      'entanglement',
      'by-a-thread',
      'by-a-thread-at-sea',
    ];

    const actualOrder = techniquesInOrder.map(t => t.id);
    expect(actualOrder).toEqual(expectedOrder);
  });

  it('should have all technique IDs mapped to names', () => {
    const allTechniqueIds: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'saturation',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'band-block-deficit',
      'shared-row-column',
      'cross-empty-patterns',
      'cross-pressure',
      'forced-placement',
      'line-case-split',
      'undercounting',
      'overcounting',
      'square-counting',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'fish',
      'n-rooks',
      'schema-based',
      'entanglement-patterns',
      'entanglement',
      'by-a-thread',
      'by-a-thread-at-sea',
    ];

    for (const id of allTechniqueIds) {
      expect(techniqueNameById[id]).toBeDefined();
      expect(typeof techniqueNameById[id]).toBe('string');
      expect(techniqueNameById[id].length).toBeGreaterThan(0);
    }
  });

  it('should have exactly 34 techniques registered', () => {
    expect(techniquesInOrder).toHaveLength(34);
  });

  it('should have unique technique IDs', () => {
    const ids = techniquesInOrder.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all techniques with valid findHint functions', () => {
    for (const technique of techniquesInOrder) {
      expect(technique.findHint).toBeDefined();
      expect(typeof technique.findHint).toBe('function');
    }
  });

  it('should return hint from earliest applicable technique when multiple techniques apply', async () => {
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';
    state.cells[2][2] = 'star';
    state.cells[2][3] = 'cross';
    state.cells[3][2] = 'cross';

    const hint = await findNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('trivial-marks');
  });

  it('should verify technique ordering with specific example', async () => {
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    state.cells[0][0] = 'star';
    state.cells[0][5] = 'star';

    const hint = await findNextHint(state);
    expect(hint).not.toBeNull();
    expect(hint?.technique).toBe('trivial-marks');
    expect(hint?.kind).toBe('place-cross');
    expect(hint?.resultCells.every(c => c.row === 0)).toBe(true);
  });

  it.skip('should return null when no techniques apply', async () => {
    // TEST_REGIONS has region 8 entirely in column 7, so locked-line fires even on an empty board.
    // A meaningful "no techniques" test would require a fully solved puzzle state.
    const def = createEmptyPuzzleDef();
    def.regions = TEST_REGIONS;
    const state = createEmptyPuzzleState(def);

    const hint = await findNextHint(state);
    expect(hint).toBeNull();
  });
});

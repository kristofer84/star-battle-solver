import { describe, expect, it } from 'vitest';
import { techniquesInOrder } from '../src/logic/techniques';
import type { TechniqueId } from '../src/types/hints';

describe('Integration Tests: Technique Verification', () => {
  it('verifies all techniques are registered', () => {
    const expectedTechniques: TechniqueId[] = [
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

    expect(techniquesInOrder.length).toBe(34);

    const registeredIds = techniquesInOrder.map(t => t.id);

    for (const expectedId of expectedTechniques) {
      expect(registeredIds).toContain(expectedId);
    }
  });

  it('verifies techniques are in correct order', () => {
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

  it('verifies each technique has required properties', () => {
    for (const technique of techniquesInOrder) {
      expect(technique).toHaveProperty('id');
      expect(technique).toHaveProperty('name');
      expect(technique).toHaveProperty('findHint');
      expect(typeof technique.findHint).toBe('function');
    }
  });
});


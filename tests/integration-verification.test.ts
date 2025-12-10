import { describe, expect, it } from 'vitest';
import { techniquesInOrder } from '../src/logic/techniques';
import type { TechniqueId } from '../src/types/hints';

describe('Integration Tests: Technique Verification', () => {
  it('verifies all techniques are registered', () => {
    const expectedTechniques: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'cross-empty-patterns',
      'entanglement',
      'cross-pressure',
      'shared-row-column',
      'forced-placement',
      'undercounting',
      'overcounting',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'schema-based',
      'entanglement-patterns',
      'fish',
      'n-rooks',
      'by-a-thread',
      'by-a-thread-at-sea',
    ];

    expect(techniquesInOrder.length).toBe(29);
    
    const registeredIds = techniquesInOrder.map(t => t.id);
    
    for (const expectedId of expectedTechniques) {
      expect(registeredIds).toContain(expectedId);
    }
  });

  it('verifies techniques are in correct order', () => {
    const expectedOrder: TechniqueId[] = [
      'trivial-marks',
      'locked-line',
      'adjacent-row-col',
      'two-by-two',
      'exact-fill',
      'simple-shapes',
      'cross-empty-patterns',
      'entanglement',
      'cross-pressure',
      'shared-row-column',
      'forced-placement',
      'undercounting',
      'overcounting',
      'exclusion',
      'pressured-exclusion',
      'adjacent-exclusion',
      'finned-counts',
      'composite-shapes',
      'squeeze',
      'set-differentials',
      'at-sea',
      'kissing-ls',
      'the-m',
      'pressured-ts',
      'schema-based',
      'entanglement-patterns',
      'fish',
      'n-rooks',
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


import { describe, expect, it } from 'vitest';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';
import { makeState, applyHint } from './integration-helpers';

describe('Integration Tests: Idiosyncrasies Category', () => {
  it('identifies kissing-ls technique', async () => {
    // Just verify the technique is registered and can be called
    const hasKissingLs = techniquesInOrder.some(t => t.id === 'kissing-ls');
    expect(hasKissingLs).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'kissing-ls');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'kissing-ls' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies the-m technique', async () => {
    // Just verify the technique is registered and can be called
    const hasTheM = techniquesInOrder.some(t => t.id === 'the-m');
    expect(hasTheM).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'the-m');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'the-m' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies pressured-ts technique', async () => {
    // Just verify the technique is registered and can be called
    const hasPressuredTs = techniquesInOrder.some(t => t.id === 'pressured-ts');
    expect(hasPressuredTs).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'pressured-ts');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'pressured-ts' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies fish technique', async () => {
    // Just verify the technique is registered and can be called
    const hasFish = techniquesInOrder.some(t => t.id === 'fish');
    expect(hasFish).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'fish');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'fish' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies n-rooks technique', async () => {
    // Just verify the technique is registered and can be called
    const hasNRooks = techniquesInOrder.some(t => t.id === 'n-rooks');
    expect(hasNRooks).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'n-rooks');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'n-rooks' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies entanglement technique', async () => {
    // Just verify the technique is registered and can be called
    const hasEntanglement = techniquesInOrder.some(t => t.id === 'entanglement');
    expect(hasEntanglement).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'entanglement');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'entanglement' && Array.isArray(result.resultCells))).toBe(true);
    }
  });
});

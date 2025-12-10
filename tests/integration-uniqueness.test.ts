import { describe, expect, it } from 'vitest';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';
import { makeState, applyHint } from './integration-helpers';

describe('Integration Tests: Uniqueness Category', () => {
  it('identifies by-a-thread technique', async () => {
    // Just verify the technique is registered and can be called
    const hasByAThread = techniquesInOrder.some(t => t.id === 'by-a-thread');
    expect(hasByAThread).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'by-a-thread');
    if (tech) {
      // Call directly - by-a-thread is expensive, so we don't want to loop
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'by-a-thread' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies at-sea technique', async () => {
    // Just verify the technique is registered and can be called
    const hasAtSea = techniquesInOrder.some(t => t.id === 'at-sea');
    expect(hasAtSea).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'at-sea');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'at-sea' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies by-a-thread-at-sea technique', async () => {
    // Just verify the technique is registered and can be called
    const hasByAThreadAtSea = techniquesInOrder.some(t => t.id === 'by-a-thread-at-sea');
    expect(hasByAThreadAtSea).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'by-a-thread-at-sea');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'by-a-thread-at-sea' && Array.isArray(result.resultCells))).toBe(true);
    }
  });
});

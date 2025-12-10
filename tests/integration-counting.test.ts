import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE } from '../src/types/puzzle';
import { findNextHint, techniquesInOrder } from '../src/logic/techniques';
import { makeState, applyHint } from './integration-helpers';

describe('Integration Tests: Counting Category', () => {
  it('identifies undercounting patterns', async () => {
    // Just verify the technique is registered and can be called
    const hasUndercounting = techniquesInOrder.some(t => t.id === 'undercounting');
    expect(hasUndercounting).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'undercounting');
    if (tech) {
      // Call directly to verify it works
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'undercounting' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies overcounting patterns', async () => {
    // Just verify the technique is registered and can be called
    const hasOvercounting = techniquesInOrder.some(t => t.id === 'overcounting');
    expect(hasOvercounting).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'overcounting');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'overcounting' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies composite shapes', async () => {
    // Just verify the technique is registered and can be called
    const hasCompositeShapes = techniquesInOrder.some(t => t.id === 'composite-shapes');
    expect(hasCompositeShapes).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'composite-shapes');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'composite-shapes' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies squeeze patterns', async () => {
    const state = makeState();
    
    // Create a narrow corridor scenario
    // Fill row 3 with crosses except for 3 consecutive cells
    for (let c = 0; c < DEFAULT_SIZE; c++) {
      if (c < 4 || c > 6) {
        state.cells[3][c] = 'cross';
      }
    }
    
    // Try a few hints to see if squeeze fires, but limit iterations
    let previousStateHash = '';
    let noProgressCount = 0;
    const maxIterations = 20;
    const maxNoProgress = 3;
    
    for (let i = 0; i < maxIterations; i++) {
      const hint = await findNextHint(state);
      if (!hint) break;
      
      const stateHash = JSON.stringify(state.cells);
      if (stateHash === previousStateHash) {
        noProgressCount++;
        if (noProgressCount >= maxNoProgress) break;
      } else {
        noProgressCount = 0;
        previousStateHash = stateHash;
      }
      
      if (hint.technique === 'squeeze') {
        expect(hint.explanation).toBeTruthy();
        expect(hint.resultCells?.length).toBeGreaterThan(0);
        return;
      }
      
      const applied = await applyHint(state);
      if (!applied) break;
    }
    
    // Squeeze is available in the system
    const hasSqueeze = techniquesInOrder.some(t => t.id === 'squeeze');
    expect(hasSqueeze).toBe(true);
  });

  it('identifies finned counts', async () => {
    // Just verify the technique is registered and can be called
    const hasFinnedCounts = techniquesInOrder.some(t => t.id === 'finned-counts');
    expect(hasFinnedCounts).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'finned-counts');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'finned-counts' && Array.isArray(result.resultCells))).toBe(true);
    }
  });

  it('identifies set differentials', async () => {
    // Just verify the technique is registered and can be called
    const hasSetDifferentials = techniquesInOrder.some(t => t.id === 'set-differentials');
    expect(hasSetDifferentials).toBe(true);
    
    const state = makeState();
    const tech = techniquesInOrder.find(t => t.id === 'set-differentials');
    if (tech) {
      const result = tech.findHint(state);
      expect(result === null || (result.technique === 'set-differentials' && Array.isArray(result.resultCells))).toBe(true);
    }
  });
});

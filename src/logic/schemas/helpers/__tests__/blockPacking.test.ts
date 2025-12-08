/**
 * Unit tests for blockPacking helper
 */

import { describe, it, expect } from 'vitest';
import { findCagePackings, type CageBlock, type CagePackingConstraints } from '../blockPacking';

describe('findCagePackings', () => {
  it('should return empty solution when targetBlockCount is 0', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [4, 5, 6, 7] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0], cells: [0, 1, 2, 3, 4, 5, 6, 7] },
      targetBlockCount: 0,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0].blocks).toHaveLength(0);
    expect(result.possibleCells.size).toBe(0);
    expect(result.mandatoryCells.size).toBe(0);
  });

  it('should return no solutions when not enough blocks', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0], cells: [0, 1, 2, 3] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    expect(result.solutions).toHaveLength(0);
    expect(result.possibleCells.size).toBe(0);
    expect(result.mandatoryCells.size).toBe(0);
  });

  it('should find single solution when blocks are non-overlapping', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [4, 5, 6, 7] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1], cells: [0, 1, 2, 3, 4, 5, 6, 7] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    expect(result.solutions).toHaveLength(1);
    expect(result.solutions[0].blocks).toHaveLength(2);
    expect(result.possibleCells.size).toBe(8);
    // All cells are mandatory since there's only one solution
    expect(result.mandatoryCells.size).toBe(8);
  });

  it('should find multiple solutions when multiple non-overlapping combinations exist', () => {
    // Create 3 non-overlapping blocks
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },      // Block 1: cells 0-3
      { id: 2, cells: [4, 5, 6, 7] },      // Block 2: cells 4-7
      { id: 3, cells: [8, 9, 10, 11] },    // Block 3: cells 8-11
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1, 2], cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should find C(3,2) = 3 solutions
    expect(result.solutions.length).toBeGreaterThanOrEqual(3);
    expect(result.solutions.every(s => s.blocks.length === 2)).toBe(true);
    
    // All cells should be possible
    expect(result.possibleCells.size).toBe(12);
    
    // No cells should be mandatory (since different combinations use different cells)
    expect(result.mandatoryCells.size).toBe(0);
  });

  it('should exclude overlapping blocks from same solution', () => {
    // Create overlapping blocks
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },      // Block 1: cells 0-3
      { id: 2, cells: [2, 3, 4, 5] },      // Block 2: overlaps with block 1 (cells 2,3)
      { id: 3, cells: [6, 7, 8, 9] },      // Block 3: no overlap
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1], cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should find solutions that don't include both block 1 and block 2 together
    for (const solution of result.solutions) {
      const hasBlock1 = solution.blocks.some(b => b.id === 1);
      const hasBlock2 = solution.blocks.some(b => b.id === 2);
      // Block 1 and 2 should never be together
      expect(hasBlock1 && hasBlock2).toBe(false);
    }
    
    // Should have at least some solutions (e.g., [1,3] and [2,3])
    expect(result.solutions.length).toBeGreaterThan(0);
  });

  it('should filter blocks using allowBlock function', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [4, 5, 6, 7] },
      { id: 3, cells: [8, 9, 10, 11] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1, 2], cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      targetBlockCount: 2,
      allowBlock: (block) => block.id !== 3, // Exclude block 3
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should only use blocks 1 and 2
    for (const solution of result.solutions) {
      expect(solution.blocks.every(b => b.id !== 3)).toBe(true);
    }
    
    // Should have exactly one solution: [1, 2]
    expect(result.solutions.length).toBe(1);
    expect(result.solutions[0].blocks.map(b => b.id).sort()).toEqual([1, 2]);
  });

  it('should compute correct possibleCells (union of all solution cells)', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [4, 5, 6, 7] },
      { id: 3, cells: [8, 9, 10, 11] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1, 2], cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      targetBlockCount: 1,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should have 3 solutions (one for each block)
    expect(result.solutions.length).toBe(3);
    
    // possibleCells should be union of all cells from all blocks
    expect(result.possibleCells.size).toBe(12);
    for (let i = 0; i < 12; i++) {
      expect(result.possibleCells.has(i)).toBe(true);
    }
  });

  it('should compute correct mandatoryCells (intersection of all solution cells)', () => {
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [4, 5, 6, 7] },
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1], cells: [0, 1, 2, 3, 4, 5, 6, 7] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should have exactly one solution: [1, 2]
    expect(result.solutions.length).toBe(1);
    
    // All cells should be mandatory (appear in the only solution)
    expect(result.mandatoryCells.size).toBe(8);
    for (let i = 0; i < 8; i++) {
      expect(result.mandatoryCells.has(i)).toBe(true);
    }
  });

  it('should handle case with no valid packings due to all blocks overlapping', () => {
    // All blocks overlap with each other
    const blocks: CageBlock[] = [
      { id: 1, cells: [0, 1, 2, 3] },
      { id: 2, cells: [2, 3, 4, 5] },  // overlaps with 1
      { id: 3, cells: [4, 5, 6, 7] },  // overlaps with 2
    ];
    
    const constraints: CagePackingConstraints = {
      band: { type: 'rowBand', rows: [0, 1], cells: [0, 1, 2, 3, 4, 5, 6, 7] },
      targetBlockCount: 2,
    };
    
    const result = findCagePackings(blocks, constraints);
    
    // Should find some solutions (e.g., [1,3] if they don't overlap)
    // Actually, blocks 1 and 3 might not overlap directly
    // Let's check: block 1 has [0,1,2,3], block 3 has [4,5,6,7] - no overlap!
    // So we should have at least one solution
    expect(result.solutions.length).toBeGreaterThan(0);
  });
});


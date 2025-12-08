/**
 * Generic cage packing (exact-cover) helper
 * 
 * Implements exhaustive non-overlapping block packing using backtracking
 * to find all valid packings of a given size.
 */

import type { RowBand, ColumnBand } from '../model/types';

/**
 * A cage block (2×2 block)
 */
export interface CageBlock {
  id: number;
  cells: number[];
}

/**
 * Band-like structure (row band or column band)
 */
export interface BandLike {
  type: 'rowBand' | 'colBand';
  rows?: number[];
  cols?: number[];
  cells: number[];
}

/**
 * Constraints for cage packing
 */
export interface CagePackingConstraints {
  band: BandLike;
  targetBlockCount: number;
  rowRemaining?: Map<number, number>;
  colRemaining?: Map<number, number>;
  allowBlock?: (block: CageBlock) => boolean;
}

/**
 * A single packing solution (set of non-overlapping blocks)
 */
export interface CagePackingSolution {
  blocks: CageBlock[];
}

/**
 * Result of cage packing enumeration
 */
export interface CagePackingResult {
  solutions: CagePackingSolution[];
  possibleCells: Set<number>;
  mandatoryCells: Set<number>;
}

/**
 * Check if two blocks overlap (share at least one cell)
 */
function blocksOverlap(block1: CageBlock, block2: CageBlock): boolean {
  const cells1 = new Set(block1.cells);
  return block2.cells.some(cell => cells1.has(cell));
}

/**
 * Check if a set of blocks are all non-overlapping
 */
function areNonOverlapping(blocks: CageBlock[]): boolean {
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocksOverlap(blocks[i], blocks[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Find all non-overlapping packings of exactly targetBlockCount blocks
 * Uses backtracking to enumerate all valid solutions
 */
export function findCagePackings(
  blocks: CageBlock[],
  constraints: CagePackingConstraints
): CagePackingResult {
  const { targetBlockCount, allowBlock } = constraints;
  
  // Filter blocks using allowBlock if provided
  let filteredBlocks = blocks;
  if (allowBlock) {
    filteredBlocks = blocks.filter(allowBlock);
  }
  
  // If targetBlockCount is 0, return empty solution
  if (targetBlockCount === 0) {
    return {
      solutions: [{ blocks: [] }],
      possibleCells: new Set(),
      mandatoryCells: new Set(),
    };
  }
  
  // If we don't have enough blocks, return no solutions
  if (filteredBlocks.length < targetBlockCount) {
    return {
      solutions: [],
      possibleCells: new Set(),
      mandatoryCells: new Set(),
    };
  }
  
  // Use backtracking to find all non-overlapping subsets of size targetBlockCount
  const solutions: CagePackingSolution[] = [];
  
  function backtrack(
    currentSolution: CageBlock[],
    remainingBlocks: CageBlock[],
    startIndex: number
  ): void {
    // If we've found a complete solution
    if (currentSolution.length === targetBlockCount) {
      solutions.push({ blocks: [...currentSolution] });
      return;
    }
    
    // If we don't have enough remaining blocks to complete the solution
    if (currentSolution.length + remainingBlocks.length < targetBlockCount) {
      return;
    }
    
    // Try adding each remaining block
    for (let i = startIndex; i < remainingBlocks.length; i++) {
      const candidate = remainingBlocks[i];
      
      // Check if candidate overlaps with any block in current solution
      const overlaps = currentSolution.some(block => blocksOverlap(block, candidate));
      
      if (!overlaps) {
        // Add candidate to solution
        currentSolution.push(candidate);
        
        // Continue with remaining blocks
        backtrack(currentSolution, remainingBlocks, i + 1);
        
        // Backtrack: remove candidate
        currentSolution.pop();
      }
    }
  }
  
  // Start backtracking
  backtrack([], filteredBlocks, 0);
  
  // Compute possibleCells (union of all solution cells)
  const possibleCells = new Set<number>();
  for (const solution of solutions) {
    for (const block of solution.blocks) {
      for (const cell of block.cells) {
        possibleCells.add(cell);
      }
    }
  }
  
  // Compute mandatoryCells (intersection of all solution cells)
  // A cell is mandatory if it appears in ALL solutions
  const mandatoryCells = new Set<number>();
  
  if (solutions.length > 0) {
    // Start with cells from first solution
    const firstSolutionCells = new Set<number>();
    for (const block of solutions[0].blocks) {
      for (const cell of block.cells) {
        firstSolutionCells.add(cell);
      }
    }
    
    // Check each cell: it's mandatory if it appears in all solutions
    for (const cell of firstSolutionCells) {
      const appearsInAll = solutions.every(solution => {
        return solution.blocks.some(block => block.cells.includes(cell));
      });
      if (appearsInAll) {
        mandatoryCells.add(cell);
      }
    }
  }
  
  return {
    solutions,
    possibleCells,
    mandatoryCells,
  };
}


import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, BlockDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  getCell,
  formatRow,
  formatCol,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `square-counting-${hintCounter}`;
}

// Shared helpers
function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
  const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
  return block2.some(c => cells1.has(`${c.row},${c.col}`));
}

/**
 * 2x2 Square Counting technique:
 * 
 * For consecutive rows (or columns), if the number of valid 2x2 blocks equals
 * the number of remaining stars needed, then each block must contain exactly one star.
 * If a block has only one empty cell, that cell must be the star.
 */
export function findSquareCountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // Check consecutive pairs of rows
  for (let startRow = 0; startRow <= size - 2; startRow += 1) {
    const rows = [startRow, startRow + 1];
    
    // Count stars needed in these rows
    let totalStarsNeeded = 0;
    let totalStarsPlaced = 0;
    for (const r of rows) {
      const row = rowCells(state, r);
      const rowStars = countStars(state, row);
      totalStarsNeeded += starsPerUnit;
      totalStarsPlaced += rowStars;
    }
    
    const remainingStars = totalStarsNeeded - totalStarsPlaced;
    if (remainingStars <= 0) continue;
    
    // Debug logging for rows 3 & 4 (0-indexed) or rows 0 & 1
    const isDebugCase = (startRow === 3 && size === 10) || (startRow === 0 && size === 10);
    if (isDebugCase) {
      console.log(`[SQUARE COUNTING] Checking rows ${rows[0]} & ${rows[1]}: need ${remainingStars} more stars (${totalStarsPlaced} placed, ${totalStarsNeeded} needed)`);
    }
    
    // Find all valid 2x2 blocks in these rows that can still contain a star
    // A block is valid if:
    // 1. It's fully contained in these rows (top-left at startRow)
    // 2. It doesn't already have a star
    // 3. It has at least one empty cell
    const allValidBlocks: Coords[][] = [];
    
    // Check blocks starting at startRow (spanning rows startRow and startRow+1)
    for (let c = 0; c < size - 1; c += 1) {
      const block: Coords[] = [
        { row: startRow, col: c },
        { row: startRow, col: c + 1 },
        { row: startRow + 1, col: c },
        { row: startRow + 1, col: c + 1 },
      ];
      
      // Check if block already has a star
      const hasStar = block.some(cell => getCell(state, cell) === 'star');
      if (hasStar) continue;
      
      // Check if block has at least one empty cell
      const hasEmpty = block.some(cell => getCell(state, cell) === 'empty');
      if (!hasEmpty) continue;
      
      allValidBlocks.push(block);
      if (isDebugCase) {
        const empties = emptyCells(state, block);
        console.log(`[SQUARE COUNTING] Valid block at (${startRow},${c}): ${empties.length} empty cells: [${empties.map(e => `(${e.row},${e.col})`).join(', ')}]`);
      }
    }
    
    // Find non-overlapping sets of blocks that can contain the required stars
    // Two blocks overlap if they share any cell
    function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
      const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
      return block2.some(c => cells1.has(`${c.row},${c.col}`));
    }
    
    // Find all sets of exactly remainingStars non-overlapping blocks
    function findAllNonOverlappingSets(blocks: Coords[][], targetCount: number): Coords[][][] {
      if (targetCount === 0) return [[]];
      if (blocks.length < targetCount) return [];
      
      // Try all combinations of targetCount blocks
      function combine(arr: Coords[][], k: number): Coords[][][] {
        if (k === 0) return [[]];
        if (k > arr.length) return [];
        
        const result: Coords[][][] = [];
        for (let i = 0; i <= arr.length - k; i++) {
          const head = arr[i];
          const tailCombos = combine(arr.slice(i + 1), k - 1);
          for (const combo of tailCombos) {
            // Check if head doesn't overlap with any block in combo
            const overlaps = combo.some(b => blocksOverlap(head, b));
            if (!overlaps) {
              result.push([head, ...combo]);
            }
          }
        }
        return result;
      }
      
      return combine(blocks, targetCount);
    }
    
    const allNonOverlappingSets = findAllNonOverlappingSets(allValidBlocks, remainingStars);
    
    if (isDebugCase) {
      console.log(`[SQUARE COUNTING] Rows ${startRow},${startRow+1}: Found ${allValidBlocks.length} total valid blocks, ${allNonOverlappingSets.length} set(s) of ${remainingStars} non-overlapping blocks`);
      if (allNonOverlappingSets.length > 0) {
        for (let i = 0; i < allNonOverlappingSets.length; i++) {
          const set = allNonOverlappingSets[i];
          console.log(`[SQUARE COUNTING]   Set ${i+1}: blocks at [${set.map(b => `(${b[0].row},${b[0].col})`).join(', ')}]`);
        }
      }
    }
    
    // The technique only applies when there is exactly ONE set of non-overlapping blocks
    // If there are multiple sets, we can't determine which specific blocks must contain stars
    if (allNonOverlappingSets.length !== 1) continue;
    
    const validBlocks = allNonOverlappingSets[0];
    if (validBlocks.length !== remainingStars) continue;
      
    if (isDebugCase) {
      console.log(`[SQUARE COUNTING] Using unique set with blocks at: [${validBlocks.map(b => `(${b[0].row},${b[0].col})`).join(', ')}]`);
    }
    
    // Collect all cells from all blocks that must contain stars
    const allBlockCells: Coords[] = [];
    for (const block of validBlocks) {
      allBlockCells.push(...block);
    }
    
    // Find blocks with only one empty cell - that cell must be a star
    const forcedStars: Coords[] = [];
    for (const block of validBlocks) {
        const empties = emptyCells(state, block);
        if (empties.length === 1) {
          const forcedStar = empties[0];
          
          // Verify this cell can actually have a star (not adjacent to existing stars)
          // Check adjacency to stars outside the block
          let hasAdjacentStar = false;
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              const nr = forcedStar.row + dr;
              const nc = forcedStar.col + dc;
              if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                // Skip if it's in the same block
                if (block.some(c => c.row === nr && c.col === nc)) continue;
                if (getCell(state, { row: nr, col: nc }) === 'star') {
                  hasAdjacentStar = true;
                  break;
                }
              }
            }
            if (hasAdjacentStar) break;
          }
          
          if (!hasAdjacentStar) {
            // Also check row/column/region quotas
            const row = rowCells(state, forcedStar.row);
            const col = colCells(state, forcedStar.col);
            const regionId = state.def.regions[forcedStar.row][forcedStar.col];
            const region = regionCells(state, regionId);
            
            if (countStars(state, row) < starsPerUnit &&
                countStars(state, col) < starsPerUnit &&
                countStars(state, region) < starsPerUnit) {
              forcedStars.push(forcedStar);
            }
          }
        }
    }
    
    // If we can place any stars, return them with all blocks highlighted
    if (forcedStars.length > 0) {
      const explanation = `${formatUnitList(rows, formatRow)} need ${remainingStars} more star(s), and there are exactly ${validBlocks.length} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star. ${forcedStars.length === 1 ? 'This block has only one empty cell, so it must be a star.' : `${forcedStars.length} of these blocks have only one empty cell each, so those cells must be stars.`}`;
      
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'square-counting',
        resultCells: forcedStars,
        explanation,
        highlights: {
          rows,
          cells: allBlockCells,
        },
      };
    }
  }
  
  // Check consecutive pairs of columns (similar logic)
  for (let startCol = 0; startCol <= size - 2; startCol += 1) {
    const cols = [startCol, startCol + 1];
    
    // Count stars needed in these columns
    let totalStarsNeeded = 0;
    let totalStarsPlaced = 0;
    for (const c of cols) {
      const col = colCells(state, c);
      const colStars = countStars(state, col);
      totalStarsNeeded += starsPerUnit;
      totalStarsPlaced += colStars;
    }
    
    const remainingStars = totalStarsNeeded - totalStarsPlaced;
    if (remainingStars <= 0) continue;
    
    // Find all valid 2x2 blocks in these columns that can still contain a star
    const allValidBlocks: Coords[][] = [];
    
    // Check blocks starting at any row, with left column at startCol
    for (let r = 0; r < size - 1; r += 1) {
      const block: Coords[] = [
        { row: r, col: startCol },
        { row: r, col: startCol + 1 },
        { row: r + 1, col: startCol },
        { row: r + 1, col: startCol + 1 },
      ];
      
      // Check if block already has a star
      const hasStar = block.some(cell => getCell(state, cell) === 'star');
      if (hasStar) continue;
      
      // Check if block has at least one empty cell
      const hasEmpty = block.some(cell => getCell(state, cell) === 'empty');
      if (!hasEmpty) continue;
      
      allValidBlocks.push(block);
    }
    
    // Find all sets of exactly remainingStars non-overlapping blocks
    function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
      const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
      return block2.some(c => cells1.has(`${c.row},${c.col}`));
    }
    
    function findAllNonOverlappingSets(blocks: Coords[][], targetCount: number): Coords[][][] {
      if (targetCount === 0) return [[]];
      if (blocks.length < targetCount) return [];
      
      function combine(arr: Coords[][], k: number): Coords[][][] {
        if (k === 0) return [[]];
        if (k > arr.length) return [];
        
        const result: Coords[][][] = [];
        for (let i = 0; i <= arr.length - k; i++) {
          const head = arr[i];
          const tailCombos = combine(arr.slice(i + 1), k - 1);
          for (const combo of tailCombos) {
            const overlaps = combo.some(b => blocksOverlap(head, b));
            if (!overlaps) {
              result.push([head, ...combo]);
            }
          }
        }
        return result;
      }
      
      return combine(blocks, targetCount);
    }
    
    const allNonOverlappingSets = findAllNonOverlappingSets(allValidBlocks, remainingStars);
    
    // The technique only applies when there is exactly ONE set of non-overlapping blocks
    // If there are multiple sets, we can't determine which specific blocks must contain stars
    if (allNonOverlappingSets.length !== 1) continue;
    
    const validBlocks = allNonOverlappingSets[0];
    if (validBlocks.length !== remainingStars) continue;
    
    // Collect all cells from all blocks that must contain stars
    const allBlockCells: Coords[] = [];
    for (const block of validBlocks) {
      allBlockCells.push(...block);
    }
    
    // Find blocks with only one empty cell - that cell must be a star
    const forcedStars: Coords[] = [];
    for (const block of validBlocks) {
      const empties = emptyCells(state, block);
      if (empties.length === 1) {
        const forcedStar = empties[0];
        
        // Verify this cell can actually have a star (not adjacent to existing stars)
        // Check adjacency to stars outside the block
        let hasAdjacentStar = false;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const nr = forcedStar.row + dr;
            const nc = forcedStar.col + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
              // Skip if it's in the same block
              if (block.some(c => c.row === nr && c.col === nc)) continue;
              if (getCell(state, { row: nr, col: nc }) === 'star') {
                hasAdjacentStar = true;
                break;
              }
            }
          }
          if (hasAdjacentStar) break;
        }
        
        if (!hasAdjacentStar) {
          // Also check row/column/region quotas
          const row = rowCells(state, forcedStar.row);
          const col = colCells(state, forcedStar.col);
          const regionId = state.def.regions[forcedStar.row][forcedStar.col];
          const region = regionCells(state, regionId);
          
          if (countStars(state, row) < starsPerUnit &&
              countStars(state, col) < starsPerUnit &&
              countStars(state, region) < starsPerUnit) {
            forcedStars.push(forcedStar);
          }
        }
      }
    }
    
    // If we can place any stars, return them with all blocks highlighted
    if (forcedStars.length > 0) {
      const explanation = `${formatUnitList(cols, formatCol)} need ${remainingStars} more star(s), and there are exactly ${validBlocks.length} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star. ${forcedStars.length === 1 ? 'This block has only one empty cell, so it must be a star.' : `${forcedStars.length} of these blocks have only one empty cell each, so those cells must be stars.`}`;
      
      return {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'square-counting',
        resultCells: forcedStars,
        explanation,
        highlights: {
          cols,
          cells: allBlockCells,
        },
      };
    }
  }

  return null;
}

function formatUnitList(indices: number[], formatter: (n: number) => string): string {
  if (indices.length === 0) return '';
  if (indices.length === 1) return formatter(indices[0]);
  if (indices.length === 2) return `${formatter(indices[0])} and ${formatter(indices[1])}`;
  const last = indices[indices.length - 1];
  const rest = indices.slice(0, -1);
  return `${rest.map(formatter).join(', ')}, and ${formatter(last)}`;
}

/**
 * Find result with deductions support
 * Returns block deductions when pattern is detected but no forced stars can be placed
 */
export function findSquareCountingResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Check consecutive pairs of rows
  for (let startRow = 0; startRow <= size - 2; startRow += 1) {
    const rows = [startRow, startRow + 1];
    
    // Count stars needed in these rows
    let totalStarsNeeded = 0;
    let totalStarsPlaced = 0;
    for (const r of rows) {
      const row = rowCells(state, r);
      const rowStars = countStars(state, row);
      totalStarsNeeded += starsPerUnit;
      totalStarsPlaced += rowStars;
    }
    
    const remainingStars = totalStarsNeeded - totalStarsPlaced;
    if (remainingStars <= 0) continue;
    
    // Find all valid 2x2 blocks in these rows that can still contain a star
    const allValidBlocks: Coords[][] = [];
    
    // Check blocks starting at startRow (spanning rows startRow and startRow+1)
    for (let c = 0; c < size - 1; c += 1) {
      const block: Coords[] = [
        { row: startRow, col: c },
        { row: startRow, col: c + 1 },
        { row: startRow + 1, col: c },
        { row: startRow + 1, col: c + 1 },
      ];
      
      // Check if block already has a star
      const hasStar = block.some(cell => getCell(state, cell) === 'star');
      if (hasStar) continue;
      
      // Check if block has at least one empty cell
      const hasEmpty = block.some(cell => getCell(state, cell) === 'empty');
      if (!hasEmpty) continue;
      
      allValidBlocks.push(block);
    }
    
    // Find all sets of exactly remainingStars non-overlapping blocks
    function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
      const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
      return block2.some(c => cells1.has(`${c.row},${c.col}`));
    }
    
    function findAllNonOverlappingSets(blocks: Coords[][], targetCount: number): Coords[][][] {
      if (targetCount === 0) return [[]];
      if (blocks.length < targetCount) return [];
      
      function combine(arr: Coords[][], k: number): Coords[][][] {
        if (k === 0) return [[]];
        if (k > arr.length) return [];
        
        const result: Coords[][][] = [];
        for (let i = 0; i <= arr.length - k; i++) {
          const head = arr[i];
          const tailCombos = combine(arr.slice(i + 1), k - 1);
          for (const combo of tailCombos) {
            const overlaps = combo.some(b => blocksOverlap(head, b));
            if (!overlaps) {
              result.push([head, ...combo]);
            }
          }
        }
        return result;
      }
      
      return combine(blocks, targetCount);
    }
    
    const allNonOverlappingSets = findAllNonOverlappingSets(allValidBlocks, remainingStars);
    
    // The technique only applies when there is exactly ONE set of non-overlapping blocks
    // If there are multiple sets, we can't determine which specific blocks must contain stars
    if (allNonOverlappingSets.length === 1) {
      const validBlocks = allNonOverlappingSets[0];
      if (validBlocks.length === remainingStars) {
        // Create block deductions for each block in the unique set
        for (const block of validBlocks) {
          // Use top-left cell coordinates directly (main solver handles square-counting specially)
          const blockDeduction: BlockDeduction = {
            kind: 'block',
            technique: 'square-counting',
            block: { bRow: block[0].row, bCol: block[0].col },
            starsRequired: 1,
            explanation: `${formatUnitList(rows, formatRow)} need ${remainingStars} more star(s), and there are exactly ${allNonOverlappingSets.length} set(s) of ${remainingStars} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star.`,
          };
          deductions.push(blockDeduction);
        }
      }
    }
  }
  
  // Check consecutive pairs of columns (similar logic)
  for (let startCol = 0; startCol <= size - 2; startCol += 1) {
    const cols = [startCol, startCol + 1];
    
    // Count stars needed in these columns
    let totalStarsNeeded = 0;
    let totalStarsPlaced = 0;
    for (const c of cols) {
      const col = colCells(state, c);
      const colStars = countStars(state, col);
      totalStarsNeeded += starsPerUnit;
      totalStarsPlaced += colStars;
    }
    
    const remainingStars = totalStarsNeeded - totalStarsPlaced;
    if (remainingStars <= 0) continue;
    
    // Find all valid 2x2 blocks in these columns that can still contain a star
    const allValidBlocks: Coords[][] = [];
    
    // Check blocks starting at any row, with left column at startCol
    for (let r = 0; r < size - 1; r += 1) {
      const block: Coords[] = [
        { row: r, col: startCol },
        { row: r, col: startCol + 1 },
        { row: r + 1, col: startCol },
        { row: r + 1, col: startCol + 1 },
      ];
      
      // Check if block already has a star
      const hasStar = block.some(cell => getCell(state, cell) === 'star');
      if (hasStar) continue;
      
      // Check if block has at least one empty cell
      const hasEmpty = block.some(cell => getCell(state, cell) === 'empty');
      if (!hasEmpty) continue;
      
      allValidBlocks.push(block);
    }
    
    // Find all sets of exactly remainingStars non-overlapping blocks
    function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
      const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
      return block2.some(c => cells1.has(`${c.row},${c.col}`));
    }
    
    function findAllNonOverlappingSets(blocks: Coords[][], targetCount: number): Coords[][][] {
      if (targetCount === 0) return [[]];
      if (blocks.length < targetCount) return [];
      
      function combine(arr: Coords[][], k: number): Coords[][][] {
        if (k === 0) return [[]];
        if (k > arr.length) return [];
        
        const result: Coords[][][] = [];
        for (let i = 0; i <= arr.length - k; i++) {
          const head = arr[i];
          const tailCombos = combine(arr.slice(i + 1), k - 1);
          for (const combo of tailCombos) {
            const overlaps = combo.some(b => blocksOverlap(head, b));
            if (!overlaps) {
              result.push([head, ...combo]);
            }
          }
        }
        return result;
      }
      
      return combine(blocks, targetCount);
    }
    
    const allNonOverlappingSets = findAllNonOverlappingSets(allValidBlocks, remainingStars);
    
    // The technique only applies when there is exactly ONE set of non-overlapping blocks
    // If there are multiple sets, we can't determine which specific blocks must contain stars
    if (allNonOverlappingSets.length === 1) {
      const validBlocks = allNonOverlappingSets[0];
      if (validBlocks.length === remainingStars) {
        // Create block deductions for each block in the unique set
        for (const block of validBlocks) {
          // Use top-left cell coordinates directly (main solver handles square-counting specially)
          const blockDeduction: BlockDeduction = {
            kind: 'block',
            technique: 'square-counting',
            block: { bRow: block[0].row, bCol: block[0].col },
            starsRequired: 1,
            explanation: `${formatUnitList(cols, formatCol)} need ${remainingStars} more star(s), and there are exactly ${allNonOverlappingSets.length} set(s) of ${remainingStars} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star.`,
          };
          deductions.push(blockDeduction);
        }
      }
    }
  }

  // Try to find a clear hint first (forced star placements)
  const hint = findSquareCountingHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  // If we found deductions but no clear hint, return them for main solver
  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}


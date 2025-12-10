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
import { canPlaceAllStars } from './undercounting';
import { canPlaceAllStarsSimultaneously } from '../constraints/placement';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `square-counting-${hintCounter}`;
}

// Shared helpers
type BlockInfo = {
  cells: Coords[];
  placeable: Coords[];
};

function blocksOverlap(block1: Coords[], block2: Coords[]): boolean {
  const cells1 = new Set(block1.map(c => `${c.row},${c.col}`));
  return block2.some(c => cells1.has(`${c.row},${c.col}`));
}

function blockInfosOverlap(block1: BlockInfo, block2: BlockInfo): boolean {
  return blocksOverlap(block1.cells, block2.cells);
}

function findNonOverlappingSetsLimited(
  blocks: BlockInfo[],
  targetCount: number,
  maxSets: number,
): BlockInfo[][] {
  const result: BlockInfo[][] = [];
  const chosen: BlockInfo[] = [];

  function backtrack(start: number): boolean {
    if (chosen.length === targetCount) {
      result.push([...chosen]);
      return result.length < maxSets;
    }

    for (let i = start; i < blocks.length; i += 1) {
      const block = blocks[i];
      if (chosen.some(b => blockInfosOverlap(b, block))) continue;

      chosen.push(block);
      const shouldContinue = backtrack(i + 1);
      chosen.pop();
      if (!shouldContinue) return false;
    }

    return true;
  }

  backtrack(0);
  return result;
}

function hasValidPlacement(
  state: PuzzleState,
  blocks: BlockInfo[],
  starsPerUnit: number,
): boolean {
  if (blocks.some(block => block.placeable.length === 0)) {
    return false;
  }

  const sortedBlocks = [...blocks].sort(
    (a, b) => a.placeable.length - b.placeable.length,
  );

  function search(index: number, chosen: Coords[]): boolean {
    if (index === sortedBlocks.length) {
      return true;
    }

    for (const cell of sortedBlocks[index].placeable) {
      const nextChosen = [...chosen, cell];
      if (
        canPlaceAllStarsSimultaneously(state, nextChosen, starsPerUnit) !== null &&
        search(index + 1, nextChosen)
      ) {
        return true;
      }
    }

    return false;
  }

  return search(0, []);
}

function buildRowBlocks(
  state: PuzzleState,
  startRow: number,
  placeableFn: (block: Coords[]) => Coords[],
): BlockInfo[] {
  const { size } = state.def;
  const allValidBlocks: BlockInfo[] = [];

  for (let c = 0; c < size - 1; c += 1) {
    const blockCells: Coords[] = [
      { row: startRow, col: c },
      { row: startRow, col: c + 1 },
      { row: startRow + 1, col: c },
      { row: startRow + 1, col: c + 1 },
    ];

    if (blockCells.some(cell => getCell(state, cell) === 'star')) continue;

    const placeable = placeableFn(blockCells);
    if (placeable.length === 0) continue;

    allValidBlocks.push({ cells: blockCells, placeable });
  }

  return allValidBlocks;
}

function buildColumnBlocks(
  state: PuzzleState,
  startCol: number,
  placeableFn: (block: Coords[]) => Coords[],
): BlockInfo[] {
  const { size } = state.def;
  const allValidBlocks: BlockInfo[] = [];

  for (let r = 0; r < size - 1; r += 1) {
    const blockCells: Coords[] = [
      { row: r, col: startCol },
      { row: r, col: startCol + 1 },
      { row: r + 1, col: startCol },
      { row: r + 1, col: startCol + 1 },
    ];

    if (blockCells.some(cell => getCell(state, cell) === 'star')) continue;

    const placeable = placeableFn(blockCells);
    if (placeable.length === 0) continue;

    allValidBlocks.push({ cells: blockCells, placeable });
  }

  return allValidBlocks;
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
  let bestHint: { hint: Hint; score: number } | null = null;

  const rowPlaceable = (block: Coords[]): Coords[] =>
    emptyCells(state, block).filter(
      cell => canPlaceAllStarsSimultaneously(state, [cell], starsPerUnit) !== null,
    );

  const colPlaceable = (block: Coords[]): Coords[] =>
    emptyCells(state, block).filter(cell => canPlaceAllStars(state, [cell]));

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

    const allValidBlocks = buildRowBlocks(state, startRow, rowPlaceable);
    if (allValidBlocks.length < remainingStars) continue;

    const allNonOverlappingSets = findNonOverlappingSetsLimited(
      allValidBlocks,
      remainingStars,
      2,
    );

    const feasibleSets = allNonOverlappingSets.filter(set =>
      hasValidPlacement(state, set, starsPerUnit),
    );
    
    if (isDebugCase) {
      console.log(`[SQUARE COUNTING] Rows ${startRow},${startRow+1}: Found ${allValidBlocks.length} total valid blocks, ${allNonOverlappingSets.length} set(s) of ${remainingStars} non-overlapping blocks`);
      if (allNonOverlappingSets.length > 0) {
        for (let i = 0; i < allNonOverlappingSets.length; i++) {
          const set = allNonOverlappingSets[i];
          console.log(`[SQUARE COUNTING]   Set ${i+1}: blocks at [${set.map(b => `(${b.cells[0].row},${b.cells[0].col})`).join(', ')}]`);
        }
      }
    }
    
    if (feasibleSets.length === 0) continue;

    // If multiple feasible sets remain, we can still act on cells that are forced in every set
    const candidateSets =
      feasibleSets.length === 1
        ? feasibleSets
        : feasibleSets.filter(set => set.length === remainingStars);
    if (candidateSets.length === 0) continue;

    const validBlocks = candidateSets[0];
    if (validBlocks.length !== remainingStars) continue;

    if (isDebugCase) {
      console.log(`[SQUARE COUNTING] Using unique set with blocks at: [${validBlocks.map(b => `(${b.cells[0].row},${b.cells[0].col})`).join(', ')}]`);
    }
    
    // Collect all cells from all blocks that must contain stars
    const allBlockCells: Coords[] = [];
    for (const block of validBlocks) {
      allBlockCells.push(...block.cells);
    }
    
    // Find blocks with only one empty cell - that cell must be a star
    const forcedStars: Coords[] = [];
    const forcedAcrossSets: Coords[] | null = candidateSets.length === 1 ? null : (() => {
      let intersection: Coords[] | null = null;

      for (const set of candidateSets) {
        const forcedInSet = set.flatMap(block =>
          block.placeable.length === 1 ? block.placeable : [],
        );

        if (intersection === null) {
          intersection = forcedInSet;
        } else {
          const forcedKeys = new Set(forcedInSet.map(c => `${c.row},${c.col}`));
          intersection = intersection.filter(c => forcedKeys.has(`${c.row},${c.col}`));
        }
      }

      return intersection && intersection.length > 0 ? intersection : null;
    })();

    const targetBlocks = candidateSets[0];

    for (const block of targetBlocks) {
      if (block.placeable.length === 1) {
        const forcedStar = block.placeable[0];
          
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
                if (block.cells.some(c => c.row === nr && c.col === nc)) continue;
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

          if (
            countStars(state, row) < starsPerUnit &&
            countStars(state, col) < starsPerUnit &&
            countStars(state, region) < starsPerUnit
          ) {
            forcedStars.push(forcedStar);
          }
        }
      }
    }

    // If there are multiple feasible sets, only act when they force the same cells
    if (candidateSets.length > 1 && !forcedAcrossSets) {
      continue;
    }

    // If we can place any stars, return them with all blocks highlighted
    const sharedForced = forcedAcrossSets ?? forcedStars;

    if (sharedForced.length > 0) {
      const explanation = candidateSets.length === 1
        ? `${formatUnitList(rows, formatRow)} need ${remainingStars} more star(s), and there are exactly ${validBlocks.length} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star. ${sharedForced.length === 1 ? 'This block has only one empty cell, so it must be a star.' : `${sharedForced.length} of these blocks have only one empty cell each, so those cells must be stars.`}`
        : `${formatUnitList(rows, formatRow)} need ${remainingStars} more star(s). Every feasible arrangement of ${remainingStars} non-overlapping 2×2 block(s) forces star(s) at ${sharedForced.map(c => `(${c.row},${c.col})`).join(', ')}.`;

      const candidateHint: Hint = {
        id: nextHintId(),
        kind: 'place-star',
        technique: 'square-counting',
        resultCells: sharedForced,
        explanation,
        highlights: {
          rows,
          cells: allBlockCells,
        },
      };

      const score = sharedForced.length * 100 + remainingStars;
      if (!bestHint || score > bestHint.score) {
        bestHint = { hint: candidateHint, score };
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

    const allValidBlocks = buildColumnBlocks(state, startCol, colPlaceable);
    if (allValidBlocks.length < remainingStars) continue;

    const allNonOverlappingSets = findNonOverlappingSetsLimited(
      allValidBlocks,
      remainingStars,
      2,
    );

    if (allNonOverlappingSets.length !== 1) continue;

    const validBlocks = allNonOverlappingSets[0];
    if (validBlocks.length !== remainingStars) continue;

    const allBlockCells: Coords[] = validBlocks.flatMap(block => block.cells);

    const forcedStars: Coords[] = [];
    for (const block of validBlocks) {
      if (block.placeable.length === 1) {
        const forcedStar = block.placeable[0];
        
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
          if (block.cells.some(c => c.row === nr && c.col === nc)) continue;
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
          
          if (
            countStars(state, row) < starsPerUnit &&
            countStars(state, col) < starsPerUnit &&
            countStars(state, region) < starsPerUnit
          ) {
            forcedStars.push(forcedStar);
          }
        }
      }
    }
    
    // If we can place any stars, return them with all blocks highlighted
    if (forcedStars.length > 0) {
      const explanation = `${formatUnitList(cols, formatCol)} need ${remainingStars} more star(s), and there are exactly ${validBlocks.length} non-overlapping 2×2 block(s) where stars can be placed. Each block must contain exactly one star. ${forcedStars.length === 1 ? 'This block has only one empty cell, so it must be a star.' : `${forcedStars.length} of these blocks have only one empty cell each, so those cells must be stars.`}`;

      const candidateHint: Hint = {
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

      const score = forcedStars.length * 100 + remainingStars;
      if (!bestHint || score > bestHint.score) {
        bestHint = { hint: candidateHint, score };
      }
    }
  }

  return bestHint?.hint ?? null;
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

  const rowPlaceable = (block: Coords[]): Coords[] => emptyCells(state, block);
  const colPlaceable = (block: Coords[]): Coords[] => emptyCells(state, block);

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

    const allValidBlocks = buildRowBlocks(state, startRow, rowPlaceable);
    if (allValidBlocks.length < remainingStars) continue;

    const allNonOverlappingSets = findNonOverlappingSetsLimited(
      allValidBlocks,
      remainingStars,
      2,
    );

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
            block: { bRow: block.cells[0].row, bCol: block.cells[0].col },
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

    const allValidBlocks = buildColumnBlocks(state, startCol, colPlaceable);
    if (allValidBlocks.length < remainingStars) continue;

    const allNonOverlappingSets = findNonOverlappingSetsLimited(
      allValidBlocks,
      remainingStars,
      2,
    );

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
            block: { bRow: block.cells[0].row, bCol: block.cells[0].col },
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


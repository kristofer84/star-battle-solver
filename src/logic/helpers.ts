import type { PuzzleState, Coords, CellState } from '../types/puzzle';

export function rowCells(state: PuzzleState, row: number): Coords[] {
  const { size } = state.def;
  const cells: Coords[] = [];
  for (let c = 0; c < size; c += 1) {
    cells.push({ row, col: c });
  }
  return cells;
}

export function colCells(state: PuzzleState, col: number): Coords[] {
  const { size } = state.def;
  const cells: Coords[] = [];
  for (let r = 0; r < size; r += 1) {
    cells.push({ row: r, col });
  }
  return cells;
}

export function regionCells(state: PuzzleState, regionId: number): Coords[] {
  const coords: Coords[] = [];
  for (let r = 0; r < state.def.size; r += 1) {
    for (let c = 0; c < state.def.size; c += 1) {
      if (state.def.regions[r][c] === regionId) {
        coords.push({ row: r, col: c });
      }
    }
  }
  return coords;
}

export function getCell(state: PuzzleState, { row, col }: Coords): CellState {
  return state.cells[row][col];
}

export function countStars(state: PuzzleState, cells: Coords[]): number {
  return cells.reduce((acc, c) => (getCell(state, c) === 'star' ? acc + 1 : acc), 0);
}

export function countCrosses(state: PuzzleState, cells: Coords[]): number {
  return cells.reduce((acc, c) => (getCell(state, c) === 'cross' ? acc + 1 : acc), 0);
}

export function emptyCells(state: PuzzleState, cells: Coords[]): Coords[] {
  return cells.filter((c) => getCell(state, c) === 'empty');
}

export function neighbors8(coord: Coords, size: number): Coords[] {
  const result: Coords[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = coord.row + dr;
      const nc = coord.col + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        result.push({ row: nr, col: nc });
      }
    }
  }
  return result;
}

// ============================================================================
// Set Operations
// ============================================================================

function coordsEqual(a: Coords, b: Coords): boolean {
  return a.row === b.row && a.col === b.col;
}

function deduplicate(coords: Coords[]): Coords[] {
  const result: Coords[] = [];
  for (const coord of coords) {
    if (!result.some((c) => coordsEqual(c, coord))) {
      result.push(coord);
    }
  }
  return result;
}

export function intersection(a: Coords[], b: Coords[]): Coords[] {
  const deduped = deduplicate(a.filter((coordA) => b.some((coordB) => coordsEqual(coordA, coordB))));
  return deduped;
}

export function union(a: Coords[], b: Coords[]): Coords[] {
  const result = [...a];
  for (const coordB of b) {
    if (!a.some((coordA) => coordsEqual(coordA, coordB))) {
      result.push(coordB);
    }
  }
  return deduplicate(result);
}

export function difference(a: Coords[], b: Coords[]): Coords[] {
  return deduplicate(a.filter((coordA) => !b.some((coordB) => coordsEqual(coordA, coordB))));
}

// ============================================================================
// Composite Shape Analysis
// ============================================================================

export interface CompositeShape {
  cells: Coords[];
  regions: Set<number>;
  rows: Set<number>;
  cols: Set<number>;
  minStars: number;
  maxStars: number;
}

export function findCompositeShape(state: PuzzleState, cells: Coords[]): CompositeShape {
  const regions = new Set<number>();
  const rows = new Set<number>();
  const cols = new Set<number>();

  for (const cell of cells) {
    regions.add(state.def.regions[cell.row][cell.col]);
    rows.add(cell.row);
    cols.add(cell.col);
  }

  const minStars = computeMinStars(state, cells);
  const maxStars = computeMaxStars(state, cells);

  return { cells, regions, rows, cols, minStars, maxStars };
}

// ============================================================================
// Min/Max Star Computation with 2×2 Constraints
// ============================================================================

export function computeMinStars(state: PuzzleState, cells: Coords[]): number {
  // Minimum stars is the number of stars already placed in the shape
  // This is a conservative estimate - more sophisticated analysis could
  // derive higher minimums based on unit quotas
  return countStars(state, cells);
}

export function computeMaxStars(state: PuzzleState, cells: Coords[]): number {
  // Start with the number of empty cells + existing stars
  const existingStars = countStars(state, cells);
  const empties = emptyCells(state, cells);
  
  // Maximum is constrained by 2×2 blocks and adjacency
  // For now, use a simple upper bound: existing stars + empty cells
  // More sophisticated analysis would consider 2×2 tiling constraints
  let maxPossible = existingStars + empties.length;
  
  // Apply 2×2 constraint: find all 2×2 blocks within the shape
  // and reduce max if blocks already have stars
  const twoByTwoBlocks = findTwoByTwoBlocks(state, cells);
  for (const block of twoByTwoBlocks) {
    const starsInBlock = countStars(state, block);
    if (starsInBlock >= 1) {
      // This block can have at most 1 star, so reduce max by the number
      // of empties in this block (they can't all be stars)
      const emptiesInBlock = emptyCells(state, block);
      maxPossible -= emptiesInBlock.length;
    }
  }
  
  return Math.max(existingStars, maxPossible);
}

export function findTwoByTwoBlocks(state: PuzzleState, cells: Coords[]): Coords[][] {
  const blocks: Coords[][] = [];
  const cellSet = new Set(cells.map((c) => `${c.row},${c.col}`));
  
  // Scan for all 2×2 blocks that are fully contained in the cell set
  for (let r = 0; r < state.def.size - 1; r += 1) {
    for (let c = 0; c < state.def.size - 1; c += 1) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      
      // Check if all 4 cells are in the input cell set
      if (block.every((cell) => cellSet.has(`${cell.row},${cell.col}`))) {
        blocks.push(block);
      }
    }
  }
  
  return blocks;
}

export function maxStarsWithTwoByTwo(state: PuzzleState, cells: Coords[], existingStars: Coords[]): number {
  // More sophisticated max star computation considering 2×2 constraints
  // This is used by overcounting technique
  const existing = countStars(state, cells);
  const empties = emptyCells(state, cells);
  
  // Use a greedy approach: try to place as many stars as possible
  // while respecting 2×2 constraints
  let maxCount = existing;
  const placed = new Set(existingStars.map((c) => `${c.row},${c.col}`));
  
  for (const empty of empties) {
    // Check if placing a star here would violate 2×2 constraint
    let canPlace = true;
    
    // Check all 2×2 blocks containing this cell
    for (let dr = -1; dr <= 0; dr += 1) {
      for (let dc = -1; dc <= 0; dc += 1) {
        const blockTopLeft = { row: empty.row + dr, col: empty.col + dc };
        if (
          blockTopLeft.row >= 0 &&
          blockTopLeft.col >= 0 &&
          blockTopLeft.row < state.def.size - 1 &&
          blockTopLeft.col < state.def.size - 1
        ) {
          const block: Coords[] = [
            blockTopLeft,
            { row: blockTopLeft.row, col: blockTopLeft.col + 1 },
            { row: blockTopLeft.row + 1, col: blockTopLeft.col },
            { row: blockTopLeft.row + 1, col: blockTopLeft.col + 1 },
          ];
          
          // Count stars already in this block
          const starsInBlock = block.filter((c) => placed.has(`${c.row},${c.col}`)).length;
          if (starsInBlock >= 1) {
            canPlace = false;
            break;
          }
        }
      }
      if (!canPlace) break;
    }
    
    if (canPlace) {
      maxCount += 1;
      placed.add(`${empty.row},${empty.col}`);
    }
  }
  
  return maxCount;
}



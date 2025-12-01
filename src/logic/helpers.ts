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

// ============================================================================
// Pattern Matching for Idiosyncratic Techniques
// ============================================================================

export interface LShapePattern {
  regionId: number;
  cells: Coords[];
  corner: Coords;
  arms: { horizontal: Coords[]; vertical: Coords[] };
}

export interface MShapePattern {
  regionId: number;
  cells: Coords[];
  peaks: Coords[];
  valley: Coords;
}

export interface TShapePattern {
  regionId: number;
  cells: Coords[];
  stem: Coords[];
  crossbar: Coords[];
}

/**
 * Detect L-shaped regions in the puzzle.
 * An L-shape consists of a corner cell with one horizontal arm and one vertical arm.
 */
export function findLShapes(state: PuzzleState): LShapePattern[] {
  const patterns: LShapePattern[] = [];
  const numRegions = 10; // Standard Star Battle has 10 regions
  
  for (let regionId = 1; regionId <= numRegions; regionId += 1) {
    const cells = regionCells(state, regionId);
    
    // An L-shape needs at least 3 cells
    if (cells.length < 3) continue;
    
    // Try each cell as a potential corner
    for (const corner of cells) {
      // Find cells in the same row (horizontal arm)
      const horizontal = cells.filter(
        (c) => c.row === corner.row && c.col !== corner.col
      );
      
      // Find cells in the same column (vertical arm)
      const vertical = cells.filter(
        (c) => c.col === corner.col && c.row !== corner.row
      );
      
      // Valid L-shape: corner + at least one cell in each arm
      // and no other cells outside these arms
      if (horizontal.length > 0 && vertical.length > 0) {
        const lShapeCells = [corner, ...horizontal, ...vertical];
        
        // Check if all region cells are part of the L-shape
        if (lShapeCells.length === cells.length) {
          patterns.push({
            regionId,
            cells,
            corner,
            arms: { horizontal, vertical },
          });
          break; // Found L-shape for this region, move to next region
        }
      }
    }
  }
  
  return patterns;
}

/**
 * Detect M-shaped regions in the puzzle.
 * An M-shape has two peaks (local maxima in row position) and a valley between them.
 */
export function findMShapes(state: PuzzleState): MShapePattern[] {
  const patterns: MShapePattern[] = [];
  const numRegions = 10;
  
  for (let regionId = 1; regionId <= numRegions; regionId += 1) {
    const cells = regionCells(state, regionId);
    
    // An M-shape needs at least 5 cells (2 peaks, valley, and connecting cells)
    if (cells.length < 5) continue;
    
    // Group cells by column to analyze vertical structure
    const colGroups = new Map<number, Coords[]>();
    for (const cell of cells) {
      if (!colGroups.has(cell.col)) {
        colGroups.set(cell.col, []);
      }
      colGroups.get(cell.col)!.push(cell);
    }
    
    // M-shape should span at least 3 columns
    if (colGroups.size < 3) continue;
    
    const sortedCols = Array.from(colGroups.keys()).sort((a, b) => a - b);
    
    // Look for M pattern: high-low-high in terms of row positions
    // Find peaks (columns where cells extend to higher rows than neighbors)
    const peaks: Coords[] = [];
    let valley: Coords | null = null;
    
    for (let i = 0; i < sortedCols.length; i += 1) {
      const col = sortedCols[i];
      const cellsInCol = colGroups.get(col)!;
      const minRow = Math.min(...cellsInCol.map((c) => c.row));
      
      // Check if this is a peak (lower row number = higher on grid)
      const isPeak =
        (i === 0 || minRow < Math.min(...colGroups.get(sortedCols[i - 1])!.map((c) => c.row))) &&
        (i === sortedCols.length - 1 || minRow < Math.min(...colGroups.get(sortedCols[i + 1])!.map((c) => c.row)));
      
      if (isPeak) {
        peaks.push(cellsInCol.find((c) => c.row === minRow)!);
      }
      
      // Check if this is a valley (higher row number = lower on grid)
      const isValley =
        i > 0 &&
        i < sortedCols.length - 1 &&
        minRow > Math.min(...colGroups.get(sortedCols[i - 1])!.map((c) => c.row)) &&
        minRow > Math.min(...colGroups.get(sortedCols[i + 1])!.map((c) => c.row));
      
      if (isValley && !valley) {
        valley = cellsInCol.find((c) => c.row === minRow)!;
      }
    }
    
    // Valid M-shape: exactly 2 peaks and 1 valley
    if (peaks.length === 2 && valley) {
      patterns.push({
        regionId,
        cells,
        peaks,
        valley,
      });
    }
  }
  
  return patterns;
}

/**
 * Detect T-shaped regions in the puzzle.
 * A T-shape has a horizontal crossbar and a vertical stem extending from it.
 */
export function findTShapes(state: PuzzleState): TShapePattern[] {
  const patterns: TShapePattern[] = [];
  const numRegions = 10;
  
  for (let regionId = 1; regionId <= numRegions; regionId += 1) {
    const cells = regionCells(state, regionId);
    
    // A T-shape needs at least 4 cells (3 for crossbar, 1+ for stem)
    if (cells.length < 4) continue;
    
    // Try to find a horizontal crossbar (3+ cells in same row)
    const rowGroups = new Map<number, Coords[]>();
    for (const cell of cells) {
      if (!rowGroups.has(cell.row)) {
        rowGroups.set(cell.row, []);
      }
      rowGroups.get(cell.row)!.push(cell);
    }
    
    for (const [row, crossbarCells] of rowGroups) {
      if (crossbarCells.length < 3) continue;
      
      // Sort crossbar cells by column
      crossbarCells.sort((a, b) => a.col - b.col);
      
      // Check if crossbar is contiguous
      let isContiguous = true;
      for (let i = 1; i < crossbarCells.length; i += 1) {
        if (crossbarCells[i].col !== crossbarCells[i - 1].col + 1) {
          isContiguous = false;
          break;
        }
      }
      
      if (!isContiguous) continue;
      
      // Find the middle of the crossbar
      const middleIdx = Math.floor(crossbarCells.length / 2);
      const middleCol = crossbarCells[middleIdx].col;
      
      // Find stem cells (cells in same column as middle, different row)
      const stem = cells.filter(
        (c) => c.col === middleCol && c.row !== row
      );
      
      // Valid T-shape: crossbar + at least one stem cell
      // and all cells are accounted for
      if (stem.length > 0) {
        const tShapeCells = [...crossbarCells, ...stem];
        
        if (tShapeCells.length === cells.length) {
          patterns.push({
            regionId,
            cells,
            stem,
            crossbar: crossbarCells,
          });
          break; // Found T-shape for this region
        }
      }
    }
    
    // Also try vertical crossbar with horizontal stem
    const colGroups = new Map<number, Coords[]>();
    for (const cell of cells) {
      if (!colGroups.has(cell.col)) {
        colGroups.set(cell.col, []);
      }
      colGroups.get(cell.col)!.push(cell);
    }
    
    for (const [col, crossbarCells] of colGroups) {
      if (crossbarCells.length < 3) continue;
      
      // Sort crossbar cells by row
      crossbarCells.sort((a, b) => a.row - b.row);
      
      // Check if crossbar is contiguous
      let isContiguous = true;
      for (let i = 1; i < crossbarCells.length; i += 1) {
        if (crossbarCells[i].row !== crossbarCells[i - 1].row + 1) {
          isContiguous = false;
          break;
        }
      }
      
      if (!isContiguous) continue;
      
      // Find the middle of the crossbar
      const middleIdx = Math.floor(crossbarCells.length / 2);
      const middleRow = crossbarCells[middleIdx].row;
      
      // Find stem cells (cells in same row as middle, different column)
      const stem = cells.filter(
        (c) => c.row === middleRow && c.col !== col
      );
      
      // Valid T-shape: crossbar + at least one stem cell
      // and all cells are accounted for
      if (stem.length > 0) {
        const tShapeCells = [...crossbarCells, ...stem];
        
        if (tShapeCells.length === cells.length) {
          patterns.push({
            regionId,
            cells,
            stem,
            crossbar: crossbarCells,
          });
          break; // Found T-shape for this region
        }
      }
    }
  }
  
  return patterns;
}



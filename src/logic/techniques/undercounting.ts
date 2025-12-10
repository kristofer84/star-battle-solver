import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaRelationDeduction, ExclusiveSetDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  union,
  intersection,
  neighbors8,
  getCell,
  difference,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';
import { countSolutions } from '../search';

/**
 * Check if placing stars in all given cells would violate adjacency or 2×2 constraints
 */
export function canPlaceAllStars(state: PuzzleState, cells: Coords[]): boolean {
  const { size } = state.def;
  
  // Check for adjacency violations: no two stars can be adjacent (including diagonally)
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const cell1 = cells[i];
      const cell2 = cells[j];
      
      // Check if cells are adjacent (including diagonally)
      const rowDiff = Math.abs(cell1.row - cell2.row);
      const colDiff = Math.abs(cell1.col - cell2.col);
      if (rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0)) {
        return false; // Adjacent cells cannot both be stars
      }
    }
    
    // Also check adjacency with existing stars
    const neighbors = neighbors8(cells[i], size);
    for (const neighbor of neighbors) {
      if (state.cells[neighbor.row][neighbor.col] === 'star') {
        return false; // Would be adjacent to existing star
      }
    }
  }
  
  // Check for 2×2 violations: no 2×2 block can have more than 1 star
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const block: Coords[] = [
        { row: r, col: c },
        { row: r, col: c + 1 },
        { row: r + 1, col: c },
        { row: r + 1, col: c + 1 },
      ];
      
      // Count how many of the cells we're placing stars in are in this block
      let starsInBlock = 0;
      for (const cell of cells) {
        if (block.some(b => b.row === cell.row && b.col === cell.col)) {
          starsInBlock++;
        }
      }
      
      // Also count existing stars in this block
      for (const blockCell of block) {
        if (state.cells[blockCell.row][blockCell.col] === 'star') {
          starsInBlock++;
        }
      }
      
      if (starsInBlock > 1) {
        return false; // Would create a 2×2 block with more than 1 star
      }
    }
  }
  
  return true;
}

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `undercounting-${hintCounter}`;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];

  const [first, ...rest] = items;
  const withFirst = combinations(rest, k - 1).map((combo) => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function uniqueCells(cells: Coords[]): Coords[] {
  const seen = new Set<string>();
  const result: Coords[] = [];

  for (const cell of cells) {
    const key = `${cell.row},${cell.col}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cell);
    }
  }

  return result;
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
 * Shallow clone of a puzzle state for hypothesis testing
 */
function cloneState(state: PuzzleState): PuzzleState {
  return {
    def: state.def,
    cells: state.cells.map((row) => [...row]),
  };
}

/**
 * Undercounting technique:
 * 
 * Identifies composite shapes (unions of regions or partial regions) where
 * the minimum number of stars that must be placed equals the number of
 * empty cells, forcing all those cells to be stars.
 * 
 * The minimum star count considers:
 * - Stars already placed in the shape
 * - Unit quotas that must be satisfied
 * - 2×2 constraints that limit placement
 * - Adjacency rules
 */
export function findUndercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const startTime = performance.now();
  const timings: Record<string, number> = {};
  let checksPerformed = 0;
  let patternsChecked = {
    rowRegion: 0,
    colRegion: 0,
    multiRegionRow: 0,
    multiRowRegion: 0,
    multiColRegion: 0,
    generalizedRows: 0,
    generalizedCols: 0,
    confinedRegionsRows: 0,
    confinedRegionsCols: 0,
  };

  // Strategy: Look for composite shapes formed by intersections of units
  // where the minimum star count forces specific cells to be stars

  // Precompute row, column, and region data
  const rowData = Array.from({ length: size }, (_, r) => {
    const cells = rowCells(state, r);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  const colData = Array.from({ length: size }, (_, c) => {
    const cells = colCells(state, c);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  const regionData = Array.from({ length: size + 1 }, (_, id) => {
    if (id === 0) return null; // 1-based regions
    const cells = regionCells(state, id);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  // FIRST: Check for star placements (prioritize star hints over cross hints)
  
  // Try intersections of rows with regions
  const rowRegionStart = performance.now();
  for (let r = 0; r < size; r += 1) {
    const row = rowData[r].cells;
    const rowRemaining = rowData[r].remaining;
    
    if (rowRemaining <= 0) continue;
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      patternsChecked.rowRegion++;
      checksPerformed++;
      const region = regionData[regionId]!.cells;
      const regionRemaining = regionData[regionId]!.remaining;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of row and region, excluding crosses
      // Crosses should not count to the areas for counting purposes
      const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(rowNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Calculate cells outside the intersection (excluding crosses)
      const rowOutsideIntersection = difference(rowNonCrosses, shape);
      const regionOutsideIntersection = difference(regionNonCrosses, shape);
      
      // Count empty cells outside the intersection
      const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      // Compute minimum stars that MUST be in the intersection
      // This considers that the row/region could get stars from outside the intersection
      const minStarsInIntersection = Math.max(
        0,
        rowRemaining - emptyCellsInRowOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minimum equals the number of empty cells in the intersection,
      // all empty cells must be stars
      if (minStarsInIntersection === empties.length && empties.length > 0) {
        // Validate that placing stars in ALL empty cells doesn't violate constraints
        if (!canPlaceAllStars(state, empties)) {
          continue; // Skip if placing all stars would violate constraints
        }

        // EXTRA SAFETY GUARD:
        // Do not let undercounting place stars if it would exhaust all remaining
        // candidates in any containing row or column. This prevents over-committing to
        // a solution path that might be incorrect.
        // Check the row
        const rowEmpties = rowData[r].empties;
        const rowEmptiesAfter = rowEmpties.filter(e => 
          !empties.some(emp => emp.row === e.row && emp.col === e.col)
        ).length;
        if (rowRemaining > rowEmptiesAfter) {
          continue; // Would exhaust the row
        }
        // Check all affected columns
        const affectedCols = new Set(empties.map(e => e.col));
        let wouldExhaustColumn = false;
        for (const colIdx of affectedCols) {
          const colEmpties = colData[colIdx].empties;
          const colRemainingStars = colData[colIdx].remaining;
          const colEmptiesAfter = colEmpties.filter(e => 
            !empties.some(emp => emp.row === e.row && emp.col === e.col)
          ).length;
          if (colRemainingStars > colEmptiesAfter) {
            wouldExhaustColumn = true;
            break;
          }
        }
        if (wouldExhaustColumn) {
          continue; // Would exhaust a column - skip this hint
        }

        // EXTRA SOUNDNESS CHECK FOR SINGLETON INTERSECTIONS:
        // When there is exactly one empty cell in this intersection, we are
        // claiming that this specific cell MUST be a star. Before we commit
        // to that, verify that marking it as a cross would truly make the
        // puzzle unsatisfiable (i.e. no valid completion remains).
        if (empties.length === 1) {
          const [forcedStar] = empties;
          const crossState = cloneState(state);
          crossState.cells[forcedStar.row][forcedStar.col] = 'cross';
          const sol = countSolutions(crossState, {
            maxCount: 1,
            timeoutMs: 2000,
            maxDepth: 200,
          });
          // If there is still at least one solution with this cell as a cross,
          // then it is not logically forced to be a star, so we skip this hint.
          if (!sol.timedOut && sol.count > 0) {
            continue;
          }
        }

        const explanation = `${formatRow(r)} needs ${rowRemaining} more star(s) and region ${formatRegions([regionId])} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        console.log(`[UNDERCOUNTING] Found star hint via: row∩region`);
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties, // Return ALL empty cells, not just one
          explanation,
          highlights: {
            rows: [r],
            regions: [regionId],
            cells: empties,
          },
        };
      }
    }
  }
  timings.rowRegion = performance.now() - rowRegionStart;
  
  // Try intersections of columns with regions
  const colRegionStart = performance.now();
  for (let c = 0; c < size; c += 1) {
    const col = colData[c].cells;
    const colRemaining = colData[c].remaining;
    
    if (colRemaining <= 0) continue;
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      patternsChecked.colRegion++;
      checksPerformed++;
      const region = regionData[regionId]!.cells;
      const regionRemaining = regionData[regionId]!.remaining;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of column and region, excluding crosses
      // Crosses should not count to the areas for counting purposes
      const colNonCrosses = col.filter(c => getCell(state, c) !== 'cross');
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(colNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Calculate cells outside the intersection (excluding crosses)
      const colOutsideIntersection = difference(colNonCrosses, shape);
      const regionOutsideIntersection = difference(regionNonCrosses, shape);
      
      // Count empty cells outside the intersection
      const emptyCellsInColOutside = emptyCells(state, colOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      // Compute minimum stars that MUST be in the intersection
      // This considers that the column/region could get stars from outside the intersection
      const minStarsInIntersection = Math.max(
        0,
        colRemaining - emptyCellsInColOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minimum equals the number of empty cells in the intersection,
      // all empty cells must be stars
      if (minStarsInIntersection === empties.length && empties.length > 0) {
        // Validate that placing stars in ALL empty cells doesn't violate constraints
        if (!canPlaceAllStars(state, empties)) {
          continue; // Skip if placing all stars would violate constraints
        }

        // EXTRA SAFETY GUARD: Check if placing stars would exhaust the column
        const colEmpties = colData[c].empties;
        const emptiesAfter = colEmpties.filter(e => 
          !empties.some(emp => emp.row === e.row && emp.col === e.col)
        ).length;
        if (colRemaining > emptiesAfter) {
          continue; // Would exhaust the column
        }

        // EXTRA SOUNDNESS CHECK FOR SINGLETON INTERSECTIONS (columns):
        if (empties.length === 1) {
          const [forcedStar] = empties;
          const crossState = cloneState(state);
          crossState.cells[forcedStar.row][forcedStar.col] = 'cross';
          const sol = countSolutions(crossState, {
            maxCount: 1,
            timeoutMs: 2000,
            maxDepth: 200,
          });
          if (!sol.timedOut && sol.count > 0) {
            continue;
          }
        }

        const explanation = `${formatCol(c)} needs ${colRemaining} more star(s) and region ${formatRegions([regionId])} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
        
        console.log(`[UNDERCOUNTING] Found star hint via: col∩region`);
        return {
          id: nextHintId(),
          kind: 'place-star',
          technique: 'undercounting',
          resultCells: empties, // Return ALL empty cells, not just one
          explanation,
          highlights: {
            cols: [c],
            regions: [regionId],
            cells: empties,
          },
        };
      }
    }
  }
  timings.colRegion = performance.now() - colRegionStart;
  
  // Try more complex composite shapes: unions of multiple regions
  const multiRegionRowStart = performance.now();
  // intersected with rows or columns
  const regionIndices = Array.from({ length: size }, (_, i) => i + 1); // 1 to size
  
  for (let r = 0; r < size; r += 1) {
    const row = rowData[r].cells;
    const rowRemaining = rowData[r].remaining;
    
    if (rowRemaining <= 0) continue;
    
    // Try combinations of 2, 3 regions (limited for performance)
    for (let numRegions = 2; numRegions <= Math.min(4, size); numRegions += 1) {
      for (const regionIds of combinations(regionIndices, numRegions)) {
        // Build union of regions (excluding crosses)
        let unionRegions: Coords[] = [];
        let totalRegionRemaining = 0;
        for (const regionId of regionIds) {
          const regionRemaining = regionData[regionId]!.remaining;
          if (regionRemaining <= 0) {
            unionRegions = []; // Skip if any region is already satisfied
            break;
          }
          totalRegionRemaining += regionRemaining;
          const region = regionData[regionId]!.cells;
          const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
          unionRegions = union(unionRegions, regionNonCrosses);
        }
        
        if (unionRegions.length === 0) continue;
        
        const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
        const shape = intersection(rowNonCrosses, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        
        // Calculate cells outside the intersection (excluding crosses)
        const rowOutsideIntersection = difference(rowNonCrosses, shape);
        const unionOutsideIntersection = difference(unionRegions, shape);
        
        // Count empty cells outside the intersection
        const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
        const emptyCellsInUnionOutside = emptyCells(state, unionOutsideIntersection).length;
        
        // The union needs at least the sum of all regions' remaining stars
        // This is a lower bound - the actual need might be higher, but for undercounting
        // we use the most conservative (lowest) estimate
        const unionRemaining = totalRegionRemaining;
        
        // Compute minimum stars that MUST be in the intersection
        // This considers that the row/union could get stars from outside the intersection
        const minStarsInIntersection = Math.max(
          0,
          rowRemaining - emptyCellsInRowOutside,
          unionRemaining - emptyCellsInUnionOutside
        );
        
        // If minimum equals the number of empty cells in the intersection,
        // all empty cells must be stars
        if (minStarsInIntersection === empties.length && empties.length > 0) {
          // Validate that placing stars in ALL empty cells doesn't violate constraints
          if (!canPlaceAllStars(state, empties)) {
            continue; // Skip if placing all stars would violate constraints
          }

          // EXTRA SOUNDNESS CHECK FOR SINGLETON INTERSECTIONS (row ∩ union(regions)):
          if (empties.length === 1) {
            const [forcedStar] = empties;
            const crossState = cloneState(state);
            crossState.cells[forcedStar.row][forcedStar.col] = 'cross';
            const sol = countSolutions(crossState, {
              maxCount: 1,
              timeoutMs: 2000,
              maxDepth: 200,
            });
            if (!sol.timedOut && sol.count > 0) {
              continue;
            }
          }

          const explanation = `${formatRow(r)} needs ${rowRemaining} more star(s). ${formatRegions(regionIds)} together need at least ${totalRegionRemaining} more star(s). The intersection with ${formatRow(r)} has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          console.log(`[UNDERCOUNTING] Found star hint via: multi-region∩row`);
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'undercounting',
            resultCells: empties, // Return ALL empty cells, not just one
            explanation,
            highlights: {
              rows: [r],
              regions: regionIds,
              cells: empties,
            },
          };
        }
      }
    }
  }
  timings.multiRegionRow = performance.now() - multiRegionRowStart;

  // Check intersections of a single region with unions of multiple rows/columns
  // This can identify cases where a region intersects with multiple rows/columns
  // and we can determine that some cells in the intersection must be crosses
  const multiRowRegionStart = performance.now();
  for (let regionId = 1; regionId <= size; regionId += 1) {
    const region = regionData[regionId]!.cells;
    const regionRemaining = regionData[regionId]!.remaining;
    
    if (regionRemaining <= 0) continue;
    
    // Exclude crosses from region for counting purposes
    const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
    
    // Try unions of 2, 3 rows (limited for performance)
    const rowIndicesForUnion = Array.from({ length: size }, (_, i) => i);
    for (let numRows = 2; numRows <= Math.min(3, size); numRows += 1) {
      const rowCombos = combinations(rowIndicesForUnion, numRows);
      for (const rows of rowCombos) {
        patternsChecked.multiRowRegion++;
        checksPerformed++;
        // Build union of rows (excluding crosses) and calculate total remaining stars
        let unionRows: Coords[] = [];
        let totalRowsRemaining = 0;
        for (const r of rows) {
          const rowRemaining = rowData[r].remaining;
          if (rowRemaining <= 0) {
            unionRows = []; // Skip if any row is already satisfied
            break;
          }
          totalRowsRemaining += rowRemaining;
          const row = rowData[r].cells;
          const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
          unionRows = union(unionRows, rowNonCrosses);
        }
        
        if (unionRows.length === 0) continue;
        
        // Find intersection of region with union of rows
        const shape = intersection(regionNonCrosses, unionRows);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        // Calculate cells outside the intersection
        const regionOutsideIntersection = difference(regionNonCrosses, shape);
        const unionRowsOutsideIntersection = difference(unionRows, shape);
        
        // Count empty cells outside the intersection
        const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
        const emptyCellsInRowsOutside = emptyCells(state, unionRowsOutsideIntersection).length;
        
        // Compute minimum stars that MUST be in the intersection
        // The rows together need totalRowsRemaining stars
        // But they can get stars from outside the intersection
        const minStarsInIntersection = Math.max(
          0,
          totalRowsRemaining - emptyCellsInRowsOutside,
          regionRemaining - emptyCellsInRegionOutside
        );
        
        // If minimum equals the number of empty cells, all must be stars
        if (minStarsInIntersection === empties.length && empties.length > 0) {
          // Validate that placing stars in ALL empty cells doesn't violate constraints
          if (!canPlaceAllStars(state, empties)) {
            continue; // Skip if placing all stars would violate constraints
          }
          
          const explanation = `${formatUnitList(rows, formatRow)} together need ${totalRowsRemaining} more star(s) and region ${formatRegions([regionId])} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          console.log(`[UNDERCOUNTING] Found star hint via: region∩multi-row`);
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'undercounting',
            resultCells: empties,
            explanation,
            highlights: {
              rows,
              regions: [regionId],
              cells: empties,
            },
          };
        }
      }
    }
  }
  timings.multiRowRegion = performance.now() - multiRowRegionStart;
  
  // Try unions of 2, 3 columns (limited for performance)
  const multiColRegionStart = performance.now();
  const colIndicesForUnion = Array.from({ length: size }, (_, i) => i);
  for (let regionId = 1; regionId <= size; regionId += 1) {
    const region = regionData[regionId]!.cells;
    const regionRemaining = regionData[regionId]!.remaining;
    
    if (regionRemaining <= 0) continue;
    
    // Exclude crosses from region for counting purposes
    const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
    
    for (let numCols = 2; numCols <= Math.min(3, size); numCols += 1) {
      const colCombos = combinations(colIndicesForUnion, numCols) as number[][];
      for (const cols of colCombos as number[][]) {
        patternsChecked.multiColRegion++;
        checksPerformed++;
        // Build union of columns (excluding crosses) and calculate total remaining stars
        let unionCols: Coords[] = [];
        let totalColsRemaining = 0;
        for (const c of cols) {
          const colRemaining = colData[c].remaining;
          if (colRemaining <= 0) {
            unionCols = []; // Skip if any column is already satisfied
            break;
          }
          totalColsRemaining += colRemaining;
          const col = colData[c].cells;
          const colNonCrosses = col.filter(cell => getCell(state, cell) !== 'cross');
          unionCols = union(unionCols, colNonCrosses);
        }
        
        if (unionCols.length === 0) continue;
        
        // Find intersection of region with union of columns
        const shape = intersection(regionNonCrosses, unionCols);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        // Calculate cells outside the intersection
        const regionOutsideIntersection = difference(regionNonCrosses, shape);
        const unionColsOutsideIntersection = difference(unionCols, shape);
        
        // Count empty cells outside the intersection
        const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
        const emptyCellsInColsOutside = emptyCells(state, unionColsOutsideIntersection).length;
        
        // Compute minimum stars that MUST be in the intersection
        const minStarsInIntersection = Math.max(
          0,
          totalColsRemaining - emptyCellsInColsOutside,
          regionRemaining - emptyCellsInRegionOutside
        );
        
        // If minimum equals the number of empty cells, all must be stars
        if (minStarsInIntersection === empties.length && empties.length > 0) {
          // Validate that placing stars in ALL empty cells doesn't violate constraints
          if (!canPlaceAllStars(state, empties)) {
            continue; // Skip if placing all stars would violate constraints
          }
          
          const explanation = `${formatUnitList(cols, formatCol)} together need ${totalColsRemaining} more star(s) and region ${formatRegions([regionId])} needs ${regionRemaining} more star(s). Their intersection has exactly ${empties.length} empty cell(s), so all must be stars.`;
          
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'undercounting',
            resultCells: empties,
            explanation,
            highlights: {
              cols,
              regions: [regionId],
              cells: empties,
            },
          };
        }
      }
    }
  }
  timings.multiColRegion = performance.now() - multiColRegionStart;

  // SECOND: Check for cross placements (only if no star hints found)
  // Generalized counting: if X rows (or columns) are covered by exactly X regions,
  // then all stars for those regions must be placed in those rows/columns.
  // Therefore, cells from other regions in those rows/columns must be crosses.
  const rowIndices = Array.from({ length: size }, (_, i) => i);
  const colIndices = Array.from({ length: size }, (_, i) => i);

  // Precompute regions in each row/column
  const regionsInRow: Set<number>[] = [];
  const regionsInCol: Set<number>[] = [];

  for (let r = 0; r < size; r += 1) {
    const set = new Set<number>();
    for (const cell of rowData[r].cells) {
      if (getCell(state, cell) !== 'cross') {
        set.add(state.def.regions[cell.row][cell.col]);
      }
    }
    regionsInRow[r] = set;
  }

  for (let c = 0; c < size; c += 1) {
    const set = new Set<number>();
    for (const cell of colData[c].cells) {
      if (getCell(state, cell) !== 'cross') {
        set.add(state.def.regions[cell.row][cell.col]);
      }
    }
    regionsInCol[c] = set;
  }

  // Limit group size for performance (most patterns occur with 2-4 regions/rows/columns)
  const genStartTime = performance.now();
  let genRowStart = performance.now();
  for (let groupSize = 2; groupSize <= Math.min(4, size); groupSize += 1) {
    genRowStart = performance.now();
    const rowCombos = combinations(rowIndices, groupSize);
    for (const rows of rowCombos) {
      patternsChecked.generalizedRows++;
      checksPerformed++;
      // Only consider non-cross cells when determining which regions cover these rows
      // Crosses should not count to the areas for counting purposes
      const regionSet = new Set<number>();
      for (const r of rows) {
        for (const regionId of regionsInRow[r]) {
          regionSet.add(regionId);
        }
      }

      if (regionSet.size !== groupSize) continue;

      const regionIds = Array.from(regionSet);
      
      // Check if all remaining empty cells of these regions are in these rows
      let allRemainingCellsInRows = true;
      let totalRegionStarsNeeded = 0;
      for (const regionId of regionIds) {
        const regionRemaining = regionData[regionId]!.remaining;
        
        if (regionRemaining <= 0) {
          allRemainingCellsInRows = false;
          break;
        }
        
        totalRegionStarsNeeded += regionRemaining;
        
        // Check if all remaining empty cells of this region are in the selected rows
        const regionEmpties = regionData[regionId]!.empties;
        const rowsSet = new Set(rows);
        const emptiesInRows = regionEmpties.filter(e => rowsSet.has(e.row));
        
        if (emptiesInRows.length !== regionEmpties.length) {
          allRemainingCellsInRows = false;
          break;
        }
      }
      
      if (!allRemainingCellsInRows) continue;
      
      // Calculate total stars needed for these rows (only if we need it)
      let totalRowsStarsNeeded = 0;
      for (const r of rows) {
        totalRowsStarsNeeded += rowData[r].remaining;
      }
      
      // Pattern: If regions can place all their remaining stars only in these rows,
      // and the total required stars equals the total row capacity,
      // then all other regions' cells in these rows must be crosses
      if (totalRegionStarsNeeded === totalRowsStarsNeeded) {
        const otherRegionCells = uniqueCells(
          rows.flatMap((r) => {
            const row = rowData[r].cells;
            return row.filter((cell) => {
              const cellRegionId = state.def.regions[cell.row][cell.col];
              return !regionIds.includes(cellRegionId);
            });
          })
        );
        const resultCells = otherRegionCells.filter((c) => getCell(state, c) === 'empty');
        
        if (resultCells.length > 0) {
          const explanation = `${formatRegions(regionIds)} can place all their remaining ${totalRegionStarsNeeded} star(s) only in ${formatUnitList(rows, formatRow)}, and these rows together need exactly ${totalRowsStarsNeeded} star(s). Therefore, all stars for those regions must be placed within those rows, and cells from other regions in those rows must be crosses.`;

          console.log(`[UNDERCOUNTING] Found cross hint via: generalized-rows (Pattern 1)`);
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'undercounting',
            resultCells,
            explanation,
            highlights: {
              rows,
              regions: regionIds,
              cells: resultCells,
            },
          };
        }
      }
      
      // Also check: if all remaining cells of these regions are in these rows,
      // then cells from these regions in OTHER rows must be crosses
      if (allRemainingCellsInRows) {
        const outsideCells = uniqueCells(
          regionIds.flatMap((regionId) =>
            regionData[regionId]!.cells.filter((cell) => !rows.includes(cell.row))
          )
        );
        const resultCells = outsideCells.filter((c) => getCell(state, c) === 'empty');
        
        if (resultCells.length > 0) {
          const explanation = `${formatRegions(regionIds)} can place all their remaining stars only in ${formatUnitList(rows, formatRow)}. Therefore, cells from those regions in other rows must be crosses.`;

          console.log(`[UNDERCOUNTING] Found cross hint via: generalized-rows (Pattern 2)`);
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'undercounting',
            resultCells,
            explanation,
            highlights: {
              rows,
              regions: regionIds,
              cells: resultCells,
            },
          };
        }
      }
    }

    // Pattern 1: Check if columns contain exactly groupSize regions (original pattern)
    let genColStart = performance.now();
    const colCombos = combinations(colIndices, groupSize);
    genColStart = performance.now();
    for (const cols of colCombos) {
      patternsChecked.generalizedCols++;
      checksPerformed++;
      const regionSet = new Set<number>();
      for (const c of cols) {
        for (const regionId of regionsInCol[c]) {
          regionSet.add(regionId);
        }
      }

      if (regionSet.size === groupSize) {
        const regionIds = Array.from(regionSet);
        
        // Check if all remaining empty cells of these regions are in these columns
        let allRemainingCellsInCols = true;
        let totalRegionStarsNeeded = 0;
        for (const regionId of regionIds) {
          const regionRemaining = regionData[regionId]!.remaining;
          
          if (regionRemaining <= 0) {
            allRemainingCellsInCols = false;
            break;
          }
          
          totalRegionStarsNeeded += regionRemaining;
          
          const regionEmpties = regionData[regionId]!.empties;
          const colsSet = new Set(cols);
          const emptiesInCols = regionEmpties.filter(e => colsSet.has(e.col));
          
          if (emptiesInCols.length !== regionEmpties.length) {
            allRemainingCellsInCols = false;
            break;
          }
        }
        
        if (allRemainingCellsInCols) {
          let totalColsStarsNeeded = 0;
          for (const c of cols) {
            totalColsStarsNeeded += colData[c].remaining;
          }
          
          if (totalRegionStarsNeeded === totalColsStarsNeeded) {
            const otherRegionCells = uniqueCells(
              cols.flatMap((c) => {
                const col = colData[c].cells;
                return col.filter((cell) => {
                  const cellRegionId = state.def.regions[cell.row][cell.col];
                  return !regionIds.includes(cellRegionId);
                });
              })
            );
            const resultCells = otherRegionCells.filter((c) => getCell(state, c) === 'empty');
            
            if (resultCells.length > 0) {
              const explanation = `${formatRegions(regionIds)} can place all their remaining ${totalRegionStarsNeeded} star(s) only in ${formatUnitList(cols, formatCol)}, and these columns together need exactly ${totalColsStarsNeeded} star(s). Therefore, all stars for those regions must be placed within those columns, and cells from other regions in those columns must be crosses.`;

              console.log(`[UNDERCOUNTING] Found cross hint via: pattern2-cols (Pattern 1)`);
              return {
                id: nextHintId(),
                kind: 'place-cross',
                technique: 'undercounting',
                resultCells,
                explanation,
                highlights: {
                  cols,
                  regions: regionIds,
                  cells: resultCells,
                },
              };
            }
          }
        }
      }
    }
    timings.generalizedCols = performance.now() - genColStart;
    
    // Confined regions pattern: Check if regions can place all stars only in certain rows/columns
    // even if other regions also appear in those rows/columns
    const regionCombos = combinations(regionIndices, groupSize);
    
    // Check rows
    const confinedRegionsRowsStart = performance.now();
    for (const rows of rowCombos) {
      patternsChecked.confinedRegionsRows++;
      checksPerformed++;
      
      // Compute row capacity once using rowData
      const totalRowsStarsNeeded = rows.reduce((sum, r) => sum + rowData[r].remaining, 0);
      if (totalRowsStarsNeeded <= 0) continue;
      
      // Build regionsInRows by unioning regionsInRow[r] for these rows
      const rowsSet = new Set(rows);
      const regionsInRows = new Set<number>();
      for (const r of rows) {
        for (const regionId of regionsInRow[r]) {
          regionsInRows.add(regionId);
        }
      }
      
      for (const regionIds of regionCombos) {
        // Early exit: skip if none of these regions appear in these rows
        if (!regionIds.some(id => regionsInRows.has(id))) {
          continue;
        }
        checksPerformed++;
        
        // Check if all remaining empty cells of these regions are in these rows
        let allRemainingCellsInRows = true;
        let totalRegionStarsNeeded = 0;
        for (const regionId of regionIds) {
          const regionDataItem = regionData[regionId]!;
          
          if (regionDataItem.remaining <= 0) {
            allRemainingCellsInRows = false;
            break;
          }
          
          totalRegionStarsNeeded += regionDataItem.remaining;
          
          // Early exit if totalRegionStarsNeeded exceeds totalRowsStarsNeeded
          if (totalRegionStarsNeeded > totalRowsStarsNeeded) {
            allRemainingCellsInRows = false;
            break;
          }
          
          // Use regionData[regionId].empties for the test
          const regionEmpties = regionDataItem.empties;
          const emptiesInRows = regionEmpties.filter(e => rowsSet.has(e.row));
          
          if (emptiesInRows.length !== regionEmpties.length) {
            allRemainingCellsInRows = false;
            break;
          }
        }
        
        if (!allRemainingCellsInRows) continue;
        
        // Only if totalRegionStarsNeeded === totalRowsStarsNeeded and all chosen regions' empties are confined to these rows
        if (totalRegionStarsNeeded === totalRowsStarsNeeded) {
          const otherRegionCells = uniqueCells(
            rows.flatMap((r) => {
              const row = rowData[r].cells;
              return row.filter((cell) => {
                const cellRegionId = state.def.regions[cell.row][cell.col];
                return !regionIds.includes(cellRegionId);
              });
            })
          );
          const resultCells = otherRegionCells.filter((c) => getCell(state, c) === 'empty');
          
          if (resultCells.length > 0) {
            const explanation = `${formatRegions(regionIds)} can place all their remaining ${totalRegionStarsNeeded} star(s) only in ${formatUnitList(rows, formatRow)}, and these rows together need exactly ${totalRowsStarsNeeded} star(s). Therefore, all stars for those regions must be placed within those rows, and cells from other regions in those rows must be crosses.`;

            console.log(`[UNDERCOUNTING] Found cross hint via: confined-regions-rows`);
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'undercounting',
              resultCells,
              explanation,
              highlights: {
                rows,
                regions: regionIds,
                cells: resultCells,
              },
            };
          }
        }
      }
    }
    timings.confinedRegionsRows = performance.now() - confinedRegionsRowsStart;
    
    // Check columns
    const confinedRegionsColsStart = performance.now();
    for (const cols of colCombos) {
      patternsChecked.confinedRegionsCols++;
      checksPerformed++;
      
      // Compute column capacity once using colData
      const totalColsStarsNeeded = cols.reduce((sum, c) => sum + colData[c].remaining, 0);
      if (totalColsStarsNeeded <= 0) continue;
      
      // Build regionsInCols by unioning regionsInCol[c] for these columns
      const colsSet = new Set(cols);
      const regionsInCols = new Set<number>();
      for (const c of cols) {
        for (const regionId of regionsInCol[c]) {
          regionsInCols.add(regionId);
        }
      }
      
      for (const regionIds of regionCombos) {
        // Early exit: skip if none of these regions appear in these columns
        if (!regionIds.some(id => regionsInCols.has(id))) {
          continue;
        }
        checksPerformed++;
        
        // Check if all remaining empty cells of these regions are in these columns
        let allRemainingCellsInCols = true;
        let totalRegionStarsNeeded = 0;
        for (const regionId of regionIds) {
          const regionDataItem = regionData[regionId]!;
          
          if (regionDataItem.remaining <= 0) {
            allRemainingCellsInCols = false;
            break;
          }
          
          totalRegionStarsNeeded += regionDataItem.remaining;
          
          // Early exit if totalRegionStarsNeeded exceeds totalColsStarsNeeded
          if (totalRegionStarsNeeded > totalColsStarsNeeded) {
            allRemainingCellsInCols = false;
            break;
          }
          
          // Use regionData[regionId].empties for the test
          const regionEmpties = regionDataItem.empties;
          const emptiesInCols = regionEmpties.filter(e => colsSet.has(e.col));
          
          if (emptiesInCols.length !== regionEmpties.length) {
            allRemainingCellsInCols = false;
            break;
          }
        }
        
        if (!allRemainingCellsInCols) continue;
        
        // Only if totalRegionStarsNeeded === totalColsStarsNeeded and all chosen regions' empties are confined to these columns
        if (totalRegionStarsNeeded === totalColsStarsNeeded) {
          const otherRegionCells = uniqueCells(
            cols.flatMap((c) => {
              const col = colData[c].cells;
              return col.filter((cell) => {
                const cellRegionId = state.def.regions[cell.row][cell.col];
                return !regionIds.includes(cellRegionId);
              });
            })
          );
          const resultCells = otherRegionCells.filter((c) => getCell(state, c) === 'empty');
          
          if (resultCells.length > 0) {
            const explanation = `${formatRegions(regionIds)} can place all their remaining ${totalRegionStarsNeeded} star(s) only in ${formatUnitList(cols, formatCol)}, and these columns together need exactly ${totalColsStarsNeeded} star(s). Therefore, all stars for those regions must be placed within those columns, and cells from other regions in those columns must be crosses.`;

            console.log(`[UNDERCOUNTING] Found cross hint via: confined-regions-cols`);
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'undercounting',
              resultCells,
              explanation,
              highlights: {
                cols,
                regions: regionIds,
                cells: resultCells,
              },
            };
          }
        }
      }
    }
    timings.confinedRegionsCols = performance.now() - confinedRegionsColsStart;
  }

  const totalTime = performance.now() - startTime;
  const genTime = performance.now() - genStartTime;
  
  // Always log if it takes significant time or many checks
  if (totalTime > 50 || checksPerformed > 500) {
    console.log(`[UNDERCOUNTING DEBUG] Total time: ${totalTime.toFixed(2)}ms, Total checks: ${checksPerformed}`);
    console.log(`[UNDERCOUNTING DEBUG] Timing breakdown (ms):`, {
      'row∩region': timings.rowRegion?.toFixed(2) || '0.00',
      'col∩region': timings.colRegion?.toFixed(2) || '0.00',
      'multi-region∩row': timings.multiRegionRow?.toFixed(2) || '0.00',
      'region∩multi-row': timings.multiRowRegion?.toFixed(2) || '0.00',
      'region∩multi-col': timings.multiColRegion?.toFixed(2) || '0.00',
      'generalized-rows': timings.generalizedRows?.toFixed(2) || '0.00',
      'generalized-cols': timings.generalizedCols?.toFixed(2) || '0.00',
      'confined-regions-rows': timings.confinedRegionsRows?.toFixed(2) || '0.00',
      'confined-regions-cols': timings.confinedRegionsCols?.toFixed(2) || '0.00',
      'generalized-total': genTime.toFixed(2),
    });
    console.log(`[UNDERCOUNTING DEBUG] Pattern breakdown (checks):`, {
      'row∩region': patternsChecked.rowRegion,
      'col∩region': patternsChecked.colRegion,
      'multi-region∩row': patternsChecked.multiRegionRow,
      'region∩multi-row': patternsChecked.multiRowRegion,
      'region∩multi-col': patternsChecked.multiColRegion,
      'generalized-rows': patternsChecked.generalizedRows,
      'generalized-cols': patternsChecked.generalizedCols,
      'confined-regions-rows': patternsChecked.confinedRegionsRows,
      'confined-regions-cols': patternsChecked.confinedRegionsCols,
    });
  }

  return null;
}

/**
 * Find result with deductions support
 * Note: Undercounting is complex and primarily produces hints.
 * Deductions are emitted when partial patterns are detected.
 */
export function findUndercountingResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Precompute row, column, and region data (same as findUndercountingHint)
  const rowData = Array.from({ length: size }, (_, r) => {
    const cells = rowCells(state, r);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  const colData = Array.from({ length: size }, (_, c) => {
    const cells = colCells(state, c);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  const regionData = Array.from({ length: size + 1 }, (_, id) => {
    if (id === 0) return null; // 1-based regions
    const cells = regionCells(state, id);
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  // Emit deductions for partial patterns: when minStarsInIntersection > 0 but < empties.length
  // This means at least N stars must be in this intersection, but not all cells are forced
  
  // Check row∩region intersections
  for (let r = 0; r < size; r += 1) {
    const row = rowData[r].cells;
    const rowRemaining = rowData[r].remaining;
    if (rowRemaining <= 0) continue;
    
    const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      const region = regionData[regionId]!.cells;
      const regionRemaining = regionData[regionId]!.remaining;
      if (regionRemaining <= 0) continue;
      
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(rowNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      const rowOutsideIntersection = difference(rowNonCrosses, shape);
      const regionOutsideIntersection = difference(regionNonCrosses, shape);
      const emptyCellsInRowOutside = emptyCells(state, rowOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      const minStarsInIntersection = Math.max(
        0,
        rowRemaining - emptyCellsInRowOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minStars > 0 but < empties.length, emit ExclusiveSetDeduction
      if (minStarsInIntersection > 0 && minStarsInIntersection < empties.length) {
        deductions.push({
          kind: 'exclusive-set',
          technique: 'undercounting',
          cells: empties,
          starsRequired: minStarsInIntersection,
          explanation: `The intersection of ${formatRow(r)} and region ${formatRegions([regionId])} must contain at least ${minStarsInIntersection} star(s) in its ${empties.length} empty cell(s).`,
        });
      }
    }
  }

  // Check col∩region intersections
  for (let c = 0; c < size; c += 1) {
    const col = colData[c].cells;
    const colRemaining = colData[c].remaining;
    if (colRemaining <= 0) continue;
    
    const colNonCrosses = col.filter(cell => getCell(state, cell) !== 'cross');
    
    for (let regionId = 0; regionId < size; regionId += 1) {
      const region = regionData[regionId]!.cells;
      const regionRemaining = regionData[regionId]!.remaining;
      if (regionRemaining <= 0) continue;
      
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(colNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      const colOutsideIntersection = difference(colNonCrosses, shape);
      const regionOutsideIntersection = difference(regionNonCrosses, shape);
      const emptyCellsInColOutside = emptyCells(state, colOutsideIntersection).length;
      const emptyCellsInRegionOutside = emptyCells(state, regionOutsideIntersection).length;
      
      const minStarsInIntersection = Math.max(
        0,
        colRemaining - emptyCellsInColOutside,
        regionRemaining - emptyCellsInRegionOutside
      );
      
      // If minStars > 0 but < empties.length, emit ExclusiveSetDeduction
      if (minStarsInIntersection > 0 && minStarsInIntersection < empties.length) {
        deductions.push({
          kind: 'exclusive-set',
          technique: 'undercounting',
          cells: empties,
          starsRequired: minStarsInIntersection,
          explanation: `The intersection of ${formatCol(c)} and region ${formatRegions([regionId])} must contain at least ${minStarsInIntersection} star(s) in its ${empties.length} empty cell(s).`,
        });
      }
    }
  }

  // Try to find a clear hint first
  const hint = findUndercountingHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  // Return deductions if any were found
  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}

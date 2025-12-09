import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import {
  rowCells,
  colCells,
  regionCells,
  countStars,
  emptyCells,
  union,
  intersection,
  maxStarsWithTwoByTwo,
  getCell,
  formatRow,
  formatCol,
  formatRegions,
} from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `overcounting-${hintCounter}`;
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
 * Overcounting technique:
 * 
 * Identifies composite shapes (unions of regions or partial regions) where
 * the maximum number of stars that can be placed has been reached,
 * forcing all remaining empty cells to be crosses.
 * 
 * The maximum star count considers:
 * - Stars already placed in the shape
 * - 2×2 constraints that limit placement
 * - Adjacency rules
 * - Unit quotas that constrain total stars
 */
export function findOvercountingHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const startTime = performance.now();
  const timings: Record<string, number> = {};
  let checksPerformed = 0;
  let patternsChecked = {
    generalizedRows: 0,
    generalizedCols: 0,
    rowRegion: 0,
    colRegion: 0,
    multiRegionRow: 0,
    confinedRegionsRows: 0,
    confinedRegionsCols: 0,
  };

  // Strategy: Look for composite shapes formed by intersections of units
  // where the maximum star count has been reached, forcing remaining cells to be crosses

  // Cache all region cells (same for all iterations since state doesn't change)
  const allRegionIds = new Set<number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      allRegionIds.add(state.def.regions[r][c]);
    }
  }
  const regionCellsCache = new Map<number, Coords[]>();
  for (const regionId of allRegionIds) {
    regionCellsCache.set(regionId, regionCells(state, regionId));
  }

  const rowIndices = Array.from({ length: size }, (_, i) => i);
  const colIndices = Array.from({ length: size }, (_, i) => i);

  // Generalized counting: if X rows (or columns) are covered by exactly X regions,
  // then all stars for those regions must be placed in those rows/columns.
  // Therefore, cells from those regions outside the selected units are crosses.
  const genStartTime = performance.now();
  let genRowsTime = 0;
  let genColsTime = 0;
  for (let groupSize = 2; groupSize <= size; groupSize += 1) {
    const rowsStartTime = performance.now();
    for (const rows of combinations(rowIndices, groupSize)) {
      patternsChecked.generalizedRows++;
      checksPerformed++;
      // Only consider non-cross cells when determining which regions cover these rows
      // Crosses should not count to the areas for counting purposes
      const regionSet = new Set<number>();
      for (const r of rows) {
        for (let c = 0; c < size; c += 1) {
          if (getCell(state, { row: r, col: c }) !== 'cross') {
            regionSet.add(state.def.regions[r][c]);
          }
        }
      }

      if (regionSet.size !== groupSize) continue;

      const rowsSet = new Set(rows);
      const regionIds = Array.from(regionSet);
      const outsideCells = uniqueCells(
        regionIds.flatMap((regionId) =>
          regionCellsCache.get(regionId)!.filter((cell) => !rowsSet.has(cell.row))
        )
      );
      const resultCells = outsideCells.filter((c) => getCell(state, c) === 'empty');

      if (resultCells.length > 0) {
        const explanation = `${formatUnitList(rows, formatRow)} are fully covered by ${formatRegions(
          regionIds
        )}. Because there are ${rows.length} row(s) and the same number of regions, all required stars for those regions must be placed within those rows. Cells from those regions in other rows must therefore be crosses.`;

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
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
    genRowsTime += performance.now() - rowsStartTime;

    const colsStartTime = performance.now();
    for (const cols of combinations(colIndices, groupSize)) {
      patternsChecked.generalizedCols++;
      checksPerformed++;
      // Only consider non-cross cells when determining which regions cover these columns
      // Crosses should not count to the areas for counting purposes
      const regionSet = new Set<number>();
      for (const c of cols) {
        for (let r = 0; r < size; r += 1) {
          if (getCell(state, { row: r, col: c }) !== 'cross') {
            regionSet.add(state.def.regions[r][c]);
          }
        }
      }

      if (regionSet.size !== groupSize) continue;

      const colsSet = new Set(cols);
      const regionIds = Array.from(regionSet);
      const outsideCells = uniqueCells(
        regionIds.flatMap((regionId) =>
          regionCellsCache.get(regionId)!.filter((cell) => !colsSet.has(cell.col))
        )
      );
      const resultCells = outsideCells.filter((c) => getCell(state, c) === 'empty');

      if (resultCells.length > 0) {
        const explanation = `${formatUnitList(cols, formatCol)} are fully covered by ${formatRegions(
          regionIds
        )}. Because there are ${cols.length} column(s) and the same number of regions, all required stars for those regions must be placed within those columns. Cells from those regions in other columns must therefore be crosses.`;

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
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
    genColsTime += performance.now() - colsStartTime;
  }
  timings.generalizedRows = genRowsTime;
  timings.generalizedCols = genColsTime;
  
  // Try intersections of rows with regions
  const rowRegionStartTime = performance.now();
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    // Calculate rowNonCrosses once per row (doesn't change in inner loop)
    const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      patternsChecked.rowRegion++;
      checksPerformed++;
      const region = regionCellsCache.get(regionId);
      if (!region) continue;
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of row and region, excluding crosses
      // Crosses should not count to the areas for counting purposes
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(rowNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Compute maximum stars that can be placed in this shape
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // The maximum is also constrained by unit quotas
      const maxFromUnits = Math.min(rowRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If maximum equals current stars, all empty cells must be crosses
      if (maxStars === shapeStars && empties.length > 0) {
        const explanation = `${formatRow(r)} and region ${formatRegions([regionId])} can have at most ${maxStars} star(s) in their intersection (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
        
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
          resultCells: empties,
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
  timings.rowRegion = performance.now() - rowRegionStartTime;
  
  // Try intersections of columns with regions
  const colRegionStartTime = performance.now();
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    // Calculate colNonCrosses once per column (doesn't change in inner loop)
    const colNonCrosses = col.filter(c => getCell(state, c) !== 'cross');
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      patternsChecked.colRegion++;
      checksPerformed++;
      const region = regionCellsCache.get(regionId);
      if (!region) continue;
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of column and region, excluding crosses
      // Crosses should not count to the areas for counting purposes
      const regionNonCrosses = region.filter(c => getCell(state, c) !== 'cross');
      const shape = intersection(colNonCrosses, regionNonCrosses);
      if (shape.length === 0) continue;
      
      const empties = emptyCells(state, shape);
      if (empties.length === 0) continue;
      
      // Compute maximum stars that can be placed in this shape
      const shapeStars = countStars(state, shape);
      const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
      const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
      
      // The maximum is also constrained by unit quotas
      const maxFromUnits = Math.min(colRemaining + shapeStars, regionRemaining + shapeStars);
      const maxStars = Math.min(maxStarsPossible, maxFromUnits);
      
      // If maximum equals current stars, all empty cells must be crosses
      if (maxStars === shapeStars && empties.length > 0) {
        const explanation = `${formatCol(c)} and region ${formatRegions([regionId])} can have at most ${maxStars} star(s) in their intersection (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
        
        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'overcounting',
          resultCells: empties,
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
  timings.colRegion = performance.now() - colRegionStartTime;
  
  // Try more complex composite shapes: unions of multiple regions
  // intersected with rows or columns
  const multiRegionStartTime = performance.now();
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    // Calculate rowNonCrosses once per row (doesn't change in inner loops)
    const rowNonCrosses = row.filter(c => getCell(state, c) !== 'cross');
    
    // Try pairs of regions
    for (let reg1 = 1; reg1 <= size; reg1 += 1) {
      const region1 = regionCellsCache.get(reg1);
      if (!region1) continue;
      for (let reg2 = reg1 + 1; reg2 <= size; reg2 += 1) {
        patternsChecked.multiRegionRow++;
        checksPerformed++;
        const region2 = regionCellsCache.get(reg2);
        if (!region2) continue;
        // Exclude crosses from regions for counting purposes
        const region1NonCrosses = region1.filter(c => getCell(state, c) !== 'cross');
        const region2NonCrosses = region2.filter(c => getCell(state, c) !== 'cross');
        const unionRegions = union(region1NonCrosses, region2NonCrosses);
        const shape = intersection(rowNonCrosses, unionRegions);
        if (shape.length === 0) continue;
        
        const empties = emptyCells(state, shape);
        if (empties.length === 0) continue;
        
        const shapeStars = countStars(state, shape);
        const existingStarCoords = shape.filter((c) => getCell(state, c) === 'star');
        const maxStarsPossible = maxStarsWithTwoByTwo(state, shape, existingStarCoords);
        
        const reg1Stars = countStars(state, region1);
        const reg2Stars = countStars(state, region2);
        const reg1Remaining = starsPerUnit - reg1Stars;
        const reg2Remaining = starsPerUnit - reg2Stars;
        
        // Maximum from unit quotas
        const maxFromUnits = Math.min(
          rowRemaining + shapeStars,
          reg1Remaining + reg2Remaining + shapeStars
        );
        const maxStars = Math.min(maxStarsPossible, maxFromUnits);
        
        // If maximum equals current stars, all empty cells must be crosses
        if (maxStars === shapeStars && empties.length > 0) {
          const explanation = `${formatRow(r)} intersected with ${formatRegions([reg1, reg2])} can have at most ${maxStars} star(s) (considering 2×2 constraints). This maximum is already reached, so all ${empties.length} empty cell(s) must be crosses.`;
          
          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'overcounting',
            resultCells: empties,
            explanation,
            highlights: {
              rows: [r],
              regions: [reg1, reg2],
              cells: empties,
            },
          };
        }
      }
    }
  }
  timings.multiRegionRow = performance.now() - multiRegionStartTime;

  // Confined regions pattern: Check if regions can place all stars only in certain rows/columns
  // even if other regions also appear in those rows/columns
  // This finds forced crosses when regions are confined to specific units
  const confinedRegionsRowsStartTime = performance.now();
  
  // Precompute row/column/region data for efficient access
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
    const cells = regionCellsCache.get(id) || [];
    const stars = countStars(state, cells);
    const empties = emptyCells(state, cells);
    return { cells, stars, empties, remaining: starsPerUnit - stars };
  });

  // Precompute which regions appear in each row/column (excluding crosses)
  const regionsInRow: Set<number>[] = Array.from({ length: size }, () => new Set());
  const regionsInCol: Set<number>[] = Array.from({ length: size }, () => new Set());
  
  for (let r = 0; r < size; r += 1) {
    for (const cell of rowData[r].cells) {
      if (getCell(state, cell) !== 'cross') {
        regionsInRow[r].add(state.def.regions[cell.row][cell.col]);
      }
    }
  }

  for (let c = 0; c < size; c += 1) {
    for (const cell of colData[c].cells) {
      if (getCell(state, cell) !== 'cross') {
        regionsInCol[c].add(state.def.regions[cell.row][cell.col]);
      }
    }
  }

  const regionIndices = Array.from({ length: size }, (_, i) => i + 1);
  
  // Limit group size for performance (most patterns occur with 2-4 regions/rows/columns)
  for (let groupSize = 2; groupSize <= Math.min(4, size); groupSize += 1) {
    const rowCombos = combinations(rowIndices, groupSize);
    const regionCombos = combinations(regionIndices, groupSize);
    
    // Check rows
    for (const rows of rowCombos) {
      patternsChecked.confinedRegionsRows++;
      checksPerformed++;
      
      // Compute row capacity once
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
          
          // Check if all remaining empty cells are in these rows
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
            
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'overcounting',
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
    
    // Check columns
    const confinedRegionsColsStartTime = performance.now();
    const colCombos = combinations(colIndices, groupSize);
    for (const cols of colCombos) {
      patternsChecked.confinedRegionsCols++;
      checksPerformed++;
      
      // Compute column capacity once
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
          
          // Check if all remaining empty cells are in these columns
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
            
            return {
              id: nextHintId(),
              kind: 'place-cross',
              technique: 'overcounting',
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
    timings.confinedRegionsCols = performance.now() - confinedRegionsColsStartTime;
  }
  timings.confinedRegionsRows = performance.now() - confinedRegionsRowsStartTime;

  const totalTime = performance.now() - startTime;
  
  // Always log if it takes significant time or many checks
  if (totalTime > 50 || checksPerformed > 500) {
    console.log(`[OVERCOUNTING DEBUG] Total time: ${totalTime.toFixed(2)}ms, Total checks: ${checksPerformed}`);
    console.log(`[OVERCOUNTING DEBUG] Timing breakdown (ms):`, {
      'generalized-rows': timings.generalizedRows?.toFixed(2) || '0.00',
      'generalized-cols': timings.generalizedCols?.toFixed(2) || '0.00',
      'row∩region': timings.rowRegion?.toFixed(2) || '0.00',
      'col∩region': timings.colRegion?.toFixed(2) || '0.00',
      'multi-region∩row': timings.multiRegionRow?.toFixed(2) || '0.00',
      'confined-regions-rows': timings.confinedRegionsRows?.toFixed(2) || '0.00',
      'confined-regions-cols': timings.confinedRegionsCols?.toFixed(2) || '0.00',
    });
    console.log(`[OVERCOUNTING DEBUG] Pattern breakdown (checks):`, {
      'generalized-rows': patternsChecked.generalizedRows,
      'generalized-cols': patternsChecked.generalizedCols,
      'row∩region': patternsChecked.rowRegion,
      'col∩region': patternsChecked.colRegion,
      'multi-region∩row': patternsChecked.multiRegionRow,
      'confined-regions-rows': patternsChecked.confinedRegionsRows,
      'confined-regions-cols': patternsChecked.confinedRegionsCols,
    });
  }

  return null;
}

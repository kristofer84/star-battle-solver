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

  // Strategy: Look for composite shapes formed by intersections of units
  // where the maximum star count has been reached, forcing remaining cells to be crosses

  const rowIndices = Array.from({ length: size }, (_, i) => i);
  const colIndices = Array.from({ length: size }, (_, i) => i);

  // Generalized counting: if X rows (or columns) are covered by exactly X regions,
  // then all stars for those regions must be placed in those rows/columns.
  // Therefore, cells from those regions outside the selected units are crosses.
  for (let groupSize = 2; groupSize <= size; groupSize += 1) {
    for (const rows of combinations(rowIndices, groupSize)) {
      const regionSet = new Set<number>();
      for (const r of rows) {
        for (let c = 0; c < size; c += 1) {
          regionSet.add(state.def.regions[r][c]);
        }
      }

      if (regionSet.size !== groupSize) continue;

      const rowsSet = new Set(rows);
      const regionIds = Array.from(regionSet);
      const outsideCells = uniqueCells(
        regionIds.flatMap((regionId) =>
          regionCells(state, regionId).filter((cell) => !rowsSet.has(cell.row))
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

    for (const cols of combinations(colIndices, groupSize)) {
      const regionSet = new Set<number>();
      for (const c of cols) {
        for (let r = 0; r < size; r += 1) {
          regionSet.add(state.def.regions[r][c]);
        }
      }

      if (regionSet.size !== groupSize) continue;

      const colsSet = new Set(cols);
      const regionIds = Array.from(regionSet);
      const outsideCells = uniqueCells(
        regionIds.flatMap((regionId) =>
          regionCells(state, regionId).filter((cell) => !colsSet.has(cell.col))
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
  }
  
  // Try intersections of rows with regions
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of row and region
      const shape = intersection(row, region);
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
  
  // Try intersections of columns with regions
  for (let c = 0; c < size; c += 1) {
    const col = colCells(state, c);
    const colStars = countStars(state, col);
    const colRemaining = starsPerUnit - colStars;
    
    if (colRemaining <= 0) continue;
    
    for (let regionId = 1; regionId <= size; regionId += 1) {
      const region = regionCells(state, regionId);
      const regionStars = countStars(state, region);
      const regionRemaining = starsPerUnit - regionStars;
      
      if (regionRemaining <= 0) continue;
      
      // Find intersection of column and region
      const shape = intersection(col, region);
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
  
  // Try more complex composite shapes: unions of multiple regions
  // intersected with rows or columns
  for (let r = 0; r < size; r += 1) {
    const row = rowCells(state, r);
    const rowStars = countStars(state, row);
    const rowRemaining = starsPerUnit - rowStars;
    
    if (rowRemaining <= 0) continue;
    
    // Try pairs of regions
    for (let reg1 = 1; reg1 <= size; reg1 += 1) {
      for (let reg2 = reg1 + 1; reg2 <= size; reg2 += 1) {
        const region1 = regionCells(state, reg1);
        const region2 = regionCells(state, reg2);
        const unionRegions = union(region1, region2);
        
        const shape = intersection(row, unionRegions);
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

  return null;
}

import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';
import { neighbors8, rowCells, colCells, regionCells, emptyCells, countStars } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `adjacent-exclusion-${hintCounter}`;
}

/**
 * Adjacent Exclusion:
 * 
 * If all possible placements for required stars in a row/column/region
 * are adjacent to a particular cell, then that cell cannot contain a star
 * (must be a cross).
 * 
 * Pattern: N stars must be placed in a region. If all possible placements
 * for these stars (considering non-adjacency constraints) are adjacent to cell C,
 * then C cannot contain a star.
 * 
 * For multiple stars: Find all valid placement sets for N stars (non-adjacent),
 * then check if the union of all placements is adjacent to the test cell.
 */
export function findAdjacentExclusionHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;
  const startTime = performance.now();
  let cellsChecked = 0;
  let regionsChecked = 0;

  // Calculate all region IDs once (same for all test cells)
  const allRegionIds = new Set<number>();
  for (let rr = 0; rr < size; rr += 1) {
    for (let cc = 0; cc < size; cc += 1) {
      allRegionIds.add(state.def.regions[rr][cc]);
    }
  }

  // Check each empty cell to see if it should be excluded
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      cellsChecked++;

      const testCell: Coords = { row: r, col: c };
      const testCellNeighbors = new Set<string>();
      for (const nb of neighbors8(testCell, size)) {
        testCellNeighbors.add(`${nb.row},${nb.col}`);
      }

      // Check all regions FIRST: if a region needs stars and all possible placements are adjacent to testCell
      // We check ALL regions, not just the one containing testCell

      for (const regionId of allRegionIds) {
        regionsChecked++;
        const region = regionCells(state, regionId);
        const regionStars = countStars(state, region);
        const regionEmpties = emptyCells(state, region);
        const regionNeedsStars = starsPerUnit - regionStars;

        if (regionNeedsStars > 0 && regionEmpties.length > 0) {
          // Skip if region has too many empty cells (would be too expensive)
          if (regionEmpties.length > 20) {
            continue;
          }
          
          // Filter out testCell from region empties
          const regionEmptiesWithoutTest = regionEmpties.filter(cell => 
            !(cell.row === testCell.row && cell.col === testCell.col)
          );

          // Find all valid placements for the required stars, considering non-adjacency
          // For N stars, we need to find all sets of N non-adjacent cells
          const placementStartTime = performance.now();
          const allPlacementSets = findAllValidPlacementSets(
            state,
            regionEmptiesWithoutTest,
            regionNeedsStars,
            size
          );
          const placementTime = performance.now() - placementStartTime;
          
          if (placementTime > 50) {
            console.log(`[DEBUG] Adjacent Exclusion: Region ${regionId} placement search took ${placementTime.toFixed(2)}ms (${regionEmptiesWithoutTest.length} cells, ${regionNeedsStars} stars, ${allPlacementSets.length} sets)`);
          }
          
          if (allPlacementSets.length === 0 && regionEmptiesWithoutTest.length > 0 && regionEmptiesWithoutTest.length <= 20) {
            console.log(`[DEBUG] Adjacent Exclusion: No placement sets found for region ${regionId} (${regionEmptiesWithoutTest.length} cells, ${regionNeedsStars} stars) - may have hit limit`);
          }

          if (allPlacementSets.length > 0) {
            // For N stars, we need to check if testCell is adjacent to:
            // 1. All overlapping placements (cells that appear in multiple/all placement sets)
            // 2. PLUS all non-overlapping placements of at least one star
            
            // Count how many times each cell appears across all placement sets
            const cellCounts = new Map<string, number>();
            for (const placementSet of allPlacementSets) {
              for (const cell of placementSet) {
                const key = `${cell.row},${cell.col}`;
                cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
              }
            }

            // Overlapping = cells that appear in all or most placement sets
            // For 2 stars: overlapping = cells that appear in all placement sets (could be either star)
            // Non-overlapping = cells that appear in some but not all placement sets
            
            const totalPlacements = allPlacementSets.length;
            const overlapping = new Set<string>();
            const nonOverlappingSets: Set<string>[] = [];
            
            // Group cells by how many times they appear
            const cellsByCount = new Map<number, Set<string>>();
            for (const [cellKey, count] of cellCounts.entries()) {
              if (!cellsByCount.has(count)) {
                cellsByCount.set(count, new Set<string>());
              }
              cellsByCount.get(count)!.add(cellKey);
            }
            
            // Overlapping = cells that appear in all placement sets
            // (For 2 stars, if a cell appears in all sets, it's overlapping)
            const allCountSet = cellsByCount.get(totalPlacements);
            if (allCountSet) {
              for (const cellKey of allCountSet) {
                overlapping.add(cellKey);
              }
            }
            
            // For non-overlapping: we need to find cells that appear in some placement sets
            // but represent a specific star's placement
            // Since stars are indistinguishable, we'll check if there are cells that
            // appear in fewer than all placement sets - these are "non-overlapping" options
            
            // Actually, a simpler approach: if we have 2 stars and a cell appears in all sets,
            // it's overlapping. If a cell appears in some sets but not all, it's part of
            // non-overlapping placements for some stars.
            
            // For the user's pattern: we need to check if testCell is adjacent to:
            // - All overlapping cells (appear in all sets)
            // - PLUS all cells that appear in at least one set but not all (non-overlapping)
            
            // Actually, I think the user wants: testCell must be adjacent to ALL cells where
            // at least one star must be placed. This is the union of all placements.
            // But they also want to check non-overlapping of "one of the stars".
            
            // Let me think differently: if star 1 can be in set A and star 2 in set B,
            // then overlapping = A ∩ B, non-overlapping for star 1 = A - B, non-overlapping for star 2 = B - A
            
            // But we don't have explicit sets A and B - we have all valid placement sets.
            // So maybe we need to infer A and B from the placement sets?
            
            // Actually, maybe the simplest interpretation: 
            // - Overlapping = intersection of all placement sets (cells that appear in every set)
            // - Non-overlapping = union minus intersection (cells that appear in some but not all sets)
            
            // But that doesn't match the user's description. Let me try a different approach:
            // For each cell in the union, if it appears in ALL placement sets, it's overlapping.
            // Otherwise, it's non-overlapping for some stars.
            
            const unionOfAllPlacements = new Set<string>();
            for (const placementSet of allPlacementSets) {
              for (const cell of placementSet) {
                unionOfAllPlacements.add(`${cell.row},${cell.col}`);
              }
            }
            
            // Overlapping = cells that appear in ALL placement sets
            const overlappingSet = new Set<string>();
            for (const cellKey of unionOfAllPlacements) {
              if (cellCounts.get(cellKey) === totalPlacements) {
                overlappingSet.add(cellKey);
              }
            }
            
            // Non-overlapping = cells that appear in SOME but not ALL placement sets
            const nonOverlappingSet = new Set<string>();
            for (const cellKey of unionOfAllPlacements) {
              const count = cellCounts.get(cellKey) || 0;
              if (count > 0 && count < totalPlacements) {
                nonOverlappingSet.add(cellKey);
              }
            }
            
            // Check if EVERY placement set has at least one cell adjacent to testCell
            // This is the correct interpretation: if every way to place the stars requires
            // at least one star to be adjacent to the test cell, then the test cell cannot contain a star
            const everyPlacementSetHasAdjacentCell = allPlacementSets.length > 0 &&
              allPlacementSets.every(placementSet => {
                return placementSet.some(cell => {
                  const cellKey = `${cell.row},${cell.col}`;
                  return testCellNeighbors.has(cellKey);
                });
              });

            if (everyPlacementSetHasAdjacentCell) {
              // Check if testCell is in a different region
              const testCellRegionId = state.def.regions[testCell.row][testCell.col];
              if (regionId !== testCellRegionId) {
                const allCells = Array.from(unionOfAllPlacements).map(key => {
                  const [r, c] = key.split(',').map(Number);
                  return { row: r, col: c };
                });

                const explanation = `Region ${regionId} needs ${regionNeedsStars} star(s), and all possible placements for these stars are adjacent to this cell. Therefore, this cell cannot contain a star.`;

                return {
                  id: nextHintId(),
                  kind: 'place-cross',
                  technique: 'adjacent-exclusion',
                  resultCells: [testCell],
                  explanation,
                  highlights: {
                    regions: [regionId],
                    cells: [testCell, ...allCells],
                  },
                };
              }
            }
          }
        }
      }

      // Check rows: if a row needs stars and all possible placements are adjacent to testCell
      const row = rowCells(state, r);
      const rowStars = countStars(state, row);
      const rowEmpties = emptyCells(state, row);
      const rowNeedsStars = starsPerUnit - rowStars;

      if (rowNeedsStars > 0 && rowEmpties.length > 0) {
        // Check if all possible star placements in this row are adjacent to testCell
        const possiblePlacements = rowEmpties.filter(cell => {
          // Can't be the test cell itself
          if (cell.row === testCell.row && cell.col === testCell.col) {
            return false;
          }
          // Check if this cell can actually contain a star (not adjacent to existing stars)
          const nbs = neighbors8(cell, size);
          return !nbs.some(nb => state.cells[nb.row][nb.col] === 'star');
        });

        if (possiblePlacements.length > 0) {
          // Check if all possible placements are adjacent to testCell
          const allAdjacent = possiblePlacements.every(cell => 
            testCellNeighbors.has(`${cell.row},${cell.col}`)
          );

          if (allAdjacent) {
            // But we need to verify that at least one star MUST be placed in these cells
            // This means: rowNeedsStars > 0 AND all possible placements are adjacent to testCell
            // AND we're not in the same row (otherwise it's trivial)
            if (r !== testCell.row) {
              const explanation = `Row ${r + 1} needs ${rowNeedsStars} star(s), and all possible placements for these stars are adjacent to this cell. Therefore, this cell cannot contain a star.`;

              return {
                id: nextHintId(),
                kind: 'place-cross',
                technique: 'adjacent-exclusion',
                resultCells: [testCell],
                explanation,
                highlights: {
                  rows: [r],
                  cells: [testCell, ...possiblePlacements],
                },
              };
            }
          }
        }
      }

      // Check columns: if a column needs stars and all possible placements are adjacent to testCell
      const col = colCells(state, c);
      const colStars = countStars(state, col);
      const colEmpties = emptyCells(state, col);
      const colNeedsStars = starsPerUnit - colStars;

      if (colNeedsStars > 0 && colEmpties.length > 0) {
        const possiblePlacements = colEmpties.filter(cell => {
          if (cell.row === testCell.row && cell.col === testCell.col) {
            return false;
          }
          const nbs = neighbors8(cell, size);
          return !nbs.some(nb => state.cells[nb.row][nb.col] === 'star');
        });

        if (possiblePlacements.length > 0) {
          const allAdjacent = possiblePlacements.every(cell => 
            testCellNeighbors.has(`${cell.row},${cell.col}`)
          );

          if (allAdjacent) {
            if (c !== testCell.col) {
              const explanation = `Column ${c + 1} needs ${colNeedsStars} star(s), and all possible placements for these stars are adjacent to this cell. Therefore, this cell cannot contain a star.`;

              return {
                id: nextHintId(),
                kind: 'place-cross',
                technique: 'adjacent-exclusion',
                resultCells: [testCell],
                explanation,
                highlights: {
                  cols: [c],
                  cells: [testCell, ...possiblePlacements],
                },
              };
            }
          }
        }
      }
    }
  }

  const totalTime = performance.now() - startTime;
  if (totalTime > 100) {
    console.log(`[DEBUG] Adjacent Exclusion: Completed in ${totalTime.toFixed(2)}ms (checked ${cellsChecked} cells, ${regionsChecked} region checks)`);
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findAdjacentExclusionResult(state: PuzzleState): TechniqueResult {
  // Try to find a clear hint first
  const hint = findAdjacentExclusionHint(state);
  if (hint) {
    return { type: 'hint', hint };
  }

  // Adjacent exclusion finds cells that cannot be stars because all placements are adjacent.
  // We could emit CellDeduction for excluded cells,
  // but the technique uses expensive placement search and primarily produces hints directly.

  return { type: 'none' };
}

// Maximum number of placement sets to generate before giving up (prevents UI freeze)
const MAX_PLACEMENT_SETS = 1000;

/**
 * Find all valid sets of N non-adjacent stars that can be placed in the given cells
 * Returns an array of placement sets, where each set is an array of N non-adjacent cells
 * Returns empty array if too many combinations would be generated (prevents UI freeze)
 */
function findAllValidPlacementSets(
  state: PuzzleState,
  candidateCells: Coords[],
  numStars: number,
  size: number,
  maxResults: number = MAX_PLACEMENT_SETS
): Coords[][] {
  if (numStars === 0) return [[]];
  if (candidateCells.length < numStars) return [];
  
  // Early exit: if the number of combinations would be too large, skip
  // For C(n, k), estimate: if n > 20 and k > 1, it could be expensive
  if (candidateCells.length > 20 && numStars > 1) {
    // Estimate: C(n, k) could be very large
    // For safety, skip if candidateCells.length is too large
    console.log(`[DEBUG] Adjacent Exclusion: Skipping expensive computation (${candidateCells.length} cells, ${numStars} stars)`);
    return [];
  }
  
  if (numStars === 1) {
    // For 1 star, return all cells that can contain a star
    return candidateCells
      .filter(cell => {
        const nbs = neighbors8(cell, size);
        return !nbs.some(nb => state.cells[nb.row][nb.col] === 'star');
      })
      .map(cell => [cell]);
  }

  const results: Coords[][] = [];

  // Try each cell as the first star
  for (let i = 0; i < candidateCells.length; i++) {
    // Early termination if we've found enough results
    if (results.length >= maxResults) {
      // Hit limit - return empty to avoid incorrect deductions from partial results
      console.warn(`[PERF] Adjacent Exclusion: Hit MAX_PLACEMENT_SETS limit (${maxResults}) for ${candidateCells.length} cells, ${numStars} stars`);
      return [];
    }
    
    const firstCell = candidateCells[i];
    
    // Check if this cell can contain a star
    const nbs = neighbors8(firstCell, size);
    if (nbs.some(nb => state.cells[nb.row][nb.col] === 'star')) {
      continue; // Can't place star here (adjacent to existing star)
    }

    // Find remaining cells that are not adjacent to firstCell
    const remainingCells = candidateCells.slice(i + 1).filter(cell => {
      const rowDiff = Math.abs(cell.row - firstCell.row);
      const colDiff = Math.abs(cell.col - firstCell.col);
      return !(rowDiff <= 1 && colDiff <= 1); // Not adjacent to firstCell
    });

    // Recursively find placements for remaining stars
    const remainingPlacements = findAllValidPlacementSets(
      state,
      remainingCells,
      numStars - 1,
      size,
      maxResults - results.length // Pass remaining capacity
    );

    // Combine firstCell with each remaining placement
    for (const remaining of remainingPlacements) {
      results.push([firstCell, ...remaining]);
      if (results.length >= maxResults) {
        // Hit limit - return empty to avoid incorrect deductions from partial results
        return [];
      }
    }
  }

  return results;
}

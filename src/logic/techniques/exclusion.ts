import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, CellDeduction } from '../../types/deductions';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `exclusion-${hintCounter}`;
}

/**
 * Exclusion (basic counting version):
 *
 * For each empty cell, consider placing a hypothetical star there.
 * If this would make it impossible for some row/column/region to
 * reach its required number of stars (even ignoring adjacency and 2×2),
 * then that cell is a forced cross.
 *
 * This captures a safe subset of the "exclusion" ideas from
 * Kris De Asis' *A Star Battle Guide*.
 */
export function findExclusionHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit, regions } = state.def;

  // Precompute star and empty counts per row/column/region.
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
      if (cell === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
      } else if (cell === 'empty') {
        rowEmpties[r] += 1;
        colEmpties[c] += 1;
        regionEmpties.set(regionId, (regionEmpties.get(regionId) ?? 0) + 1);
      }
    }
  }

  function wouldBreakUnit(stars: number, empties: number): boolean {
    // After placing a star in this unit:
    const s = stars + 1;
    const e = empties - 1;
    const remaining = starsPerUnit - s;
    if (remaining < 0) return true; // would exceed quota
    if (remaining > e) return true; // not enough slots left
    return false;
  }

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      const regionId = regions[r][c];

      const breaksRow = wouldBreakUnit(rowStars[r], rowEmpties[r]);
      const breaksCol = wouldBreakUnit(colStars[c], colEmpties[c]);
      const breaksRegion = wouldBreakUnit(
        regionStars.get(regionId) ?? 0,
        regionEmpties.get(regionId) ?? 0,
      );

      if (breaksRow || breaksCol || breaksRegion) {
        const cell: Coords = { row: r, col: c };
        
        // EXTRA SAFETY GUARD:
        // Do not let exclusion be the technique that exhausts
        // all remaining candidates in a row/column/region. If turning this
        // cell into a cross would leave insufficient or exactly enough cells
        // for remaining stars, we skip this hint to avoid over-pruning.
        
        // Row guard: Only skip if marking as cross would exhaust the row
        // AND placing a star wouldn't break it (i.e., breaksRow is false)
        // If placing a star WOULD break it, we should mark it as cross regardless
        if (!breaksRow) {
          let rowEmptiesAfter = rowEmpties[r];
          if (state.cells[r][c] === 'empty') {
            rowEmptiesAfter -= 1;
          }
          const rowRemainingStars = starsPerUnit - rowStars[r];
          if (rowRemainingStars >= rowEmptiesAfter) {
            continue; // Would exhaust or exactly fill the row
          }
        }
        
        // Column guard: Only skip if marking as cross would exhaust the column
        // AND placing a star wouldn't break it (i.e., breaksCol is false)
        // If placing a star WOULD break it, we should mark it as cross regardless
        if (!breaksCol) {
          let colEmptiesAfter = colEmpties[c];
          if (state.cells[r][c] === 'empty') {
            colEmptiesAfter -= 1;
          }
          const colRemainingStars = starsPerUnit - colStars[c];
          if (colRemainingStars >= colEmptiesAfter) {
            continue; // Would exhaust or exactly fill the column
          }
        }
        
        // Region guard: Only skip if marking as cross would exhaust the region
        // AND placing a star wouldn't break it (i.e., breaksRegion is false)
        // If placing a star WOULD break it, we should mark it as cross regardless
        if (!breaksRegion) {
          let regionEmptiesAfter = regionEmpties.get(regionId) ?? 0;
          if (state.cells[r][c] === 'empty') {
            regionEmptiesAfter -= 1;
          }
          const regionStarsCount = regionStars.get(regionId) ?? 0;
          const regionRemainingStars = starsPerUnit - regionStarsCount;
          if (regionRemainingStars >= regionEmptiesAfter) {
            continue; // Would exhaust or exactly fill the region
          }
        }
        
        const reasons: string[] = [];
        if (breaksRow) reasons.push(`row ${r + 1}`);
        if (breaksCol) reasons.push(`column ${c + 1}`);
        if (breaksRegion) reasons.push(`region ${regionId}`);

        const explanation = `If this cell contained a star, ${reasons.join(
          ' and ',
        )} could no longer fit the required ${starsPerUnit} stars, so this cell must be a cross.`;

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'exclusion',
          resultCells: [cell],
          explanation,
          highlights: {
            rows: breaksRow ? [r] : undefined,
            cols: breaksCol ? [c] : undefined,
            regions: breaksRegion ? [regionId] : undefined,
            cells: [cell],
          },
        };
      }
    }
  }

  return null;
}

/**
 * Find result with deductions support
 */
export function findExclusionResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit, regions } = state.def;
  const deductions: Deduction[] = [];

  // Precompute star and empty counts per row/column/region.
  const rowStars = new Array(size).fill(0);
  const rowEmpties = new Array(size).fill(0);
  const colStars = new Array(size).fill(0);
  const colEmpties = new Array(size).fill(0);
  const regionStars = new Map<number, number>();
  const regionEmpties = new Map<number, number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const cell = state.cells[r][c];
      const regionId = regions[r][c];
      if (cell === 'star') {
        rowStars[r] += 1;
        colStars[c] += 1;
        regionStars.set(regionId, (regionStars.get(regionId) ?? 0) + 1);
      } else if (cell === 'empty') {
        rowEmpties[r] += 1;
        colEmpties[c] += 1;
        regionEmpties.set(regionId, (regionEmpties.get(regionId) ?? 0) + 1);
      }
    }
  }

  function wouldBreakUnit(stars: number, empties: number): boolean {
    const s = stars + 1;
    const e = empties - 1;
    const remaining = starsPerUnit - s;
    if (remaining < 0) return true;
    if (remaining > e) return true;
    return false;
  }

  // Collect all excluded cells as deductions
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') continue;
      const regionId = regions[r][c];

      const breaksRow = wouldBreakUnit(rowStars[r], rowEmpties[r]);
      const breaksCol = wouldBreakUnit(colStars[c], colEmpties[c]);
      const breaksRegion = wouldBreakUnit(
        regionStars.get(regionId) ?? 0,
        regionEmpties.get(regionId) ?? 0,
      );

      if (breaksRow || breaksCol || breaksRegion) {
        const cell: Coords = { row: r, col: c };
        
        // Apply same safety guards as in findExclusionHint
        if (!breaksRow) {
          let rowEmptiesAfter = rowEmpties[r];
          if (state.cells[r][c] === 'empty') {
            rowEmptiesAfter -= 1;
          }
          const rowRemainingStars = starsPerUnit - rowStars[r];
          if (rowRemainingStars >= rowEmptiesAfter) {
            continue;
          }
        }
        
        if (!breaksCol) {
          let colEmptiesAfter = colEmpties[c];
          if (state.cells[r][c] === 'empty') {
            colEmptiesAfter -= 1;
          }
          const colRemainingStars = starsPerUnit - colStars[c];
          if (colRemainingStars >= colEmptiesAfter) {
            continue;
          }
        }
        
        if (!breaksRegion) {
          let regionEmptiesAfter = regionEmpties.get(regionId) ?? 0;
          if (state.cells[r][c] === 'empty') {
            regionEmptiesAfter -= 1;
          }
          const regionStarsCount = regionStars.get(regionId) ?? 0;
          const regionRemainingStars = starsPerUnit - regionStarsCount;
          if (regionRemainingStars >= regionEmptiesAfter) {
            continue;
          }
        }

        const reasons: string[] = [];
        if (breaksRow) reasons.push(`row ${r + 1}`);
        if (breaksCol) reasons.push(`column ${c + 1}`);
        if (breaksRegion) reasons.push(`region ${regionId}`);

        deductions.push({
          kind: 'cell',
          technique: 'exclusion',
          cell,
          type: 'forceEmpty',
          explanation: `If this cell contained a star, ${reasons.join(' and ')} could no longer fit the required ${starsPerUnit} stars.`,
        });
      }
    }
  }

  // Try to find a clear hint first
  const hint = findExclusionHint(state);
  if (hint) {
    // Return hint with deductions so main solver can combine information
    return { type: 'hint', hint, deductions: deductions.length > 0 ? deductions : undefined };
  }

  if (deductions.length > 0) {
    return { type: 'deductions', deductions };
  }

  return { type: 'none' };
}



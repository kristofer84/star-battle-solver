import type { PuzzleState, Coords } from '../types/puzzle';
import type { Deduction, CellDeduction } from '../types/deductions';

/**
 * Filter out deductions for cells that are already filled
 */
export function filterValidDeductions(
  deductions: Deduction[],
  state: PuzzleState
): Deduction[] {
  return deductions.filter((ded) => {
    switch (ded.kind) {
      case 'cell': {
        // Check bounds
        if (
          ded.cell.row < 0 ||
          ded.cell.row >= state.def.size ||
          ded.cell.col < 0 ||
          ded.cell.col >= state.def.size ||
          state.cells[ded.cell.row] === undefined ||
          state.cells[ded.cell.row][ded.cell.col] === undefined
        ) {
          return false; // Invalid cell coordinates
        }
        const cell = state.cells[ded.cell.row][ded.cell.col];
        // Skip if cell is already filled with the same value
        if (ded.type === 'forceStar' && cell === 'star') return false;
        if (ded.type === 'forceEmpty' && cell === 'cross') return false;
        // Skip if deduction conflicts with current state
        if (ded.type === 'forceStar' && cell === 'cross') return false;
        if (ded.type === 'forceEmpty' && cell === 'star') return false;
        return true;
      }
      case 'block': {
        // Check if block is already resolved
        // For square-counting, bRow/bCol are already cell coordinates
        // For other techniques (like two-by-two), they're grid coordinates that need to be multiplied by 2
        let baseRow: number;
        let baseCol: number;
        if (ded.technique === 'square-counting') {
          baseRow = ded.block.bRow;
          baseCol = ded.block.bCol;
        } else {
          baseRow = 2 * ded.block.bRow;
          baseCol = 2 * ded.block.bCol;
        }
        const blockCells: Coords[] = [
          { row: baseRow, col: baseCol },
          { row: baseRow, col: baseCol + 1 },
          { row: baseRow + 1, col: baseCol },
          { row: baseRow + 1, col: baseCol + 1 },
        ];
        
        // Filter out cells that are out of bounds
        const validBlockCells = blockCells.filter(
          (c) =>
            c.row >= 0 &&
            c.row < state.def.size &&
            c.col >= 0 &&
            c.col < state.def.size &&
            state.cells[c.row] !== undefined &&
            state.cells[c.row][c.col] !== undefined
        );
        
        // If any cells are out of bounds, this deduction is invalid
        if (validBlockCells.length !== blockCells.length) {
          return false;
        }
        
        const starCount = validBlockCells.filter(
          (c) => state.cells[c.row][c.col] === 'star'
        ).length;
        const emptyCount = validBlockCells.filter(
          (c) => state.cells[c.row][c.col] === 'empty'
        ).length;

        // If block is fully resolved, skip
        if (emptyCount === 0) return false;

        // If exact requirement is met, skip
        if (ded.starsRequired !== undefined && starCount === ded.starsRequired) {
          return false;
        }

        return true;
      }
      case 'area': {
        // Filter candidate cells to only those that are still empty and in bounds
        const validCandidates = ded.candidateCells.filter(
          (c) =>
            c.row >= 0 &&
            c.row < state.def.size &&
            c.col >= 0 &&
            c.col < state.def.size &&
            state.cells[c.row] !== undefined &&
            state.cells[c.row][c.col] !== undefined &&
            state.cells[c.row][c.col] === 'empty'
        );
        if (validCandidates.length === 0) return false;

        // Count current stars in area
        let currentStars = 0;
        if (ded.areaType === 'row') {
          if (ded.areaId >= 0 && ded.areaId < state.def.size && state.cells[ded.areaId]) {
            currentStars = state.cells[ded.areaId].filter((c) => c === 'star').length;
          }
        } else if (ded.areaType === 'column') {
          if (ded.areaId >= 0 && ded.areaId < state.def.size) {
            for (let r = 0; r < state.def.size; r++) {
              if (state.cells[r] && state.cells[r][ded.areaId] === 'star') currentStars++;
            }
          }
        } else {
          // region
          for (let r = 0; r < state.def.size; r++) {
            if (state.cells[r] && state.def.regions[r]) {
              for (let c = 0; c < state.def.size; c++) {
                if (
                  state.def.regions[r][c] === ded.areaId &&
                  state.cells[r][c] === 'star'
                ) {
                  currentStars++;
                }
              }
            }
          }
        }

        // If exact requirement is met, skip
        if (
          ded.starsRequired !== undefined &&
          currentStars === ded.starsRequired
        ) {
          return false;
        }

        return true;
      }
      case 'exclusive-set': {
        // Filter cells to only those that are still empty and in bounds
        const validCells = ded.cells.filter(
          (c) =>
            c.row >= 0 &&
            c.row < state.def.size &&
            c.col >= 0 &&
            c.col < state.def.size &&
            state.cells[c.row] !== undefined &&
            state.cells[c.row][c.col] !== undefined &&
            state.cells[c.row][c.col] === 'empty'
        );
        if (validCells.length === 0) return false;

        // Count current stars in set (only for valid cells)
        const currentStars = ded.cells.filter(
          (c) =>
            c.row >= 0 &&
            c.row < state.def.size &&
            c.col >= 0 &&
            c.col < state.def.size &&
            state.cells[c.row] !== undefined &&
            state.cells[c.row][c.col] !== undefined &&
            state.cells[c.row][c.col] === 'star'
        ).length;

        // If requirement is met, skip
        if (currentStars === ded.starsRequired) return false;

        return true;
      }
      case 'area-relation': {
        // Check if relation is still relevant (at least one area has empty candidates)
        const hasEmptyCandidates = ded.areas.some((area) => {
          return area.candidateCells.some(
            (c) =>
              c.row >= 0 &&
              c.row < state.def.size &&
              c.col >= 0 &&
              c.col < state.def.size &&
              state.cells[c.row] !== undefined &&
              state.cells[c.row][c.col] !== undefined &&
              state.cells[c.row][c.col] === 'empty'
          );
        });
        return hasEmptyCandidates;
      }
    }
  });
}

/**
 * Merge and deduplicate deductions
 * When multiple deductions target the same cell/area/block, keep the most specific one
 */
export function mergeDeductions(
  existing: Deduction[],
  newDeductions: Deduction[]
): Deduction[] {
  const merged = [...existing];
  const seen = new Map<string, Deduction>();

  // Index existing deductions
  for (const ded of existing) {
    const key = getDeductionKey(ded);
    if (key) {
      seen.set(key, ded);
    }
  }

  // Add new deductions, resolving conflicts
  for (const ded of newDeductions) {
    const key = getDeductionKey(ded);
    if (!key) {
      // No key means it's a unique deduction (like area-relation)
      merged.push(ded);
      continue;
    }

    const existingDed = seen.get(key);
    if (!existingDed) {
      seen.set(key, ded);
      merged.push(ded);
      continue;
    }

    // Resolve conflict: prefer more specific deduction
    const resolved = resolveDeductionConflict(existingDed, ded);
    if (resolved) {
      const index = merged.indexOf(existingDed);
      if (index >= 0) {
        merged[index] = resolved;
        seen.set(key, resolved);
      }
    }
  }

  return merged;
}

/**
 * Get a unique key for a deduction (for deduplication)
 */
function getDeductionKey(ded: Deduction): string | null {
  switch (ded.kind) {
    case 'cell':
      return `cell:${ded.cell.row},${ded.cell.col}`;
    case 'block':
      return `block:${ded.block.bRow},${ded.block.bCol}`;
    case 'area':
      return `area:${ded.areaType}:${ded.areaId}`;
    case 'exclusive-set':
      // Use sorted cell coordinates for key
      const sortedCells = [...ded.cells]
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((c) => `${c.row},${c.col}`)
        .join('|');
      return `exclusive-set:${sortedCells}`;
    case 'area-relation':
      // Area relations are unique, no key
      return null;
  }
}

/**
 * Resolve conflict between two deductions targeting the same entity
 * Returns the more specific deduction, or null if they conflict
 */
function resolveDeductionConflict(
  existing: Deduction,
  newDed: Deduction
): Deduction | null {
  // If they're identical, keep existing
  if (JSON.stringify(existing) === JSON.stringify(newDed)) {
    return existing;
  }

  // For cell deductions, prefer the one that matches current state
  if (existing.kind === 'cell' && newDed.kind === 'cell') {
    // If they conflict (one says star, one says empty), return null (error)
    if (existing.type !== newDed.type) {
      return null;
    }
    return existing; // Keep existing
  }

  // For area/block deductions, prefer the one with more specific bounds
  if (existing.kind === 'area' && newDed.kind === 'area') {
    // Prefer exact count over bounds
    if (newDed.starsRequired !== undefined && existing.starsRequired === undefined) {
      return newDed;
    }
    if (existing.starsRequired !== undefined && newDed.starsRequired === undefined) {
      return existing;
    }
    // Prefer tighter bounds
    const existingRange =
      (existing.maxStars ?? Infinity) - (existing.minStars ?? 0);
    const newRange = (newDed.maxStars ?? Infinity) - (newDed.minStars ?? 0);
    if (newRange < existingRange) {
      return newDed;
    }
    return existing;
  }

  if (existing.kind === 'block' && newDed.kind === 'block') {
    // Similar logic for blocks
    if (newDed.starsRequired !== undefined && existing.starsRequired === undefined) {
      return newDed;
    }
    if (existing.starsRequired !== undefined && newDed.starsRequired === undefined) {
      return existing;
    }
    return existing;
  }

  // Default: keep existing
  return existing;
}

/**
 * Normalize deductions by removing redundant information
 */
export function normalizeDeductions(deductions: Deduction[]): Deduction[] {
  return deductions.map((ded) => {
    switch (ded.kind) {
      case 'area': {
        // Remove candidate cells that are already filled
        const validCandidates = ded.candidateCells.filter((c) => {
          // This will be filtered by filterValidDeductions, but we can optimize here
          return true; // Keep all for now, filtering happens later
        });
        if (validCandidates.length === 0) {
          return ded; // Return as-is, will be filtered out
        }
        return { ...ded, candidateCells: validCandidates };
      }
      case 'exclusive-set': {
        // Remove cells that are already filled
        const validCells = ded.cells.filter((c) => {
          return true; // Keep all for now
        });
        if (validCells.length === 0) {
          return ded; // Return as-is
        }
        return { ...ded, cells: validCells };
      }
      default:
        return ded;
    }
  });
}

/**
 * Extract all cell-level deductions from a list of deductions
 */
export function extractCellDeductions(deductions: Deduction[]): CellDeduction[] {
  return deductions.filter(
    (d): d is CellDeduction => d.kind === 'cell'
  );
}

/**
 * Check if two cell coordinates are equal
 */
export function cellsEqual(a: Coords, b: Coords): boolean {
  return a.row === b.row && a.col === b.col;
}


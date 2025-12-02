import type { PuzzleDef, PuzzleState } from '../types/puzzle';
import { neighbors8, formatRow, formatCol, formatRegion } from './helpers';

export function validateState(state: PuzzleState): string[] {
  const messages: string[] = [];
  const { size, starsPerUnit, regions } = state.def;

  // Row and column counts
  for (let r = 0; r < size; r += 1) {
    let rowCount = 0;
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') rowCount += 1;
    }
    if (rowCount > starsPerUnit) {
      messages.push(`${formatRow(r)} has ${rowCount} stars (maximum is ${starsPerUnit}).`);
    }
  }

  for (let c = 0; c < size; c += 1) {
    let colCount = 0;
    for (let r = 0; r < size; r += 1) {
      if (state.cells[r][c] === 'star') colCount += 1;
    }
    if (colCount > starsPerUnit) {
      messages.push(`${formatCol(c)} has ${colCount} stars (maximum is ${starsPerUnit}).`);
    }
  }

  // Region counts
  const regionStarCounts = new Map<number, number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') {
        const id = regions[r][c];
        regionStarCounts.set(id, (regionStarCounts.get(id) ?? 0) + 1);
      }
    }
  }
  regionStarCounts.forEach((count, id) => {
    if (count > starsPerUnit) {
      messages.push(`Region ${formatRegion(id)} has ${count} stars (maximum is ${starsPerUnit}).`);
    }
  });

  // Adjacency
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      const neighbors = neighbors8({ row: r, col: c }, size);
      for (const n of neighbors) {
        if (state.cells[n.row][n.col] === 'star') {
          messages.push(
            `Two stars touch at (${r},${c}) and (${n.row},${n.col}).`,
          );
        }
      }
    }
  }

  return Array.from(new Set(messages));
}

export function validateRegions(def: PuzzleDef): string[] {
  const issues: string[] = [];
  const { size, regions } = def;

  const seenRegionIds = new Set<number>();

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const id = regions[r][c];
      if (!Number.isInteger(id) || id < 1 || id > 10) {
        issues.push(`Cell (${r},${c}) has invalid region id ${id}; expected 1–10 (A–J).`);
      } else {
        seenRegionIds.add(id);
      }
    }
  }

  for (let id = 1; id <= 10; id += 1) {
    if (!seenRegionIds.has(id)) {
      issues.push(`Region ${formatRegion(id)} does not appear anywhere on the board.`);
    }
  }

  return issues;
}

export interface RuleViolations {
  rows: Set<number>; // Rows with >2 stars or >8 x's
  cols: Set<number>; // Columns with >2 stars or >8 x's
  regions: Set<number>; // Regions with >2 stars
  adjacentCells: Set<string>; // Cells with adjacent stars (as "row,col" strings)
}

export function getRuleViolations(state: PuzzleState): RuleViolations {
  const violations: RuleViolations = {
    rows: new Set(),
    cols: new Set(),
    regions: new Set(),
    adjacentCells: new Set(),
  };

  const { size, starsPerUnit, regions } = state.def;

  // Check rows and columns
  for (let r = 0; r < size; r += 1) {
    let starCount = 0;
    let crossCount = 0;
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') starCount++;
      if (state.cells[r][c] === 'cross') crossCount++;
    }
    if (starCount > starsPerUnit || crossCount > 8) {
      violations.rows.add(r);
    }
  }

  for (let c = 0; c < size; c += 1) {
    let starCount = 0;
    let crossCount = 0;
    for (let r = 0; r < size; r += 1) {
      if (state.cells[r][c] === 'star') starCount++;
      if (state.cells[r][c] === 'cross') crossCount++;
    }
    if (starCount > starsPerUnit || crossCount > 8) {
      violations.cols.add(c);
    }
  }

  // Check regions
  const regionStarCounts = new Map<number, number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') {
        const id = regions[r][c];
        regionStarCounts.set(id, (regionStarCounts.get(id) ?? 0) + 1);
      }
    }
  }
  regionStarCounts.forEach((count, id) => {
    if (count > starsPerUnit) {
      violations.regions.add(id);
    }
  });

  // Check adjacency
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      const neighbors = neighbors8({ row: r, col: c }, size);
      for (const n of neighbors) {
        if (state.cells[n.row][n.col] === 'star') {
          // Add both cells to violations
          violations.adjacentCells.add(`${r},${c}`);
          violations.adjacentCells.add(`${n.row},${n.col}`);
        }
      }
    }
  }

  return violations;
}

export function isPuzzleComplete(state: PuzzleState): boolean {
  const { size, starsPerUnit, regions } = state.def;

  // Check all cells are filled
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'empty') {
        return false;
      }
    }
  }

  // Check exactly starsPerUnit stars per row
  for (let r = 0; r < size; r += 1) {
    let starCount = 0;
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') starCount++;
    }
    if (starCount !== starsPerUnit) {
      return false;
    }
  }

  // Check exactly starsPerUnit stars per column
  for (let c = 0; c < size; c += 1) {
    let starCount = 0;
    for (let r = 0; r < size; r += 1) {
      if (state.cells[r][c] === 'star') starCount++;
    }
    if (starCount !== starsPerUnit) {
      return false;
    }
  }

  // Check exactly starsPerUnit stars per region
  const regionStarCounts = new Map<number, number>();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] === 'star') {
        const id = regions[r][c];
        regionStarCounts.set(id, (regionStarCounts.get(id) ?? 0) + 1);
      }
    }
  }
  for (let id = 1; id <= 10; id += 1) {
    if ((regionStarCounts.get(id) ?? 0) !== starsPerUnit) {
      return false;
    }
  }

  // Check no adjacent stars
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'star') continue;
      const neighbors = neighbors8({ row: r, col: c }, size);
      for (const n of neighbors) {
        if (state.cells[n.row][n.col] === 'star') {
          return false;
        }
      }
    }
  }

  return true;
}




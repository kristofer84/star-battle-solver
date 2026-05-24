import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState, type PuzzleState, type Coords } from '../src/types/puzzle';
import { findLineCaseSplitResult } from '../src/logic/techniques/lineCaseSplit';
import { findForcedPlacementResult } from '../src/logic/techniques/forcedPlacement';
import { analyzeDeductionsWithContext } from '../src/logic/mainSolver';
import { mergeDeductions } from '../src/logic/deductionUtils';
import type { AreaDeduction } from '../src/types/deductions';

function parsePuzzle(puzzleStr: string): PuzzleState {
  const lines = puzzleStr.trim().split('\n').map((l) => l.trim());
  const regions: number[][] = [];
  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    const regionRow: number[] = [];
    for (let c = 0; c < 10; c += 1) {
      const m = cells[c].match(/^(\d+)([xs]?)$/);
      if (!m) throw new Error(`Bad cell at (${r},${c}): ${cells[c]}`);
      regionRow.push(parseInt(m[1], 10));
    }
    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({ size: 10, starsPerUnit: 2, regions });
  for (let r = 0; r < 10; r += 1) {
    const cells = lines[r].split(/\s+/);
    for (let c = 0; c < 10; c += 1) {
      const m = cells[c].match(/^(\d+)([xs]?)$/);
      if (!m) continue;
      const marker = m[2];
      if (marker === 's') state.cells[r][c] = 'star';
      else if (marker === 'x') state.cells[r][c] = 'cross';
    }
  }
  return state;
}

// The user's analysis puzzle. With these crosses and stars in place:
//  - Region 0 has only {(1,1), (2,1), (3,1), (3,3)} as candidates for its 2
//    stars. Every valid placement puts ≥1 star in row 3 ∩ region 0 =
//    {(3,1), (3,3)}.
//  - Column 9 needs 1 more star. Candidates are (3,9) and (7,9). If (7,9)
//    is the col-9 star, propagation crosses (7,8) and (8,8), forcing (3,8)
//    as col 8's only remaining candidate. So every col-9 placement
//    contributes a star in row 3 within {(3,8), (3,9)}.
//  - Row 3 needs 2 stars; those two disjoint subsets account for both,
//    making (3,4) a cross.
const PUZZLE = `0x 0x 0x 0x 0x 1s 1x 2s 2x 2x
0x 0 0x 3 3x 3x 1x 1x 1x 2s
0x 0 0x 3 4x 3 3 1 5x 5x
0x 0 0x 0 4 3x 6x 1x 1 5
4x 4 4x 4 4 3x 6s 6x 1x 5x
7 8x 8 4 3x 3x 8x 6x 6s 5x
7 8x 8 4x 4 3 8 5x 5x 5x
7 8x 8 8 8 3x 8 5x 5 5
7 7x 7x 9x 8x 8x 8 5 5 8x
7x 7x 9s 9x 9s 8x 8x 8x 8x 8x`;

function areaDeductionFor(
  deductions: AreaDeduction[],
  areaType: 'row' | 'column',
  areaId: number,
  expectedCells: Coords[],
): AreaDeduction | undefined {
  const keys = new Set(expectedCells.map((c) => `${c.row},${c.col}`));
  return deductions.find((d) => {
    if (d.areaType !== areaType || d.areaId !== areaId) return false;
    if (d.candidateCells.length !== expectedCells.length) return false;
    return d.candidateCells.every((c) => keys.has(`${c.row},${c.col}`));
  });
}

describe('Region projection in forced-placement', () => {
  it('emits a row-restricted minStars=1 deduction for region 0 → row 3', () => {
    const state = parsePuzzle(PUZZLE);
    const result = findForcedPlacementResult(state);
    expect(result.type).not.toBe('none');
    if (result.type === 'none') return;
    const dedList = (result.type === 'deductions' ? result.deductions : result.deductions ?? []) as AreaDeduction[];
    const areaDeds = dedList.filter((d): d is AreaDeduction => d.kind === 'area');

    const projection = areaDeductionFor(areaDeds, 'row', 3, [
      { row: 3, col: 1 },
      { row: 3, col: 3 },
    ]);
    expect(projection).toBeDefined();
    expect(projection?.minStars).toBe(1);
  });
});

describe('lineCaseSplit', () => {
  it('emits a row-3 minStars=1 deduction over {(3,8),(3,9)} from the col-9 case-split', () => {
    const state = parsePuzzle(PUZZLE);
    const result = findLineCaseSplitResult(state);
    // On this puzzle the technique now also combines with forced-placement's
    // projections internally and prefers to return the saturation hint as a
    // single result. Either way, the {(3,8),(3,9)} subset deduction must be
    // present in the technique's emitted deductions list.
    const emitted = result.type === 'hint' ? (result.deductions ?? []) : result.type === 'deductions' ? result.deductions : [];
    const areaDeds = emitted.filter((d): d is AreaDeduction => d.kind === 'area');

    const ded = areaDeductionFor(areaDeds, 'row', 3, [
      { row: 3, col: 8 },
      { row: 3, col: 9 },
    ]);
    expect(ded).toBeDefined();
    expect(ded?.minStars).toBe(1);
  });
});

describe('Line saturation combines projections', () => {
  it('crosses (3,4) when forced-placement projection and line-case-split saturate row 3', () => {
    const state = parsePuzzle(PUZZLE);

    // line-case-split now combines its own per-line minStars facts with
    // forced-placement's region projections internally, and returns the
    // saturation hint as its primary result so the user sees the multi-
    // fact reasoning rather than a single-cell contradiction.
    const lcs = findLineCaseSplitResult(state);
    expect(lcs.type).toBe('hint');
    if (lcs.type !== 'hint') return;

    expect(lcs.hint.kind).toBe('place-cross');
    expect(lcs.hint.technique).toBe('line-case-split');
    const cellKeys = lcs.hint.resultCells.map((c) => `${c.row},${c.col}`);
    expect(cellKeys).toContain('3,4');
    expect(lcs.hint.explanation).toMatch(/Combined constraints require/);
  });
});

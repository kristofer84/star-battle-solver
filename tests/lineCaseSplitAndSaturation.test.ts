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
    expect(result.type).toBe('deductions');
    if (result.type !== 'deductions') return;
    const areaDeds = result.deductions.filter((d): d is AreaDeduction => d.kind === 'area');

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

    // Run both producers, merge their deductions, then ask mainSolver to
    // combine. We filter out cell-level deductions because line-case-split
    // also finds (4,1) directly via a contradiction branch — a sound
    // deduction, but a different mechanism. We want to prove the disjoint-
    // subset saturation path on its own.
    const fp = findForcedPlacementResult(state);
    const lcs = findLineCaseSplitResult(state);

    let deductions: ReturnType<typeof mergeDeductions> = [];
    if (fp.type === 'deductions') deductions = mergeDeductions(deductions, fp.deductions);
    if (fp.type === 'hint' && fp.deductions) deductions = mergeDeductions(deductions, fp.deductions);
    if (lcs.type === 'deductions') deductions = mergeDeductions(deductions, lcs.deductions);

    // Keep only the two row-3 area deductions for this isolation test.
    // Other valid deductions (e.g. (2,5) forced from col 5 projection) get
    // picked up by simpler resolvers first; here we want to prove that the
    // disjoint-subset saturation alone derives (3,4).
    const row3Deds = deductions.filter(
      (d) =>
        d.kind === 'area' &&
        d.areaType === 'row' &&
        d.areaId === 3 &&
        (d.minStars ?? 0) >= 1,
    );

    expect(row3Deds.length).toBeGreaterThanOrEqual(2);

    const analysis = analyzeDeductionsWithContext(row3Deds, state);

    expect(analysis.hint).not.toBeNull();
    const hint = analysis.hint!;
    expect(hint.kind).toBe('place-cross');
    const cellKeys = hint.resultCells.map((c) => `${c.row},${c.col}`);
    expect(cellKeys).toContain('3,4');
  });
});

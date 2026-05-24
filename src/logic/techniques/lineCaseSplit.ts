import type { PuzzleState, Coords, CellState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import type { TechniqueResult, Deduction, AreaDeduction, CellDeduction } from '../../types/deductions';
import {
  rowCells,
  colCells,
  regionCells,
  emptyCells,
  countStars,
  neighbors8,
  getCell,
  idToLetter,
  formatRow,
  formatCol,
} from '../helpers';
import { findForcedPlacementResult } from './forcedPlacement';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `line-case-split-${hintCounter}`;
}

/**
 * Try to combine area deductions on a single line that each cover a disjoint
 * cell-subset with minStars≥1, summing to the line's remaining stars. When
 * the sum matches, every other empty cell in the line must be a cross —
 * surface that as a hint so the user sees the multi-fact reasoning rather
 * than a single-cell contradiction from one of the contributing techniques.
 *
 * Returns the hint plus the contributing AreaDeductions so the UI's
 * Supporting deductions panel can show where each "≥k star" fact came from.
 */
function trySaturationHint(
  deductions: Deduction[],
  state: PuzzleState,
): { hint: Hint; supporting: Deduction[] } | null {
  const { size, starsPerUnit } = state.def;
  const areas = deductions.filter((d): d is AreaDeduction => d.kind === 'area');

  for (const lineType of ['row', 'column'] as const) {
    for (let lineId = 0; lineId < size; lineId += 1) {
      const lineCellList = lineType === 'row' ? rowCells(state, lineId) : colCells(state, lineId);
      const lineStars = countStars(state, lineCellList);
      const remaining = starsPerUnit - lineStars;
      if (remaining <= 0) continue;

      const lineEmpties = emptyCells(state, lineCellList);
      if (lineEmpties.length === 0) continue;

      const candidates = areas
        .filter((d) => d.areaType === lineType && d.areaId === lineId)
        .map((d) => {
          const emptyCands = d.candidateCells.filter(
            (c) => state.cells[c.row][c.col] === 'empty',
          );
          const minStars = d.starsRequired ?? d.minStars ?? 0;
          return { ded: d, emptyCands, minStars };
        })
        .filter((c) => c.emptyCands.length > 0 && c.minStars >= 1)
        .filter((c) => c.emptyCands.length < lineEmpties.length);

      if (candidates.length === 0) continue;
      if (candidates.length > 12) continue;

      const n = candidates.length;
      for (let mask = 1; mask < 1 << n; mask += 1) {
        let sum = 0;
        const selected: typeof candidates = [];
        for (let i = 0; i < n; i += 1) {
          if (mask & (1 << i)) {
            selected.push(candidates[i]);
            sum += candidates[i].minStars;
            if (sum > remaining) break;
          }
        }
        if (sum !== remaining) continue;

        const seen = new Set<string>();
        let disjoint = true;
        for (const c of selected) {
          for (const cell of c.emptyCands) {
            const key = `${cell.row},${cell.col}`;
            if (seen.has(key)) { disjoint = false; break; }
            seen.add(key);
          }
          if (!disjoint) break;
        }
        if (!disjoint) continue;

        const crosses = lineEmpties.filter((c) => !seen.has(`${c.row},${c.col}`));
        if (crosses.length === 0) continue;

        const lineLabel = lineType === 'row' ? formatRow(lineId) : formatCol(lineId);

        // Per-subset bullets that name the source technique for each
        // contributing ≥k fact, so the user can trace each constraint to its
        // origin (region projection, case-split branch, etc.) without
        // hunting around.
        const subsetBullets = selected.map((s) => {
          const cellsStr = s.emptyCands.map((c) => `(${c.row},${c.col})`).join(', ');
          const where = s.ded.explanation ?? `${s.ded.technique}`;
          return `• ≥${s.minStars} star${s.minStars === 1 ? '' : 's'} in {${cellsStr}}  —  ${where}`;
        });

        const explanation =
          `${lineLabel} needs ${remaining} more star${remaining === 1 ? '' : 's'}. ` +
          `Two disjoint subsets together account for all of them, so every other empty cell in ${lineLabel.toLowerCase()} must be a cross:\n` +
          subsetBullets.join('\n');

        const highlightCells: Coords[] = [];
        for (const c of selected) highlightCells.push(...c.emptyCands);
        highlightCells.push(...crosses);

        return {
          hint: {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'line-case-split',
            resultCells: crosses,
            explanation,
            highlights: lineType === 'row'
              ? { rows: [lineId], cells: highlightCells }
              : { cols: [lineId], cells: highlightCells },
          },
          supporting: selected.map((s) => s.ded),
        };
      }
    }
  }
  return null;
}

/**
 * Line Case-Split
 *
 * For each row or column with a small number of valid placements for its
 * remaining stars, enumerate every placement and propagate one round of
 * forced consequences (adjacency, 2×2, line/region saturation). Any cell that
 * ends up forced as a star in *every* placement contributes to a
 * row/column-restricted minStars≥1 deduction:
 *
 *   "Row r must contain at least one star within {c₁, c₂, …}"
 *
 * where the cell-set is the union of forced stars in r across all placements.
 *
 * These per-line ≥1 facts are the missing "producer" the line-saturation
 * resolver in mainSolver needs to combine multiple constraints on the same
 * row/column into cross placements.
 *
 * As a side effect, if propagation under a particular placement derives a
 * contradiction, that placement is impossible and the candidate cell can be
 * forced to a cross directly (cell-level deduction).
 */
export function findLineCaseSplitResult(state: PuzzleState): TechniqueResult {
  const { size, starsPerUnit } = state.def;
  const deductions: Deduction[] = [];

  // Skip when the board is so sparse that no line will satisfy the case-
  // split preconditions anyway. Without enough crosses, every line has too
  // many empties for `lineEmpties.length <= 4` to fire.
  let totalCrossesOrStars = 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (state.cells[r][c] !== 'empty') totalCrossesOrStars += 1;
    }
  }
  if (totalCrossesOrStars < 40) return { type: 'none' };

  // Soft budget on propagation calls to keep this technique cheap when run
  // many times (e.g. property tests). Once exceeded, return what we have.
  let propagationBudget = 30;

  for (const lineType of ['row', 'column'] as const) {
    for (let lineId = 0; lineId < size; lineId += 1) {
      if (propagationBudget <= 0) break;
      const lineCellList = lineType === 'row' ? rowCells(state, lineId) : colCells(state, lineId);
      const lineStars = countStars(state, lineCellList);
      const remaining = starsPerUnit - lineStars;
      if (remaining <= 0) continue;

      const lineEmpties = emptyCells(state, lineCellList);
      if (lineEmpties.length === 0) continue;
      // Keep enumeration bounded: small remaining stars and small candidate set.
      if (remaining > 2) continue;
      if (lineEmpties.length > 4) continue;

      const placements = enumerateLinePlacements(state, lineEmpties, remaining);
      if (placements.length < 2) continue; // need at least two branches to combine
      if (placements.length > 4) continue; // safety cap on branches

      const branchResults: { placement: Coords[]; forcedStars: Coords[] | null }[] = [];
      for (const placement of placements) {
        if (propagationBudget <= 0) break;
        propagationBudget -= 1;
        const forcedStars = propagateForcedStars(state, placement);
        branchResults.push({ placement, forcedStars });
      }
      if (branchResults.length < placements.length) continue;

      // Branches that lead to contradiction → those candidate cells can be
      // crossed directly.
      const validBranches = branchResults.filter((b) => b.forcedStars !== null);
      if (validBranches.length === 0) continue;

      if (validBranches.length < branchResults.length) {
        // At least one branch is impossible. If a candidate cell appears
        // *only* in impossible branches, it must be a cross.
        const usedInValid = new Set<string>();
        for (const b of validBranches) {
          for (const c of b.placement) usedInValid.add(`${c.row},${c.col}`);
        }
        const allCandidates = new Set<string>();
        for (const b of branchResults) {
          for (const c of b.placement) allCandidates.add(`${c.row},${c.col}`);
        }
        for (const key of allCandidates) {
          if (!usedInValid.has(key)) {
            const [rStr, cStr] = key.split(',');
            const cell: Coords = { row: parseInt(rStr, 10), col: parseInt(cStr, 10) };
            if (state.cells[cell.row][cell.col] !== 'empty') continue;
            const ded: CellDeduction = {
              kind: 'cell',
              technique: 'line-case-split',
              cell,
              type: 'forceEmpty',
              explanation: `Every ${lineType === 'row' ? formatRow(lineId) : formatCol(lineId)} placement that uses (${cell.row},${cell.col}) leads to a contradiction.`,
            };
            deductions.push(ded);
          }
        }
      }

      if (validBranches.length < 2) continue;

      // For each other line R', look for cells that appear as *newly*
      // forced stars in R' in every valid branch (cells empty in the input
      // state that the branch propagation determines must be stars). Pre-
      // existing stars don't count — they're already there regardless of
      // which branch we pick, so they carry no branch-specific information.
      for (const otherType of ['row', 'column'] as const) {
        for (let otherId = 0; otherId < size; otherId += 1) {
          if (otherType === lineType && otherId === lineId) continue;

          const perBranchCells: Coords[][] = [];
          let everyBranchHasOne = true;
          for (const b of validBranches) {
            const inOther = (b.forcedStars as Coords[]).filter((c) => {
              const matchesLine = otherType === 'row' ? c.row === otherId : c.col === otherId;
              if (!matchesLine) return false;
              // Only count cells that were empty in the input state — those
              // are the stars actually forced by this branch's hypothesis.
              return state.cells[c.row][c.col] === 'empty';
            });
            if (inOther.length === 0) {
              everyBranchHasOne = false;
              break;
            }
            perBranchCells.push(inOther);
          }
          if (!everyBranchHasOne) continue;

          // Union of per-branch forced-star cells in R'.
          const unionKeys = new Set<string>();
          const unionCells: Coords[] = [];
          for (const cells of perBranchCells) {
            for (const c of cells) {
              const k = `${c.row},${c.col}`;
              if (!unionKeys.has(k)) {
                unionKeys.add(k);
                unionCells.push(c);
              }
            }
          }

          // Skip if the union covers the entire other-line's empties (no
          // new info: the line already had to put a star somewhere among
          // its empties anyway).
          const otherCellList = otherType === 'row' ? rowCells(state, otherId) : colCells(state, otherId);
          const otherEmpties = emptyCells(state, otherCellList);
          if (unionCells.length === 0) continue;
          if (unionCells.length >= otherEmpties.length) continue;

          // Restrict to cells that are still empty in the current state.
          const candidateCells = unionCells.filter((c) => state.cells[c.row][c.col] === 'empty');
          if (candidateCells.length === 0) continue;
          if (candidateCells.length >= otherEmpties.length) continue;

          const explanation = lineType === 'row'
            ? `Splitting on ${formatRow(lineId)}'s ${placements.length} possible placement${placements.length === 1 ? '' : 's'}, every case forces a star in ${otherType === 'row' ? formatRow(otherId) : formatCol(otherId)} within {${candidateCells.map((c) => `(${c.row},${c.col})`).join(', ')}}.`
            : `Splitting on ${formatCol(lineId)}'s ${placements.length} possible placement${placements.length === 1 ? '' : 's'}, every case forces a star in ${otherType === 'row' ? formatRow(otherId) : formatCol(otherId)} within {${candidateCells.map((c) => `(${c.row},${c.col})`).join(', ')}}.`;

          const ded: AreaDeduction = {
            kind: 'area',
            technique: 'line-case-split',
            areaType: otherType,
            areaId: otherId,
            candidateCells,
            minStars: 1,
            explanation,
          };
          deductions.push(ded);
        }
      }
    }
  }

  if (deductions.length === 0) return { type: 'none' };

  // Before falling through to deduction-only mode, attempt the
  // multi-fact saturation deduction *inside* this technique. Without this,
  // any cell-level contradiction emitted alongside (e.g. (4,1) crossed
  // because every Row 4 placement using it dead-ends) would be resolved by
  // mainSolver's resolveCellDeductions first — robbing the user of the
  // richer "two disjoint subsets account for the line's remaining stars"
  // explanation, which is the whole reason this technique exists.
  //
  // We pull in forced-placement's region projections inline so we can
  // combine them with our own per-line minStars facts.
  const fpResult = findForcedPlacementResult(state);
  const combined: Deduction[] = [...deductions];
  if (fpResult.type === 'deductions') {
    combined.push(...fpResult.deductions);
  } else if (fpResult.type === 'hint' && fpResult.deductions) {
    combined.push(...fpResult.deductions);
  }
  const saturation = trySaturationHint(combined, state);
  if (saturation) {
    // Return the saturation hint and surface the *contributing* AreaDeductions
    // (each with its own explanation text identifying the source technique)
    // as the result's deduction context, so the UI's Supporting deductions
    // panel can show what the hint combined.
    return { type: 'hint', hint: saturation.hint, deductions: saturation.supporting };
  }

  return { type: 'deductions', deductions };
}

/**
 * Convenience hint wrapper. line-case-split's primary output is deductions;
 * it occasionally finds a direct cross via the contradiction branch, which
 * is surfaced through the main solver's cell-deduction resolver.
 */
export function findLineCaseSplitHint(_state: PuzzleState): Hint | null {
  return null;
}

/**
 * Enumerate every valid combination of `remaining` non-adjacent stars that
 * could fill the empties of a line. Respects current state's adjacency to
 * existing stars and the simple per-cell quota constraints.
 */
function enumerateLinePlacements(
  state: PuzzleState,
  lineEmpties: Coords[],
  remaining: number,
): Coords[][] {
  const { size, starsPerUnit } = state.def;
  const MAX = 32;

  // First filter: drop empties that already conflict with existing stars.
  const viable = lineEmpties.filter((cell) => {
    for (const nb of neighbors8(cell, size)) {
      if (getCell(state, nb) === 'star') return false;
    }
    const cellRegionId = state.def.regions[cell.row][cell.col];
    if (countStars(state, rowCells(state, cell.row)) >= starsPerUnit) return false;
    if (countStars(state, colCells(state, cell.col)) >= starsPerUnit) return false;
    if (countStars(state, regionCells(state, cellRegionId)) >= starsPerUnit) return false;
    return true;
  });

  if (viable.length < remaining) return [];

  const results: Coords[][] = [];

  function recurse(startIdx: number, picked: Coords[]) {
    if (picked.length === remaining) {
      results.push(picked.slice());
      return;
    }
    for (let i = startIdx; i < viable.length; i += 1) {
      if (results.length >= MAX) return;
      const cell = viable[i];

      // Adjacency to other picks.
      let conflict = false;
      for (const p of picked) {
        if (Math.abs(cell.row - p.row) <= 1 && Math.abs(cell.col - p.col) <= 1) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      // Per-unit quota checks accounting for previously-picked stars in the
      // same row/col/region. The viable filter only checked existing-state
      // quotas; without this, two picks in the same region/column could
      // overshoot starsPerUnit.
      const regId = state.def.regions[cell.row][cell.col];
      let pickedInRegion = 0;
      let pickedInRow = 0;
      let pickedInCol = 0;
      for (const p of picked) {
        if (state.def.regions[p.row][p.col] === regId) pickedInRegion += 1;
        if (p.row === cell.row) pickedInRow += 1;
        if (p.col === cell.col) pickedInCol += 1;
      }
      if (countStars(state, regionCells(state, regId)) + pickedInRegion + 1 > starsPerUnit) continue;
      if (countStars(state, rowCells(state, cell.row)) + pickedInRow + 1 > starsPerUnit) continue;
      if (countStars(state, colCells(state, cell.col)) + pickedInCol + 1 > starsPerUnit) continue;

      picked.push(cell);
      recurse(i + 1, picked);
      picked.pop();
    }
  }

  recurse(0, []);
  return results;
}

/**
 * Propagate forced consequences from hypothetically placing the given stars.
 *
 * Applies, to fixed point (or `MAX_ITER` rounds):
 *   - star-adjacency crosses (8-neighbours)
 *   - 2×2 single-star crosses
 *   - line/region saturation (quota met → empties → crosses)
 *   - line/region tightness (remaining empties == remaining stars → empties → stars)
 *
 * Returns the list of *all* stars on the propagated board, or `null` if
 * propagation detects a contradiction (an over-saturated unit or a
 * 2×2/adjacency violation).
 */
function propagateForcedStars(state: PuzzleState, placement: Coords[]): Coords[] | null {
  const { size, starsPerUnit, regions } = state.def;
  const cells: CellState[][] = state.cells.map((row) => [...row]);

  for (const star of placement) {
    if (cells[star.row][star.col] !== 'empty') return null;
    cells[star.row][star.col] = 'star';
  }

  const MAX_ITER = 8;

  for (let iter = 0; iter < MAX_ITER; iter += 1) {
    let changed = false;

    // 1. Star adjacency crosses + adjacent-star contradiction.
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (cells[r][c] !== 'star') continue;
        for (const nb of neighbors8({ row: r, col: c }, size)) {
          if (cells[nb.row][nb.col] === 'star' && (nb.row !== r || nb.col !== c)) {
            return null; // adjacent stars
          }
          if (cells[nb.row][nb.col] === 'empty') {
            cells[nb.row][nb.col] = 'cross';
            changed = true;
          }
        }
      }
    }

    // 2. 2×2: at most one star per 2×2 window.
    for (let r = 0; r < size - 1; r += 1) {
      for (let c = 0; c < size - 1; c += 1) {
        const block: Coords[] = [
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ];
        let starCount = 0;
        for (const b of block) if (cells[b.row][b.col] === 'star') starCount += 1;
        if (starCount > 1) return null;
        if (starCount === 1) {
          for (const b of block) {
            if (cells[b.row][b.col] === 'empty') {
              cells[b.row][b.col] = 'cross';
              changed = true;
            }
          }
        }
      }
    }

    // 3. Row quota & tightness.
    for (let r = 0; r < size; r += 1) {
      let stars = 0;
      let empties = 0;
      const emptyList: Coords[] = [];
      for (let c = 0; c < size; c += 1) {
        if (cells[r][c] === 'star') stars += 1;
        else if (cells[r][c] === 'empty') {
          empties += 1;
          emptyList.push({ row: r, col: c });
        }
      }
      if (stars > starsPerUnit) return null;
      if (stars + empties < starsPerUnit) return null;
      if (stars === starsPerUnit && empties > 0) {
        for (const e of emptyList) cells[e.row][e.col] = 'cross';
        changed = true;
      } else if (starsPerUnit - stars === empties && empties > 0) {
        for (const e of emptyList) cells[e.row][e.col] = 'star';
        changed = true;
      }
    }

    // 4. Column quota & tightness.
    for (let c = 0; c < size; c += 1) {
      let stars = 0;
      let empties = 0;
      const emptyList: Coords[] = [];
      for (let r = 0; r < size; r += 1) {
        if (cells[r][c] === 'star') stars += 1;
        else if (cells[r][c] === 'empty') {
          empties += 1;
          emptyList.push({ row: r, col: c });
        }
      }
      if (stars > starsPerUnit) return null;
      if (stars + empties < starsPerUnit) return null;
      if (stars === starsPerUnit && empties > 0) {
        for (const e of emptyList) cells[e.row][e.col] = 'cross';
        changed = true;
      } else if (starsPerUnit - stars === empties && empties > 0) {
        for (const e of emptyList) cells[e.row][e.col] = 'star';
        changed = true;
      }
    }

    // 5. Region quota & tightness.
    const regionStars = new Map<number, number>();
    const regionEmpties = new Map<number, Coords[]>();
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const id = regions[r][c];
        if (cells[r][c] === 'star') {
          regionStars.set(id, (regionStars.get(id) ?? 0) + 1);
        } else if (cells[r][c] === 'empty') {
          if (!regionEmpties.has(id)) regionEmpties.set(id, []);
          regionEmpties.get(id)!.push({ row: r, col: c });
        }
      }
    }
    for (const [id, stars] of regionStars) {
      const empties = regionEmpties.get(id) ?? [];
      if (stars > starsPerUnit) return null;
      if (stars + empties.length < starsPerUnit) return null;
      if (stars === starsPerUnit && empties.length > 0) {
        for (const e of empties) cells[e.row][e.col] = 'cross';
        changed = true;
      } else if (starsPerUnit - stars === empties.length && empties.length > 0) {
        for (const e of empties) cells[e.row][e.col] = 'star';
        changed = true;
      }
    }
    // Regions that have no stars yet but missing from regionStars: treat as 0.
    for (const [id, empties] of regionEmpties) {
      if (regionStars.has(id)) continue;
      if (empties.length < starsPerUnit) return null;
      if (starsPerUnit === empties.length) {
        for (const e of empties) cells[e.row][e.col] = 'star';
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Collect every star on the propagated board.
  const out: Coords[] = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (cells[r][c] === 'star') out.push({ row: r, col: c });
    }
  }
  return out;
}

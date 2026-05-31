/**
 * Constraint feature evaluation functions
 * These functions evaluate boolean features for candidate cells (triple rules)
 * or for rule mappings (constrained rules with multiple forced-empty cells).
 */

import type { PuzzleState, Coords } from '../../types/puzzle';

/**
 * Evaluate a named constraint feature.
 * - candidate: required for candidate_* features; pass null for mapping-level features
 * - mappedStars: the actual board positions of the canonical stars after transform+translate
 */
export function evaluateFeature(
  featureName: string,
  state: PuzzleState,
  candidate: Coords | null,
  mappedStars?: Coords[]
): boolean {
  switch (featureName) {
    // ── Candidate-level features (triple rules) ──────────────────────────────
    case 'candidate_on_outer_ring':
      return candidate !== null && candidateOnOuterRing(state, candidate);
    case 'candidate_in_ring_1':
      return candidate !== null && candidateInRing1(state, candidate);
    case 'candidate_in_same_row_as_any_star':
      return candidate !== null && candidateInSameRowAsAnyStar(candidate, mappedStars);
    case 'candidate_in_same_col_as_any_star':
      return candidate !== null && candidateInSameColAsAnyStar(candidate, mappedStars);

    // ── Star-position features (constrained rules) ───────────────────────────
    case 'allStarsInLeftHalf':
      return allStarsInHalf(state, mappedStars, 'left');
    case 'allStarsInRightHalf':
      return allStarsInHalf(state, mappedStars, 'right');
    case 'allStarsInTopHalf':
      return allStarsInHalf(state, mappedStars, 'top');
    case 'anyStarOnLeftEdge':
      return !!mappedStars && mappedStars.some((s) => s.col === 0);
    case 'anyStarOnRightEdge':
      return !!mappedStars && mappedStars.some((s) => s.col === state.def.size - 1);

    // ── Board-state features (constrained rules) ─────────────────────────────
    case 'has_empty_on_row0':
      return hasEmptyOnRow(state, 0);
    case 'has_empty_on_row_board_size_minus_1':
      return hasEmptyOnRow(state, state.def.size - 1);
    case 'has_empty_on_col0':
      return hasEmptyOnCol(state, 0);
    case 'has_empty_on_col_board_size_minus_1':
      return hasEmptyOnCol(state, state.def.size - 1);
    case 'has_empty_in_top_left_3x3':
      return hasEmptyInCorner(state, 'topLeft');
    case 'has_empty_in_top_right_3x3':
      return hasEmptyInCorner(state, 'topRight');
    case 'has_empty_in_bottom_left_3x3':
      return hasEmptyInCorner(state, 'bottomLeft');
    case 'has_empty_in_bottom_right_3x3':
      return hasEmptyInCorner(state, 'bottomRight');

    default:
      // Unknown features default to false (conservative — don't fire unknown rules)
      console.warn(`Unknown constraint feature: ${featureName}`);
      return false;
  }
}

/**
 * Evaluate all constraint features. Returns true only if every feature passes.
 * candidate may be null for mapping-level (constrained-rule) evaluation.
 */
export function evaluateAllFeatures(
  featureNames: string[],
  state: PuzzleState,
  candidate: Coords | null,
  mappedStars?: Coords[]
): boolean {
  return featureNames.every((name) =>
    evaluateFeature(name, state, candidate, mappedStars)
  );
}

// ── Candidate-level helpers ───────────────────────────────────────────────────

/**
 * Candidate is on ring 1 (one cell in from edge) but NOT on the actual edge.
 * Excludes corners and edge positions that are ambiguous with the outer ring.
 */
function candidateOnOuterRing(state: PuzzleState, candidate: Coords): boolean {
  const { size } = state.def;
  const last = size - 1;
  const isOnRing1 = (
    candidate.row === 1 || candidate.row === last - 1 ||
    candidate.col === 1 || candidate.col === last - 1
  );
  const isOnActualEdge = (
    candidate.row === 0 || candidate.row === last ||
    candidate.col === 0 || candidate.col === last
  );
  return isOnRing1 && !isOnActualEdge;
}

function candidateInRing1(state: PuzzleState, candidate: Coords): boolean {
  const { size } = state.def;
  return (
    (candidate.row === 1 || candidate.row === size - 2) &&
    candidate.col >= 1 && candidate.col < size - 1
  ) || (
    (candidate.col === 1 || candidate.col === size - 2) &&
    candidate.row >= 1 && candidate.row < size - 1
  );
}

function candidateInSameRowAsAnyStar(candidate: Coords, mappedStars?: Coords[]): boolean {
  return !!mappedStars && mappedStars.some((s) => s.row === candidate.row);
}

function candidateInSameColAsAnyStar(candidate: Coords, mappedStars?: Coords[]): boolean {
  return !!mappedStars && mappedStars.some((s) => s.col === candidate.col);
}

// ── Star-position helpers ─────────────────────────────────────────────────────

function allStarsInHalf(
  state: PuzzleState,
  mappedStars: Coords[] | undefined,
  half: 'left' | 'right' | 'top'
): boolean {
  if (!mappedStars || mappedStars.length === 0) return false;
  const { size } = state.def;
  const mid = size / 2;
  return mappedStars.every((s) => {
    if (half === 'left')  return s.col < mid;
    if (half === 'right') return s.col >= mid;
    return s.row < mid; // top
  });
}


// ── Board-state helpers ───────────────────────────────────────────────────────

function hasEmptyOnRow(state: PuzzleState, row: number): boolean {
  for (let c = 0; c < state.def.size; c += 1) {
    if (state.cells[row][c] === 'empty') return true;
  }
  return false;
}

function hasEmptyOnCol(state: PuzzleState, col: number): boolean {
  for (let r = 0; r < state.def.size; r += 1) {
    if (state.cells[r][col] === 'empty') return true;
  }
  return false;
}

function hasEmptyInCorner(
  state: PuzzleState,
  corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
): boolean {
  const { size } = state.def;
  const rowStart = corner.startsWith('bottom') ? size - 3 : 0;
  const colStart = corner.endsWith('Right') ? size - 3 : 0;
  for (let r = rowStart; r < rowStart + 3; r += 1) {
    for (let c = colStart; c < colStart + 3; c += 1) {
      if (state.cells[r][c] === 'empty') return true;
    }
  }
  return false;
}

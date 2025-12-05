import type { PuzzleState } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { describeConstraintPair, findSubsetConstraintSqueeze } from '../stats';

let hintCounter = 0;
function nextHintId() {
  hintCounter += 1;
  return `subset-squeeze-${hintCounter}`;
}

export function findSubsetConstraintSqueezeHint(state: PuzzleState): Hint | null {
  const result = findSubsetConstraintSqueeze(state);
  if (!result) return null;

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'subset-constraint-squeeze',
    resultCells: result.eliminations,
    explanation: `Subset constraint squeeze: ${describeConstraintPair(result.small, result.large)}. Cells outside the smaller constraint cannot contain stars.`,
    highlights: {
      cells: [...result.small.cells, ...result.eliminations],
    },
  };
}


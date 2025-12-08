/**
 * Pattern matcher for runtime pattern matching
 */

import type { BoardState, CellId } from '../schemas/model/types';
import type { LoadedPattern } from './loader';
import type { SchemaApplication } from '../schemas/types';
import { CellState, coordToCellId, cellIdToCoord } from '../schemas/model/types';
import { isStarCandidate } from '../schemas/helpers/cellHelpers';

/**
 * Window specification for pattern matching
 */
export interface WindowSpec {
  width: number;
  height: number;
  originRow: number;
  originCol: number;
}

/**
 * Match a pattern in a window on the board
 */
export function matchPatternInWindow(
  pattern: LoadedPattern,
  window: WindowSpec,
  state: BoardState
): SchemaApplication | null {
  const { width, height, originRow, originCol } = window;
  const size = state.size;

  // Check if window fits on board
  if (originRow + height > size || originCol + width > size) {
    return null;
  }

  // Check if pattern window size matches
  if (pattern.window_width !== width || pattern.window_height !== height) {
    return null;
  }

  // Verify pattern preconditions match current board state
  // This is simplified - full implementation would check:
  // - Region IDs match
  // - Candidate cells match
  // - Quotas match
  // - Band configurations match

  // For now, we'll do a basic check on candidate cells
  const patternData = pattern.data;
  
  // Map relative cell IDs to absolute cell IDs
  const relativeToAbsolute = (relativeId: number): CellId => {
    const relRow = Math.floor(relativeId / pattern.window_width);
    const relCol = relativeId % pattern.window_width;
    const absRow = originRow + relRow;
    const absCol = originCol + relCol;
    return coordToCellId({ row: absRow, col: absCol }, size);
  };

  // Check if pattern's candidate cells match board state
  // (Simplified - full implementation would verify all preconditions)
  const patternCandidates = patternData.candidate_cells || [];
  for (const relCellId of patternCandidates) {
    const absCellId = relativeToAbsolute(relCellId);
    if (!isStarCandidate(state, absCellId)) {
      return null; // Precondition not met
    }
  }

  // If preconditions match, apply pattern deductions
  // Filter out deductions for cells that are already filled
  const deductions = pattern.deductions.flatMap(ded => {
    return ded.relative_cell_ids
      .map(relCellId => {
        const absCellId = relativeToAbsolute(relCellId);
        const currentState = state.cellStates[absCellId];
        
        // Skip if cell is already filled
        if (currentState === CellState.Star || currentState === CellState.Empty) {
          return null;
        }
        
        // Skip if deduction conflicts with current state
        if (ded.type === 'forceStar' && currentState === CellState.Empty) {
          return null; // Can't force star if already empty
        }
        if (ded.type === 'forceEmpty' && currentState === CellState.Star) {
          return null; // Can't force empty if already star
        }
        
        return {
          cell: absCellId,
          type: ded.type,
        };
      })
      .filter((d): d is { cell: CellId; type: 'forceStar' | 'forceEmpty' } => d !== null);
  });

  if (deductions.length === 0) {
    return null; // No new deductions to apply
  }

  // Build explanation
  const explanation = {
    schemaId: `pattern_${pattern.familyId}`,
    steps: [
      {
        kind: 'countStarsInBand' as const,
        entities: {
          note: `Pattern ${pattern.id} from family ${pattern.familyId} matched`,
          window: { row: originRow, col: originCol, width, height },
        },
      },
    ],
  };

  return {
    schemaId: `pattern_${pattern.familyId}`,
    params: {
      patternId: pattern.id,
      familyId: pattern.familyId,
      window,
    },
    deductions,
    explanation,
  };
}

/**
 * Enumerate windows for pattern matching
 */
export function enumerateWindows(
  state: BoardState,
  patternWidth: number,
  patternHeight: number
): WindowSpec[] {
  const windows: WindowSpec[] = [];
  const size = state.size;

  for (let r = 0; r <= size - patternHeight; r++) {
    for (let c = 0; c <= size - patternWidth; c++) {
      windows.push({
        width: patternWidth,
        height: patternHeight,
        originRow: r,
        originCol: c,
      });
    }
  }

  return windows;
}


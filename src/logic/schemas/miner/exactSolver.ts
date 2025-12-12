/**
 * Exact solver for pattern verification
 * Enumerates all completions of a partial board state
 */

import type { BoardState, CellId } from '../model/types';
import { CellState } from '../model/types';
import { getNeighbors8, areAdjacent } from '../helpers/cellHelpers';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';
import type { Group } from '../model/types';

/**
 * Completion analysis result
 */
export interface CompletionAnalysis {
  cellResults: Map<CellId, 'alwaysStar' | 'alwaysEmpty' | 'variable'>;
  totalCompletions: number;
  complete: boolean;     // true only if the search fully explored without timeout/cap
  timedOut: boolean;
  cappedAtMax: boolean;
}

/**
 * Enumerate all completions of a partial board state
 * Returns analysis of which cells are always star, always empty, or variable
 */
export function enumerateAllCompletions(
  state: BoardState,
  maxCompletions: number = 10000,
  timeoutMs: number = 5000
): CompletionAnalysis {
  const startTime = Date.now();
  const cellResults = new Map<CellId, Set<CellState>>();
  const size = state.size;
  
  // Initialize cell results tracking
  for (let i = 0; i < size * size; i++) {
    cellResults.set(i, new Set());
  }
  
  let completionCount = 0;
  let timedOut = false;
  let cappedAtMax = false;
  
  // Backtracking solver
  function solve(currentState: BoardState, depth: number): boolean {
    // Timeout check
    if (Date.now() - startTime > timeoutMs) {
      timedOut = true;
      return false; // stop search
    }
    
    // Check if we've found enough completions
    if (completionCount >= maxCompletions) {
      cappedAtMax = true;
      return false; // stop search
    }
    
    // Find next unknown cell
    let nextCell: CellId | null = null;
    for (let i = 0; i < size * size; i++) {
      if (currentState.cellStates[i] === CellState.Unknown) {
        nextCell = i;
        break;
      }
    }
    
    // If no unknown cells, check if this is a valid completion
    if (nextCell === null) {
      if (isValidCompletion(currentState)) {
        // Record this completion
        for (let i = 0; i < size * size; i++) {
          const state = currentState.cellStates[i];
          cellResults.get(i)!.add(state);
        }
        completionCount++;
        if (completionCount >= maxCompletions) {
          cappedAtMax = true;
          return false;
        }
        return true; // continue search
      }
      return true; // continue search
    }
    
    // Try placing star
    const stateWithStar = cloneStateWithCell(currentState, nextCell, CellState.Star);
    if (isValidPartialState(stateWithStar)) {
      if (!solve(stateWithStar, depth + 1)) return false;
    }
    
    // Try placing empty
    const stateWithEmpty = cloneStateWithCell(currentState, nextCell, CellState.Empty);
    if (isValidPartialState(stateWithEmpty)) {
      if (!solve(stateWithEmpty, depth + 1)) return false;
    }
    
    return true;
  }
  
  // Start solving
  solve(state, 0);
  const complete = !timedOut && !cappedAtMax;
  
  // Analyze results
  const analysis: CompletionAnalysis = {
    cellResults: new Map(),
    totalCompletions: completionCount,
    complete,
    timedOut,
    cappedAtMax,
  };
  
  for (let i = 0; i < size * size; i++) {
    if (!complete) {
      analysis.cellResults.set(i, 'variable');
      continue;
    }

    const states = cellResults.get(i)!;
    if (states.size === 0) {
      analysis.cellResults.set(i, 'variable');
    } else if (states.size === 1) {
      const state = Array.from(states)[0];
      analysis.cellResults.set(i, state === CellState.Star ? 'alwaysStar' : 'alwaysEmpty');
    } else {
      // Check if it's always the same
      const hasStar = states.has(CellState.Star);
      const hasEmpty = states.has(CellState.Empty);
      if (hasStar && !hasEmpty) {
        analysis.cellResults.set(i, 'alwaysStar');
      } else if (hasEmpty && !hasStar) {
        analysis.cellResults.set(i, 'alwaysEmpty');
      } else {
        analysis.cellResults.set(i, 'variable');
      }
    }
  }
  
  return analysis;
}

/**
 * Check if a completion is valid (all constraints satisfied)
 */
function isValidCompletion(state: BoardState): boolean {
  // Check row quotas
  for (const row of state.rows) {
    const starCount = row.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    if (starCount !== row.starsRequired) {
      return false;
    }
  }
  
  // Check column quotas
  for (const col of state.cols) {
    const starCount = col.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    if (starCount !== col.starsRequired) {
      return false;
    }
  }
  
  // Check region quotas
  for (const region of state.regions) {
    const starCount = region.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    if (starCount !== region.starsRequired) {
      return false;
    }
  }
  
  // Check adjacency (no adjacent stars)
  for (let i = 0; i < state.size * state.size; i++) {
    if (state.cellStates[i] === CellState.Star) {
      const neighbors = getNeighbors8(i, state.size);
      for (const neighbor of neighbors) {
        const neighborId = neighbor.row * state.size + neighbor.col;
        if (state.cellStates[neighborId] === CellState.Star) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Check if a partial state is valid (could lead to a valid completion)
 */
function isValidPartialState(state: BoardState): boolean {
  // Check row quotas (not exceeded)
  for (const row of state.rows) {
    const starCount = row.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    const emptyCount = row.cells.filter(cellId => state.cellStates[cellId] === CellState.Empty).length;
    const remaining = row.cells.length - starCount - emptyCount;
    if (starCount > row.starsRequired) return false;
    if (starCount + remaining < row.starsRequired) return false;
  }
  
  // Check column quotas (not exceeded)
  for (const col of state.cols) {
    const starCount = col.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    const emptyCount = col.cells.filter(cellId => state.cellStates[cellId] === CellState.Empty).length;
    const remaining = col.cells.length - starCount - emptyCount;
    if (starCount > col.starsRequired) return false;
    if (starCount + remaining < col.starsRequired) return false;
  }
  
  // Check region quotas (not exceeded)
  for (const region of state.regions) {
    const starCount = region.cells.filter(cellId => state.cellStates[cellId] === CellState.Star).length;
    const emptyCount = region.cells.filter(cellId => state.cellStates[cellId] === CellState.Empty).length;
    const remaining = region.cells.length - starCount - emptyCount;
    if (starCount > region.starsRequired) return false;
    if (starCount + remaining < region.starsRequired) return false;
  }
  
  // Check adjacency (no adjacent stars)
  for (let i = 0; i < state.size * state.size; i++) {
    if (state.cellStates[i] === CellState.Star) {
      const neighbors = getNeighbors8(i, state.size);
      for (const neighbor of neighbors) {
        const neighborId = neighbor.row * state.size + neighbor.col;
        if (state.cellStates[neighborId] === CellState.Star) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Clone state with a cell set to a specific value
 */
function cloneStateWithCell(state: BoardState, cellId: CellId, value: CellState): BoardState {
  const newCellStates = [...state.cellStates];
  newCellStates[cellId] = value;
  return {
    ...state,
    cellStates: newCellStates,
  };
}


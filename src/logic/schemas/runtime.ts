/**
 * Runtime schema application system
 * Integrates with the existing solver hint system
 */

import type { PuzzleState } from '../../types/puzzle';
import type { Hint, HintHighlight } from '../../types/hints';
import { puzzleStateToBoardState } from './model/state';
import { applyAllSchemas, type SchemaContext } from './registry';
import type { SchemaApplication } from './types';
import { renderExplanation } from './explanations/templates';
import { getAllPatternApplications } from '../patterns/runtime';

/**
 * Convert schema application to hint format
 */
function schemaApplicationToHint(app: SchemaApplication, state: PuzzleState): {
  id: string;
  technique: 'schema-based';
  explanation: string;
  forcedStars: Array<{ row: number; col: number }>;
  forcedCrosses: Array<{ row: number; col: number }>;
  highlights?: HintHighlight;
} {
  const { def } = state;
  
  // Convert deductions to hint format
  const forcedStars: Array<{ row: number; col: number }> = [];
  const forcedCrosses: Array<{ row: number; col: number }> = [];
  
  for (const deduction of app.deductions) {
    const row = Math.floor(deduction.cell / def.size);
    const col = deduction.cell % def.size;
    
    if (deduction.type === 'forceStar') {
      forcedStars.push({ row, col });
    } else {
      forcedCrosses.push({ row, col });
    }
  }
  
  // Build explanation text using templates
  const ctx: SchemaContext = {
    state: puzzleStateToBoardState(state),
  };
  const explanationLines = renderExplanation(app.explanation, ctx);
  
  // Extract highlights from explanation entities
  const highlights: HintHighlight = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };
  
  for (const step of app.explanation.steps) {
    if (step.entities.band) {
      if (step.entities.band.rows) {
        highlights.rows?.push(...step.entities.band.rows);
      }
      if (step.entities.band.cols) {
        highlights.cols?.push(...step.entities.band.cols);
      }
    }
    if (step.entities.regions) {
      const regionIds = (step.entities.regions as any[])
        .map((r: any) => r.regionId)
        .filter((id: any) => id !== undefined);
      highlights.regions?.push(...regionIds);
    }
    if (step.entities.region) {
      highlights.regions?.push((step.entities.region as any).regionId);
    }
  }
  
  // Add deduction cells to highlights
  for (const deduction of app.deductions) {
    const row = Math.floor(deduction.cell / def.size);
    const col = deduction.cell % def.size;
    highlights.cells?.push({ row, col });
  }
  
  return {
    id: `schema-${app.schemaId}-${Date.now()}`,
    technique: 'schema-based',
    explanation: explanationLines.join(' ') || `Schema ${app.schemaId} found ${app.deductions.length} deduction(s)`,
    forcedStars,
    forcedCrosses,
    highlights: highlights.cells?.length || highlights.rows?.length || highlights.cols?.length || highlights.regions?.length
      ? highlights
      : undefined,
  };
}

/**
 * Find schema-based hints for a puzzle state
 */
export function findSchemaHints(state: PuzzleState): Hint | null {
  // Convert to board state
  const boardState = puzzleStateToBoardState(state);
  
  // Create schema context
  const ctx: SchemaContext = {
    state: boardState,
  };
  
  // Apply all schemas
  let applications = applyAllSchemas(ctx);
  
  // Also try pattern matching
  const patternApplications = getAllPatternApplications(ctx);
  applications = [...applications, ...patternApplications];
  
  // Filter out applications with no valid deductions (cells already filled)
  applications = applications.filter(app => {
    const validDeductions = app.deductions.filter(ded => {
      const row = Math.floor(ded.cell / state.def.size);
      const col = ded.cell % state.def.size;
      const currentValue = state.cells[row][col];
      
      // Skip if cell is already filled with the same value
      if (ded.type === 'forceStar' && currentValue === 'star') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'cross') return false;
      
      // Skip if deduction conflicts with current state
      if (ded.type === 'forceStar' && currentValue === 'cross') return false;
      if (ded.type === 'forceEmpty' && currentValue === 'star') return false;
      
      return true; // Valid deduction
    });
    
    // Update deductions to only include valid ones
    app.deductions = validDeductions;
    
    // Only keep applications with at least one valid deduction
    return validDeductions.length > 0;
  });
  
  if (applications.length === 0) {
    return null;
  }
  
  // Return the first (highest priority) application as a hint
  // In full implementation, we might want to return multiple hints or combine them
  return schemaApplicationToHint(applications[0], state);
}

/**
 * Apply schema deductions to puzzle state
 * Returns new state with deductions applied
 */
export function applySchemaDeductions(
  state: PuzzleState,
  applications: SchemaApplication[]
): PuzzleState {
  const newCells = state.cells.map(row => [...row]);
  
  for (const app of applications) {
    for (const deduction of app.deductions) {
      const row = Math.floor(deduction.cell / state.def.size);
      const col = deduction.cell % state.def.size;
      
      if (deduction.type === 'forceStar') {
        newCells[row][col] = 'star';
      } else {
        newCells[row][col] = 'cross';
      }
    }
  }
  
  return {
    ...state,
    cells: newCells,
  };
}


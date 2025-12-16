/**
 * E1 – Candidate Deficit Schema
 * 
 * Detects when a group has exactly as many candidates as needed stars.
 * All candidates must be stars.
 * 
 * Priority: 1 (highest - most basic deduction)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance, DeductionType } from '../types';
import type { Group, BoardState, CellId } from '../model/types';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';

/**
 * Get all groups from board state
 */
function getAllGroups(state: BoardState): Group[] {
  const groups: Group[] = [];
  
  // Add rows
  for (const row of state.rows) {
    groups.push({
      kind: 'row',
      id: `row_${row.rowIndex}`,
      cells: row.cells,
      starsRequired: row.starsRequired,
    });
  }
  
  // Add columns
  for (const col of state.cols) {
    groups.push({
      kind: 'column',
      id: `col_${col.colIndex}`,
      cells: col.cells,
      starsRequired: col.starsRequired,
    });
  }
  
  // Add regions
  for (const region of state.regions) {
    groups.push({
      kind: 'region',
      id: `region_${region.id}`,
      cells: region.cells,
      starsRequired: region.starsRequired,
    });
  }
  
  return groups;
}

/**
 * Build E1 explanation
 */
function buildE1Explanation(group: Group, candidates: CellId[], state: BoardState): ExplanationInstance {
  const remainingStars = getStarsRemainingInGroup(group, state);
  return {
    schemaId: 'E1_candidateDeficit',
    steps: [
      {
        kind: 'countStarsInBand', // Reusing step kind, but this is for group
        entities: {
          group: {
            kind: group.kind,
            id: group.id,
          },
          remainingStars,
          candidates: candidates.length,
        },
      },
    ],
  };
}

/**
 * E1 Schema implementation
 */
export const E1Schema: Schema = {
  id: 'E1_candidateDeficit',
  kind: 'core',
  priority: 1, // Highest priority
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    
    // Get all groups
    const groups = getAllGroups(state);
    
    for (const group of groups) {
      const q = getStarsRemainingInGroup(group, state);
      const candidates = getCandidatesInGroup(group, state);
      
      
      // E1 rules:
      // 1) If candidates.length === remaining stars (q), all candidates must be stars.
      // 2) If q === 0, the group is already complete, so all remaining candidates must be empty.
      if ((q > 0 && candidates.length === q) || (q === 0 && candidates.length > 0)) {
        const forceType = q === 0 ? 'forceEmpty' : 'forceStar';
        const deductions = candidates.map(cell => ({ cell, type: forceType as DeductionType }));
        const explanation = buildE1Explanation(group, candidates, state);

        applications.push({
          schemaId: 'E1_candidateDeficit',
          params: {
            groupId: group.id,
            groupKind: group.kind,
            remainingStars: q,
            candidateCount: candidates.length,
          },
          deductions,
          explanation,
        });
      }
    }
    
    return applications;
  },
};


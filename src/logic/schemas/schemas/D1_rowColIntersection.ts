/**
 * D1 – Row × Column Intersection Squeeze
 * 
 * Determine forced star/empty by comparing needed stars
 * in intersecting row/column groups.
 * 
 * Priority: 5
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';
import type { Group } from '../model/types';

/**
 * Build D1 explanation
 */
function buildD1Explanation(
  row: Group,
  col: Group,
  cell: number,
  caseType: 'forcedStar' | 'forcedEmpty'
): ExplanationInstance {
  return {
    schemaId: 'D1_rowColIntersection',
    steps: [
      {
        kind: 'countStarsInBand',
        entities: {
          row: { kind: 'row', id: row.id },
          col: { kind: 'column', id: col.id },
          cell,
          case: caseType,
        },
      },
    ],
  };
}

/**
 * D1 Schema implementation
 */
export const D1Schema: Schema = {
  id: 'D1_rowColIntersection',
  kind: 'mixed',
  priority: 5,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // For each row and column intersection
    for (const row of state.rows) {
      const rowGroup: Group = {
        kind: 'row',
        id: `row_${row.rowIndex}`,
        cells: row.cells,
        starsRequired: row.starsRequired,
      };

      for (const col of state.cols) {
        const colGroup: Group = {
          kind: 'column',
          id: `col_${col.colIndex}`,
          cells: col.cells,
          starsRequired: col.starsRequired,
        };

        // Get intersection cell
        const p = row.rowIndex * size + col.colIndex;

        // Check if cell is a candidate
        if (state.cellStates[p] !== 0) continue; // Not Unknown

        const rowNeeds = getStarsRemainingInGroup(rowGroup, state);
        const colNeeds = getStarsRemainingInGroup(colGroup, state);

        const rowCandidates = getCandidatesInGroup(rowGroup, state);
        const colCandidates = getCandidatesInGroup(colGroup, state);

        const rowCandidatesWithoutP = rowCandidates.filter(x => x !== p);
        const colCandidatesWithoutP = colCandidates.filter(x => x !== p);

        // Case 1: Forced star - removing p would leave row/col without enough candidates
        if (rowCandidatesWithoutP.length < rowNeeds || colCandidatesWithoutP.length < colNeeds) {
          applications.push({
            schemaId: 'D1_rowColIntersection',
            params: {
              row: row.rowIndex,
              col: col.colIndex,
              case: 'forcedStar',
            },
            deductions: [{ cell: p, type: 'forceStar' }],
            explanation: buildD1Explanation(rowGroup, colGroup, p, 'forcedStar'),
          });
          continue;
        }

        // Case 2: Forced empty - row/column quota already satisfied
        if (rowNeeds === 0 || colNeeds === 0) {
          applications.push({
            schemaId: 'D1_rowColIntersection',
            params: {
              row: row.rowIndex,
              col: col.colIndex,
              case: 'forcedEmpty',
            },
            deductions: [{ cell: p, type: 'forceEmpty' }],
            explanation: buildD1Explanation(rowGroup, colGroup, p, 'forcedEmpty'),
          });
        }
      }
    }

    return applications;
  },
};


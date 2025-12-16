/**
 * E2 – Partitioned Candidates
 * 
 * Constrain star placement when a group's candidate cells
 * are partitioned into disjoint subareas.
 * 
 * Priority: 1 (after E1)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Group } from '../model/types';
import { getStarsRemainingInGroup, getCandidatesInGroup } from '../helpers/groupHelpers';
import { partitionCandidates, type Partition } from '../helpers/partitionHelpers';

/**
 * Build E2 explanation
 */
function buildE2Explanation(group: Group, partitions: Partition[], quota: number): ExplanationInstance {
  return {
    schemaId: 'E2_partitionedCandidates',
    steps: [
      {
        kind: 'countStarsInBand',
        entities: {
          group: {
            kind: group.kind,
            id: group.id,
          },
          remainingStars: quota,
          partitions: partitions.map((p, i) => ({
            partitionIndex: i,
            candidateCount: p.cells.length,
          })),
        },
      },
    ],
  };
}

/**
 * E2 Schema implementation
 */
export const E2Schema: Schema = {
  id: 'E2_partitionedCandidates',
  kind: 'core',
  priority: 1, // Same priority as E1
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // Get all groups
    const groups: Group[] = [];
    for (const row of state.rows) {
      groups.push({
        kind: 'row',
        id: `row_${row.rowIndex}`,
        cells: row.cells,
        starsRequired: row.starsRequired,
      });
    }
    for (const col of state.cols) {
      groups.push({
        kind: 'column',
        id: `col_${col.colIndex}`,
        cells: col.cells,
        starsRequired: col.starsRequired,
      });
    }
    for (const region of state.regions) {
      groups.push({
        kind: 'region',
        id: `region_${region.id}`,
        cells: region.cells,
        starsRequired: region.starsRequired,
      });
    }

    for (const group of groups) {
      const q = getStarsRemainingInGroup(group, state);
      const partitions = partitionCandidates(group, state);

      // Sum of candidate counts across partitions
      const total = partitions.reduce((sum, p) => sum + p.cells.length, 0);

      // If total equals remaining stars, all candidates must be stars
      if (total === q && q > 0) {
        const deductions = partitions.flatMap(p =>
          p.cells.map(c => ({ cell: c, type: 'forceStar' as const }))
        );

        applications.push({
          schemaId: 'E2_partitionedCandidates',
          params: {
            groupId: group.id,
            groupKind: group.kind,
            quota: q,
            partitionCount: partitions.length,
          },
          deductions,
          explanation: buildE2Explanation(group, partitions, q),
        });
      }
    }

    return applications;
  },
};


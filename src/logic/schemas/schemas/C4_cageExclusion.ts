/**
 * C4 – Cage Exclusion
 * 
 * Identify when a 2×2 block's single star cannot lie in certain cells
 * due to adjacency or line/region saturation.
 * 
 * Priority: 4
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Block2x2, Group } from '../model/types';
import { isStarCandidate } from '../helpers/cellHelpers';
import { getGroupsIntersectingCells, getQuotaInBlock } from '../helpers/blockHelpers';

/**
 * Build C4 explanation
 */
function buildC4Explanation(
  block: Block2x2,
  group: Group,
  caseType: 'exclude' | 'forceIn',
  quota: number
): ExplanationInstance {
  return {
    schemaId: 'C4_cageExclusion',
    steps: [
      {
        kind: 'identifyCandidateBlocks',
        entities: {
          block: { kind: 'block2x2', blockId: block.id },
          note: 'This 2×2 block can contain only one star',
        },
      },
      {
        kind: 'countRegionQuota',
        entities: {
          group: {
            kind: group.kind,
            id: group.id,
          },
          quota,
          case: caseType,
        },
      },
    ],
  };
}

/**
 * C4 Schema implementation
 */
export const C4Schema: Schema = {
  id: 'C4_cageExclusion',
  kind: 'cage2x2',
  priority: 4,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // For each 2×2 block
    for (const block of state.blocks2x2) {
      const validCells = block.cells.filter(c => isStarCandidate(state, c));

      if (validCells.length === 0) continue;

      // Check all groups intersecting this block
      const groups = getGroupsIntersectingCells(state, block.cells);

      for (const G of groups) {
        const quota = getQuotaInBlock(G, block, state);

        // Case 1: G must not place a star here (quota = 0)
        if (quota === 0) {
          const deductions = block.cells
            .filter(c => G.cells.includes(c))
            .map(c => ({ cell: c, type: 'forceEmpty' as const }));

          if (deductions.length > 0) {
            const explanation = buildC4Explanation(block, G, 'exclude', quota);

            applications.push({
              schemaId: 'C4_cageExclusion',
              params: {
                blockId: block.id,
                groupId: G.id,
                case: 'exclude',
              },
              deductions,
              explanation,
            });
          }
        }

        // Case 2: G must place a star here (quota = 1) and only one valid cell
        if (quota === 1) {
          const possible = validCells.filter(c => G.cells.includes(c));
          if (possible.length === 1) {
            const deductions = [{ cell: possible[0], type: 'forceStar' as const }];
            const explanation = buildC4Explanation(block, G, 'forceIn', quota);

            applications.push({
              schemaId: 'C4_cageExclusion',
              params: {
                blockId: block.id,
                groupId: G.id,
                case: 'forceIn',
              },
              deductions,
              explanation,
            });
          }
        }
      }
    }

    return applications;
  },
};


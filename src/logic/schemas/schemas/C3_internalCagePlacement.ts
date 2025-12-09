/**
 * C3 – Internal Cage Placement Inside a Region
 * 
 * Within a region, if number of valid 2×2 blocks equals
 * the region's remaining stars, each block must contain exactly one star.
 * 
 * Priority: 4
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region, Block2x2 } from '../model/types';
import { getValidBlocksInRegion } from '../helpers/blockHelpers';
import { getStarsRemainingInGroup } from '../helpers/groupHelpers';
import { CellState } from '../model/types';

/**
 * C3 Schema implementation
 */
export const C3Schema: Schema = {
  id: 'C3_internalCagePlacement',
  kind: 'cage2x2',
  priority: 4,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // For each region
    for (const region of state.regions) {
      const qRemaining = getStarsRemainingInGroup(
        {
          kind: 'region',
          id: `region_${region.id}`,
          cells: region.cells,
          starsRequired: region.starsRequired,
        },
        state
      );

      if (qRemaining <= 0) continue;

      // Get valid 2×2 blocks completely inside the region
      const validBlocks = getValidBlocksInRegion(region, state);

      // If number of valid blocks equals remaining stars
      if (validBlocks.length === qRemaining) {
        // Pre-filter: Skip if all cells in blocks are already filled (no unknown cells)
        // This prevents generating applications that will be filtered out
        const hasUnknownCells = validBlocks.some(block => 
          block.cells.some(cellId => state.cellStates[cellId] === 0) // CellState.Unknown
        );
        
        if (!hasUnknownCells) continue; // Skip if all cells are already filled

        // Each block must contain exactly one star
        // This is meta-information (similar to C1)
        // Combined with other constraints, can force star positions

        const explanation: ExplanationInstance = {
          schemaId: 'C3_internalCagePlacement',
          steps: [
            {
              kind: 'countRegionQuota',
              entities: {
                region: { kind: 'region', regionId: region.id },
                remainingStars: qRemaining,
              },
            },
            {
              kind: 'identifyCandidateBlocks',
              entities: {
                blocks: validBlocks.map(b => ({ kind: 'block2x2', blockId: b.id })),
                blockCount: validBlocks.length,
              },
            },
            {
              kind: 'applyPigeonhole',
              entities: {
                note: 'Each block must contain exactly one star',
              },
            },
          ],
        };

        applications.push({
          schemaId: 'C3_internalCagePlacement',
          params: {
            regionId: region.id,
            remainingStars: qRemaining,
            blocks: validBlocks.map(b => b.id),
          },
          deductions: [], // C3 alone sets up meta-information
          explanation,
        });
      }
    }

    return applications;
  },
};


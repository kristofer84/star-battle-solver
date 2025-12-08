/**
 * A2 – Column-Band vs Regions Star-Budget Squeeze
 * 
 * Symmetric to A1 but with columns.
 * 
 * Priority: 2 (after E1, same as A1)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { ColumnBand, Region } from '../model/types';
import { enumerateColumnBands } from '../helpers/bandHelpers';
import {
  getRegionsIntersectingCols,
  regionFullyInsideCols,
  computeRemainingStarsInBand,
  getCandidatesInRegionAndCols,
  getRegionBandQuota,
  allHaveKnownBandQuota,
} from '../helpers/bandHelpers';

/**
 * Build A2 explanation (symmetric to A1)
 */
function buildA2Explanation(
  band: ColumnBand,
  fullInside: Region[],
  otherPartial: Region[],
  target: Region,
  starsRemaining: number,
  state: any
): ExplanationInstance {
  const steps = [
    {
      kind: 'countStarsInBand' as const,
      entities: {
        band: {
          kind: 'colBand',
          cols: band.cols,
        },
        starsNeeded: band.cols.length * state.starsPerLine,
      },
    },
  ];

  if (fullInside.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: fullInside.map(r => ({ kind: 'region', regionId: r.id })),
        totalStars: fullInside.reduce((sum, r) => sum + r.starsRequired, 0),
      },
    });
  }

  if (otherPartial.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: otherPartial.map(r => ({ kind: 'region', regionId: r.id })),
        note: 'known band quotas',
      },
    });
  }

  steps.push({
    kind: 'countRemainingStars' as const,
    entities: {
      remainingStars: starsRemaining,
      targetRegion: { kind: 'region', regionId: target.id },
    },
  });

  return {
    schemaId: 'A2_colBand_regionBudget',
    steps,
  };
}

/**
 * A2 Schema implementation
 */
export const A2Schema: Schema = {
  id: 'A2_colBand_regionBudget',
  kind: 'bandBudget',
  priority: 2,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Enumerate all column bands
    const bands = enumerateColumnBands(state);

    for (const band of bands) {
      const cols = band.cols;
      const colsStarsNeeded = cols.length * state.starsPerLine;
      const regions = getRegionsIntersectingCols(state, cols);

      // Partition regions into full inside and partial
      const fullInside = regions.filter(r => regionFullyInsideCols(r, cols, size));
      const partial = regions.filter(r => !regionFullyInsideCols(r, cols, size));

      // For each target partial region
      for (const target of partial) {
        const otherPartial = partial.filter(r => r !== target);

        // Check if all other partial regions have known band quotas
        if (!allHaveKnownBandQuota(otherPartial, band, state)) {
          continue;
        }

        // Compute stars forced in band
        const starsForcedFullInside = fullInside.reduce(
          (sum, r) => sum + r.starsRequired,
          0
        );

        const starsForcedOtherPartial = otherPartial.reduce((sum, r) => {
          const quota = getRegionBandQuota(r, band, state);
          return sum + quota;
        }, 0);

        const starsForcedInC = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInC = colsStarsNeeded - starsForcedInC;

        // Get candidates in target region within band
        const candInTargetBand = getCandidatesInRegionAndCols(target, cols, state);

        // Check if we can make a deduction
        if (starsRemainingInC < 0 || starsRemainingInC > candInTargetBand.length) {
          continue;
        }

        // If remaining equals candidate count or 0, we can force stars or empties
        if (starsRemainingInC === 0 || starsRemainingInC === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInC === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildA2Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInC,
            state
          );

          applications.push({
            schemaId: 'A2_colBand_regionBudget',
            params: {
              cols,
              targetRegionId: target.id,
              starsInBand: starsRemainingInC,
            },
            deductions,
            explanation,
          });
        }
      }
    }

    return applications;
  },
};


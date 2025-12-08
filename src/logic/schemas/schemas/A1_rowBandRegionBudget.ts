/**
 * A1 – Row-Band vs Regions Star-Budget Squeeze
 * 
 * Given a band of rows, consider regions that intersect it.
 * Some regions are fully inside, some are partial.
 * By counting stars already committed, deduce how many stars
 * a specific partial region must place in the band.
 * 
 * Priority: 2 (after E1)
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { RowBand, Region } from '../model/types';
import { enumerateRowBands } from '../helpers/bandHelpers';
import {
  getRegionsIntersectingRows,
  regionFullyInsideRows,
  computeRemainingStarsInBand,
  getCandidatesInRegionAndRows,
  getRegionBandQuota,
  allHaveKnownBandQuota,
} from '../helpers/bandHelpers';
import { getStarCountInCells } from '../helpers/cellHelpers';
import { CellState } from '../model/types';

/**
 * Build A1 explanation
 */
function buildA1Explanation(
  band: RowBand,
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
          kind: 'rowBand',
          rows: band.rows,
        },
        starsNeeded: band.rows.length * state.starsPerLine,
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
    schemaId: 'A1_rowBand_regionBudget',
    steps,
  };
}

/**
 * A1 Schema implementation
 */
export const A1Schema: Schema = {
  id: 'A1_rowBand_regionBudget',
  kind: 'bandBudget',
  priority: 2,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    // Enumerate all row bands
    const bands = enumerateRowBands(state);

    for (const band of bands) {
      const rows = band.rows;
      const rowsStarsNeeded = rows.length * state.starsPerLine;
      const regions = getRegionsIntersectingRows(state, rows);

      // Partition regions into full inside and partial
      const fullInside = regions.filter(r => regionFullyInsideRows(r, rows, size));
      const partial = regions.filter(r => !regionFullyInsideRows(r, rows, size));

      // For each target partial region
      for (const target of partial) {
        const otherPartial = partial.filter(r => r !== target);

        // Check if all other partial regions have known band quotas
        if (!allHaveKnownBandQuota(otherPartial, band, state)) {
          // Skip if we can't compute quotas for all other partial regions
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

        const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInR = rowsStarsNeeded - starsForcedInR;

        // Get candidates in target region within band
        const candInTargetBand = getCandidatesInRegionAndRows(target, rows, state);

        // Check if we can make a deduction
        if (starsRemainingInR < 0 || starsRemainingInR > candInTargetBand.length) {
          // Inconsistent or not useful
          continue;
        }

        // If remaining equals candidate count or 0, we can force stars or empties
        if (starsRemainingInR === 0 || starsRemainingInR === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInR === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildA1Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInR,
            state
          );

          applications.push({
            schemaId: 'A1_rowBand_regionBudget',
            params: {
              rows,
              targetRegionId: target.id,
              starsInBand: starsRemainingInR,
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


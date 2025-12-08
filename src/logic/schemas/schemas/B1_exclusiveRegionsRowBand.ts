/**
 * B1 – Exclusive Regions Inside a Row Band
 * 
 * This is essentially a more concrete instantiation of A1,
 * but framed as a schema that emphasizes specific regions in the band.
 * All candidate cells within a row band belong to a small set of regions.
 * 
 * Priority: 3
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

/**
 * Build B1 explanation with named regions
 */
function buildB1Explanation(
  band: RowBand,
  fullInside: Region[],
  otherPartial: Region[],
  target: Region,
  starsRemaining: number,
  allRegions: Region[],
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
        note: 'Regions A, B, C, D cover the band',
        regions: allRegions.map((r, i) => ({
          name: String.fromCharCode(65 + i), // A, B, C, D...
          regionId: r.id,
        })),
      },
    },
  ];

  if (fullInside.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: fullInside.map((r, i) => ({
          name: String.fromCharCode(65 + i),
          kind: 'region',
          regionId: r.id,
        })),
        totalStars: fullInside.reduce((sum, r) => sum + r.starsRequired, 0),
        note: 'fully contained regions',
      },
    });
  }

  if (otherPartial.length > 0) {
    steps.push({
      kind: 'countRegionQuota' as const,
      entities: {
        regions: otherPartial.map((r, i) => ({
          name: String.fromCharCode(65 + fullInside.length + i),
          kind: 'region',
          regionId: r.id,
        })),
        note: 'known band quotas',
      },
    });
  }

  steps.push({
    kind: 'countRemainingStars' as const,
    entities: {
      remainingStars: starsRemaining,
      targetRegion: {
        name: String.fromCharCode(65 + fullInside.length + otherPartial.length),
        kind: 'region',
        regionId: target.id,
      },
    },
  });

  return {
    schemaId: 'B1_exclusiveRegions_rowBand',
    steps,
  };
}

/**
 * B1 Schema implementation
 * Uses A1 logic but with enhanced explanation emphasizing named regions
 */
export const B1Schema: Schema = {
  id: 'B1_exclusiveRegions_rowBand',
  kind: 'exclusiveArea',
  priority: 3,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    const bands = enumerateRowBands(state);

    for (const band of bands) {
      const rows = band.rows;
      const rowsStarsNeeded = rows.length * state.starsPerLine;
      const regions = getRegionsIntersectingRows(state, rows);

      // Get all regions with candidates in the band (exclusive set)
      const regionsWithCandidates = regions.filter(r => {
        const candidates = getCandidatesInRegionAndRows(r, rows, state);
        return candidates.length > 0;
      });

      // If we have a small set of regions (B1 emphasizes this)
      if (regionsWithCandidates.length > 4) {
        // B1 is most useful with small sets, but we can still apply
        continue;
      }

      const fullInside = regionsWithCandidates.filter(r => regionFullyInsideRows(r, rows, size));
      const partial = regionsWithCandidates.filter(r => !regionFullyInsideRows(r, rows, size));

      for (const target of partial) {
        const otherPartial = partial.filter(r => r !== target);

        if (!allHaveKnownBandQuota(otherPartial, band, state)) {
          continue;
        }

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

        const candInTargetBand = getCandidatesInRegionAndRows(target, rows, state);

        if (starsRemainingInR < 0 || starsRemainingInR > candInTargetBand.length) {
          continue;
        }

        if (starsRemainingInR === 0 || starsRemainingInR === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInR === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildB1Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInR,
            regionsWithCandidates,
            state
          );

          applications.push({
            schemaId: 'B1_exclusiveRegions_rowBand',
            params: {
              rows,
              targetRegionId: target.id,
              starsInBand: starsRemainingInR,
              regionCount: regionsWithCandidates.length,
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


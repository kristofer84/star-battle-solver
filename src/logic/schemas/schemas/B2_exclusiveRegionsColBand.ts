/**
 * B2 – Exclusive Regions Inside a Column Band
 * 
 * Symmetric to B1 but with columns.
 * 
 * Priority: 3
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
import { idToLetter } from '../../helpers';

/**
 * Build B2 explanation with named regions (symmetric to B1)
 */
function buildB2Explanation(
  band: ColumnBand,
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
          kind: 'colBand',
          cols: band.cols,
        },
        starsNeeded: band.cols.length * state.starsPerLine,
        note: 'Regions A, B, C, D cover the band',
        regions: allRegions.map((r, i) => ({
          name: idToLetter(i),
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
          name: idToLetter(i),
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
          name: idToLetter(fullInside.length + i),
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
        name: idToLetter(fullInside.length + otherPartial.length),
        kind: 'region',
        regionId: target.id,
      },
    },
  });

  return {
    schemaId: 'B2_exclusiveRegions_colBand',
    steps,
  };
}

/**
 * B2 Schema implementation
 */
export const B2Schema: Schema = {
  id: 'B2_exclusiveRegions_colBand',
  kind: 'exclusiveArea',
  priority: 3,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const size = state.size;

    const bands = enumerateColumnBands(state);

    for (const band of bands) {
      const cols = band.cols;
      const colsStarsNeeded = cols.length * state.starsPerLine;
      const regions = getRegionsIntersectingCols(state, cols);

      const regionsWithCandidates = regions.filter(r => {
        const candidates = getCandidatesInRegionAndCols(r, cols, state);
        return candidates.length > 0;
      });

      if (regionsWithCandidates.length > 4) {
        continue;
      }

      const fullInside = regionsWithCandidates.filter(r => regionFullyInsideCols(r, cols, size));
      const partial = regionsWithCandidates.filter(r => !regionFullyInsideCols(r, cols, size));

      for (const target of partial) {
        const otherPartial = partial.filter(r => r !== target);

        if (!(await allHaveKnownBandQuota(otherPartial, band, state))) {
          continue;
        }

        const starsForcedFullInside = fullInside.reduce(
          (sum, r) => sum + r.starsRequired,
          0
        );

        let starsForcedOtherPartial = 0;
        for (const r of otherPartial) {
          const quota = await getRegionBandQuota(r, band, state);
          starsForcedOtherPartial += quota;
        }

        const starsForcedInC = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInC = colsStarsNeeded - starsForcedInC;

        const candInTargetBand = getCandidatesInRegionAndCols(target, cols, state);

        if (starsRemainingInC < 0 || starsRemainingInC > candInTargetBand.length) {
          continue;
        }

        if (starsRemainingInC === 0 || starsRemainingInC === candInTargetBand.length) {
          const deductions = candInTargetBand.map(cell => ({
            cell,
            type: (starsRemainingInC === 0 ? 'forceEmpty' : 'forceStar') as const,
          }));

          const explanation = buildB2Explanation(
            band,
            fullInside,
            otherPartial,
            target,
            starsRemainingInC,
            regionsWithCandidates,
            state
          );

          applications.push({
            schemaId: 'B2_exclusiveRegions_colBand',
            params: {
              cols,
              targetRegionId: target.id,
              starsInBand: starsRemainingInC,
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


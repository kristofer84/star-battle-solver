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
  computeRemainingStarsInBand,
  getCandidatesInRegionAndRows,
  getRegionBandQuota,
  getAllCellsOfRegionInBand,
  getStarCountInRegion,
  getCellsOfRegionInBand,
} from '../helpers/bandHelpers';
import { regionFullyInsideRows } from '../helpers/groupHelpers';
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

        // Compute stars forced in band
        const starsForcedFullInside = fullInside.reduce(
          (sum, r) => sum + r.starsRequired,
          0
        );

        // Compute stars forced by other partial regions
        // According to spec, we can only use KNOWN quotas (not conservative estimates)
        // A quota is "known" if:
        // 1. Region is fully inside band (quota = starsRequired)
        // 2. All remaining candidates are in band (quota = starsInBand + remainingStars)
        // 3. Region has no remaining stars (quota = starsInBand)
        // 4. Quota was deduced (quota > current stars in band)
        let starsForcedOtherPartial = 0;
        let allOtherPartialHaveKnownQuotas = true;

        for (const r of otherPartial) {
          const quota = getRegionBandQuota(r, band, state);
          const allCells = getAllCellsOfRegionInBand(r, band, state);
          const starsInBand = allCells.filter(c => state.cellStates[c] === 1).length;
          const remainingStars = r.starsRequired - getStarCountInRegion(r, state);
          const candidatesInBand = getCellsOfRegionInBand(r, band, state)
            .filter(c => state.cellStates[c] === 0).length;
          const allCandidates = r.cells.filter(c => state.cellStates[c] === 0).length;

          // Check if quota is "known" (not just conservative estimate)
          const isKnown =
            remainingStars === 0 || // No remaining stars, quota is just current stars
            candidatesInBand === allCandidates || // All candidates in band
            quota === r.starsRequired || // Fully inside band
            quota > starsInBand; // Quota was deduced (greater than current stars)

          if (!isKnown) {
            // This region doesn't have a known quota, so we can't make deductions
            allOtherPartialHaveKnownQuotas = false;
            break;
          }

          // Use the quota (which is known)
          starsForcedOtherPartial += quota;
        }

        // Only proceed if all other partial regions have known quotas
        if (!allOtherPartialHaveKnownQuotas) {
          continue;
        }

        const starsForcedInR = starsForcedFullInside + starsForcedOtherPartial;
        const starsRemainingInR = rowsStarsNeeded - starsForcedInR;

        // Get candidates in target region within band
        const candInTargetBand = getCandidatesInRegionAndRows(target, rows, state);
        if (candInTargetBand.length === 0) continue;

        const remainingInTarget = target.starsRequired - getStarCountInRegion(target, state);
        if (remainingInTarget === 0) continue;

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


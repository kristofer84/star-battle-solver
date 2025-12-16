/**
 * F1 – Region-Pair Exclusion
 * 
 * When two regions compete for the same constrained area,
 * one region saturating it forces the other away.
 * 
 * Priority: 6
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { Region, RowBand, ColumnBand } from '../model/types';
import { enumerateBands } from '../helpers/bandHelpers';
import { getCellsOfRegionInBand, getRegionBandQuota } from '../helpers/bandHelpers';
import { isStarCandidate } from '../helpers/cellHelpers';

/**
 * Build F1 explanation
 */
function buildF1Explanation(
  regionA: Region,
  regionB: Region,
  zone: RowBand | ColumnBand,
  quotaA: number
): ExplanationInstance {
  return {
    schemaId: 'F1_regionPairExclusion',
    steps: [
      {
        kind: 'countRegionQuota',
        entities: {
          regionA: { kind: 'region', regionId: regionA.id },
          regionB: { kind: 'region', regionId: regionB.id },
          zone: zone.type === 'rowBand'
            ? { kind: 'rowBand', rows: zone.rows }
            : { kind: 'colBand', cols: zone.cols },
          quotaA,
        },
      },
      {
        kind: 'eliminateOtherRegionCells',
        entities: {
          note: 'Region A saturates zone, so Region B cannot place stars here',
        },
      },
    ],
  };
}

/**
 * F1 Schema implementation
 */
export const F1Schema: Schema = {
  id: 'F1_regionPairExclusion',
  kind: 'multiRegion',
  priority: 6,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    const regions = state.regions;

    // For each pair of regions
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const A = regions[i];
        const B = regions[j];

        // Evaluate exclusion zones (bands)
        const zones = enumerateBands(state);

        for (const zone of zones) {
          const XA = getCellsOfRegionInBand(A, zone, state);
          const XB = getCellsOfRegionInBand(B, zone, state);

          const qA = await getRegionBandQuota(A, zone, state);
          const qB = await getRegionBandQuota(B, zone, state);

          const candA = XA.filter(c => isStarCandidate(state, c));
          const candB = XB.filter(c => isStarCandidate(state, c));

          // If A fills its quota here (candidates === quota), B is excluded
          if (candA.length === qA && qA > 0) {
            const deductions = candB.map(c => ({ cell: c, type: 'forceEmpty' as const }));

            if (deductions.length > 0) {
              applications.push({
                schemaId: 'F1_regionPairExclusion',
                params: {
                  regionA: A.id,
                  regionB: B.id,
                  zone: zone.type === 'rowBand' ? zone.rows : zone.cols,
                  zoneType: zone.type,
                  quotaA: qA,
                },
                deductions,
                explanation: buildF1Explanation(A, B, zone, qA),
              });
            }
          }
        }
      }
    }

    return applications;
  },
};


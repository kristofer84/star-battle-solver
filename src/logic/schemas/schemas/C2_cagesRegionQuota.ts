/**
 * C2 – 2×2 Cages vs Region Quota
 * 
 * If a region fully covers some blocks in a band where C1 holds,
 * and the number of fully-covered blocks equals the region's band quota,
 * then all other region cells in the band are forced empty.
 * 
 * Priority: 4
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { RowBand, Block2x2 } from '../model/types';
import { CellState } from '../model/types';
import { enumerateRowBands } from '../helpers/bandHelpers';
import {
  computeRemainingStarsInBand,
  getRegionsIntersectingBand,
  getCellsOfRegionInBand,
  getAllCellsOfRegionInBand,
  getRegionBandQuota,
} from '../helpers/bandHelpers';
import { getMaxNonOverlappingBlocksInBand, getValidBlocksInBand } from '../helpers/blockHelpers';

/**
 * C2 Schema implementation
 */
export const C2Schema: Schema = {
  id: 'C2_cages_regionQuota',
  kind: 'cage2x2',
  priority: 4,
  apply(ctx: SchemaContext): SchemaApplication[] {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    const bands: RowBand[] = enumerateRowBands(state).filter(b => b.rows.length === 2);

    for (const band of bands) {
      const remaining = computeRemainingStarsInBand(band, state);
      const validBlocks = getValidBlocksInBand(band, state);
      const maxBlocks = getMaxNonOverlappingBlocksInBand(band, state);

      if (maxBlocks.length !== remaining) {
        continue;
      }

      const regions = getRegionsIntersectingBand(state, band);

      for (const region of regions) {
        const quota = getRegionBandQuota(region, band, state);
        const cellsInBand = getAllCellsOfRegionInBand(region, band, state);
        const unknownInBand = cellsInBand.filter(
          cellId => state.cellStates[cellId] === CellState.Unknown
        );

        if (quota === 0 || unknownInBand.length === 0) {
          continue;
        }

        const regionCellSet = new Set(region.cells);
        const fullBlocksInRegion: Block2x2[] = maxBlocks.filter(block =>
          block.cells.every(cellId => regionCellSet.has(cellId))
        );

        if (fullBlocksInRegion.length !== quota) {
          continue;
        }

        const fullBlockCellSet = new Set<number>();
        for (const block of fullBlocksInRegion) {
          block.cells.forEach(cellId => fullBlockCellSet.add(cellId));
        }

        const forcedCrossCells = unknownInBand.filter(cellId => !fullBlockCellSet.has(cellId));
        if (forcedCrossCells.length === 0) {
          continue;
        }

        const deductions = forcedCrossCells.map(cell => ({
          type: 'forceEmpty' as const,
          cell,
        }));

        const explanation: ExplanationInstance = {
          schemaId: 'C2_cages_regionQuota',
          steps: [
            {
              kind: 'countRegionQuota',
              entities: {
                region: { kind: 'region', regionId: region.id },
                band: { kind: 'rowBand', rows: band.rows },
                quota,
              },
            },
            {
              kind: 'assignCageStars',
              entities: {
                region: { kind: 'region', regionId: region.id },
                blocks: fullBlocksInRegion.map(b => ({ kind: 'block2x2', blockId: b.id })),
              },
            },
            {
              kind: 'eliminateOtherRegionCells',
              entities: {
                region: { kind: 'region', regionId: region.id },
                cells: forcedCrossCells,
              },
            },
          ],
        };

        applications.push({
          schemaId: 'C2_cages_regionQuota',
          params: {
            bandKind: band.type,
            regionId: region.id,
            rows: band.rows,
            blocks: validBlocks.map(b => b.id),
            fullBlocksForRegion: fullBlocksInRegion.map(b => b.id),
            quotaDB: quota,
          },
          deductions,
          explanation,
        });
      }
    }

    return applications;
  },
};


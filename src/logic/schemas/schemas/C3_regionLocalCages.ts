/**
 * C3 – Region-Local Cage Schema
 * 
 * For each band and region:
 * - Identify valid 2×2 blocks fully inside region ∩ band
 * - Use exact-cover packing to find all ways to pack quota blocks
 * - Deduce: cells never appearing in any solution → cross
 * 
 * Priority: 5
 */

import type { Schema, SchemaContext, SchemaApplication, ExplanationInstance } from '../types';
import type { RowBand, ColumnBand, Region, Block2x2 } from '../model/types';
import { enumerateBands } from '../helpers/bandHelpers';
import {
  getRegionsIntersectingBand,
  getAllCellsOfRegionInBand,
  getRegionBandQuota,
} from '../helpers/bandHelpers';
import { getValidBlocksInBand } from '../helpers/blockHelpers';
import { findCagePackings, type CageBlock } from '../helpers/blockPacking';
import { CellState } from '../model/types';

/**
 * C3 Schema implementation
 */
export const C3RegionLocalCagesSchema: Schema = {
  id: 'C3_regionLocalCages',
  kind: 'cage2x2',
  priority: 5,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;

    // Enumerate all bands (row and column)
    const bands = enumerateBands(state);

    for (const band of bands) {
      // Get all valid blocks in the band
      const allBlocks = getValidBlocksInBand(band, state);
      
      // Get regions intersecting this band
      const regions = getRegionsIntersectingBand(state, band);

      for (const region of regions) {
        // Get region's quota in this band
        const quota = await getRegionBandQuota(region, band, state);
        if (quota <= 0) continue;

        // Get all cells of region in band
        const regionCells = new Set(getAllCellsOfRegionInBand(region, band, state));
        
        // Filter blocks to only those fully inside region ∩ band
        const regionBlocks: CageBlock[] = allBlocks
          .filter(block => {
            // Block must be fully inside region (all 4 cells in region)
            return block.cells.every(cell => regionCells.has(cell));
          })
          .map(block => ({
            id: block.id,
            cells: block.cells,
          }));

        if (regionBlocks.length === 0) continue;

        // Run exact-cover packing
        const packing = findCagePackings(regionBlocks, {
          band: {
            type: band.type === 'rowBand' ? 'rowBand' : 'colBand',
            rows: band.type === 'rowBand' ? band.rows : undefined,
            cols: band.type === 'colBand' ? band.cols : undefined,
            cells: band.cells,
          },
          targetBlockCount: quota,
        });

        // If no solutions, skip (might indicate inconsistency, but let other schemas handle it)
        if (packing.solutions.length === 0) continue;

        // Build deductions: cells never appearing in any solution → cross
        const deductions: Array<{ cell: number; to: 'cross' }> = [];
        
        for (const cell of regionCells) {
          // Only consider unknown cells
          if (state.cellStates[cell] === CellState.Unknown) {
            // If cell is not in any solution, it must be empty
            if (!packing.possibleCells.has(cell)) {
              deductions.push({ cell, to: 'cross' });
            }
          }
        }

        if (deductions.length > 0) {
          // Build explanation
          const explanation: ExplanationInstance = {
            schemaId: 'C3_regionLocalCages',
            steps: [
              {
                kind: 'countRegionQuota',
                entities: {
                  region: { kind: 'region', regionId: region.id },
                  band: band.type === 'rowBand'
                    ? { kind: 'rowBand', rows: band.rows }
                    : { kind: 'colBand', cols: band.cols },
                  quota,
                },
              },
              {
                kind: 'identifyCandidateBlocks',
                entities: {
                  blocks: regionBlocks.map(b => ({ kind: 'block2x2', blockId: b.id })),
                  blockCount: regionBlocks.length,
                },
              },
              {
                kind: 'applyPigeonhole',
                entities: {
                  note: `Found ${packing.solutions.length} valid packings of ${quota} blocks`,
                },
              },
              {
                kind: 'eliminateOtherRegionCells',
                entities: {
                  cells: deductions.map(d => ({ kind: 'cell', cell: d.cell })),
                  reason: 'Cells never appear in any valid packing',
                },
              },
            ],
          };

          applications.push({
            schemaId: 'C3_regionLocalCages',
            deductions: deductions.map(d => ({
              cell: d.cell,
              type: 'forceEmpty',
            })),
            params: {
              regionId: region.id,
              band: {
                type: band.type,
                rows: band.type === 'rowBand' ? band.rows : undefined,
                cols: band.type === 'colBand' ? band.cols : undefined,
              },
              quota,
              solutionCount: packing.solutions.length,
            },
            explanation,
          });
        }
      }
    }

    return applications;
  },
};


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
import type { RowBand, ColumnBand, Block2x2 } from '../model/types';
import { enumerateBands } from '../helpers/bandHelpers';
import {
  computeRemainingStarsInBand,
  getRegionsIntersectingBand,
  getCellsOfRegionInBand,
  getAllCellsOfRegionInBand,
  getRegionBandQuota,
} from '../helpers/bandHelpers';
import { getValidBlocksInBand } from '../helpers/blockHelpers';
import { findCagePackings, type CageBlock } from '../helpers/blockPacking';

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

    // Enumerate all bands
    const bands = enumerateBands(state);

    const debugC2 = (typeof process !== 'undefined' && process.env && process.env.DEBUG_C2 === 'true') || false;
    if (debugC2) {
      console.log(`[C2 DEBUG] C2 schema apply called, checking ${bands.length} bands`);
    }
    
    for (const band of bands) {
      const remaining = computeRemainingStarsInBand(band, state);
      
      // Get all valid blocks in the band
      const allBlocks = getValidBlocksInBand(band, state);
      
      // Convert to CageBlock format
      const cageBlocks: CageBlock[] = allBlocks.map(block => ({
        id: block.id,
        cells: block.cells,
      }));

      // Use exact-cover packing to verify C1 condition: can we pack exactly 'remaining' blocks?
      const packing = findCagePackings(cageBlocks, {
        band: {
          type: band.type === 'rowBand' ? 'rowBand' : 'colBand',
          rows: band.type === 'rowBand' ? band.rows : undefined,
          cols: band.type === 'colBand' ? band.cols : undefined,
          cells: band.cells,
        },
        targetBlockCount: remaining,
      });

      if (debugC2 && band.type === 'rowBand' && band.rows.length === 2 && band.rows[0] === 3 && band.rows[1] === 4) {
        console.log(`[C2 DEBUG] Band rows ${band.rows.join(',')}: remaining=${remaining}, solutions=${packing.solutions.length}`);
        if (packing.solutions.length > 0) {
          console.log(`[C2 DEBUG]   First solution block IDs: ${packing.solutions[0].blocks.map(b => b.id).join(', ')}`);
        }
        console.log(`[C2 DEBUG]   C1 condition: solutions.length > 0? ${packing.solutions.length > 0}`);
      }
      
      // C1 condition: must have at least one solution with exactly 'remaining' blocks
      if (packing.solutions.length === 0) continue;
      
      // Use the first solution for block identification (all solutions have same count)
      const nonOverlappingBlocks = packing.solutions[0].blocks.map(b => {
        // Convert back to Block2x2 format for compatibility
        const originalBlock = allBlocks.find(bl => bl.id === b.id);
        if (!originalBlock) {
          throw new Error(`Block ${b.id} not found in original blocks`);
        }
        return originalBlock;
      });

      // Get regions intersecting this band
      const regions = getRegionsIntersectingBand(state, band);

      for (const region of regions) {
        const quotaDB = getRegionBandQuota(region, band, state);
        if (quotaDB <= 0) continue;

        // Get ALL cells of region in band (including stars/crosses) for checking full coverage
        const allRegionCellsInBand = getAllCellsOfRegionInBand(region, band, state);
        // Get candidate cells only for deductions
        const candidateCellsInBand = getCellsOfRegionInBand(region, band, state);

        // Find blocks fully covered by this region (from the non-overlapping set)
        // A block is fully covered if all 4 cells are in the region (regardless of their state)
        const allRegionCellsSet = new Set(allRegionCellsInBand);
        const fullBlocksForD = nonOverlappingBlocks.filter(block => {
          // All 4 cells of block must be in region's band cells
          return block.cells.every(cell => allRegionCellsSet.has(cell));
        });

        const c = fullBlocksForD.length;
        
        if (debugC2 && band.type === 'rowBand' && band.rows.length === 2 && band.rows[0] === 3 && band.rows[1] === 4) {
          console.log(`[C2 DEBUG] Checking region ${region.id}, band rows ${band.rows.join(',')}`);
          console.log(`[C2 DEBUG]   quotaDB=${quotaDB}, fullBlocksForD.length=${c}`);
          console.log(`[C2 DEBUG]   candidateCellsInBand.length=${candidateCellsInBand.length}`);
          console.log(`[C2 DEBUG]   Condition: c === quotaDB (${c} === ${quotaDB})? ${c === quotaDB}`);
          if (region.id === 4) {
            console.log(`[C2 DEBUG]   Region 4: fullBlocksForD IDs: ${fullBlocksForD.map(b => b.id).join(', ')}`);
          }
        }

        // If number of fully-covered blocks equals region's band quota
        if (c === quotaDB) {
          // Region's stars in band must be inside these blocks
          const cellsInFullBlocks = new Set<number>(
            fullBlocksForD.flatMap(b => b.cells)
          );

          // Find candidate cells in region's band that are NOT in fully-covered blocks
          // Only mark unknown cells as empty (not stars or crosses)
          const deductions = candidateCellsInBand
            .filter(cell => !cellsInFullBlocks.has(cell))
            .map(cell => ({
              cell,
              type: 'forceEmpty' as const,
            }));

          if (debugC2 && band.type === 'rowBand' && band.rows.length === 2 && band.rows[0] === 3 && region.id === 4) {
            console.log(`[C2 DEBUG] cellsInFullBlocks: ${Array.from(cellsInFullBlocks).join(', ')}`);
            console.log(`[C2 DEBUG] candidateCellsInBand: ${candidateCellsInBand.join(', ')}`);
            console.log(`[C2 DEBUG] deductions.length=${deductions.length}`);
            if (deductions.length === 0) {
              console.log(`[C2 DEBUG] SKIPPED: No deductions to make`);
            } else {
              console.log(`[C2 DEBUG] SUCCESS: Found ${deductions.length} deductions`);
            }
          }

          if (deductions.length === 0) continue;

          const explanation: ExplanationInstance = {
            schemaId: 'C2_cages_regionQuota',
            steps: [
              {
                kind: 'countRegionQuota',
                entities: {
                  region: { kind: 'region', regionId: region.id },
                  band: band.type === 'rowBand'
                    ? { kind: 'rowBand', rows: band.rows }
                    : { kind: 'colBand', cols: band.cols },
                  quota: quotaDB,
                },
              },
              {
                kind: 'assignCageStars',
                entities: {
                  region: { kind: 'region', regionId: region.id },
                  blocks: fullBlocksForD.map(b => ({ kind: 'block2x2', blockId: b.id })),
                },
              },
              {
                kind: 'eliminateOtherRegionCells',
                entities: {
                  region: { kind: 'region', regionId: region.id },
                  cells: deductions.map(d => d.cell),
                },
              },
            ],
          };

          applications.push({
            schemaId: 'C2_cages_regionQuota',
            params: {
              bandKind: band.type,
              regionId: region.id,
              rows: band.type === 'rowBand' ? band.rows : undefined,
              cols: band.type === 'colBand' ? band.cols : undefined,
              blocks: nonOverlappingBlocks.map(b => b.id),
              fullBlocksForRegion: fullBlocksForD.map(b => b.id),
              quotaDB,
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


/**
 * Explanation templates for rendering schema explanations
 */

import type { ExplanationInstance, SchemaContext } from '../types';
import {
  formatCell,
  formatRowBand,
  formatColumnBand,
  formatRegionQuota,
  formatBlock,
  formatGroup,
} from './phrasing';

/**
 * Render explanation instance to human-readable text
 */
export function renderExplanation(
  instance: ExplanationInstance,
  ctx: SchemaContext
): string[] {
  const { state } = ctx;
  const size = state.size;
  const lines: string[] = [];

  for (const step of instance.steps) {
    // Some schemas may include optional steps that are omitted when not applicable.
    // Skip any missing steps to avoid crashing while rendering explanations.
    if (!step) continue;

    switch (step.kind) {
      case 'countStarsInBand': {
        const band = step.entities.band;
        const starsNeeded = step.entities.starsNeeded;
        if (band?.kind === 'rowBand') {
          lines.push(`${formatRowBand(band.rows)} together must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        } else if (band?.kind === 'colBand') {
          lines.push(`${formatColumnBand(band.cols)} together must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        } else {
          lines.push(`This band must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        }
        break;
      }

      case 'countRegionQuota': {
        const regions = step.entities.regions;
        if (Array.isArray(regions)) {
          const regionNames = regions.map((r: any) => {
            if (r.name) return `region ${r.name} (${r.regionId})`;
            return formatGroup('region', `region_${r.regionId}`);
          }).join(' and ');
          const totalStars = step.entities.totalStars;
          if (totalStars !== undefined) {
            lines.push(`${regionNames} lie entirely within this band, so together they must contain ${totalStars} star${totalStars !== 1 ? 's' : ''}.`);
          } else {
            lines.push(`Count quotas for ${regionNames}.`);
          }
        } else if (step.entities.region) {
          const region = step.entities.region;
          const quota = step.entities.quota || step.entities.remainingStars;
          lines.push(formatRegionQuota(region.regionId, quota));
        }
        break;
      }

      case 'countRemainingStars': {
        const remaining = step.entities.remainingStars;
        const targetRegion = step.entities.targetRegion;
        if (targetRegion) {
          const regionName = targetRegion.name
            ? `region ${targetRegion.name}`
            : formatGroup('region', `region_${targetRegion.regionId}`);
          lines.push(`So only ${remaining} star${remaining !== 1 ? 's' : ''} remain${remaining === 1 ? 's' : ''} to place, and ${remaining === 1 ? 'it' : 'they'} must be in ${regionName}.`);
        } else {
          lines.push(`Compute remaining stars: ${remaining}.`);
        }
        break;
      }

      case 'identifyCandidateBlocks': {
        const blocks = step.entities.blocks;
        const blockCount = step.entities.blockCount || (Array.isArray(blocks) ? blocks.length : 0);
        lines.push(`Only ${blockCount} valid 2×2 block${blockCount !== 1 ? 's' : ''} remain${blockCount === 1 ? 's' : ''} for the remaining stars.`);
        break;
      }

      case 'applyPigeonhole': {
        const note = step.entities.note;
        if (note) {
          lines.push(note);
        } else {
          lines.push(`Because there are exactly as many stars as blocks, each 2×2 must contain exactly 1 star.`);
        }
        break;
      }

      case 'fixRegionBandQuota': {
        const region = step.entities.region;
        const band = step.entities.band;
        const quota = step.entities.quota;
        const regionName = formatGroup('region', `region_${region.regionId}`);
        if (band?.kind === 'rowBand') {
          lines.push(`${regionName} must place ${quota} star${quota !== 1 ? 's' : ''} in ${formatRowBand(band.rows)}.`);
        } else if (band?.kind === 'colBand') {
          lines.push(`${regionName} must place ${quota} star${quota !== 1 ? 's' : ''} in ${formatColumnBand(band.cols)}.`);
        } else {
          lines.push(`${regionName} has quota ${quota} in this band.`);
        }
        break;
      }

      case 'assignCageStars': {
        const region = step.entities.region;
        const blocks = step.entities.blocks;
        const regionName = formatGroup('region', `region_${region.regionId}`);
        const blockCount = Array.isArray(blocks) ? blocks.length : 0;
        lines.push(`${regionName} fully covers ${blockCount} of these block${blockCount !== 1 ? 's' : ''}, so ${blockCount === 1 ? 'it' : 'they'} must contain ${regionName}'s star${blockCount !== 1 ? 's' : ''}.`);
        break;
      }

      case 'eliminateOtherRegionCells': {
        const region = step.entities.region;
        const cells = step.entities.cells;
        const regionName = formatGroup('region', `region_${region.regionId}`);
        if (Array.isArray(cells) && cells.length > 0) {
          const cellStrs = cells.slice(0, 3).map((c: number) => formatCell(c, size));
          const more = cells.length > 3 ? ` and ${cells.length - 3} more` : '';
          lines.push(`Therefore all other ${regionName} cells in this band are empty.`);
        } else {
          lines.push(`Eliminate other ${regionName} cells.`);
        }
        break;
      }

      default:
        lines.push(`[${step.kind}]`);
    }
  }

  return lines;
}


/**
 * Explanation templates for rendering schema explanations
 */

import type { ExplanationInstance, SchemaContext } from '../types';
import {
  formatCell,
  formatRowBand,
  formatColumnBand,
  idToLetterQuota,
  formatBlock,
  formatGroup,
} from './phrasing';
import { idToLetter } from '../../helpers';

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
        if (starsNeeded === undefined) break;

        if (band?.kind === 'rowBand') {
          lines.push(`${formatRowBand(band.rows)} together must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        } else if (band?.kind === 'colBand') {
          lines.push(`${formatColumnBand(band.cols)} together must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        } else {
          lines.push(`This band must contain ${starsNeeded} star${starsNeeded !== 1 ? 's' : ''}.`);
        }
        break;
      }

      case 'partialRegionBandQuota': {
        const regionName = formatGroup('region', `region_${step.entities.regionId}`);
        const quota: number = step.entities.quota;
        const starsInBand: number = step.entities.starsInBand ?? 0;
        const moreNeeded = quota - starsInBand;
        const reason: string = step.entities.quotaReason ?? 'computed';
        const alreadyClause = starsInBand > 0
          ? ` (${starsInBand} already placed)`
          : '';
        if (reason === 'singleCandidate') {
          lines.push(`${regionName} has only 1 candidate cell in this band, so it contributes exactly 1 star here.`);
        } else if (reason === 'allCandidatesInBand') {
          lines.push(`${regionName} has no candidates outside this band, so it must contribute all ${moreNeeded} remaining star${moreNeeded !== 1 ? 's' : ''} here${alreadyClause}.`);
        } else if (reason === 'allGlobalCandidatesForced') {
          lines.push(`All remaining candidates in ${regionName} must be stars; ${moreNeeded} of them are in this band${alreadyClause}.`);
        } else {
          lines.push(`${regionName} must contribute exactly ${quota} star${quota !== 1 ? 's' : ''} to this band${alreadyClause}.`);
        }
        break;
      }

      case 'countRegionQuota': {
        const regions = step.entities.regions;
        if (Array.isArray(regions)) {
          const regionNames = regions.map((r: any) => {
            if (r.name) return `region ${r.name} (${idToLetter(r.regionId)})`;
            return formatGroup('region', `region_${r.regionId}`);
          }).join(' and ');
          const totalStars = step.entities.totalStars;
          const partial = step.entities.partial;
          if (totalStars !== undefined) {
            if (partial) {
              lines.push(`${regionNames} together account for ${totalStars} star${totalStars !== 1 ? 's' : ''} in this band.`);
            } else {
              lines.push(`${regionNames} lie entirely within this band, so together they must contain ${totalStars} star${totalStars !== 1 ? 's' : ''}.`);
            }
          } else {
            lines.push(`Count quotas for ${regionNames}.`);
          }
        } else if (step.entities.region) {
          const region = step.entities.region;
          const quota = step.entities.quota || step.entities.remainingStars;
          lines.push(idToLetterQuota(region.regionId, quota));
        } else if (step.entities.group) {
          const group = step.entities.group as { kind: string; id: string };
          const quota: number = step.entities.quota;
          const groupCase: string = step.entities.case;
          let groupName: string;
          if (group.kind === 'row') {
            const idx = parseInt(group.id.replace('row_', ''), 10);
            groupName = `Row ${idx + 1}`;
          } else if (group.kind === 'column') {
            const idx = parseInt(group.id.replace('col_', ''), 10);
            groupName = `Column ${idx + 1}`;
          } else {
            const idx = parseInt(group.id.replace('region_', ''), 10);
            groupName = `Region ${idToLetter(idx)}`;
          }
          if (groupCase === 'exclude' || quota === 0) {
            lines.push(`${groupName} cannot place any stars in this 2×2 block, so all its cells here must be empty.`);
          } else if (groupCase === 'forceIn' || quota === 1) {
            lines.push(`${groupName} must place exactly 1 star in this 2×2 block, and this is the only valid position.`);
          } else {
            lines.push(`${groupName} has quota ${quota} in this 2×2 block.`);
          }
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
          if (remaining === 0) {
            lines.push(`So ${regionName} must place 0 stars in this band — all its candidate cells here are empty.`);
          } else {
            lines.push(`So ${regionName} must place exactly ${remaining} star${remaining !== 1 ? 's' : ''} in this band.`);
          }
        } else {
          lines.push(`Compute remaining stars: ${remaining}.`);
        }
        break;
      }

      case 'identifyCandidateBlocks': {
        if (step.entities.note) {
          const note: string = step.entities.note;
          lines.push(note.endsWith('.') ? note : `${note}.`);
          break;
        }
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


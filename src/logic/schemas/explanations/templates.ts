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
  groupLabel,
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
        // D1: row × column intersection squeeze
        if (step.entities.row && step.entities.col) {
          const row = step.entities.row as { kind: string; id: string };
          const col = step.entities.col as { kind: string; id: string };
          const caseType: string = step.entities.case ?? '';
          const rowName = groupLabel(row.kind, row.id);
          const colName = groupLabel(col.kind, col.id);
          if (caseType === 'forcedEmpty') {
            lines.push(`${rowName} or ${colName} already has its full quota of stars, so this intersection cell must be empty.`);
          } else {
            lines.push(`${rowName} and ${colName} both need this intersection cell; removing it would leave one of them short.`);
          }
          break;
        }
        // E1/E2: group with exactly as many candidates as needed (candidate deficit)
        if (step.entities.group) {
          const group = step.entities.group as { kind: string; id: string };
          const remaining: number = step.entities.remainingStars ?? 0;
          const candidateCount: number = step.entities.candidates
            ?? ((Array.isArray(step.entities.partitions)
              ? (step.entities.partitions as any[]).reduce((s, p) => s + (p.candidateCount ?? 0), 0)
              : 0));
          const gName = groupLabel(group.kind, group.id);
          if (remaining === 0) {
            lines.push(`${gName} already has all its stars placed; the remaining candidate cells must be empty.`);
          } else {
            lines.push(`${gName} needs ${remaining} more star${remaining !== 1 ? 's' : ''} and has exactly ${candidateCount} candidate${candidateCount !== 1 ? 's' : ''} left — all must be stars.`);
          }
          break;
        }
        // Standard band budget
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
          // C4: group quota within a 2×2 block
          const group = step.entities.group as { kind: string; id: string };
          const quota: number = step.entities.quota;
          const groupCase: string = step.entities.case;
          const gName = groupLabel(group.kind, group.id);
          if (groupCase === 'exclude' || quota === 0) {
            lines.push(`${gName} cannot place any stars in this 2×2 block, so all its cells here must be empty.`);
          } else if (groupCase === 'forceIn' || quota === 1) {
            lines.push(`${gName} must place exactly 1 star in this 2×2 block, and this is the only valid position.`);
          } else {
            lines.push(`${gName} has quota ${quota} in this 2×2 block.`);
          }
        } else if (step.entities.regionA && step.entities.regionB) {
          // F1: region-pair exclusion
          const regionA = step.entities.regionA as { regionId: number };
          const regionB = step.entities.regionB as { regionId: number };
          const zone = step.entities.zone;
          const quotaA: number = step.entities.quotaA ?? 0;
          const nameA = `Region ${idToLetter(regionA.regionId)}`;
          const nameB = `Region ${idToLetter(regionB.regionId)}`;
          let zoneDesc = 'this zone';
          if (zone?.kind === 'rowBand' && Array.isArray(zone.rows)) {
            zoneDesc = formatRowBand(zone.rows);
          } else if (zone?.kind === 'colBand' && Array.isArray(zone.cols)) {
            zoneDesc = formatColumnBand(zone.cols);
          }
          lines.push(`${nameA} must place all ${quotaA} of its star${quotaA !== 1 ? 's' : ''} in ${zoneDesc}, filling its quota there and forcing ${nameB} out.`);
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
        if (step.entities.note) {
          const note: string = step.entities.note;
          lines.push(note.endsWith('.') ? note : `${note}.`);
          break;
        }
        const region = step.entities.region;
        if (!region) {
          if (Array.isArray(step.entities.cells) && step.entities.cells.length > 0) {
            lines.push(`The remaining cells in this area must be empty.`);
          }
          break;
        }
        const regionName = formatGroup('region', `region_${region.regionId}`);
        lines.push(`Therefore all other ${regionName} cells in this band are empty.`);
        break;
      }

      default:
        lines.push(`[${step.kind}]`);
    }
  }

  return lines;
}


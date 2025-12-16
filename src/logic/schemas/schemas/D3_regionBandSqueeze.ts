import type { Schema, SchemaApplication, SchemaContext, ExplanationInstance } from '../types';
import type { ColumnGroup, Region, RowGroup } from '../model/types';
import { getStarCountInCells } from '../helpers/cellHelpers';
import { createPlacementValidator } from '../helpers/placementHelpers';

function buildSqueezeExplanation(
  lineIndex: number,
  lineType: 'row' | 'col',
  regionId: number,
  forced: number[]
): ExplanationInstance {
  return {
    schemaId: 'D3_regionBandSqueeze',
    steps: [
      {
        kind: 'countRemainingStars',
        entities: {
          lineType,
          lineIndex,
          regionId,
          forcedCount: forced.length,
        },
      },
      {
        kind: 'applyPigeonhole',
        entities: {
          forcedCells: forced,
        },
      },
    ],
  };
}

function processLineAndRegion(
  line: RowGroup | ColumnGroup,
  region: Region,
  starsPerLine: number,
  state: SchemaContext['state'],
  shape: Set<number>,
  applications: SchemaApplication[],
  lineType: 'row' | 'col',
  lineIndex: number
) {
  const lineStars = getStarCountInCells(state, line.cells);
  const regionStars = getStarCountInCells(state, region.cells);
  const lineRemaining = starsPerLine - lineStars;
  const regionRemaining = starsPerLine - regionStars;

  if (lineRemaining <= 0 || regionRemaining <= 0) {
    return;
  }

  const validator = createPlacementValidator(state);
  const lineValidCandidates = line.cells.filter(cell => validator.canPlace(cell));
  const regionValidCandidates = region.cells.filter(cell => validator.canPlace(cell));

  const lineValidOutside = lineValidCandidates.filter(cell => !shape.has(cell)).length;
  const regionValidOutside = regionValidCandidates.filter(cell => !shape.has(cell)).length;

  const lineNeeded = Math.max(0, lineRemaining - lineValidOutside);
  const regionNeeded = Math.max(0, regionRemaining - regionValidOutside);
  const starsForced = Math.max(lineNeeded, regionNeeded);

  if (starsForced <= 0) {
    return;
  }

  const shapeCandidates = lineValidCandidates.filter(cell => shape.has(cell));

  if (shapeCandidates.length === starsForced && shapeCandidates.length > 0) {
    const deductions = shapeCandidates.map(cell => ({ cell, type: 'forceStar' as const }));
    applications.push({
      schemaId: 'D3_regionBandSqueeze',
      params: {
        lineType,
        lineIndex,
        regionId: region.id,
      },
      deductions,
      explanation: buildSqueezeExplanation(lineIndex, lineType, region.id, shapeCandidates),
    });
  }
}

export const D3RegionBandSqueezeSchema: Schema = {
  id: 'D3_regionBandSqueeze',
  kind: 'core',
  priority: 3,
  async apply(ctx: SchemaContext): Promise<SchemaApplication[]> {
    const applications: SchemaApplication[] = [];
    const { state } = ctx;
    const { starsPerLine } = state;

    for (const row of state.rows) {
      for (const region of state.regions) {
        const regionCells = new Set(region.cells);
        const shape = new Set(row.cells.filter(cell => regionCells.has(cell)));
        if (shape.size === 0) continue;

        processLineAndRegion(row, region, starsPerLine, state, shape, applications, 'row', row.rowIndex);
      }
    }

    for (const col of state.cols) {
      for (const region of state.regions) {
        const regionCells = new Set(region.cells);
        const shape = new Set(col.cells.filter(cell => regionCells.has(cell)));
        if (shape.size === 0) continue;

        processLineAndRegion(col, region, starsPerLine, state, shape, applications, 'col', col.colIndex);
      }
    }

    return applications;
  },
};

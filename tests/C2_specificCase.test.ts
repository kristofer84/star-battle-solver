import { describe, it, expect } from 'vitest';
import { createEmptyPuzzleState } from '../src/types/puzzle';
import { puzzleStateToBoardState } from '../src/logic/schemas/model/state';
import {
  enumerateRowBands,
  computeRemainingStarsInBand,
  getRegionBandQuota,
  getAllCellsOfRegionInBand,
} from '../src/logic/schemas/helpers/bandHelpers';
import type { RowBand } from '../src/logic/schemas/model/types';
import { getMaxNonOverlappingBlocksInBand } from '../src/logic/schemas/helpers/blockHelpers';
import { findSchemaBasedHint } from '../src/logic/techniques/schemaBased';
import { getAllSchemaApplications } from '../src/logic/schemas/runtime';
import { applyAllSchemas } from '../src/logic/schemas/registry';
import { C2Schema } from '../src/logic/schemas/schemas/C2_cagesRegionQuota';
import '../src/logic/schemas/index';

/**
 * Parse puzzle from string format:
 * Format: "0x 0x 0x 0x 0s 1x 1 1 1 1x"
 * Where: number = region (0-9, will be converted to 1-10), x = cross, s = star, number alone = empty
 */
function parsePuzzle(puzzleStr: string) {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];

  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);
    const regionRow: number[] = [];

    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) {
        throw new Error(`Invalid cell format at row ${r}, col ${c}: ${cell}`);
      }

      const regionNum = parseInt(match[1], 10);
      regionRow.push(regionNum + 1);
    }

    regions.push(regionRow);
  }

  const state = createEmptyPuzzleState({
    size: 10,
    starsPerUnit: 2,
    regions,
  });

  for (let r = 0; r < 10; r++) {
    const line = lines[r];
    const cells = line.split(/\s+/);

    for (let c = 0; c < 10; c++) {
      const cell = cells[c];
      const match = cell.match(/^(\d+)([xs]?)$/);
      if (!match) continue;

      const stateChar = match[2];
      if (stateChar === 's') {
        state.cells[r][c] = 'star';
      } else if (stateChar === 'x') {
        state.cells[r][c] = 'cross';
      }
    }
  }

  return state;
}

function getRowBand(state: ReturnType<typeof puzzleStateToBoardState>, startRow: number, length: number) {
  return enumerateRowBands(state).find(
    band => band.type === 'rowBand' && band.rows.length === length && band.rows[0] === startRow
  ) as ReturnType<typeof enumerateRowBands>[number];
}

describe('C2 schema-based technique - specific case', () => {
  it('applies band quotas and C2 deductions for region 4', () => {
    const puzzleStr = `0x 0x 0x 0x 0s 1x 1 1 1 1x
2 2x 2s 0x 1x 1x 1 1x 1 3x
2 2x 0x 0x 1 3 3 3 3 3x
4x 4x 0s 4x 3 3 3x 3 3x 8
4x 4x 0x 4x 3x 3 3 7 7x 8
5x 4s 4x 4s 6x 6x 7x 7x 8x 8x
5x 6x 4x 6x 6x 6 6 7 7x 8
5s 6x 6x 6 7 7 7x 7x 8x 8
5x 5x 5x 6 6x 7x 9 9 9 9x
5x 5s 6x 6 9 9 9 9x 9 9x`;

    const state = parsePuzzle(puzzleStr);
    const boardState = puzzleStateToBoardState(state);
    const region4 = boardState.regions.find(region => region.id === 4);
    expect(region4).toBeDefined();
    const rowBand012 = getRowBand(boardState, 0, 3);
    const rowBand34 = getRowBand(boardState, 3, 2);

    expect(rowBand012).toBeDefined();
    expect(rowBand34).toBeDefined();

    const quota012 = getRegionBandQuota(region4!, rowBand012 as RowBand, boardState);
    expect(quota012).toBe(1);
    const cells012 = getAllCellsOfRegionInBand(region4!, rowBand012 as RowBand, boardState);
    const stars012 = cells012.filter(cellId => boardState.cellStates[cellId] === 1).length;
    expect(stars012).toBeLessThanOrEqual(1);

    const remainingBand34 = computeRemainingStarsInBand(rowBand34 as RowBand, boardState);
    expect(remainingBand34).toBe(3);
    const maxBlocks = getMaxNonOverlappingBlocksInBand(rowBand34 as RowBand, boardState);
    expect(maxBlocks).toHaveLength(3);
    const quota34 = getRegionBandQuota(region4!, rowBand34 as RowBand, boardState);
    expect(quota34).toBe(1);

    const regionCellSet = new Set(region4!.cells);
    const fullyInsideBlocks = maxBlocks.filter(block => block.cells.every(cell => regionCellSet.has(cell)));
    expect(fullyInsideBlocks).toHaveLength(1);
    const uniqueCageCells = new Set(fullyInsideBlocks[0].cells);

    applyAllSchemas({ state: boardState });
    const applications = getAllSchemaApplications(state).filter(app => app.schemaId === C2Schema.id);
    const forcedEmptyCells = applications.flatMap(app =>
      app.deductions
        .filter(ded => ded.type === 'forceEmpty' && regionCellSet.has(ded.cell))
        .map(ded => ded.cell)
    );

    expect(forcedEmptyCells.length).toBeGreaterThan(0);
    forcedEmptyCells.forEach(cellId => {
      const row = Math.floor(cellId / boardState.size);
      expect(row === 3 || row === 4).toBe(true);
      expect(uniqueCageCells.has(cellId)).toBe(false);
    });

    const hint = findSchemaBasedHint(state);
    expect(hint).not.toBeNull();
    expect(hint!.technique).toBe('schema-based');

    const crossCells = hint!.resultCells.filter(cell => {
      const type = hint!.schemaCellTypes?.get(`${cell.row},${cell.col}`) ?? (hint!.kind === 'place-cross' ? 'cross' : 'star');
      return type === 'cross';
    });

    const crossInTargetBand = crossCells.some(cell => {
      const cellId = cell.row * boardState.size + cell.col;
      return regionCellSet.has(cellId) && (cell.row === 3 || cell.row === 4);
    });

    expect(crossInTargetBand).toBe(true);
  });
});

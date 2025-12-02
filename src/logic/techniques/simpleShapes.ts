import type { PuzzleState, Coords } from '../../types/puzzle';
import type { Hint } from '../../types/hints';
import { regionCells, findLShapes, findTShapes, neighbors8, getCell } from '../helpers';

let hintCounter = 0;

function nextHintId() {
  hintCounter += 1;
  return `simple-shapes-${hintCounter}`;
}

/**
 * Simple shapes – various tetrominoes and pentominoes in 10×10 2★:
 *
 * In a 10×10 2★ puzzle, certain simple region shapes allow us to deduce
 * forced crosses (and occasionally stars) using 2×2 and exclusion logic:
 *
 * 1. 1×4 / 4×1 strips: If a region consists of exactly four cells forming a
 *    straight horizontal or vertical strip, both stars must lie in those cells.
 *
 * 2. L-shapes: If a region forms an L-shape (4 cells), both stars must lie in
 *    the L-shape. Using 2×2 constraints, we can mark certain adjacent cells.
 *
 * 3. T-shapes: If a region forms a T-shape (4 cells), both stars must lie in
 *    the T-shape. Using 2×2 constraints, we can mark certain adjacent cells.
 *
 * 4. S-shapes: If a region forms an S-shape (4 cells), both stars must lie in
 *    the S-shape. Using 2×2 constraints, we can mark certain adjacent cells.
 *
 * 5. Other simple shapes: Various 3-6 cell shapes that form recognizable patterns.
 *
 * This technique places those forced crosses as a hint; it does not guess the
 * exact star locations inside the shape.
 */
export function findSimpleShapesHint(state: PuzzleState): Hint | null {
  const { size, starsPerUnit } = state.def;

  // This rule is specific to 10×10 2★ puzzles.
  if (size !== 10 || starsPerUnit !== 2) return null;

  const maxRegionId = 10;
  const forcedCrosses: Coords[] = [];

  // Check for 1×4 / 4×1 strips (4-cell regions)
  for (let regionId = 1; regionId <= maxRegionId; regionId += 1) {
    const cells = regionCells(state, regionId);
    if (cells.length !== 4) continue;

    const rows = new Set(cells.map((c) => c.row));
    const cols = new Set(cells.map((c) => c.col));

    // Horizontal 1×4 (all in same row, four contiguous columns)
    if (rows.size === 1) {
      const row = cells[0].row;
      const sortedCols = [...cols].sort((a, b) => a - b);
      if (sortedCols[3] - sortedCols[0] !== 3) continue; // not contiguous 1×4

      const [c0, c1, c2, c3] = sortedCols;

      // All other cells in this row must be crosses.
      for (let c = 0; c < size; c += 1) {
        if (c >= c0 && c <= c3) continue;
        if (state.cells[row][c] === 'empty') {
          forcedCrosses.push({ row, col: c });
        }
      }

      // Cells directly above and below the strip are adjacent to some star
      // for every valid 2-star placement in the 1×4, so they are also crosses.
      const neighborRows = [row - 1, row + 1];
      for (const nr of neighborRows) {
        if (nr < 0 || nr >= size) continue;
        for (let c = c0; c <= c3; c += 1) {
          if (state.cells[nr][c] === 'empty') {
            forcedCrosses.push({ row: nr, col: c });
          }
        }
      }
    }

    // Vertical 4×1 (all in same column, four contiguous rows)
    if (cols.size === 1) {
      const col = cells[0].col;
      const sortedRows = [...rows].sort((a, b) => a - b);
      if (sortedRows[3] - sortedRows[0] !== 3) continue; // not contiguous 4×1

      const [r0, r1, r2, r3] = sortedRows;

      // All other cells in this column must be crosses.
      for (let r = 0; r < size; r += 1) {
        if (r >= r0 && r <= r3) continue;
        if (state.cells[r][col] === 'empty') {
          forcedCrosses.push({ row: r, col });
        }
      }

      // Cells directly left and right of the strip are adjacent to some star
      // for every valid 2-star placement in the 4×1, so they are also crosses.
      const neighborCols = [col - 1, col + 1];
      for (const nc of neighborCols) {
        if (nc < 0 || nc >= size) continue;
        for (let r = r0; r <= r3; r += 1) {
          if (state.cells[r][nc] === 'empty') {
            forcedCrosses.push({ row: r, col: nc });
          }
        }
      }
    }

    if (forcedCrosses.length) {
      // Deduplicate
      const key = (c: Coords) => `${c.row},${c.col}`;
      const seen = new Set<string>();
      const unique = forcedCrosses.filter((c) => {
        const k = key(c);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'simple-shapes',
        resultCells: unique,
        explanation:
          'This region is a 1×4 (or 4×1) strip in a 10×10 2★ puzzle, so both of its stars must lie in the strip. The rest of the row/column and the cells directly next to the strip cannot contain stars and are crosses.',
        highlights: {
          regions: [regionId],
          cells: [...cells, ...unique],
        },
      };
    }
  }

  // Helper function to find forced crosses for any simple shape using 2×2 logic
  function findForcedCrossesForShape(shapeCells: Coords[], regionId: number): Coords[] {
    const forced: Coords[] = [];

    // Strategy: Check all 2×2 blocks that include cells from the shape.
    // If a 2×2 block contains 3 cells from the shape, the 4th cell cannot contain a star
    // (would violate 2×2 rule since shape must have 2 stars in 2★).
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const block: Coords[] = [
          { row: r, col: c },
          { row: r, col: c + 1 },
          { row: r + 1, col: c },
          { row: r + 1, col: c + 1 },
        ];

        // Count how many shape cells are in this 2×2 block
        const shapeCellsInBlock = block.filter(b =>
          shapeCells.some(sc => sc.row === b.row && sc.col === b.col)
        );

        // If 3 shape cells are in this 2×2 block, the 4th cell cannot have a star
        if (shapeCellsInBlock.length === 3) {
          const fourthCell = block.find(b =>
            !shapeCells.some(sc => sc.row === b.row && sc.col === b.col)
          );
          if (fourthCell && state.cells[fourthCell.row][fourthCell.col] === 'empty') {
            forced.push(fourthCell);
          }
        }
      }
    }

    return forced;
  }

  // Check for L-shapes (4-cell regions)
  const lShapes = findLShapes(state);
  for (const lShape of lShapes) {
    if (lShape.cells.length !== 4) continue;

    const { corner, arms } = lShape;
    
    // CRITICAL FIX: Check for definitive star placements in L-shapes
    // In an L-shape with 4 cells, if two cells in one arm are adjacent to each other,
    // only the far cell (not adjacent to the corner) can be a star
    if (arms.horizontal.length === 1 && arms.vertical.length === 2) {
      const vert0 = arms.vertical[0];
      const vert1 = arms.vertical[1];
      
      // Check if vert0 and vert1 are adjacent to each other
      const vert0AdjacentToVert1 = Math.abs(vert0.row - vert1.row) <= 1 && Math.abs(vert0.col - vert1.col) <= 1;
      
      if (vert0AdjacentToVert1) {
        // Check which one is adjacent to the corner
        const cornerAdjacentToVert0 = Math.abs(corner.row - vert0.row) <= 1 && Math.abs(corner.col - vert0.col) <= 1;
        const cornerAdjacentToVert1 = Math.abs(corner.row - vert1.row) <= 1 && Math.abs(corner.col - vert1.col) <= 1;
        
        // The far cell (not adjacent to corner) is forced
        if (cornerAdjacentToVert0 && !cornerAdjacentToVert1 && getCell(state, vert1) === 'empty') {
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'simple-shapes',
            resultCells: [vert1],
            explanation: `This region is an L-shape. The vertical arm cells are adjacent, and one is adjacent to the corner, so the far cell must be a star.`,
            highlights: {
              regions: [lShape.regionId],
              cells: [corner, vert0, vert1],
            },
          };
        }
        
        if (cornerAdjacentToVert1 && !cornerAdjacentToVert0 && getCell(state, vert0) === 'empty') {
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'simple-shapes',
            resultCells: [vert0],
            explanation: `This region is an L-shape. The vertical arm cells are adjacent, and one is adjacent to the corner, so the far cell must be a star.`,
            highlights: {
              regions: [lShape.regionId],
              cells: [corner, vert0, vert1],
            },
          };
        }
      }
    }
    
    // Symmetric case: 2 horizontal, 1 vertical
    if (arms.horizontal.length === 2 && arms.vertical.length === 1) {
      const horiz0 = arms.horizontal[0];
      const horiz1 = arms.horizontal[1];
      
      // Check if horiz0 and horiz1 are adjacent to each other
      const horiz0AdjacentToHoriz1 = Math.abs(horiz0.row - horiz1.row) <= 1 && Math.abs(horiz0.col - horiz1.col) <= 1;
      
      if (horiz0AdjacentToHoriz1) {
        // Check which one is adjacent to the corner
        const cornerAdjacentToHoriz0 = Math.abs(corner.row - horiz0.row) <= 1 && Math.abs(corner.col - horiz0.col) <= 1;
        const cornerAdjacentToHoriz1 = Math.abs(corner.row - horiz1.row) <= 1 && Math.abs(corner.col - horiz1.col) <= 1;
        
        // The far cell (not adjacent to corner) is forced
        if (cornerAdjacentToHoriz0 && !cornerAdjacentToHoriz1 && getCell(state, horiz1) === 'empty') {
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'simple-shapes',
            resultCells: [horiz1],
            explanation: `This region is an L-shape. The horizontal arm cells are adjacent, and one is adjacent to the corner, so the far cell must be a star.`,
            highlights: {
              regions: [lShape.regionId],
              cells: [corner, horiz0, horiz1],
            },
          };
        }
        
        if (cornerAdjacentToHoriz1 && !cornerAdjacentToHoriz0 && getCell(state, horiz0) === 'empty') {
          return {
            id: nextHintId(),
            kind: 'place-star',
            technique: 'simple-shapes',
            resultCells: [horiz0],
            explanation: `This region is an L-shape. The horizontal arm cells are adjacent, and one is adjacent to the corner, so the far cell must be a star.`,
            highlights: {
              regions: [lShape.regionId],
              cells: [corner, horiz0, horiz1],
            },
          };
        }
      }
    }

    const lForcedCrosses = findForcedCrossesForShape(lShape.cells, lShape.regionId);

    // Also mark cells that are adjacent to both arms (these would always be adjacent to a star)
    const adjacentCells = new Set<string>();
    for (const cell of lShape.cells) {
      const neighbors = neighbors8(cell, size);
      for (const neighbor of neighbors) {
        if (lShape.cells.some(c => c.row === neighbor.row && c.col === neighbor.col)) {
          continue;
        }
        adjacentCells.add(`${neighbor.row},${neighbor.col}`);
      }
    }

    for (const cellKey of adjacentCells) {
      const [row, col] = cellKey.split(',').map(Number);
      if (state.cells[row][col] !== 'empty') continue;

      const isAdjacentToHorizontalArm = arms.horizontal.some(arm =>
        Math.abs(row - arm.row) <= 1 && Math.abs(col - arm.col) <= 1 &&
        !(row === arm.row && col === arm.col)
      );
      
      const isAdjacentToVerticalArm = arms.vertical.some(arm =>
        Math.abs(row - arm.row) <= 1 && Math.abs(col - arm.col) <= 1 &&
        !(row === arm.row && col === arm.col)
      );

      if (isAdjacentToHorizontalArm && isAdjacentToVerticalArm) {
        lForcedCrosses.push({ row, col });
      }
    }

    if (lForcedCrosses.length > 0) {
      const key = (c: Coords) => `${c.row},${c.col}`;
      const seen = new Set<string>();
      const unique = lForcedCrosses.filter((c) => {
        const k = key(c);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'simple-shapes',
        resultCells: unique,
        explanation:
          `This region is an L-shape in a 10×10 2★ puzzle, so both of its stars must lie in the L-shape. Using 2×2 constraints and exclusion, certain cells adjacent to the L-shape cannot contain stars and are crosses.`,
        highlights: {
          regions: [lShape.regionId],
          cells: [...lShape.cells, ...unique],
        },
      };
    }
  }

  // Check for T-shapes (4-cell regions)
  const tShapes = findTShapes(state);
  for (const tShape of tShapes) {
    if (tShape.cells.length !== 4) continue;

    const tForcedCrosses = findForcedCrossesForShape(tShape.cells, tShape.regionId);

    if (tForcedCrosses.length > 0) {
      const key = (c: Coords) => `${c.row},${c.col}`;
      const seen = new Set<string>();
      const unique = tForcedCrosses.filter((c) => {
        const k = key(c);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      return {
        id: nextHintId(),
        kind: 'place-cross',
        technique: 'simple-shapes',
        resultCells: unique,
        explanation:
          `This region is a T-shape in a 10×10 2★ puzzle, so both of its stars must lie in the T-shape. Using 2×2 constraints, certain cells adjacent to the T-shape cannot contain stars and are crosses.`,
        highlights: {
          regions: [tShape.regionId],
          cells: [...tShape.cells, ...unique],
        },
      };
    }
  }

  // Check for S-shapes (4-cell regions) - S-shaped tetromino (all rotations/flips)
  for (let regionId = 1; regionId <= maxRegionId; regionId += 1) {
    const cells = regionCells(state, regionId);
    if (cells.length !== 4) continue;

    // Check if it's an S-shape (zigzag pattern)
    // S-shape patterns:
    //   XX      X       XX      X
    //  XX  or  XX  or   X  or  XX
    const rows = new Set(cells.map((c) => c.row));
    const cols = new Set(cells.map((c) => c.col));
    
    // S-shape spans 2 rows and 3 columns (or 3 rows and 2 columns)
    if ((rows.size === 2 && cols.size === 3) || (rows.size === 3 && cols.size === 2)) {
      const sortedRows = [...rows].sort((a, b) => a - b);
      const sortedCols = [...cols].sort((a, b) => a - b);
      
      let isSShape = false;
      
      if (rows.size === 2 && cols.size === 3) {
        // Horizontal S: top row has 2 cells, bottom row has 2 cells, offset
        const topRow = sortedRows[0];
        const bottomRow = sortedRows[1];
        const topRowCells = cells.filter(c => c.row === topRow);
        const bottomRowCells = cells.filter(c => c.row === bottomRow);
        
        if (topRowCells.length === 2 && bottomRowCells.length === 2) {
          const topCols = topRowCells.map(c => c.col).sort((a, b) => a - b);
          const bottomCols = bottomRowCells.map(c => c.col).sort((a, b) => a - b);
          
          // S pattern: top cells are left+middle, bottom cells are middle+right
          // or top cells are middle+right, bottom cells are left+middle
          isSShape = 
            (topCols[0] === bottomCols[0] - 1 && topCols[1] === bottomCols[0] && topCols[1] + 1 === bottomCols[1]) ||
            (topCols[0] === bottomCols[0] && topCols[1] === bottomCols[1] - 1 && topCols[1] + 1 === bottomCols[1]);
        }
      } else if (rows.size === 3 && cols.size === 2) {
        // Vertical S: left column has 2 cells, right column has 2 cells, offset
        const leftCol = sortedCols[0];
        const rightCol = sortedCols[1];
        const leftColCells = cells.filter(c => c.col === leftCol);
        const rightColCells = cells.filter(c => c.col === rightCol);
        
        if (leftColCells.length === 2 && rightColCells.length === 2) {
          const leftRows = leftColCells.map(c => c.row).sort((a, b) => a - b);
          const rightRows = rightColCells.map(c => c.row).sort((a, b) => a - b);
          
          // S pattern: left cells are top+middle, right cells are middle+bottom
          // or left cells are middle+bottom, right cells are top+middle
          isSShape = 
            (leftRows[0] === rightRows[0] - 1 && leftRows[1] === rightRows[0] && leftRows[1] + 1 === rightRows[1]) ||
            (leftRows[0] === rightRows[0] && leftRows[1] === rightRows[1] - 1 && leftRows[1] + 1 === rightRows[1]);
        }
      }
      
      if (isSShape) {
        const sForcedCrosses = findForcedCrossesForShape(cells, regionId);
        
        if (sForcedCrosses.length > 0) {
          const key = (c: Coords) => `${c.row},${c.col}`;
          const seen = new Set<string>();
          const unique = sForcedCrosses.filter((c) => {
            const k = key(c);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });

          return {
            id: nextHintId(),
            kind: 'place-cross',
            technique: 'simple-shapes',
            resultCells: unique,
            explanation:
              `This region is an S-shape in a 10×10 2★ puzzle, so both of its stars must lie in the S-shape. Using 2×2 constraints, certain cells adjacent to the S-shape cannot contain stars and are crosses.`,
            highlights: {
              regions: [regionId],
              cells: [...cells, ...unique],
            },
          };
        }
      }
    }
  }

  // Check for other simple shapes (3-6 cells) using general 2×2 logic
  // This catches shapes like 3-cell lines, 5-cell pentominoes, etc.
  for (let regionId = 1; regionId <= maxRegionId; regionId += 1) {
    const cells = regionCells(state, regionId);
    // Skip if already handled (4-cell strips, L, T, S)
    if (cells.length === 4) {
      const rows = new Set(cells.map((c) => c.row));
      const cols = new Set(cells.map((c) => c.col));
      // Skip 1×4 strips (already handled)
      if (rows.size === 1 || cols.size === 1) continue;
      // Skip L-shapes (already handled)
      const lShapesCheck = findLShapes(state);
      if (lShapesCheck.some(ls => ls.regionId === regionId && ls.cells.length === 4)) continue;
      // Skip T-shapes (already handled)
      const tShapesCheck = findTShapes(state);
      if (tShapesCheck.some(ts => ts.regionId === regionId && ts.cells.length === 4)) continue;
    }
    
    // Apply to 3-6 cell shapes
    if (cells.length >= 3 && cells.length <= 6) {
      const generalForcedCrosses = findForcedCrossesForShape(cells, regionId);
      
      if (generalForcedCrosses.length > 0) {
        const key = (c: Coords) => `${c.row},${c.col}`;
        const seen = new Set<string>();
        const unique = generalForcedCrosses.filter((c) => {
          const k = key(c);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });

        return {
          id: nextHintId(),
          kind: 'place-cross',
          technique: 'simple-shapes',
          resultCells: unique,
          explanation:
            `This region is a simple shape in a 10×10 2★ puzzle, so both of its stars must lie in the shape. Using 2×2 constraints, certain cells adjacent to the shape cannot contain stars and are crosses.`,
          highlights: {
            regions: [regionId],
            cells: [...cells, ...unique],
          },
        };
      }
    }
  }

  return null;
}



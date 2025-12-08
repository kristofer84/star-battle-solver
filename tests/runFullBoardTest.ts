import { createEmptyPuzzleState } from '../src/types/puzzle';
import { findNextHint } from '../src/logic/techniques';
import { validateState } from '../src/logic/validation';
import type { PuzzleState } from '../src/types/puzzle';
import { store } from '../src/store/puzzleStore';
import { puzzles } from './puzzles';

/**
 * Parse puzzle from string format:
 * Format: "0s 0x 0x 1x 1s 1x 1x 2x 2s 2x"
 * Where: number = region (0-9, will be converted to 1-10), x = cross, s = star
 */
function parsePuzzle(puzzleStr: string): { regions: number[][]; expectedStars: [number, number][] } {
  const lines = puzzleStr.trim().split('\n').map(line => line.trim());
  const regions: number[][] = [];
  const expectedStars: [number, number][] = [];
  
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
      const state = match[2];
      
      // Convert region from 0-9 to 1-10
      regionRow.push(regionNum + 1);
      
      if (state === 's') {
        expectedStars.push([r, c]);
      }
    }
    
    regions.push(regionRow);
  }
  
  return { regions, expectedStars };
}

function applyHint(state: PuzzleState): { applied: boolean; cellsChanged: [number, number, string][] } {
  const hint = findNextHint(state);
  if (!hint) {
    return { applied: false, cellsChanged: [] };
  }
  
  const cellsChanged: [number, number, string][] = [];
  for (const cell of hint.resultCells) {
    const oldValue = state.cells[cell.row][cell.col];
    const newValue = hint.kind === 'place-star' ? 'star' : 'cross';
    if (oldValue !== newValue) {
      state.cells[cell.row][cell.col] = newValue;
      cellsChanged.push([cell.row, cell.col, newValue]);
    }
  }
  
  return { applied: true, cellsChanged };
}

function getBoardState(state: PuzzleState): { stars: [number, number][]; crosses: [number, number][] } {
  const stars: [number, number][] = [];
  const crosses: [number, number][] = [];
  
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (state.cells[r][c] === 'star') {
        stars.push([r, c]);
      } else if (state.cells[r][c] === 'cross') {
        crosses.push([r, c]);
      }
    }
  }
  
  return { stars, crosses };
}

interface TestResult {
  puzzleIndex: number;
  success: boolean;
  output: string[];
  error?: string;
}

async function runTest(puzzleIndex: number, puzzleStr: string): Promise<TestResult> {
  const output: string[] = [];
  const log = (...args: any[]) => {
    output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };
  const logError = (...args: any[]) => {
    output.push('ERROR: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  };
  
  try {
    log(`\n${'='.repeat(60)}`);
    log(`=== Puzzle ${puzzleIndex + 1} of ${puzzles.length} ===`);
    log('='.repeat(60));
    
    const { regions, expectedStars } = parsePuzzle(puzzleStr);
    
    // Set disabled techniques for this test (each test runs independently)
    store.disabledTechniques = ['schema-based'];
    
    const state = createEmptyPuzzleState({
      size: 10,
      starsPerUnit: 2,
      regions
    });
    
    const maxIterations = 500;
    let iteration = 0;
    const hintsApplied: Array<{
      iteration: number;
      technique: string;
      kind: string;
      cellsChanged: [number, number, string][];
      validationErrors: string[];
    }> = [];
    
    while (iteration < maxIterations) {
      const hint = findNextHint(state);
      if (!hint) {
        log(`No more hints found at iteration ${iteration}`);
        break;
      }
    
      const { applied, cellsChanged } = applyHint(state);
      
      if (!applied || cellsChanged.length === 0) {
        log(`Hint at iteration ${iteration} did not change any cells`);
        break;
      }
    
      const validationErrors = validateState(state);
      
      hintsApplied.push({
        iteration,
        technique: hint.technique,
        kind: hint.kind,
        cellsChanged,
        validationErrors: [...validationErrors],
      });
    
      if (validationErrors.length > 0) {
        const boardState = getBoardState(state);
        logError(`\n=== VALIDATION ERROR AT ITERATION ${iteration} ===`);
        logError(`Technique: ${hint.technique}`);
        logError(`Kind: ${hint.kind}`);
        logError(`Cells changed:`, cellsChanged);
        logError(`Validation errors:`, validationErrors);
        logError(`Current stars (${boardState.stars.length}):`, boardState.stars);
        logError(`Current crosses (${boardState.crosses.length}):`, boardState.crosses);
        return { puzzleIndex, success: false, output, error: 'Validation error' };
      }
    
      if (iteration % 10 === 0 || cellsChanged.length > 5) {
        const boardState = getBoardState(state);
        log(`Iteration ${iteration}: ${hint.technique} (${hint.kind}) - ${cellsChanged.length} cells changed - Stars: ${boardState.stars.length}, Crosses: ${boardState.crosses.length}`);
      }
    
      iteration++;
    }
    
    log(`\n=== SOLVER COMPLETED ===`);
    log(`Total hints applied: ${iteration}`);
    log(`Techniques used:`, [...new Set(hintsApplied.map(h => h.technique))]);
    
    const boardState = getBoardState(state);
    log(`Final stars: ${boardState.stars.length}`);
    log(`Final crosses: ${boardState.crosses.length}`);
    
    const finalValidationErrors = validateState(state);
    if (finalValidationErrors.length > 0) {
      logError('Final validation errors:', finalValidationErrors);
      return { puzzleIndex, success: false, output, error: 'Final validation errors' };
    }
    
    const expectedSet = new Set(expectedStars.map(([r, c]) => `${r},${c}`));
    const actualSet = new Set(boardState.stars.map(([r, c]) => `${r},${c}`));
    
    const missing = expectedStars.filter(([r, c]) => !actualSet.has(`${r},${c}`));
    const extra = boardState.stars.filter(([r, c]) => !expectedSet.has(`${r},${c}`));
    
    if (missing.length > 0 || extra.length > 0) {
      logError('\n=== SOLUTION MISMATCH ===');
      logError('Missing stars:', missing);
      logError('Extra stars:', extra);
      return { puzzleIndex, success: false, output, error: 'Solution mismatch' };
    }
    
    log('\n✅ Test PASSED - Solution matches expected!');
    return { puzzleIndex, success: true, output };
  } catch (error) {
    logError(`Exception during test:`, error);
    return { puzzleIndex, success: false, output, error: String(error) };
  }
}

async function main() {
  console.log('=== Starting Full Board Test ===');
  console.log(`Testing ${puzzles.length} puzzles from puzzles.ts\n`);

  // Allow selecting a specific puzzle via command line argument
  // Usage: 
  //   tsx runFullBoardTest.ts              - Run all puzzles
  //   tsx runFullBoardTest.ts 0            - Run puzzle 0 only
  //   tsx runFullBoardTest.ts 0 5          - Run puzzle 0 with concurrency 5
  //   tsx runFullBoardTest.ts undefined 5 3 - Run first 3 puzzles with concurrency 5
  const puzzleIndexArg = process.argv[2];
  const concurrencyArg = process.argv[3];
  const limitArg = process.argv[4];
  let puzzlesToTest: number[];
  const concurrency = concurrencyArg ? parseInt(concurrencyArg, 10) : Math.min(10, puzzles.length);
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  if (puzzleIndexArg !== undefined && puzzleIndexArg !== 'undefined') {
    const index = parseInt(puzzleIndexArg, 10);
    if (isNaN(index) || index < 0 || index >= puzzles.length) {
      console.error(`Invalid puzzle index: ${puzzleIndexArg}. Must be between 0 and ${puzzles.length - 1}`);
      process.exit(1);
    }
    puzzlesToTest = [index];
  } else {
    const allPuzzles = Array.from({ length: puzzles.length }, (_, i) => i);
    puzzlesToTest = limit ? allPuzzles.slice(0, limit) : allPuzzles;
  }

  console.log(`Running ${puzzlesToTest.length} puzzle(s) with concurrency of ${concurrency}\n`);

  const startTime = Date.now();
  const results: TestResult[] = [];

  // Run tests in batches to control concurrency
  for (let i = 0; i < puzzlesToTest.length; i += concurrency) {
    const batch = puzzlesToTest.slice(i, i + concurrency);
    const batchPromises = batch.map(index => runTest(index, puzzles[index]));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Print progress
    const completed = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = completed - passed;
    console.log(`Progress: ${completed}/${puzzlesToTest.length} completed (${passed} passed, ${failed} failed)`);
  }

  // Print all results sequentially to avoid interleaved output
  console.log(`\n${'='.repeat(60)}`);
  console.log('=== DETAILED RESULTS ===');
  console.log('='.repeat(60));

  for (const result of results.sort((a, b) => a.puzzleIndex - b.puzzleIndex)) {
    // Print output for each test
    for (const line of result.output) {
      if (line.startsWith('ERROR:')) {
        console.error(line);
      } else {
        console.log(line);
      }
    }
    
    if (!result.success) {
      console.error(`\n❌ Puzzle ${result.puzzleIndex + 1} FAILED${result.error ? ` - ${result.error}` : ''}`);
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== SUMMARY ===`);
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

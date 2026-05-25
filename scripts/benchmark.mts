/**
 * Star Battle Solver Benchmark
 *
 * Usage:
 *   npx tsx scripts/benchmark.ts [count] [--load <file>] [--out <file>]
 *
 * Options:
 *   count        Number of puzzles to generate (default: 100)
 *   --load FILE  Load puzzle defs from a previous run instead of generating
 *   --out FILE   Output file for raw data (default: benchmark-data.json)
 *   --workers N  Override worker count (default: cpus - 1)
 */

import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';
import { cpus } from 'os';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { join, dirname } from 'path';

// Polyfill requestAnimationFrame for Node.js (used by some schema runtime yield patterns)
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 0);
}

import type { PuzzleDef, PuzzleState } from '../src/types/puzzle.js';
import { createEmptyPuzzleState } from '../src/types/puzzle.js';
import { techniquesInOrder } from '../src/logic/techniques.js';
import { analyzeDeductionsWithContext } from '../src/logic/mainSolver.js';
import { mergeDeductions } from '../src/logic/deductionUtils.js';
import { countSolutions } from '../src/logic/search.js';
import type { Deduction } from '../src/types/deductions.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TechniqueCall {
  techniqueId: string;
  timeMs: number;
  /** direct hint | produced deductions | deductions triggered a hint | nothing */
  resultType: 'hint-star' | 'hint-cross' | 'deductions' | 'deductions-resolved-star' | 'deductions-resolved-cross' | 'none';
  deductionCount?: number;
  /** For deductions-resolved results: which techniques (including self) contributed deductions to the pool this step */
  deductionContributors?: string[];
}

export interface SolverStep {
  stepIndex: number;
  calls: TechniqueCall[];
  /** Which technique id "won" (produced or triggered the hint) */
  winnerTechniqueId: string | null;
  hintKind: 'place-star' | 'place-cross' | null;
  /** Index in techniquesInOrder list (0-based) */
  winnerTechniqueIndex: number | null;
}

export interface PuzzleSolveResult {
  puzzleIndex: number;
  solved: boolean;
  stuckAtStep: number | null;
  steps: SolverStep[];
  totalTimeMs: number;
}

export interface BenchmarkData {
  generatedAt: string;
  puzzleCount: number;
  puzzles: PuzzleDef[];
  results: PuzzleSolveResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeded RNG – mulberry32
// ─────────────────────────────────────────────────────────────────────────────

function makePrng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Puzzle generation
// ─────────────────────────────────────────────────────────────────────────────

type Rng = () => number;

function generateRegions(size: number, numRegions: number, rng: Rng): number[][] {
  const grid: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  const used = new Set<number>();
  const seedRows: number[] = [];
  const seedCols: number[] = [];
  while (seedRows.length < numRegions) {
    const r = Math.floor(rng() * size);
    const c = Math.floor(rng() * size);
    const idx = r * size + c;
    if (!used.has(idx)) {
      used.add(idx);
      seedRows.push(r);
      seedCols.push(c);
      grid[r][c] = seedRows.length;
    }
  }

  const frontier: Array<Array<[number, number]>> = seedRows.map((r, i) => [[r, seedCols[i]]]);
  const counts = new Array(numRegions).fill(1);
  let unassigned = size * size - numRegions;

  while (unassigned > 0) {
    let chosen = -1, minCount = Infinity;
    for (let i = 0; i < numRegions; i++) {
      if (frontier[i].length > 0 && counts[i] < minCount) { minCount = counts[i]; chosen = i; }
    }
    if (chosen === -1) break;

    const fi = Math.floor(rng() * frontier[chosen].length);
    const [r, c] = frontier[chosen][fi];
    const candidates: [number, number][] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === 0) candidates.push([nr, nc]);
    }
    if (candidates.length === 0) { frontier[chosen].splice(fi, 1); continue; }
    const [nr, nc] = candidates[Math.floor(rng() * candidates.length)];
    grid[nr][nc] = chosen + 1;
    counts[chosen]++;
    frontier[chosen].push([nr, nc]);
    unassigned--;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== 0) continue;
      const q: [number, number][] = [[r, c]];
      const vis = new Set<number>([r * size + c]);
      let found = false;
      for (let qi = 0; qi < q.length && !found; qi++) {
        const [qr, qc] = q[qi];
        for (const [dr, dc] of dirs) {
          const nr2 = qr + dr, nc2 = qc + dc;
          if (nr2 >= 0 && nr2 < size && nc2 >= 0 && nc2 < size) {
            if (grid[nr2][nc2] !== 0) { grid[r][c] = grid[nr2][nc2]; found = true; break; }
            const key = nr2 * size + nc2;
            if (!vis.has(key)) { vis.add(key); q.push([nr2, nc2]); }
          }
        }
      }
    }
  }

  return grid;
}

function tryGeneratePuzzle(seed: number): PuzzleDef | null {
  const SIZE = 10;
  const NUM_REGIONS = 10;
  const rng = makePrng(seed);
  const regions = generateRegions(SIZE, NUM_REGIONS, rng);

  const regionSet = new Set<number>();
  for (const row of regions) for (const id of row) regionSet.add(id);
  if (regionSet.size !== NUM_REGIONS) return null;

  const def: PuzzleDef = { size: SIZE, starsPerUnit: 2, regions };
  const emptyState = createEmptyPuzzleState(def);

  // countSolutions handles "no solution" (count=0), non-unique (count=2), and unique (count=1)
  // in one pass — no need for a separate solvePuzzle existence check.
  const countResult = countSolutions(emptyState, { maxCount: 2, timeoutMs: 400 });
  if (!countResult.timedOut && countResult.count !== 1) return null;

  return def;
}

export function generatePuzzles(count: number, startSeed = 0): PuzzleDef[] {
  const puzzles: PuzzleDef[] = [];
  let seed = startSeed;
  let attempts = 0;
  const MAX_ATTEMPTS = count * 200; // ~2% acceptance rate

  while (puzzles.length < count && attempts < MAX_ATTEMPTS) {
    const def = tryGeneratePuzzle(seed++);
    attempts++;
    if (def) {
      puzzles.push(def);
      if (puzzles.length % 10 === 0) {
        process.stdout.write(`\r  Generated ${puzzles.length}/${count} (${attempts} attempts)...`);
      }
    }
  }
  process.stdout.write('\n');
  return puzzles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmark solver loop
// Mirrors the logic in findNextHint() but records per-technique timing data.
// ─────────────────────────────────────────────────────────────────────────────

function isSolved(state: PuzzleState): boolean {
  const { size, starsPerUnit } = state.def;
  // Check no empty cells remain and all units have correct star count
  for (let r = 0; r < size; r++) {
    let starCount = 0;
    for (let c = 0; c < size; c++) {
      if (state.cells[r][c] === 'empty') return false;
      if (state.cells[r][c] === 'star') starCount++;
    }
    if (starCount !== starsPerUnit) return false;
  }
  return true;
}

function applyHint(state: PuzzleState, hint: { kind: string; resultCells: { row: number; col: number }[] }): void {
  const value = hint.kind === 'place-star' ? 'star' : 'cross';
  for (const cell of hint.resultCells) {
    state.cells[cell.row][cell.col] = value as any;
  }
}

async function runSolverOnPuzzle(def: PuzzleDef, puzzleIndex: number): Promise<PuzzleSolveResult> {
  const state = createEmptyPuzzleState(def);
  const steps: SolverStep[] = [];
  const startTime = performance.now();
  const MAX_STEPS = 500;

  while (!isSolved(state) && steps.length < MAX_STEPS) {
    const calls: TechniqueCall[] = [];
    let accumulatedDeductions: Deduction[] = [];
    let winnerTechniqueId: string | null = null;
    let winnerTechniqueIndex: number | null = null;
    let hintKind: 'place-star' | 'place-cross' | null = null;
    let stepDone = false;
    const deductionContributors: string[] = []; // techniques that added deductions this step

    let firstCrossHint: { hint: any; techId: string; techIndex: number } | null = null;

    for (let ti = 0; ti < techniquesInOrder.length && !stepDone; ti++) {
      const tech = techniquesInOrder[ti];

      // Mirror the real solver: if we have a cross hint and reach an expensive technique, stop
      if (firstCrossHint !== null && tech.expensive) {
        winnerTechniqueId = firstCrossHint.techId;
        winnerTechniqueIndex = firstCrossHint.techIndex;
        hintKind = 'place-cross';
        applyHint(state, firstCrossHint.hint);
        stepDone = true;
        break;
      }

      const t0 = performance.now();
      let result: any;
      try {
        if (tech.findResult) {
          const r = tech.findResult(state);
          result = r instanceof Promise ? await r : r;
        } else {
          const h = tech.findHint(state);
          const hint = h instanceof Promise ? await h : h;
          result = hint ? { type: 'hint', hint } : { type: 'none' };
        }
      } catch {
        result = { type: 'none' };
      }
      const timeMs = performance.now() - t0;

      // Mirror real solver's per-technique timeout
      if (timeMs > 10_000) {
        result = { type: 'none' };
      }

      if (result.type === 'hint') {
        const hintObj = result.hint;
        if (hintObj.kind === 'place-star') {
          calls.push({ techniqueId: tech.id, timeMs, resultType: 'hint-star' });
          winnerTechniqueId = tech.id;
          winnerTechniqueIndex = ti;
          hintKind = 'place-star';
          applyHint(state, hintObj);
          stepDone = true;
        } else {
          calls.push({ techniqueId: tech.id, timeMs, resultType: 'hint-cross' });
          if (firstCrossHint === null) {
            firstCrossHint = { hint: hintObj, techId: tech.id, techIndex: ti };
          }
        }
      } else if (result.type === 'deductions') {
        const newDeds: Deduction[] = result.deductions ?? [];
        accumulatedDeductions = mergeDeductions(accumulatedDeductions, newDeds);
        if (newDeds.length > 0) deductionContributors.push(tech.id);

        const analysis = analyzeDeductionsWithContext(accumulatedDeductions, state);
        if (analysis.hint) {
          const hintObj = analysis.hint;
          if (hintObj.kind === 'place-star') {
            calls.push({ techniqueId: tech.id, timeMs, resultType: 'deductions-resolved-star', deductionCount: newDeds.length, deductionContributors: [...deductionContributors] });
            winnerTechniqueId = tech.id;
            winnerTechniqueIndex = ti;
            hintKind = 'place-star';
            applyHint(state, hintObj);
            stepDone = true;
          } else {
            calls.push({ techniqueId: tech.id, timeMs, resultType: 'deductions-resolved-cross', deductionCount: newDeds.length, deductionContributors: [...deductionContributors] });
            if (firstCrossHint === null) {
              firstCrossHint = { hint: hintObj, techId: tech.id, techIndex: ti };
            }
          }
        } else {
          calls.push({ techniqueId: tech.id, timeMs, resultType: 'deductions', deductionCount: newDeds.length });
        }
      } else {
        calls.push({ techniqueId: tech.id, timeMs, resultType: 'none' });
      }
    }

    // If no star hint found but we have a cross hint, use it
    if (!stepDone && firstCrossHint !== null) {
      winnerTechniqueId = firstCrossHint.techId;
      winnerTechniqueIndex = firstCrossHint.techIndex;
      hintKind = 'place-cross';
      applyHint(state, firstCrossHint.hint);
      stepDone = true;
    }

    steps.push({
      stepIndex: steps.length,
      calls,
      winnerTechniqueId,
      hintKind,
      winnerTechniqueIndex,
    });

    if (!stepDone) break; // Stuck
  }

  return {
    puzzleIndex,
    solved: isSolved(state),
    stuckAtStep: isSolved(state) ? null : steps.length,
    steps,
    totalTimeMs: performance.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistics computation
// ─────────────────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

interface TechniqueStats {
  id: string;
  name: string;
  callCount: number;
  totalTimeMs: number;
  meanTimeMs: number;
  p50TimeMs: number;
  p90TimeMs: number;
  p99TimeMs: number;
  maxTimeMs: number;
  hintStarDirect: number;
  hintCrossDirect: number;
  deductionsResolvedStar: number;
  deductionsResolvedCross: number;
  deductionsProduced: number;
  noneCount: number;
  winnerCount: number; // times this tech caused a step to progress
  winnerRate: number;  // winnerCount / callCount
  usefulRate: number;  // (any non-none result) / callCount
  avgWastedMsBefore: number; // avg time wasted before this tech won
  deductionFueledWins: number; // times this tech's deductions were in the pool when any tech resolved
}

function computeStats(results: PuzzleSolveResult[]): TechniqueStats[] {
  const techMap = new Map<string, {
    id: string;
    name: string;
    timings: number[];
    hintStar: number;
    hintCross: number;
    dedResStar: number;
    dedResCross: number;
    ded: number;
    none: number;
    winner: number;
    wastedMsBefore: number[];
    dedFueled: number;
  }>();

  // Init all techniques (even if never called)
  for (const t of techniquesInOrder) {
    techMap.set(t.id, {
      id: t.id,
      name: t.name,
      timings: [],
      hintStar: 0, hintCross: 0,
      dedResStar: 0, dedResCross: 0,
      ded: 0, none: 0,
      winner: 0,
      wastedMsBefore: [],
      dedFueled: 0,
    });
  }

  for (const result of results) {
    for (const step of result.steps) {
      let wastedMs = 0;

      for (const call of step.calls) {
        const s = techMap.get(call.techniqueId);
        if (!s) continue;

        s.timings.push(call.timeMs);

        switch (call.resultType) {
          case 'hint-star': s.hintStar++; break;
          case 'hint-cross': s.hintCross++; break;
          case 'deductions-resolved-star': s.dedResStar++; break;
          case 'deductions-resolved-cross': s.dedResCross++; break;
          case 'deductions': s.ded++; break;
          case 'none': s.none++; break;
        }

        if (call.techniqueId === step.winnerTechniqueId) {
          s.winner++;
          s.wastedMsBefore.push(wastedMs);
        }

        // Track which techniques fueled deduction-resolved wins
        if ((call.resultType === 'deductions-resolved-star' || call.resultType === 'deductions-resolved-cross')
            && call.deductionContributors) {
          for (const cid of call.deductionContributors) {
            const cs = techMap.get(cid);
            if (cs) cs.dedFueled++;
          }
        }

        // Accumulate time for "wasted before winner" only for non-useful calls before winner
        if (call.resultType === 'none' || call.resultType === 'deductions') {
          wastedMs += call.timeMs;
        }
      }
    }
  }

  return techniquesInOrder.map(t => {
    const s = techMap.get(t.id)!;
    const sorted = [...s.timings].sort((a, b) => a - b);
    const total = s.timings.reduce((a, b) => a + b, 0);
    const callCount = s.timings.length;
    const useful = s.hintStar + s.hintCross + s.dedResStar + s.dedResCross + s.ded;
    const wastedMean = s.wastedMsBefore.length > 0
      ? s.wastedMsBefore.reduce((a, b) => a + b, 0) / s.wastedMsBefore.length
      : 0;

    return {
      id: s.id,
      name: s.name,
      callCount,
      totalTimeMs: total,
      meanTimeMs: callCount > 0 ? total / callCount : 0,
      p50TimeMs: percentile(sorted, 50),
      p90TimeMs: percentile(sorted, 90),
      p99TimeMs: percentile(sorted, 99),
      maxTimeMs: sorted[sorted.length - 1] ?? 0,
      hintStarDirect: s.hintStar,
      hintCrossDirect: s.hintCross,
      deductionsResolvedStar: s.dedResStar,
      deductionsResolvedCross: s.dedResCross,
      deductionsProduced: s.ded,
      noneCount: s.none,
      winnerCount: s.winner,
      winnerRate: callCount > 0 ? s.winner / callCount : 0,
      usefulRate: callCount > 0 ? useful / callCount : 0,
      avgWastedMsBefore: wastedMean,
      deductionFueledWins: s.dedFueled,
    };
  });
}

function printSummary(results: PuzzleSolveResult[]): void {
  const solved = results.filter(r => r.solved).length;
  const total = results.length;
  const stepCounts = results.filter(r => r.solved).map(r => r.steps.length);
  const times = results.filter(r => r.solved).map(r => r.totalTimeMs);

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  BENCHMARK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`  Puzzles solved:  ${solved}/${total} (${((solved/total)*100).toFixed(1)}%)`);

  if (stepCounts.length > 0) {
    const stepsSorted = [...stepCounts].sort((a, b) => a - b);
    const timeSorted = [...times].sort((a, b) => a - b);
    console.log(`  Steps per solve: min=${stepsSorted[0]}  mean=${(stepCounts.reduce((a,b)=>a+b,0)/stepCounts.length).toFixed(1)}  p90=${percentile(stepsSorted,90)}  max=${stepsSorted[stepsSorted.length-1]}`);
    console.log(`  Time per solve:  min=${timeSorted[0].toFixed(0)}ms  mean=${(times.reduce((a,b)=>a+b,0)/times.length).toFixed(0)}ms  p90=${percentile(timeSorted,90).toFixed(0)}ms  max=${timeSorted[timeSorted.length-1].toFixed(0)}ms`);
  }

  const stats = computeStats(results);
  const totalBenchTime = results.reduce((a, r) => a + r.totalTimeMs, 0);

  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('  TECHNIQUE STATISTICS (sorted by total time spent)');
  console.log('───────────────────────────────────────────────────────────────────────');

  const header = [
    'Technique'.padEnd(28),
    'Calls'.padStart(7),
    'TotalMs'.padStart(9),
    'MeanMs'.padStart(8),
    'P90ms'.padStart(7),
    'P99ms'.padStart(7),
    'MaxMs'.padStart(7),
    'Wins'.padStart(6),
    'Win%'.padStart(6),
    'Useful%'.padStart(8),
    'Stars'.padStart(6),
    'Crosses'.padStart(8),
    '~MsWasted'.padStart(10),
  ].join('  ');
  console.log(header);
  console.log('─'.repeat(header.length));

  const byTime = [...stats].sort((a, b) => b.totalTimeMs - a.totalTimeMs);
  for (const s of byTime) {
    if (s.callCount === 0) continue;
    const timeShare = (s.totalTimeMs / totalBenchTime * 100).toFixed(1);
    const row = [
      (s.name).padEnd(28),
      s.callCount.toString().padStart(7),
      s.totalTimeMs.toFixed(1).padStart(9),
      s.meanTimeMs.toFixed(2).padStart(8),
      s.p90TimeMs.toFixed(2).padStart(7),
      s.p99TimeMs.toFixed(2).padStart(7),
      s.maxTimeMs.toFixed(1).padStart(7),
      s.winnerCount.toString().padStart(6),
      (s.winnerRate * 100).toFixed(1).padStart(5) + '%',
      (s.usefulRate * 100).toFixed(1).padStart(7) + '%',
      (s.hintStarDirect + s.deductionsResolvedStar).toString().padStart(6),
      (s.hintCrossDirect + s.deductionsResolvedCross).toString().padStart(8),
      s.avgWastedMsBefore.toFixed(1).padStart(10),
    ].join('  ');
    console.log(row + `  (${timeShare}% of total)`);
  }

  // Techniques never called
  const neverCalled = stats.filter(s => s.callCount === 0);
  if (neverCalled.length > 0) {
    console.log('\n  Never called: ' + neverCalled.map(s => s.name).join(', '));
  }

  // Techniques order analysis: where do wins come from?
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('  WIN DISTRIBUTION BY TECHNIQUE ORDER POSITION');
  console.log('───────────────────────────────────────────────────────────────────────');

  const totalSteps = results.flatMap(r => r.steps).filter(s => s.winnerTechniqueId !== null).length;
  const winByPosition: number[] = new Array(techniquesInOrder.length).fill(0);
  for (const r of results) {
    for (const step of r.steps) {
      if (step.winnerTechniqueIndex !== null) {
        winByPosition[step.winnerTechniqueIndex]++;
      }
    }
  }

  let cumWins = 0;
  for (let i = 0; i < techniquesInOrder.length; i++) {
    if (winByPosition[i] === 0) continue;
    cumWins += winByPosition[i];
    const pct = (winByPosition[i] / totalSteps * 100).toFixed(1);
    const cumPct = (cumWins / totalSteps * 100).toFixed(1);
    const tech = techniquesInOrder[i];
    const expensive = tech.expensive ? ' [expensive]' : '';
    console.log(`  #${String(i).padStart(2)} ${tech.name.padEnd(28)}${expensive.padEnd(12)} ${String(winByPosition[i]).padStart(5)} wins (${pct}%)  cumulative: ${cumPct}%`);
  }

  // Wasted-time analysis
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('  EXPENSIVE TECHNIQUES: time spent before first result (top 10)');
  console.log('───────────────────────────────────────────────────────────────────────');

  const expensive = stats
    .filter(s => s.callCount > 0 && s.avgWastedMsBefore > 0)
    .sort((a, b) => b.avgWastedMsBefore - a.avgWastedMsBefore)
    .slice(0, 10);

  for (const s of expensive) {
    console.log(`  ${s.name.padEnd(28)}  avg ${s.avgWastedMsBefore.toFixed(1)}ms wasted by earlier techniques before it won`);
  }

  // Techniques that run but never win
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('  TECHNIQUES WITH ZERO WINS (but non-zero calls) — optimization candidates');
  console.log('───────────────────────────────────────────────────────────────────────');
  const zeroWin = stats.filter(s => s.callCount > 0 && s.winnerCount === 0);
  for (const s of zeroWin) {
    const fueledNote = s.deductionFueledWins > 0 ? `  [fueled ${s.deductionFueledWins} downstream wins]` : '';
    console.log(`  ${s.name.padEnd(28)}  ${s.callCount} calls, ${s.totalTimeMs.toFixed(1)}ms total, ${(s.usefulRate*100).toFixed(1)}% produced deductions${fueledNote}`);
  }

  // Deduction enablers: techniques with zero direct wins but fueled downstream wins
  console.log('\n───────────────────────────────────────────────────────────────────────');
  console.log('  DEDUCTION ENABLERS — zero direct wins, but fed another technique\'s pool');
  console.log('───────────────────────────────────────────────────────────────────────');
  const enablers = stats
    .filter(s => s.callCount > 0 && s.winnerCount === 0 && s.deductionFueledWins > 0)
    .sort((a, b) => b.deductionFueledWins - a.deductionFueledWins);
  if (enablers.length === 0) {
    console.log('  (none — zero-win techniques produced no deductions that resolved downstream)');
  } else {
    for (const s of enablers) {
      const pctFueled = (s.deductionFueledWins / totalSteps * 100).toFixed(1);
      console.log(`  ${s.name.padEnd(28)}  fueled ${s.deductionFueledWins} wins (${pctFueled}% of steps), ${s.totalTimeMs.toFixed(1)}ms total cost`);
    }
  }

  // Also show win+fuel combined for any technique that does both
  const mixedContrib = stats
    .filter(s => s.callCount > 0 && s.winnerCount > 0 && s.deductionFueledWins > 0)
    .sort((a, b) => b.deductionFueledWins - a.deductionFueledWins);
  if (mixedContrib.length > 0) {
    console.log('\n  Techniques that BOTH directly win AND fuel downstream:');
    for (const s of mixedContrib) {
      console.log(`  ${s.name.padEnd(28)}  direct wins: ${s.winnerCount}, fueled: ${s.deductionFueledWins}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker logic
// ─────────────────────────────────────────────────────────────────────────────

async function runWorker() {
  const { puzzleDef, puzzleIndex } = workerData as { puzzleDef: PuzzleDef; puzzleIndex: number };
  try {
    const result = await runSolverOnPuzzle(puzzleDef, puzzleIndex);
    parentPort!.postMessage({ ok: true, result });
  } catch (err: any) {
    parentPort!.postMessage({ ok: false, error: String(err?.message ?? err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main thread orchestrator
// ─────────────────────────────────────────────────────────────────────────────

async function runParallel(
  puzzles: PuzzleDef[],
  numWorkers: number,
  workerFile: string,
  bootstrapFile: string,
): Promise<PuzzleSolveResult[]> {
  const results: PuzzleSolveResult[] = new Array(puzzles.length);
  let nextIndex = 0;
  let completed = 0;
  const startTime = performance.now();

  await new Promise<void>((resolve, reject) => {
    let activeWorkers = 0;

    function spawnNext() {
      if (nextIndex >= puzzles.length) {
        if (activeWorkers === 0) resolve();
        return;
      }

      const puzzleIndex = nextIndex++;
      activeWorkers++;

      const w = new Worker(bootstrapFile, {
        workerData: {
          __workerFile: workerFile,
          tsxEsmApi: (globalThis as any).__tsxEsmApi as string,
          puzzleDef: puzzles[puzzleIndex],
          puzzleIndex,
        },
      });

      w.on('message', (msg: { ok: boolean; result?: PuzzleSolveResult; error?: string }) => {
        if (msg.ok && msg.result) {
          results[puzzleIndex] = msg.result;
        } else {
          results[puzzleIndex] = {
            puzzleIndex,
            solved: false,
            stuckAtStep: 0,
            steps: [],
            totalTimeMs: 0,
          };
          console.error(`Worker error for puzzle ${puzzleIndex}: ${msg.error}`);
        }
      });

      w.on('error', (err) => {
        console.error(`Worker ${puzzleIndex} error:`, err);
        results[puzzleIndex] = { puzzleIndex, solved: false, stuckAtStep: 0, steps: [], totalTimeMs: 0 };
      });

      w.on('exit', () => {
        activeWorkers--;
        completed++;
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        const pct = ((completed / puzzles.length) * 100).toFixed(0);
        process.stdout.write(`\r  Solved ${completed}/${puzzles.length} (${pct}%) — ${elapsed}s elapsed`);
        spawnNext();
        if (activeWorkers === 0 && nextIndex >= puzzles.length) resolve();
      });
    }

    const initialBatch = Math.min(numWorkers, puzzles.length);
    for (let i = 0; i < initialBatch; i++) spawnNext();
  });

  process.stdout.write('\n');
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

if (!isMainThread) {
  await runWorker();
} else {
  const args = process.argv.slice(2);
  let puzzleCount = 100;
  let loadFile: string | null = null;
  let outFile = 'benchmark-data.json';
  let workerOverride: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--load' && args[i + 1]) { loadFile = args[++i]; }
    else if (args[i] === '--out' && args[i + 1]) { outFile = args[++i]; }
    else if (args[i] === '--workers' && args[i + 1]) { workerOverride = parseInt(args[++i]); }
    else if (/^\d+$/.test(args[i])) { puzzleCount = parseInt(args[i]); }
  }

  const numCores = cpus().length;
  const numWorkers = workerOverride ?? Math.max(1, numCores - 1);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const bootstrapFile = join(__dirname, 'worker-bootstrap.mjs');

  // Find tsx ESM API — search in multiple locations
  async function findTsxEsmApi(): Promise<string> {
    const { createRequire } = await import('module');
    const { readdirSync } = await import('fs');

    const candidates: string[] = [];

    // 1. Local install
    candidates.push(join(process.cwd(), 'node_modules', 'tsx', 'dist', 'esm', 'api', 'index.mjs'));

    // 2. Resolve tsx/package.json relative to this script
    try {
      const r = createRequire(import.meta.url);
      const tsxPkg = r.resolve('tsx/package.json');
      candidates.push(join(dirname(tsxPkg), 'dist', 'esm', 'api', 'index.mjs'));
    } catch { /* tsx not locally installed */ }

    // 3. Look at process.execArgv for tsx cli path hints
    for (const arg of process.execArgv) {
      if (arg.includes('tsx') && (arg.endsWith('.mjs') || arg.endsWith('.cjs'))) {
        const dir = dirname(arg); // e.g. /path/to/tsx/dist
        candidates.push(join(dir, 'esm', 'api', 'index.mjs'));
        candidates.push(join(dirname(dir), 'dist', 'esm', 'api', 'index.mjs'));
      }
    }

    // 4. Search common npx cache
    if (process.env.HOME) {
      const npxBase = join(process.env.HOME, '.npm', '_npx');
      if (existsSync(npxBase)) {
        try {
          for (const hash of readdirSync(npxBase)) {
            candidates.push(join(npxBase, hash, 'node_modules', 'tsx', 'dist', 'esm', 'api', 'index.mjs'));
          }
        } catch { /* ignore */ }
      }
    }

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }

    throw new Error('Cannot locate tsx/dist/esm/api/index.mjs. Install tsx locally: npm i -D tsx');
  }

  const tsxEsmApi = await findTsxEsmApi();
  (globalThis as any).__tsxEsmApi = tsxEsmApi;

  console.log(`\nStar Battle Solver Benchmark`);
  console.log(`Workers: ${numWorkers} (of ${numCores} cores)`);

  let puzzles: PuzzleDef[];

  if (loadFile) {
    console.log(`Loading puzzles from ${loadFile}...`);
    const data = JSON.parse(readFileSync(loadFile, 'utf-8')) as BenchmarkData;
    puzzles = data.puzzles;
    puzzleCount = puzzles.length;
    console.log(`Loaded ${puzzleCount} puzzles.`);
  } else {
    console.log(`Generating ${puzzleCount} puzzles...`);
    puzzles = generatePuzzles(puzzleCount);
    if (puzzles.length < puzzleCount) {
      console.warn(`Warning: only generated ${puzzles.length}/${puzzleCount} unique puzzles.`);
    }
  }

  console.log(`Solving ${puzzles.length} puzzles with ${numWorkers} workers...`);
  const results = await runParallel(puzzles, numWorkers, __filename, bootstrapFile);

  const data: BenchmarkData = {
    generatedAt: new Date().toISOString(),
    puzzleCount: puzzles.length,
    puzzles,
    results,
  };

  writeFileSync(outFile, JSON.stringify(data));
  console.log(`Raw data saved to ${outFile}`);

  printSummary(results);
}

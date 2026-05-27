/** Diff two benchmark-data.json files. Usage: tsx scripts/bench-diff.mts a.json b.json */
import { readFileSync } from 'fs';

interface SolverStep { calls: Array<{ techniqueId: string; timeMs: number }>; winnerTechniqueId: string | null; }
interface PuzzleSolveResult { solved: boolean; steps: SolverStep[]; totalTimeMs: number; }
interface BenchmarkData { results: PuzzleSolveResult[]; }

function aggregate(data: BenchmarkData) {
  const perTech = new Map<string, { calls: number; totalMs: number; wins: number }>();
  let solved = 0, totalTime = 0, countSolved = 0;
  for (const r of data.results) {
    if (r.solved) { solved += 1; totalTime += r.totalTimeMs; countSolved += 1; }
    for (const s of r.steps) {
      for (const c of s.calls) {
        const e = perTech.get(c.techniqueId) ?? { calls: 0, totalMs: 0, wins: 0 };
        e.calls += 1; e.totalMs += c.timeMs; perTech.set(c.techniqueId, e);
      }
      if (s.winnerTechniqueId) {
        const e = perTech.get(s.winnerTechniqueId) ?? { calls: 0, totalMs: 0, wins: 0 };
        e.wins += 1; perTech.set(s.winnerTechniqueId, e);
      }
    }
  }
  return { solved, total: data.results.length, meanTimeMs: countSolved > 0 ? totalTime / countSolved : 0, perTech };
}

function pct(after: number, before: number) {
  if (before === 0) return after === 0 ? '   0%' : '  inf%';
  const p = ((after - before) / before) * 100;
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`.padStart(7);
}

function fmt(n: number) { return (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)).padStart(9); }

const [, , baseFile, afterFile] = process.argv;
if (!baseFile || !afterFile) { console.error('Usage: bench-diff.mts <baseline> <after>'); process.exit(1); }
const b = aggregate(JSON.parse(readFileSync(baseFile, 'utf-8')) as BenchmarkData);
const a = aggregate(JSON.parse(readFileSync(afterFile, 'utf-8')) as BenchmarkData);

console.log(`\nSolved:   base=${b.solved}/${b.total}  after=${a.solved}/${a.total}  (Δ ${a.solved - b.solved})`);
console.log(`Mean ms:  base=${b.meanTimeMs.toFixed(0)}  after=${a.meanTimeMs.toFixed(0)}  (${pct(a.meanTimeMs, b.meanTimeMs).trim()})\n`);

const rows: Array<[string, number, number, number, number, number, number]> = [];
for (const k of new Set([...b.perTech.keys(), ...a.perTech.keys()])) {
  const bE = b.perTech.get(k) ?? { calls: 0, totalMs: 0, wins: 0 };
  const aE = a.perTech.get(k) ?? { calls: 0, totalMs: 0, wins: 0 };
  rows.push([k, bE.totalMs, aE.totalMs, bE.calls, aE.calls, bE.wins, aE.wins]);
}
rows.sort((x, y) => y[1] - x[1]);

console.log('Technique'.padEnd(28) + 'Base ms'.padStart(9) + ' After ms'.padStart(10) + '   Δ%   ' + 'BCalls'.padStart(7) + 'ACalls'.padStart(7) + ' BW'.padStart(4) + ' AW'.padStart(4));
console.log('─'.repeat(75));
for (const [k, bMs, aMs, bC, aC, bW, aW] of rows) {
  if (bMs === 0 && aMs === 0) continue;
  console.log(k.padEnd(28) + fmt(bMs) + ' ' + fmt(aMs) + ' ' + pct(aMs, bMs) + String(bC).padStart(7) + String(aC).padStart(7) + String(bW).padStart(4) + String(aW).padStart(4));
}

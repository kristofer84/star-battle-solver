/** Subset bench-baseline.json puzzles. Usage: tsx scripts/bench-subset.mts in.json N out.json */
import { readFileSync, writeFileSync } from 'fs';
const [, , inFile, nStr, outFile] = process.argv;
const data = JSON.parse(readFileSync(inFile, 'utf-8'));
const n = parseInt(nStr, 10);
const subset = { ...data, puzzles: data.puzzles.slice(0, n), puzzleCount: n, results: [] };
writeFileSync(outFile, JSON.stringify(subset));
console.log(`Wrote ${n} puzzles to ${outFile}`);

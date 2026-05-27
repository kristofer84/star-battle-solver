/** Build a puzzle-data file containing only specified indices. Usage: tsx bench-select.mts in.json out.json idx1,idx2,... */
import { readFileSync, writeFileSync } from 'fs';
const [, , inFile, outFile, idxStr] = process.argv;
const idxs = idxStr.split(',').map(Number);
const data = JSON.parse(readFileSync(inFile, 'utf-8'));
const subset = { ...data, puzzles: idxs.map((i) => data.puzzles[i]), puzzleCount: idxs.length, results: [] };
writeFileSync(outFile, JSON.stringify(subset));
console.log(`Wrote ${idxs.length} puzzles to ${outFile}`);

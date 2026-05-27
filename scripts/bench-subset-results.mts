/** Extract results for specified puzzleIndex values into a new bench file. Usage: tsx bench-subset-results.mts in.json out.json idx1,idx2,... */
import { readFileSync, writeFileSync } from 'fs';
const [, , inFile, outFile, idxStr] = process.argv;
const idxs = new Set(idxStr.split(',').map(Number));
const data = JSON.parse(readFileSync(inFile, 'utf-8'));
const results = data.results.filter((r: { puzzleIndex: number }) => idxs.has(r.puzzleIndex));
const subset = { ...data, results };
writeFileSync(outFile, JSON.stringify(subset));
console.log(`Wrote ${results.length} results to ${outFile}`);

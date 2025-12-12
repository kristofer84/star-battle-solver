import type { PuzzleState } from '../../../types/puzzle';
import type { VerifiedCellAssignment, VerifiedCandidate } from './schemaHintVerifier';

function stateKey(state: PuzzleState): string {
  // Fast and stable: stringify the cell grid only.
  // (If regions/starsPerUnit/size can vary, include def.size + starsPerUnit.)
  return `${state.def.size}:${state.def.starsPerUnit}:` + state.cells.map(r => r.join('')).join('|');
}

export function makeVerificationKey(state: PuzzleState, a: VerifiedCellAssignment): string {
  return `${stateKey(state)}::${a.row},${a.col}:${a.value}`;
}

const cache = new Map<string, VerifiedCandidate>();

export function getCached(key: string): VerifiedCandidate | undefined {
  return cache.get(key);
}

export function setCached(key: string, value: VerifiedCandidate): void {
  cache.set(key, value);
}

export function clearVerificationCache(): void {
  cache.clear();
}

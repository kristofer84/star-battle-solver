/**
 * Index file that explicitly imports all entanglement JSON files
 * This ensures Vite can discover and bundle them properly
 *
 * Files moved to backup/ (not loaded):
 * - 10x10-2star-entanglements.json: pair-based patterns, not used by any active technique
 * - 10x10-2star-entanglements-constrained-entanglements.json: constrainedData, not processed by entanglementPatterns.ts
 * - 10x10-2star-entanglements-pure-entanglements.json: pureData, not processed by entanglementPatterns.ts
 */

import examplePair from './example-pair.json';
import exampleTriple from './example-triple.json';
import entanglements10x10Triple from './10x10-2star-entanglements-triple-entanglements.json';

export const entanglementFiles = [
  { id: 'example-pair', data: examplePair },
  { id: 'example-triple', data: exampleTriple },
  { id: '10x10-2star-entanglements-triple-entanglements', data: entanglements10x10Triple },
];


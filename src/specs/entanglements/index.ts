/**
 * Index file that explicitly imports all entanglement JSON files
 * This ensures Vite can discover and bundle them properly
 *
 * Files kept in backup/ (not loaded):
 * - 10x10-2star-entanglements-pure-entanglements.json: pure templates are identical to the
 *   unconstrained_rules in the constrained file, so loading it would be duplicate data.
 */

import examplePair from './example-pair.json';
import exampleTriple from './example-triple.json';
import entanglements10x10 from './10x10-2star-entanglements.json';
import entanglements10x10Constrained from './10x10-2star-entanglements-constrained-entanglements.json';
import entanglements10x10Triple from './10x10-2star-entanglements-triple-entanglements.json';

export const entanglementFiles = [
  { id: 'example-pair', data: examplePair },
  { id: 'example-triple', data: exampleTriple },
  { id: '10x10-2star-entanglements', data: entanglements10x10 },
  { id: '10x10-2star-entanglements-constrained-entanglements', data: entanglements10x10Constrained },
  { id: '10x10-2star-entanglements-triple-entanglements', data: entanglements10x10Triple },
];


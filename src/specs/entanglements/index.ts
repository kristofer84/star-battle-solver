/**
 * Index file that explicitly imports all entanglement JSON files
 * This ensures Vite can discover and bundle them properly
 */

import entanglements10x10 from './10x10-2star-entanglements.json';
import entanglements10x10Constrained from './10x10-2star-entanglements-constrained-entanglements.json';
import entanglements10x10Pure from './10x10-2star-entanglements-pure-entanglements.json';
import entanglements10x10Triple from './10x10-2star-entanglements-triple-entanglements.json';

export const entanglementFiles = [
  { id: '10x10-2star-entanglements', data: entanglements10x10 },
  { id: '10x10-2star-entanglements-constrained-entanglements', data: entanglements10x10Constrained },
  { id: '10x10-2star-entanglements-pure-entanglements', data: entanglements10x10Pure },
  { id: '10x10-2star-entanglements-triple-entanglements', data: entanglements10x10Triple },
];


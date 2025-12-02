import type { PuzzleState } from '../types/puzzle';
import type { Hint, TechniqueId } from '../types/hints';
import { addLogEntry } from '../store/puzzleStore';
import { findTrivialMarksHint } from './techniques/trivialMarks';
import { findTwoByTwoHint } from './techniques/twoByTwo';
import { findCrossPressureHint } from './techniques/crossPressure';
import { findOneByNHint } from './techniques/oneByN';
import { findExclusionHint } from './techniques/exclusion';
import { findPressuredExclusionHint } from './techniques/pressuredExclusion';
import { findSimpleShapesHint } from './techniques/simpleShapes';
import { findUndercountingHint } from './techniques/undercounting';
import { findOvercountingHint } from './techniques/overcounting';
import { findFinnedCountsHint } from './techniques/finnedCounts';
import { findCompositeShapesHint } from './techniques/compositeShapes';
import { findSqueezeHint } from './techniques/squeeze';
import { findSetDifferentialsHint } from './techniques/setDifferentials';
import { findByAThreadHint } from './techniques/byAThread';
import { findAtSeaHint } from './techniques/atSea';
import { findByAThreadAtSeaHint } from './techniques/byAThreadAtSea';
import { findKissingLsHint } from './techniques/kissingLs';
import { findTheMHint } from './techniques/theM';
import { findPressuredTsHint } from './techniques/pressuredTs';
import { findFishHint } from './techniques/fish';
import { findNRooksHint } from './techniques/nRooks';
import { findEntanglementHint } from './techniques/entanglement';

export interface Technique {
  id: TechniqueId;
  name: string;
  findHint(state: PuzzleState): Hint | null;
}

export const techniquesInOrder: Technique[] = [
  {
    id: 'trivial-marks',
    name: 'Trivial Marks',
    findHint: findTrivialMarksHint,
  },
  {
    id: 'two-by-two',
    name: '2×2 Blocks',
    findHint: findTwoByTwoHint,
  },
  {
    id: 'cross-pressure',
    name: 'Cross Pressure',
    findHint: findCrossPressureHint,
  },
  {
    id: 'simple-shapes',
    name: 'Simple Shapes',
    findHint: findSimpleShapesHint,
  },
  {
    id: 'one-by-n',
    name: '1×N Bands',
    findHint: findOneByNHint,
  },
  {
    id: 'exclusion',
    name: 'Exclusion',
    findHint: findExclusionHint,
  },
  {
    id: 'pressured-exclusion',
    name: 'Pressured Exclusion',
    findHint: findPressuredExclusionHint,
  },
  {
    id: 'undercounting',
    name: 'Undercounting',
    findHint: findUndercountingHint,
  },
  {
    id: 'overcounting',
    name: 'Overcounting',
    findHint: findOvercountingHint,
  },
  {
    id: 'finned-counts',
    name: 'Finned Counts',
    findHint: findFinnedCountsHint,
  },
  {
    id: 'composite-shapes',
    name: 'Composite Shapes',
    findHint: findCompositeShapesHint,
  },
  {
    id: 'squeeze',
    name: 'Squeeze',
    findHint: findSqueezeHint,
  },
  {
    id: 'set-differentials',
    name: 'Set Differentials',
    findHint: findSetDifferentialsHint,
  },
  {
    id: 'at-sea',
    name: 'At Sea',
    findHint: findAtSeaHint,
  },
  {
    id: 'kissing-ls',
    name: 'Kissing Ls',
    findHint: findKissingLsHint,
  },
  {
    id: 'the-m',
    name: 'The M',
    findHint: findTheMHint,
  },
  {
    id: 'pressured-ts',
    name: 'Pressured Ts',
    findHint: findPressuredTsHint,
  },
  {
    id: 'fish',
    name: 'Fish',
    findHint: findFishHint,
  },
  {
    id: 'n-rooks',
    name: 'N Rooks',
    findHint: findNRooksHint,
  },
  {
    id: 'by-a-thread',
    name: 'By a Thread',
    findHint: findByAThreadHint,
  },
  {
    id: 'by-a-thread-at-sea',
    name: 'By a Thread at Sea',
    findHint: findByAThreadAtSeaHint,
  },
  {
    id: 'entanglement',
    name: 'Entanglement',
    findHint: findEntanglementHint,
  },
];

export function findNextHint(state: PuzzleState): Hint | null {
  const startTime = performance.now();
  const testedTechniques: Array<{ technique: string; timeMs: number }> = [];
  
  for (const tech of techniquesInOrder) {
    const techStartTime = performance.now();
    const hint = tech.findHint(state);
    const techEndTime = performance.now();
    const techTimeMs = techEndTime - techStartTime;
    const techniqueName = tech.name;
    
    testedTechniques.push({
      technique: techniqueName,
      timeMs: techTimeMs,
    });
    
    if (hint) {
      const totalTimeMs = techEndTime - startTime;
      const message = hint.explanation || `Found hint using ${techniqueName}`;
      
      addLogEntry({
        timestamp: Date.now(),
        technique: techniqueName,
        timeMs: techTimeMs,
        message: `${message} (placed ${hint.resultCells.length} ${hint.kind === 'place-star' ? 'star' : 'cross'}${hint.resultCells.length !== 1 ? 's' : ''})`,
        testedTechniques: testedTechniques,
      });
      
      return hint;
    }
  }
  
  const totalTimeMs = performance.now() - startTime;
  addLogEntry({
    timestamp: Date.now(),
    technique: 'None',
    timeMs: totalTimeMs,
    message: 'No hint found with current techniques',
    testedTechniques: testedTechniques,
  });
  
  return null;
}

export const techniqueNameById: Record<TechniqueId, string> = techniquesInOrder.reduce(
  (acc, tech) => {
    acc[tech.id] = tech.name;
    return acc;
  },
  {} as Record<TechniqueId, string>,
);



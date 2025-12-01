import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { intersection, union, difference } from '../src/logic/helpers';
import type { Coords } from '../src/types/puzzle';

// Arbitrary generator for Coords
const coordsArb = fc.record({
  row: fc.integer({ min: 0, max: 9 }),
  col: fc.integer({ min: 0, max: 9 }),
});

// Arbitrary generator for arrays of Coords
const coordsArrayArb = fc.array(coordsArb, { minLength: 0, maxLength: 20 });

function coordsEqual(a: Coords, b: Coords): boolean {
  return a.row === b.row && a.col === b.col;
}

function hasDuplicates(arr: Coords[]): boolean {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (coordsEqual(arr[i], arr[j])) {
        return true;
      }
    }
  }
  return false;
}

function containsCoord(arr: Coords[], coord: Coords): boolean {
  return arr.some((c) => coordsEqual(c, coord));
}

describe('Set Operations - Property Tests', () => {
  /**
   * Property 1: All hints have required fields
   * Validates: Requirements 22.1
   * 
   * Note: This property is about set operations, not hints.
   * The property tests that set operations maintain correctness.
   */

  it('intersection contains only elements in both sets', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, (a, b) => {
        const result = intersection(a, b);
        
        // Every element in result must be in both a and b
        for (const coord of result) {
          expect(containsCoord(a, coord)).toBe(true);
          expect(containsCoord(b, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('intersection is commutative', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, (a, b) => {
        const ab = intersection(a, b);
        const ba = intersection(b, a);
        
        // Both should have same length
        expect(ab.length).toBe(ba.length);
        
        // Every element in ab should be in ba
        for (const coord of ab) {
          expect(containsCoord(ba, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('union contains all elements from both sets', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, (a, b) => {
        const result = union(a, b);
        
        // Every element in a must be in result
        for (const coord of a) {
          expect(containsCoord(result, coord)).toBe(true);
        }
        
        // Every element in b must be in result
        for (const coord of b) {
          expect(containsCoord(result, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('union is commutative (same elements, possibly different order)', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, (a, b) => {
        const ab = union(a, b);
        const ba = union(b, a);
        
        // Both should have same length
        expect(ab.length).toBe(ba.length);
        
        // Every element in ab should be in ba
        for (const coord of ab) {
          expect(containsCoord(ba, coord)).toBe(true);
        }
        
        // Every element in ba should be in ab
        for (const coord of ba) {
          expect(containsCoord(ab, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('difference contains only elements in first set but not second', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, (a, b) => {
        const result = difference(a, b);
        
        // Every element in result must be in a
        for (const coord of result) {
          expect(containsCoord(a, coord)).toBe(true);
        }
        
        // No element in result should be in b
        for (const coord of result) {
          expect(containsCoord(b, coord)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('difference with empty set returns deduplicated original set', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = difference(a, []);
        
        // Every unique element in a should be in result
        for (const coord of a) {
          expect(containsCoord(result, coord)).toBe(true);
        }
        
        // Result should not have duplicates
        expect(hasDuplicates(result)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('intersection with empty set returns empty set', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = intersection(a, []);
        expect(result.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('union with empty set returns deduplicated original set', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = union(a, []);
        
        // Every unique element in a should be in result
        for (const coord of a) {
          expect(containsCoord(result, coord)).toBe(true);
        }
        
        // Result should not have duplicates
        expect(hasDuplicates(result)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('intersection is idempotent', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = intersection(a, a);
        
        // Result should contain all elements from a
        for (const coord of a) {
          expect(containsCoord(result, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('union is idempotent (no duplicates added)', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = union(a, a);
        
        // Every element in a should be in result
        for (const coord of a) {
          expect(containsCoord(result, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('difference with self returns empty set', () => {
    fc.assert(
      fc.property(coordsArrayArb, (a) => {
        const result = difference(a, a);
        expect(result.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('set identity: A ∪ (B ∩ C) = (A ∪ B) ∩ (A ∪ C) - distributive law', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, coordsArrayArb, (a, b, c) => {
        const left = union(a, intersection(b, c));
        const right = intersection(union(a, b), union(a, c));
        
        // Both should have same length
        expect(left.length).toBe(right.length);
        
        // Every element in left should be in right
        for (const coord of left) {
          expect(containsCoord(right, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('set identity: A \\ (B ∪ C) = (A \\ B) ∩ (A \\ C) - De Morgan\'s law', () => {
    fc.assert(
      fc.property(coordsArrayArb, coordsArrayArb, coordsArrayArb, (a, b, c) => {
        const left = difference(a, union(b, c));
        const right = intersection(difference(a, b), difference(a, c));
        
        // Both should have same length
        expect(left.length).toBe(right.length);
        
        // Every element in left should be in right
        for (const coord of left) {
          expect(containsCoord(right, coord)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

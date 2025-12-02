import { describe, it } from 'vitest';

describe('Manual Parse', () => {
  it('should manually parse the solution', () => {
    // Exactly as user provided:
    const solutionRaw = `. . . S . . S . . .
. S . . . . . . S .
. . . S . S . . . S
. . . . . . . . . S
. . . . S . S . . .
. . S . . . . . S .
S . . . . S . . . .
. . S . . . . S . .
. . . . S . . . . S
. S . . . . . S . .`;

    console.log('\n=== Raw solution ===');
    const lines = solutionRaw.split('\n');
    lines.forEach((line, i) => {
      console.log(`Row ${i}: "${line}"`);
      const starCount = (line.match(/S/g) || []).length;
      console.log(`  Stars in row: ${starCount}`);
    });

    // Count stars per column
    console.log('\n=== Column analysis ===');
    for (let col = 0; col < 10; col++) {
      let count = 0;
      const positions: number[] = [];
      lines.forEach((line, row) => {
        const chars = line.split(' ');
        if (chars[col] === 'S') {
          count++;
          positions.push(row);
        }
      });
      console.log(`Col ${col}: ${count} stars at rows ${positions.join(', ')}`);
    }

    // Extract exact star positions
    console.log('\n=== All star positions ===');
    const stars: [number, number][] = [];
    lines.forEach((line, row) => {
      const chars = line.split(' ');
      chars.forEach((char, col) => {
        if (char === 'S') {
          stars.push([row, col]);
          console.log(`  (${row}, ${col})`);
        }
      });
    });

    console.log(`\nTotal stars: ${stars.length}`);
  });
});

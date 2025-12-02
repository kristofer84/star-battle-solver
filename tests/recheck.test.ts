import { describe, it } from 'vitest';

describe('Recheck Solution', () => {
  it('should parse character by character', () => {
    // User's exact text:
    const row2 = '. . . S . S . . . S';
    
    console.log('\n=== Character by character analysis of row 2 ===');
    console.log(`Full string: "${row2}"`);
    console.log(`Length: ${row2.length}`);
    
    const chars = row2.split('');
    chars.forEach((char, i) => {
      console.log(`Index ${i}: "${char}" (code: ${char.charCodeAt(0)})`);
    });
    
    console.log('\n=== Split by space ===');
    const parts = row2.split(' ');
    parts.forEach((part, i) => {
      console.log(`Position ${i}: "${part}"`);
    });
    
    console.log('\n=== Looking for S characters ===');
    parts.forEach((part, i) => {
      if (part === 'S') {
        console.log(`Found S at position ${i}`);
      }
    });
  });
});

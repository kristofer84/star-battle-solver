# N‑Rooks Technique (Kris De Asis style) – Implementation Guide

This guide explains how to change an existing **cell‑based “N‑rooks” technique** into the **2×2‑block‑based “N‑rooks” technique** described by Kris De Asis and used in the `kristofer84/star-battle-solver` project (10×10, 2★ puzzles). It assumes you already have generic puzzle helpers (rows, columns, regions, adjacency) and some 2×2 helpers.

The key change is:

> Work on **2×2 blocks** and their **empty / non‑empty status**, not directly on individual forced cells.

The goal of this guide is to give you firm, concrete steps so you can replace your current `findNRooksHint` with a faithful implementation of the 2×2 N‑rooks logic.

---

## 1. Preconditions and Scope

1. **Board size and stars per unit**  
   This implementation assumes:
   - Board is **10×10**.
   - `starsPerUnit = 2` (two stars per row, column, and region).

   If your code supports more general sizes, treat this technique as **gated**:
   ```ts
   if (state.def.size !== 10 || state.def.starsPerUnit !== 2) return null;
   ```

2. **2×2 blocks**  
   Partition the 10×10 grid into a **5×5 grid of 2×2 blocks**:

   - Block rows: `BRow = 0..4`
   - Block cols: `BCol = 0..4`
   - Cells in block `(BRow, BCol)` are the four cells:
     ```
     rows: 2*BRow, 2*BRow + 1
     cols: 2*BCol, 2*BCol + 1
     ```

3. **Unit counts available**  
   You must already be able to compute, for any subset of cells:
   - How many **stars are placed** now.
   - How many **stars are still required** (remaining) in rows, columns, and regions.

4. **2×2 helper layer**  
   You will introduce (or reuse) a simple **2×2 abstraction layer** to talk in terms of blocks instead of cells. You do **not** need to expose this outside the technique; it can be internal helpers.

---

## 2. Data Structures to Add

Add a small block‑level model to the N‑rooks module. This does **not** modify your global `PuzzleState`; it is a derived view for the technique.

### 2.1 Block coordinates and indexing

Add a type for 2×2 blocks:

```ts
interface BlockCoords {
  bRow: number; // 0..4
  bCol: number; // 0..4
}
```

Convenience functions:

```ts
function blockId(b: BlockCoords): number {
  return b.bRow * 5 + b.bCol; // 0..24
}

function idToBlock(id: number): BlockCoords {
  return { bRow: Math.floor(id / 5), bCol: id % 5 };
}
```

### 2.2 Mapping between blocks and cells

You will use these **everywhere** in the technique:

```ts
function cellsInBlock(b: BlockCoords): Coords[] {
  const baseRow = 2 * b.bRow;
  const baseCol = 2 * b.bCol;
  return [
    { row: baseRow,     col: baseCol     },
    { row: baseRow,     col: baseCol + 1 },
    { row: baseRow + 1, col: baseCol     },
    { row: baseRow + 1, col: baseCol + 1 },
  ];
}

function blockOfCell(cell: Coords): BlockCoords {
  return {
    bRow: Math.floor(cell.row / 2),
    bCol: Math.floor(cell.col / 2),
  };
}
```

### 2.3 Block status

For N‑rooks, you care about whether a 2×2 block **must be empty**, **must contain a star**, or is still **unknown**.

Add an enum:

```ts
type BlockStatus = 'empty' | 'has-star' | 'unknown';

interface BlockInfo {
  coords: BlockCoords;
  status: BlockStatus;
  cells: Coords[]; // length 4
}
```

You will create a `BlockInfo[]` (length 25) from the current `PuzzleState`.

---

## 3. Deriving Block Status from State

This is where your **2×2 helpers** come in. You need a function:

```ts
function analyseBlocks(state: PuzzleState): BlockInfo[];
```

It should implement the following logic, in this order, for every block:

1. **Collect cells**
   ```ts
   const cells = cellsInBlock(b);
   ```

2. **Classify each cell as:**
   - `fixed-star` – explicitly has a star in the current state.
   - `impossible` – cannot be a star **for any reason**:
     - already marked as “no star” in your representation,
     - would violate adjacency if starred,
     - row/col/region is full for that cell,
     - any other constraint you already encode.
   - `candidate` – not a star yet, but **still allowed** to become one later.

   You should already have helper(s) to answer “can this cell still be a star?”. Reuse them consistently.

3. **Determine block status (`BlockStatus`)**

   Use these rules:

   - **Rule B1 – Empty block**
     ```ts
     if (cells.every(c => isImpossibleStarCell(state, c))) {
       status = 'empty';
     }
     ```

   - **Rule B2 – Block already has a star**
     ```ts
     else if (cells.some(c => isFixedStar(state, c))) {
       status = 'has-star';
     }
     ```

   - **Rule B3 – Potentially star but not forced**
     ```ts
     else {
       status = 'unknown';
     }
     ```

   These three rules are enough for the *N‑rooks* layer. More advanced 2×2 logic can live in other techniques; N‑rooks consumes the derived `empty` and `has-star` information.

4. **Return all blocks**

   ```ts
   const blocks: BlockInfo[] = [];
   for (let bRow = 0; bRow < 5; bRow += 1) {
     for (let bCol = 0; bCol < 5; bCol += 1) {
       const coords = { bRow, bCol };
       const cells = cellsInBlock(coords);
       const status = classifyBlock(state, cells); // rules B1–B3
       blocks.push({ coords, status, cells });
     }
   }
   return blocks;
   ```

This block analysis is deliberately **simple and local**. All the global “N‑rooks” cleverness comes in the next step.

---

## 4. The N‑Rooks Invariant on Blocks

For a **10×10, 2★** puzzle:

- Each pair of rows (2×10 strip) contains **4 stars**.
- Each 2×2 block contains **at most one star** (adjacency rule).  
  Therefore, those 4 stars must be in **4 distinct blocks** in that strip.
- There are `5` blocks across the strip, so **exactly 1 block in each block row is empty** (contains 0 stars).  
  The same holds for **each block column**.

This yields a global invariant:

> For each block row **bRow** ∈ {0..4}, exactly **one** block `(bRow, bCol)` is empty.  
> For each block col **bCol** ∈ {0..4}, exactly **one** block `(bRow, bCol)` is empty.

The set of **empty blocks** forms a **5×5 N‑rooks configuration**: one in each row and each column.

Your job is to exploit this invariant using **partial information** (some blocks already known `empty` or `has-star`) to deduce **new empty blocks**, which then translate to **new “no star” cell marks**.

---

## 5. Block‑Level N‑Rooks Logic

You will write a new `findNRooksHint` that operates purely on **blocks**.

### 5.1 Overview

1. Compute `blocks = analyseBlocks(state)`.
2. Derive maps:
   - For each `bRow`: list of empty / non‑empty / unknown block indices.
   - For each `bCol`: same.
3. Apply N‑rooks reasoning to find **at least one new block that must be empty**, but is currently `unknown`.
4. Convert that to a **hint** that places crosses in its 4 cells.

If you cannot find such a block, return `null`.

### 5.2 Row and column views

Build these helper structures:

```ts
interface BlockRowInfo {
  row: number; // 0..4
  empties: BlockInfo[];
  nonEmpties: BlockInfo[]; // has-star
  unknowns: BlockInfo[];
}

interface BlockColInfo {
  col: number; // 0..4
  empties: BlockInfo[];
  nonEmpties: BlockInfo[]; // has-star
  unknowns: BlockInfo[];
}
```

Populate them:

```ts
function buildBlockRowInfo(blocks: BlockInfo[]): BlockRowInfo[] {
  const rows: BlockRowInfo[] = [];
  for (let bRow = 0; bRow < 5; bRow += 1) {
    const rowBlocks = blocks.filter(b => b.coords.bRow === bRow);
    rows.push({
      row: bRow,
      empties: rowBlocks.filter(b => b.status === 'empty'),
      nonEmpties: rowBlocks.filter(b => b.status === 'has-star'),
      unknowns: rowBlocks.filter(b => b.status === 'unknown'),
    });
  }
  return rows;
}

function buildBlockColInfo(blocks: BlockInfo[]): BlockColInfo[] {
  const cols: BlockColInfo[] = [];
  for (let bCol = 0; bCol < 5; bCol += 1) {
    const colBlocks = blocks.filter(b => b.coords.bCol === bCol);
    cols.push({
      col: bCol,
      empties: colBlocks.filter(b => b.status === 'empty'),
      nonEmpties: colBlocks.filter(b => b.status === 'has-star'),
      unknowns: colBlocks.filter(b => b.status === 'unknown'),
    });
  }
  return cols;
}
```

### 5.3 Core N‑rooks deductions

Implement the following logical rules.

All rules assume **N‑rooks invariant**:

- Per block row: `#empty = 1`.
- Per block col: `#empty = 1`.

#### Rule R1 – Single empty already known in a row/column

If a block row already has a known empty block, every other block in that row must be **non‑empty**. That does not give you a new empty block, but it is useful if you want a symmetrical implementation and internal checks.

Similarly for block columns.

You *may* use this to strengthen `has-star` statuses, but it is not required for the basic hint.

#### Rule R2 – Four blocks already non‑empty in a row

If a block row has **four blocks** that are known non‑empty (`status === 'has-star'`) and **one unknown**, then that one unknown must be the empty block.

Formally:

```ts
for each BlockRowInfo rowInfo:
  if rowInfo.empties.length === 0 &&
     rowInfo.nonEmpties.length === 4 &&
     rowInfo.unknowns.length === 1:

    const emptyBlock = rowInfo.unknowns[0];
    // we have deduced a new empty block
```

Apply the symmetric rule for block columns.

#### Rule R3 – Cross‑checking rows and columns

Sometimes a block is not forced empty by a single row or column alone but becomes forced when you combine both constraints.

Algorithm:

1. Collect all **candidate empty blocks**: blocks that are currently `unknown`.
2. For each block row:
   - If it has no `empty` yet, all its `unknowns` are candidates for “the empty one” in that row.
3. For each block column:
   - Similarly collect candidates.

Then observe:

- In any valid solution, the **25 empty blocks** form a permutation (`bRow -> bCol`).  
  This is a classic N‑rooks structure.

A simple, implementable pattern that does not require full search:

- If, for a given `bRow`, **only one unknown block** remains that is also a valid candidate for its column (i.e. that column has no known empty yet), then that block must be empty.

In practice, **Rule R2** already catches the majority of realistic N‑rooks deduction situations in normal puzzles. You can start with R2 only and extend later if needed.

---

## 6. Integrating with Your Hint System

Replace your old `findNRooksHint` with a block‑based version that:

1. Checks that the puzzle is a 10×10, 2★.
2. Builds `blocks`, `blockRows`, and `blockCols`.
3. Looks for a **single newly forced empty block** using R2 (and optionally R3).
4. Emits a `place-cross` (or equivalent) hint marking all four cells of that block as “no star”.

### 6.1 Signature

Keep the same public signature if you already use it:

```ts
export function findNRooksHint(state: PuzzleState): Hint | null {
  if (state.def.size !== 10 || state.def.starsPerUnit !== 2) return null;

  const blocks = analyseBlocks(state);
  const blockRows = buildBlockRowInfo(blocks);
  const blockCols = buildBlockColInfo(blocks);

  const forcedEmpty =
    findForcedEmptyByRow(blockRows) ??
    findForcedEmptyByCol(blockCols);

  if (!forcedEmpty) return null;

  return createEmptyBlockHint(forcedEmpty);
}
```

### 6.2 Finding a forced empty block

```ts
function findForcedEmptyByRow(rows: BlockRowInfo[]): BlockInfo | null {
  for (const row of rows) {
    if (row.empties.length === 0 &&
        row.nonEmpties.length === 4 &&
        row.unknowns.length === 1) {
      return row.unknowns[0];
    }
  }
  return null;
}

function findForcedEmptyByCol(cols: BlockColInfo[]): BlockInfo | null {
  for (const col of cols) {
    if (col.empties.length === 0 &&
        col.nonEmpties.length === 4 &&
        col.unknowns.length === 1) {
      return col.unknowns[0];
    }
  }
  return null;
}
```

You can later add a `findForcedEmptyByRooksPattern(...)` implementing more global N‑rooks logic if your puzzles need it.

### 6.3 Building the hint

Assume your `Hint` type supports a “place crosses” kind (or the equivalent of “these cells cannot be stars”). For example:

```ts
function createEmptyBlockHint(block: BlockInfo): Hint {
  const cells = block.cells; // the 4 cells of the block

  const description = `N‑Rooks (2×2 blocks): \
in block row ${block.coords.bRow + 1} and block column ${block.coords.bCol + 1}, \
the other four blocks in this block row already contain stars, \
so this 2×2 block must be empty. Therefore, none of its cells can contain a star.`;

  return {
    id: nextHintId(),
    kind: 'place-cross',
    technique: 'n-rooks',
    resultCells: cells,
    explanation: description,
    highlights: {
      cells,
      // optionally highlight the 2×2 strip of rows/cols containing the block
      rows: cells.map(c => c.row),
      cols: cells.map(c => c.col),
    },
  };
}
```

Adapt field names (`kind`, `highlights`, etc.) to match your existing hint system.

---

## 7. Removing the Old Cell‑Based N‑Rooks

Your current implementation finds **forced cells** per row/col/region and then looks for an N×N rook pattern among them. That is not the same technique. After introducing the block‑based implementation, you should:

1. **Delete or rename** the old cell‑based `findNRooksHint` so there is no ambiguity.
2. If you still like the behavior of “grouping several forced cells into one hint”, consider re‑implementing that as a **separate technique**, for example `forced-stars-multi`.

Make sure your **hint ordering** (priority) is adjusted so that:

- Simpler techniques (trivial adjacency, completion of rows/columns/regions, basic 2×2) run first.
- Block‑based N‑rooks comes only after block statuses can be reliably derived.

---

## 8. Testing Checklist

When you finish the changes, test at least the following:

1. **Block mapping sanity**  
   - For all cells (0..9, 0..9), `blockOfCell` followed by `cellsInBlock` should contain that cell.
   - No two distinct blocks share a cell.

2. **Block status**  
   - If you place a star in one cell of a 2×2, `analyseBlocks` must mark that block as `'has-star'`.
   - If you mark all four cells as impossible, it must be `'empty'`.

3. **N‑rooks rule R2**  
   - Create a synthetic state where, in some block row, 4 blocks each contain a fixed star and the 5th block is still `unknown`.  
   - Assert that `findNRooksHint` returns a hint for that 5th block.

4. **No false positives**  
   - Create a state with 3 non‑empty and 2 unknown blocks in a block row.  
   - `findNRooksHint` must return `null` (unless a column rule forces something).

5. **Integration with UI**  
   - Request a hint on a real puzzle state where you know an N‑rooks deduction applies; verify the solver suggests the correct 2×2 block and correctly marks all four cells as “no star”.

If all of these pass, your implementation will closely follow the 2×2 N‑rooks technique as used in Kris De Asis’ solver.

---

## 9. Summary of Required Steps

For convenience, here is the implementation checklist in one place:

1. **Gate the technique** to 10×10, 2★ puzzles.
2. **Add 2×2 block helpers**:
   - `BlockCoords`, `blockId`, `idToBlock`.
   - `cellsInBlock`, `blockOfCell`.
3. **Add `BlockInfo` / `BlockStatus`** and `analyseBlocks(state)` using:
   - classification of each cell as `fixed-star` / `impossible` / `candidate`.
   - rules B1–B3 to set `status`.
4. **Build block row/column views**:
   - `buildBlockRowInfo`, `buildBlockColInfo`.
5. **Implement N‑rooks deductions**:
   - Row rule R2 (`4 nonEmpties + 1 unknown → unknown is empty`).
   - Column rule R2 (same, by column).
6. **Implement `findNRooksHint`** that:
   - computes block info;
   - finds a forced empty block (by row or column);
   - returns a `place-cross` hint for that 2×2 block.
7. **Remove or rename** the old cell‑based N‑rooks logic.
8. **Write tests** for mapping, block status, and N‑rooks behavior.

Following these steps will give you a clean, block‑centric N‑rooks technique that matches the structure and intent of the implementation used in `star-battle-solver`.

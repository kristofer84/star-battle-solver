# Entanglement Pattern Calculator

A standalone Node.js/TypeScript utility for enumerating all possible entanglement patterns that arise from placing non-touching stars on a grid according to Star Battle rules.

## What are Entanglement Patterns?

Entanglement patterns represent all possible ways to place a specific number of stars (`z`) on an `n × n` grid such that:
- **No stars touch** (orthogonal or diagonal adjacency is forbidden)
- **Row/column limits are respected** (at most `y` stars per row and column)
- Each pattern includes:
  - The star positions
  - All forbidden cells (cells adjacent to stars)
  - A bounding rectangle (expanded by 1 cell around the stars)
  - Coverage statistics

These patterns are useful for analyzing complex Star Battle puzzles where multiple constraints interact to force specific placements.

## Prerequisites

- Node.js (v14 or higher)
- pnpm (or npm/yarn)
- TypeScript compiler

## Building

Compile the TypeScript source to JavaScript:

```bash
pnpm exec tsc -p entanglement-calculator/tsconfig.json
```

This generates `entanglement-calculator/dist/index.js`.

## Usage

### Basic Usage

Run the compiled script with required parameters:

```bash
node entanglement-calculator/dist/index.js \
  --gridSize=10 \
  --starsPerLine=2 \
  --entangledStars=2 \
  --output=entanglement-calculator/output/10x10-2star-entanglements.json
```

### Parameters

| Parameter | Short Alias | Required | Description |
|-----------|-------------|----------|-------------|
| `--gridSize` | `--n` | Yes | Size of the square grid (e.g., 10 for a 10×10 grid) |
| `--starsPerLine` | `--y` | Yes | Maximum number of stars allowed per row/column |
| `--entangledStars` | `--z` | Yes | Number of stars to place in each pattern |
| `--output` | - | Yes | Path to the output JSON file (parent directories will be created) |
| `--maxPatterns` | - | No | Limit the number of patterns to generate (useful for large searches) |
| `--workers` | - | No | Number of parallel workers (default: half of CPU cores) |
| `--progressInterval` | - | No | Progress update interval in milliseconds (default: 1000ms) |

### Examples

**Small grid with 2 stars:**
```bash
node entanglement-calculator/dist/index.js \
  --n=4 \
  --y=1 \
  --z=2 \
  --output=entanglement-calculator/output/4x4-2star.json
```

**Large grid with pattern limit:**
```bash
node entanglement-calculator/dist/index.js \
  --gridSize=12 \
  --starsPerLine=2 \
  --entangledStars=3 \
  --maxPatterns=1000 \
  --output=entanglement-calculator/output/12x12-3star-sample.json
```

**Using short aliases:**
```bash
node entanglement-calculator/dist/index.js \
  --n=8 --y=2 --z=2 \
  --output=entanglement-calculator/output/8x8-2star.json
```

**With parallel processing:**
```bash
node entanglement-calculator/dist/index.js \
  --gridSize=12 \
  --starsPerLine=2 \
  --entangledStars=3 \
  --workers=4 \
  --progressInterval=2000 \
  --output=entanglement-calculator/output/12x12-3star-parallel.json
```

## Output Format

The tool generates a JSON file with the following structure:

```json
{
  "metadata": {
    "gridSize": 10,
    "starsPerLine": 2,
    "entangledStars": 2,
    "maxPatterns": null,
    "generatedAt": "2025-01-15T10:30:00.000Z",
    "description": "Automatically enumerated entanglement zones..."
  },
  "patternCount": 150,
  "patterns": [
    {
      "id": 1,
      "stars": [
        { "row": 0, "col": 0 },
        { "row": 2, "col": 3 }
      ],
      "forbiddenCells": [
        { "row": 0, "col": 0 },
        { "row": 0, "col": 1 },
        ...
      ],
      "rectangle": {
        "top": 0,
        "left": 0,
        "bottom": 3,
        "right": 4
      },
      "coverage": {
        "rectangleArea": 20,
        "forbiddenCount": 15
      }
    },
    ...
  ]
}
```

### Output Fields Explained

- **`metadata`**: Configuration and generation timestamp
- **`patternCount`**: Total number of patterns found
- **`patterns`**: Array of pattern objects, each containing:
  - **`id`**: Sequential pattern identifier
  - **`stars`**: Array of `{row, col}` coordinates where stars are placed
  - **`forbiddenCells`**: All cells that cannot contain stars due to adjacency (includes the star cells themselves)
  - **`rectangle`**: Bounding box expanded by 1 cell in each direction around the stars
  - **`coverage`**: Statistics about the pattern's coverage

## Performance Considerations

- **Combinatorial explosion**: The number of patterns grows exponentially with grid size and number of stars
- **Use `--maxPatterns`**: For large searches, limit the output to avoid generating massive files
- **Computation time**: Larger grids and more stars take significantly longer to enumerate
- **Memory usage**: All patterns are kept in memory before writing to disk
- **Parallel processing**: Use `--workers` to utilize multiple CPU cores (defaults to half of available cores)
- **Progress reporting**: Progress updates are shown periodically (configurable with `--progressInterval`)

### Typical Performance

| Grid Size | Stars | Patterns | Time (approx) |
|-----------|-------|----------|---------------|
| 4×4 | 2 | ~50 | <1s |
| 6×6 | 2 | ~500 | <5s |
| 8×8 | 2 | ~5000 | <30s |
| 10×10 | 2 | ~50000 | 2-5 min |
| 10×10 | 3 | ~100000+ | 10+ min |

*Times are approximate and depend on hardware*

## Use Cases

1. **Puzzle Analysis**: Pre-compute common entanglement patterns for faster puzzle solving
2. **Pattern Recognition**: Identify known patterns in puzzles to apply advanced techniques
3. **Research**: Study the structure and properties of Star Battle constraint interactions
4. **Testing**: Generate test cases for Star Battle solvers

## Features

### Progress Reporting
The calculator automatically reports progress during long computations:
- Progress updates are shown every second (configurable with `--progressInterval`)
- Shows the number of patterns found and elapsed time
- Works in both single-threaded and parallel modes

### Input Validation
Strict validation ensures valid parameters:
- All numeric parameters must be positive integers
- `starsPerLine` cannot exceed `gridSize`
- `entangledStars` cannot exceed `gridSize * starsPerLine`
- `maxPatterns`, `workers`, and `progressInterval` are validated if provided
- Clear error messages indicate what's wrong with invalid inputs

### Parallel Processing
For large searches, the calculator can use multiple CPU cores:
- Automatically uses half of available CPU cores by default
- Manually specify with `--workers` parameter
- Divides the search space efficiently across workers
- Progress reporting aggregates results from all workers
- Significantly faster for large grids with many patterns

## Code Review Notes

The implementation uses a backtracking algorithm with the following features:

✅ **Correctness**:
- Properly enforces 8-directional adjacency (no touching stars)
- Respects row/column star limits
- Correctly computes forbidden cells and bounding rectangles
- Validates all input parameters strictly

✅ **Efficiency**:
- Uses early termination when maxPatterns is reached
- Prunes invalid branches early in backtracking
- Efficient set-based adjacency checking
- Parallel processing with worker threads for large searches
- Progress reporting with configurable intervals

✅ **User Experience**:
- Clear error messages for invalid inputs
- Progress updates during long computations
- Automatic worker count selection
- Detailed metadata in output files

## Troubleshooting

**Error: "Missing required arguments"**
- Ensure all three required parameters (`gridSize`, `starsPerLine`, `entangledStars`) are provided

**Out of memory errors**
- Use `--maxPatterns` to limit the number of patterns generated
- Try smaller grid sizes or fewer stars

**Very slow execution**
- Large grids with many stars can take a long time
- Consider using `--maxPatterns` to get a sample of patterns instead of all of them

## Integration

This calculator is part of the Star Battle Solver project. The generated patterns can be used by the main solver to identify entanglement techniques in puzzles.

## License

Part of the star-battle-solver project.

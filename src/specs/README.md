# Entanglement Pattern Files

This folder contains JSON files describing entanglement patterns discovered through analysis of Star Battle puzzle solutions.

## File Types

### Type A: Pair-based Entanglement Patterns

Files named like `10x10-2star-entanglements.json` contain pair-based patterns.

**Structure:**
```json
{
  "board_size": 10,
  "stars_per_row": 2,
  "stars_per_column": 2,
  "initial_star_count": 2,
  "total_solutions": 146510,
  "patterns": [
    {
      "initial_stars": [[0, 0], [0, 3]],
      "compatible_solutions": 2143,
      "forced_empty": [[2, 6], [2, 8]],
      "forced_star": []
    }
  ]
}
```

### Type B: Triple Entanglement Patterns (Canonical)

Files named like `10x10-2star-entanglements-triple-entanglements.json` contain canonical triple patterns.

**Structure:**
```json
{
  "board_size": 10,
  "initial_stars": 2,
  "unconstrained_rules": [
    {
      "canonical_stars": [[0, 0], [2, 3]],
      "canonical_candidate": [0, -3],
      "constraint_features": [],
      "forced": true,
      "occurrences": 128
    }
  ],
  "constrained_rules": []
}
```

## Coordinate System

- Coordinates are **0-based**: `[row, col]`
- `row = 0` is the top row; `col = 0` is the leftmost column
- For canonical patterns, coordinates may be outside `[0, board_size-1]` as they represent relative shapes

## Discovery

The solver automatically discovers all `*.json` files in this folder at runtime and loads them based on their structure (presence of `patterns` array vs `unconstrained_rules`/`constrained_rules`).

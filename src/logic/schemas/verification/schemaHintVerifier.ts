import type { PuzzleState } from '../../../types/puzzle';
import type { Hint, HintHighlight } from '../../../types/hints';
import type { SchemaApplication } from '../types';
import { countSolutions } from '../../search';
import { getCached, makeVerificationKey, setCached } from './verificationCache';

export type VerifiedCellAssignment = {
  row: number;
  col: number;
  value: 'star' | 'cross';
};

export type VerificationStatus =
  | 'proved' // contradiction proven, exhaustive in the configured bounds
  | 'disproved' // opposite assumption still allows at least one completion
  | 'inconclusive'; // timeout/cap reached, cannot conclude

export type ProofStep =
  | {
      kind: 'assumption';
      cell: { row: number; col: number };
      assumed: 'star' | 'cross';
    }
  | {
      kind: 'search-result';
      solutionsFound: number;
      timedOut: boolean;
      cappedAtMax: boolean;
      timeoutMs: number;
      maxCount: number;
    }
  | {
      kind: 'conclusion';
      conclusion: 'forced-star' | 'forced-cross' | 'not-forced';
      cell: { row: number; col: number };
    };

export type VerifiedCandidate = {
  status: VerificationStatus;
  assignment: VerifiedCellAssignment;
  proof: ProofStep[];
};

export type VerifySchemaHintOptions = {
  /** Timeout per opposite-assumption check. Keep small, e.g. 150–400ms. */
  perCheckTimeoutMs: number;
  /** Count at most this many solutions. For forcedness you only need 1. */
  maxSolutionsToFind: number; // should be 1
};

function cloneCells(cells: PuzzleState['cells']): PuzzleState['cells'] {
  return cells.map(row => [...row]);
}

function applyAssumption(
  state: PuzzleState,
  cell: { row: number; col: number },
  assumed: 'star' | 'cross'
): PuzzleState | null {
  const next = cloneCells(state.cells);
  const cur = next[cell.row][cell.col];
  if (cur === assumed) return { ...state, cells: next };
  if (cur !== 'empty') return null; // conflict: already opposite mark
  next[cell.row][cell.col] = assumed;
  return { ...state, cells: next };
}

export function verifyForcedCell(
  state: PuzzleState,
  assignment: VerifiedCellAssignment,
  options: VerifySchemaHintOptions
): VerifiedCandidate {
  const cacheKey = makeVerificationKey(state, assignment);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const oppositeAssumed: 'star' | 'cross' =
    assignment.value === 'star' ? 'cross' : 'star';

  const proof: ProofStep[] = [
    { kind: 'assumption', cell: { row: assignment.row, col: assignment.col }, assumed: oppositeAssumed },
  ];

  const assumedState = applyAssumption(
    state,
    { row: assignment.row, col: assignment.col },
    oppositeAssumed
  );

  if (!assumedState) {
    // Opposite assumption immediately conflicts with current marks => forced.
    proof.push({
      kind: 'search-result',
      solutionsFound: 0,
      timedOut: false,
      cappedAtMax: false,
      timeoutMs: options.perCheckTimeoutMs,
      maxCount: options.maxSolutionsToFind,
    });
    proof.push({
      kind: 'conclusion',
      conclusion: assignment.value === 'star' ? 'forced-star' : 'forced-cross',
      cell: { row: assignment.row, col: assignment.col },
    });
    const out: VerifiedCandidate = { status: 'proved', assignment, proof };
    setCached(cacheKey, out);
    return out;
  }

  const res = countSolutions(assumedState, {
    timeoutMs: options.perCheckTimeoutMs,
    maxCount: options.maxSolutionsToFind,
  });

  proof.push({
    kind: 'search-result',
    solutionsFound: res.count,
    timedOut: res.timedOut,
    cappedAtMax: res.cappedAtMax,
    timeoutMs: options.perCheckTimeoutMs,
    maxCount: options.maxSolutionsToFind,
  });

  // Soundness rules:
  // - Only conclude forced if we found 0 solutions AND we did NOT time out AND did NOT cap.
  if (res.count === 0 && !res.timedOut && !res.cappedAtMax) {
    proof.push({
      kind: 'conclusion',
      conclusion: assignment.value === 'star' ? 'forced-star' : 'forced-cross',
      cell: { row: assignment.row, col: assignment.col },
    });
    const out: VerifiedCandidate = { status: 'proved', assignment, proof };
    setCached(cacheKey, out);
    return out;
  }

  // If we found at least one solution under the opposite assumption, it is not forced.
  if (res.count > 0) {
    proof.push({
      kind: 'conclusion',
      conclusion: 'not-forced',
      cell: { row: assignment.row, col: assignment.col },
    });
    const out: VerifiedCandidate = { status: 'disproved', assignment, proof };
    setCached(cacheKey, out);
    return out;
  }

  // Otherwise it was inconclusive (timeout/cap with count==0)
  proof.push({
    kind: 'conclusion',
    conclusion: 'not-forced',
    cell: { row: assignment.row, col: assignment.col },
  });
  const out: VerifiedCandidate = { status: 'inconclusive', assignment, proof };
  setCached(cacheKey, out);
  return out;
}

export type VerifySchemaApplicationResult =
  | { kind: 'no-verified-deductions' }
  | { kind: 'verified-hint'; hint: Hint };

export function verifyAndBuildSchemaHint(
  state: PuzzleState,
  app: SchemaApplication,
  baseExplanation: string,
  baseHighlights: HintHighlight | undefined,
  options: VerifySchemaHintOptions
): VerifySchemaApplicationResult {
  const size = state.def.size;

  // Convert schema deductions to row/col + proposed value
  const proposed: VerifiedCellAssignment[] = app.deductions.map(d => {
    const row = Math.floor(d.cell / size);
    const col = d.cell % size;
    return { row, col, value: d.type === 'forceStar' ? 'star' : 'cross' };
  });

  // Deduplicate identical assignments and drop anything that conflicts with current state.
  const key = (a: VerifiedCellAssignment) => `${a.row},${a.col}:${a.value}`;
  const seen = new Set<string>();
  const filtered: VerifiedCellAssignment[] = [];
  for (const a of proposed) {
    const cur = state.cells[a.row][a.col];
    if (cur === a.value) continue; // already satisfied
    if (cur !== 'empty') continue; // conflicts with current marks, drop
    const k = key(a);
    if (seen.has(k)) continue;
    seen.add(k);
    filtered.push(a);
  }

  if (filtered.length === 0) return { kind: 'no-verified-deductions' };

  // IMPORTANT: verifying every deduction can be expensive if a schema yields many.
  // Strategy: verify in order and stop after the first proved deduction.
  // (You can extend to verify more later.)
  for (const a of filtered) {
    const verified = verifyForcedCell(state, a, options);
    if (verified.status !== 'proved') {
      continue;
    }

    // Build user-facing explanation:
    // - schema narrative (already exists)
    // - appended proof summary (always present)
    const proofLine = buildProofSummaryLine(verified.proof, a);

    const hint: Hint = {
      id: `schema-verified-${app.schemaId}-${Date.now()}`,
      kind: a.value === 'star' ? 'place-star' : 'place-cross',
      technique: 'schema-based',
      resultCells: [{ row: a.row, col: a.col }],
      explanation: `${baseExplanation}\n\nProof:\n${proofLine}`,
      highlights: mergeHighlights(baseHighlights, { cells: [{ row: a.row, col: a.col }] }),
    };

    return { kind: 'verified-hint', hint };
  }

  return { kind: 'no-verified-deductions' };
}

function mergeHighlights(
  a: HintHighlight | undefined,
  b: HintHighlight | undefined
): HintHighlight | undefined {
  if (!a && !b) return undefined;
  const out: HintHighlight = {
    cells: [],
    rows: [],
    cols: [],
    regions: [],
  };
  for (const src of [a, b]) {
    if (!src) continue;
    if (src.cells) out.cells!.push(...src.cells);
    if (src.rows) out.rows!.push(...src.rows);
    if (src.cols) out.cols!.push(...src.cols);
    if (src.regions) out.regions!.push(...src.regions);
  }
  // drop empties
  if (!out.cells!.length) delete out.cells;
  if (!out.rows!.length) delete out.rows;
  if (!out.cols!.length) delete out.cols;
  if (!out.regions!.length) delete out.regions;
  return out.cells || out.rows || out.cols || out.regions ? out : undefined;
}

function buildProofSummaryLine(proof: ProofStep[], a: VerifiedCellAssignment): string {
  const sr = proof.find(p => p.kind === 'search-result') as
    | Extract<ProofStep, { kind: 'search-result' }>
    | undefined;
  const assumed = proof.find(p => p.kind === 'assumption') as
    | Extract<ProofStep, { kind: 'assumption' }>
    | undefined;

  const assumedText = assumed
    ? `Assume (${assumed.cell.row},${assumed.cell.col}) is ${assumed.assumed}.`
    : 'Assume the opposite.';

  if (!sr) return `${assumedText} No valid completion exists, so it is forced.`;

  // Always explain timeouts explicitly.
  if (sr.timedOut || sr.cappedAtMax) {
    // This should not happen for proved hints (we guard against it), but keep the text correct.
    return `${assumedText} Search was inconclusive (timeout/cap).`;
  }

  if (sr.solutionsFound === 0) {
    const forcedText = a.value === 'star' ? 'a star' : 'a cross';
    return `${assumedText} The solver found 0 valid completions, therefore (${a.row},${a.col}) must be ${forcedText}.`;
  }

  return `${assumedText} At least one completion exists, so it is not forced.`;
}

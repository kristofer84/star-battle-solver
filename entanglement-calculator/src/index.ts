import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve, join } from "path";
import { Worker } from "worker_threads";
import { cpus } from "os";

// Type declarations for Node.js globals (available at runtime in CommonJS)
declare const __dirname: string;
declare const process: NodeJS.Process;
declare const require: NodeJS.Require;
declare const module: NodeJS.Module;

interface Coordinate {
  row: number;
  col: number;
}

interface Rectangle {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

interface EntanglementPattern {
  id: number;
  stars: Coordinate[];
  forbiddenCells: Coordinate[];
  rectangle: Rectangle;
  coverage: {
    rectangleArea: number;
    forbiddenCount: number;
  };
}

interface CalculatorArgs {
  gridSize: number;
  starsPerLine: number;
  entangledStars: number;
  outputPath: string;
  maxPatterns?: number;
  workers?: number;
  progressInterval?: number;
}

function parseArgs(argv: string[]): CalculatorArgs {
  const args: Partial<CalculatorArgs> = {};

  for (const raw of argv.slice(2)) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    if (!value) continue;
    const numeric = Number(value);
    switch (key) {
      case "gridSize":
      case "n":
        args.gridSize = numeric;
        break;
      case "starsPerLine":
      case "y":
        args.starsPerLine = numeric;
        break;
      case "entangledStars":
      case "z":
        args.entangledStars = numeric;
        break;
      case "output":
        args.outputPath = value;
        break;
      case "maxPatterns":
        args.maxPatterns = numeric;
        break;
      case "workers":
        args.workers = numeric;
        break;
      case "progressInterval":
        args.progressInterval = numeric;
        break;
      default:
        console.warn(`Unknown argument ignored: ${raw}`);
    }
  }

  if (!args.gridSize || !args.starsPerLine || !args.entangledStars) {
    throw new Error(
      "Missing required arguments. Usage: node dist/index.js --gridSize=10 --starsPerLine=2 --entangledStars=2 --output=path/to/file.json [--maxPatterns=500] [--workers=4] [--progressInterval=1000]",
    );
  }

  args.outputPath = resolve(args.outputPath || "entanglement-calculator/output/entanglement-patterns.json");
  args.workers = args.workers ?? Math.max(1, Math.floor(cpus().length / 2));
  args.progressInterval = args.progressInterval ?? 1000;

  return args as CalculatorArgs;
}

function validateArgs(args: CalculatorArgs): void {
  const errors: string[] = [];

  if (!Number.isInteger(args.gridSize) || args.gridSize < 1) {
    errors.push(`gridSize must be a positive integer, got: ${args.gridSize}`);
  }

  if (!Number.isInteger(args.starsPerLine) || args.starsPerLine < 1) {
    errors.push(`starsPerLine must be a positive integer, got: ${args.starsPerLine}`);
  }

  if (!Number.isInteger(args.entangledStars) || args.entangledStars < 1) {
    errors.push(`entangledStars must be a positive integer, got: ${args.entangledStars}`);
  }

  if (args.starsPerLine > args.gridSize) {
    errors.push(`starsPerLine (${args.starsPerLine}) cannot exceed gridSize (${args.gridSize})`);
  }

  const maxPossibleStars = args.gridSize * args.starsPerLine;
  if (args.entangledStars > maxPossibleStars) {
    errors.push(
      `entangledStars (${args.entangledStars}) cannot exceed gridSize * starsPerLine (${maxPossibleStars})`,
    );
  }

  if (args.maxPatterns !== undefined) {
    if (!Number.isInteger(args.maxPatterns) || args.maxPatterns < 1) {
      errors.push(`maxPatterns must be a positive integer, got: ${args.maxPatterns}`);
    }
  }

  if (args.workers !== undefined) {
    if (!Number.isInteger(args.workers) || args.workers < 1) {
      errors.push(`workers must be a positive integer, got: ${args.workers}`);
    }
  }

  if (args.progressInterval !== undefined) {
    if (!Number.isInteger(args.progressInterval) || args.progressInterval < 100) {
      errors.push(`progressInterval must be an integer >= 100ms, got: ${args.progressInterval}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid arguments:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }
}

function toKey({ row, col }: Coordinate): string {
  return `${row},${col}`;
}

function canPlace(star: Coordinate, starSet: Set<string>, n: number, rowCounts: number[], colCounts: number[], maxPerLine: number): boolean {
  if (rowCounts[star.row] >= maxPerLine || colCounts[star.col] >= maxPerLine) {
    return false;
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const key = toKey({ row: star.row + dr, col: star.col + dc });
      if (starSet.has(key)) return false;
    }
  }
  return star.row >= 0 && star.row < n && star.col >= 0 && star.col < n;
}

function computeForbiddenCells(n: number, stars: Coordinate[]): Set<string> {
  const forbidden = new Set<string>();
  for (const { row, col } of stars) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        const key = toKey({ row: nr, col: nc });
        forbidden.add(key);
      }
    }
  }
  return forbidden;
}

function computeRectangle(n: number, stars: Coordinate[]): Rectangle {
  const rows = stars.map((s) => s.row);
  const cols = stars.map((s) => s.col);
  const top = Math.max(Math.min(...rows) - 1, 0);
  const left = Math.max(Math.min(...cols) - 1, 0);
  const bottom = Math.min(Math.max(...rows) + 1, n - 1);
  const right = Math.min(Math.max(...cols) + 1, n - 1);
  return { top, left, bottom, right };
}

function enumeratePatterns(
  args: CalculatorArgs,
  onProgress?: (count: number) => void,
): EntanglementPattern[] {
  const { gridSize: n, entangledStars: z, starsPerLine: maxPerLine, maxPatterns } = args;
  const patterns: EntanglementPattern[] = [];
  const starSet = new Set<string>();
  const stars: Coordinate[] = [];
  const rowCounts = Array(n).fill(0);
  const colCounts = Array(n).fill(0);
  const totalCells = n * n;
  let lastProgressTime = Date.now();
  const progressInterval = args.progressInterval ?? 1000;

  const remainingCells = (index: number) => totalCells - index;

  function backtrack(startIndex: number) {
    if (stars.length === z) {
      const forbidden = computeForbiddenCells(n, stars);
      const rectangle = computeRectangle(n, stars);
      patterns.push({
        id: patterns.length + 1,
        stars: [...stars],
        forbiddenCells: [...forbidden].map((key) => {
          const [row, col] = key.split(",").map(Number);
          return { row, col };
        }).sort((a, b) => (a.row - b.row) || (a.col - b.col)),
        rectangle,
        coverage: {
          rectangleArea: (rectangle.bottom - rectangle.top + 1) * (rectangle.right - rectangle.left + 1),
          forbiddenCount: forbidden.size,
        },
      });

      // Progress reporting
      if (onProgress) {
        const now = Date.now();
        if (now - lastProgressTime >= progressInterval) {
          onProgress(patterns.length);
          lastProgressTime = now;
        }
      }

      return;
    }

    if (maxPatterns !== undefined && patterns.length >= maxPatterns) {
      return;
    }

    const slotsRemaining = z - stars.length;
    for (let idx = startIndex; idx < totalCells; idx++) {
      if (remainingCells(idx) < slotsRemaining) break;
      const row = Math.floor(idx / n);
      const col = idx % n;
      const candidate: Coordinate = { row, col };
      if (!canPlace(candidate, starSet, n, rowCounts, colCounts, maxPerLine)) continue;

      starSet.add(toKey(candidate));
      stars.push(candidate);
      rowCounts[row] += 1;
      colCounts[col] += 1;

      backtrack(idx + 1);

      starSet.delete(toKey(candidate));
      stars.pop();
      rowCounts[row] -= 1;
      colCounts[col] -= 1;

      if (maxPatterns !== undefined && patterns.length >= maxPatterns) {
        break;
      }
    }
  }

  backtrack(0);
  return patterns;
}

interface WorkerMessage {
  type: "progress" | "done" | "error";
  patterns?: EntanglementPattern[];
  count?: number;
  error?: string;
}

function enumeratePatternsParallel(args: CalculatorArgs): Promise<EntanglementPattern[]> {
  return new Promise((resolve, reject) => {
    const { gridSize: n, entangledStars: z, starsPerLine: maxPerLine, workers = 1 } = args;
    const totalCells = n * n;
    const cellsPerWorker = Math.ceil(totalCells / workers);

    const allPatterns: EntanglementPattern[] = [];
    let completedWorkers = 0;
    const workerPatternCounts: number[] = Array(workers).fill(0);
    const startTime = Date.now();
    const progressInterval = args.progressInterval ?? 1000;
    let lastProgressTime = Date.now();

    // Resolve worker file path (CommonJS - __dirname is available)
    const workerPath = join(__dirname, "index-worker.js");

    const workerPromises: Promise<void>[] = [];

    for (let w = 0; w < workers; w++) {
      const startCell = w * cellsPerWorker;
      const endCell = Math.min(startCell + cellsPerWorker, totalCells);

      const worker = new Worker(workerPath, {
        workerData: {
          gridSize: n,
          starsPerLine: maxPerLine,
          entangledStars: z,
          startCell,
          endCell,
          maxPatterns: args.maxPatterns,
        },
      });

      const workerPromise = new Promise<void>((workerResolve, workerReject) => {
        worker.on("message", (msg: WorkerMessage) => {
          if (msg.type === "progress" && msg.count !== undefined) {
            workerPatternCounts[w] = msg.count;
            const totalFound = workerPatternCounts.reduce((sum, count) => sum + count, 0);
            const now = Date.now();
            if (now - lastProgressTime >= progressInterval) {
              const elapsed = ((now - startTime) / 1000).toFixed(1);
              console.log(`[Progress] Found ${totalFound} patterns (${elapsed}s elapsed)`);
              lastProgressTime = now;
            }
          } else if (msg.type === "done" && msg.patterns) {
            allPatterns.push(...msg.patterns);
            completedWorkers++;
            if (completedWorkers === workers) {
              workerResolve();
            }
          } else if (msg.type === "error") {
            workerReject(new Error(msg.error || "Worker error"));
          }
        });

        worker.on("error", (err) => {
          workerReject(err);
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            workerReject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      workerPromises.push(workerPromise);
    }

    Promise.all(workerPromises)
      .then(() => {
        // Assign sequential IDs to all patterns
        allPatterns.forEach((pattern, idx) => {
          pattern.id = idx + 1;
        });
        resolve(allPatterns);
      })
      .catch(reject);
  });
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv);
  validateArgs(args);

  console.log(`Starting enumeration:`);
  console.log(`  Grid size: ${args.gridSize}×${args.gridSize}`);
  console.log(`  Stars per line: ${args.starsPerLine}`);
  console.log(`  Entangled stars: ${args.entangledStars}`);
  console.log(`  Workers: ${args.workers}`);
  if (args.maxPatterns) {
    console.log(`  Max patterns: ${args.maxPatterns}`);
  }
  console.log("");

  const startTime = Date.now();
  let patterns: EntanglementPattern[];

  if (args.workers && args.workers > 1) {
    console.log(`Using ${args.workers} parallel workers...`);
    patterns = await enumeratePatternsParallel(args);
  } else {
    patterns = enumeratePatterns(args, (count) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Progress] Found ${count} patterns (${elapsed}s elapsed)`);
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nCompleted: Found ${patterns.length} pattern(s) in ${elapsed}s`);

  const payload = {
    metadata: {
      gridSize: args.gridSize,
      starsPerLine: args.starsPerLine,
      entangledStars: args.entangledStars,
      maxPatterns: args.maxPatterns ?? null,
      workers: args.workers ?? 1,
      generatedAt: new Date().toISOString(),
      computationTimeSeconds: parseFloat(elapsed),
      description:
        "Automatically enumerated entanglement zones for non-touching star placements. Each pattern marks forbidden cells resulting from the adjacency rule and a bounding rectangle expanded by one cell around the stars.",
    },
    patternCount: patterns.length,
    patterns,
  };

  const outputPath = args.outputPath;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${patterns.length} entanglement pattern(s) to ${outputPath}`);
}

if (require.main === module) {
  run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    });
}


import { parentPort, workerData } from "worker_threads";

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

interface WorkerData {
  gridSize: number;
  starsPerLine: number;
  entangledStars: number;
  startCell: number;
  endCell: number;
  maxPatterns?: number;
}

function toKey({ row, col }: Coordinate): string {
  return `${row},${col}`;
}

function canPlace(
  star: Coordinate,
  starSet: Set<string>,
  n: number,
  rowCounts: number[],
  colCounts: number[],
  maxPerLine: number,
): boolean {
  if (star.row < 0 || star.row >= n || star.col < 0 || star.col >= n) {
    return false;
  }
  if (rowCounts[star.row] >= maxPerLine || colCounts[star.col] >= maxPerLine) {
    return false;
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const key = toKey({ row: star.row + dr, col: star.col + dc });
      if (starSet.has(key)) return false;
    }
  }
  return true;
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

function enumeratePatternsWorker(data: WorkerData): EntanglementPattern[] {
  const { gridSize: n, entangledStars: z, starsPerLine: maxPerLine, startCell, endCell, maxPatterns } = data;
  const patterns: EntanglementPattern[] = [];
  const starSet = new Set<string>();
  const stars: Coordinate[] = [];
  const rowCounts = Array(n).fill(0);
  const colCounts = Array(n).fill(0);
  const totalCells = n * n;
  let lastProgressTime = Date.now();
  const progressInterval = 1000;

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
      const now = Date.now();
      if (now - lastProgressTime >= progressInterval) {
        if (parentPort) {
          parentPort.postMessage({ type: "progress", count: patterns.length });
        }
        lastProgressTime = now;
      }

      return;
    }

    if (maxPatterns !== undefined && patterns.length >= maxPatterns) {
      return;
    }

    const slotsRemaining = z - stars.length;
    const searchStart = stars.length === 0 ? startCell : startIndex;
    const searchEnd = stars.length === 0 ? endCell : totalCells;

    for (let idx = searchStart; idx < searchEnd; idx++) {
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

  backtrack(startCell);
  return patterns;
}

if (parentPort) {
  try {
    const patterns = enumeratePatternsWorker(workerData as WorkerData);
    parentPort.postMessage({ type: "done", patterns });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      error: (error as Error).message,
    });
  }
}


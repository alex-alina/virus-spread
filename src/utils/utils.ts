export const SOLVER_CHUNK_SIZE = 2000;
export const GRID_SIZE = 20;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const colors = ['bg-blue-400', 'bg-green-400', 'bg-yellow-400', 'bg-violet-400'];

type GameSetup = {
  board: string[];
  startingPoint: number;
};

type ComponentGraph = {
  allMask: bigint;
  componentBits: bigint[];
  componentCount: number;
  adjacencyMasks: bigint[];
  colorMasks: bigint[];
  startComponent: number;
  startColor: number;
};

export const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
export const getRandomCellIndex = (cellCount: number) => Math.floor(Math.random() * cellCount);
export const extractColorName = (colorClass: string) =>
  colorClass.match(/-([^-]+)-/)?.[1] ?? 'Select colour';

export const formatElapsedTime = (seconds: number) => {
  const minutesPart = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secondsPart = (seconds % 60).toString().padStart(2, '0');

  return `${minutesPart}:${secondsPart}`;
};

export const getNeighborIndices = (index: number) => {
  const row = Math.floor(index / GRID_SIZE);
  const col = index % GRID_SIZE;
  const neighbors: number[] = [];

  const evenRow = row % 2 === 0;
  const deltas = evenRow
    ? [
        [-1, -1],
        [-1, 0],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0]
      ]
    : [
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, 0],
        [1, 1]
      ];

  deltas.forEach(([dr, dc]) => {
    const nextRow = row + dr;
    const nextCol = col + dc;

    if (nextRow < 0 || nextRow >= GRID_SIZE || nextCol < 0 || nextCol >= GRID_SIZE) {
      return;
    }

    neighbors.push(nextRow * GRID_SIZE + nextCol);
  });

  return neighbors;
};

export const getConnectedCells = (
  board: string[],
  startIndex: number,
  color = board[startIndex]
) => {
  const connected = new Set<number>();
  const stack = [startIndex];

  while (stack.length > 0) {
    const current = stack.pop();

    if (current === undefined || connected.has(current) || board[current] !== color) {
      continue;
    }

    connected.add(current);

    getNeighborIndices(current).forEach((neighbor) => {
      if (!connected.has(neighbor)) {
        stack.push(neighbor);
      }
    });
  }

  return connected;
};

export const buildComponentGraph = (board: string[], startIndex: number): ComponentGraph | null => {
  const colorIndexByClass = new Map(colors.map((colorClass, index) => [colorClass, index]));
  const componentIds = new Array<number>(CELL_COUNT).fill(-1);
  const componentColor: number[] = [];
  let componentCount = 0;

  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (componentIds[cell] !== -1) {
      continue;
    }

    const baseColor = board[cell];
    const baseColorIndex = colorIndexByClass.get(baseColor);

    if (baseColorIndex === undefined) {
      return null;
    }

    const stack = [cell];
    componentIds[cell] = componentCount;

    while (stack.length > 0) {
      const current = stack.pop();

      if (current === undefined) {
        continue;
      }

      getNeighborIndices(current).forEach((neighbor) => {
        if (componentIds[neighbor] !== -1 || board[neighbor] !== baseColor) {
          return;
        }

        componentIds[neighbor] = componentCount;
        stack.push(neighbor);
      });
    }

    componentColor.push(baseColorIndex);
    componentCount += 1;
  }

  const componentBits = Array.from({ length: componentCount }, (_, index) => 1n << BigInt(index));
  const adjacencyMasks = Array.from({ length: componentCount }, () => 0n);

  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const component = componentIds[cell];

    getNeighborIndices(cell).forEach((neighbor) => {
      const neighborComponent = componentIds[neighbor];

      if (neighborComponent === component) {
        return;
      }

      adjacencyMasks[component] |= componentBits[neighborComponent];
    });
  }

  const colorMasks = Array.from({ length: colors.length }, () => 0n);

  for (let component = 0; component < componentCount; component += 1) {
    colorMasks[componentColor[component]] |= componentBits[component];
  }

  const startComponent = componentIds[startIndex];

  return {
    allMask: (1n << BigInt(componentCount)) - 1n,
    componentBits,
    componentCount,
    adjacencyMasks,
    colorMasks,
    startComponent,
    startColor: componentColor[startComponent]
  };
};

export const getNeighborsOfMask = (mask: bigint, graph: ComponentGraph) => {
  let neighbors = 0n;

  for (let component = 0; component < graph.componentCount; component += 1) {
    if ((mask & graph.componentBits[component]) === 0n) {
      continue;
    }

    neighbors |= graph.adjacencyMasks[component];
  }

  return neighbors;
};

export const absorbColor = (mask: bigint, colorIndex: number, graph: ComponentGraph) => {
  let conquered = mask;
  let frontier = getNeighborsOfMask(conquered, graph) & graph.colorMasks[colorIndex] & ~conquered;

  while (frontier !== 0n) {
    conquered |= frontier;
    frontier = getNeighborsOfMask(frontier, graph) & graph.colorMasks[colorIndex] & ~conquered;
  }

  return conquered;
};

export const solveExactlyAsync = (
  graph: ComponentGraph,
  onComplete: (steps: number | null) => void
): (() => void) => {
  let cancelled = false;

  const startMask = graph.componentBits[graph.startComponent];
  if (startMask === graph.allMask) {
    onComplete(0);
    return () => {
      cancelled = true;
    };
  }

  const visited = new Set<string>();
  const queueMasks: bigint[] = [startMask];
  const queueColors: number[] = [graph.startColor];
  const queueDepths: number[] = [0];
  let head = 0;

  visited.add(`${startMask.toString(16)}:${graph.startColor}`);

  const processChunk = () => {
    if (cancelled) {
      return;
    }

    let processed = 0;

    while (head < queueMasks.length && processed < SOLVER_CHUNK_SIZE) {
      const currentMask = queueMasks[head];
      const currentColor = queueColors[head];
      const currentDepth = queueDepths[head];
      head += 1;
      processed += 1;

      for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
        if (colorIndex === currentColor) {
          continue;
        }

        const nextMask = absorbColor(currentMask, colorIndex, graph);

        if (nextMask === currentMask) {
          continue;
        }

        if (nextMask === graph.allMask) {
          onComplete(currentDepth + 1);
          return;
        }

        const key = `${nextMask.toString(16)}:${colorIndex}`;
        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        queueMasks.push(nextMask);
        queueColors.push(colorIndex);
        queueDepths.push(currentDepth + 1);
      }
    }

    if (head < queueMasks.length) {
      setTimeout(processChunk, 0);
      return;
    }

    onComplete(null);
  };

  setTimeout(processChunk, 0);

  return () => {
    cancelled = true;
  };
};

export const buildNewGame = (): GameSetup => {
  return {
    board: Array.from({ length: CELL_COUNT }, getRandomColor),
    startingPoint: getRandomCellIndex(CELL_COUNT)
  };
};

export const TEST_STARTING_POINT = 0;

export const buildTestGame = (): GameSetup => {
  const board = Array.from({ length: CELL_COUNT }, (_, index) => {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;

    if (row < GRID_SIZE / 2 && col < GRID_SIZE / 2) {
      return colors[0];
    }
    if (row < GRID_SIZE / 2 && col >= GRID_SIZE / 2) {
      return colors[1];
    }
    if (row >= GRID_SIZE / 2 && col < GRID_SIZE / 2) {
      return colors[2];
    }
    return colors[3];
  });

  return {
    board,
    startingPoint: TEST_STARTING_POINT
  };
};

import {
  CELL_COUNT,
  GRID_SIZE,
  SOLVER_CHUNK_SIZE,
  absorbColor,
  buildComponentGraph,
  buildNewGame,
  colors,
  extractColorName,
  formatElapsedTime,
  getConnectedCells,
  getNeighborIndices,
  getNeighborsOfMask,
  getRandomCellIndex,
  getRandomColor,
  solveExactlyAsync,
  solveExactlyPathAsync,
} from "./utils";

const sortIndices = (values: number[]) => [...values].sort((a, b) => a - b);

const makeBoard = (
  fillColor = colors[0],
  overrides: Record<number, string> = {},
) => {
  const board = Array.from({ length: CELL_COUNT }, () => fillColor);

  Object.entries(overrides).forEach(([index, value]) => {
    board[Number(index)] = value;
  });

  return board;
};

describe("virus-spread utils", () => {
  it("exports expected constants", () => {
    expect(GRID_SIZE).toBe(20);
    expect(CELL_COUNT).toBe(GRID_SIZE * GRID_SIZE);
    expect(SOLVER_CHUNK_SIZE).toBe(2000);
    expect(colors.length).toBe(4);
  });

  it("picks random values within bounds", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);

    expect(getRandomColor()).toBe(colors[2]);
    expect(getRandomCellIndex(10)).toBe(5);

    randomSpy.mockRestore();
  });

  it("extracts color names safely", () => {
    expect(extractColorName("bg-blue-400")).toBe("blue");
    expect(extractColorName("no-match")).toBe("Select colour");
  });

  it("formats elapsed time as mm:ss", () => {
    expect(formatElapsedTime(0)).toBe("00:00");
    expect(formatElapsedTime(61)).toBe("01:01");
  });

  it("returns neighbor indices for hex corners and centers", () => {
    expect(sortIndices(getNeighborIndices(0))).toEqual([1, 20]);
    expect(sortIndices(getNeighborIndices(11))).toEqual([10, 12, 30, 31]);
    expect(sortIndices(getNeighborIndices(55))).toEqual([
      34, 35, 54, 56, 74, 75,
    ]);
  });

  it("finds connected cells of the same color", () => {
    const board = makeBoard(colors[1], {
      0: colors[0],
      1: colors[0],
    });

    const connected = getConnectedCells(board, 0);

    expect(Array.from(connected).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("builds a component graph for a valid board", () => {
    const board = makeBoard(colors[0], { 1: colors[1] });
    const graph = buildComponentGraph(board, 0);

    expect(graph).not.toBeNull();
    if (!graph) {
      throw new Error("Graph should be defined");
    }

    expect(graph.componentCount).toBe(2);
    expect(graph.allMask).toBe(3n);
    expect(graph.startComponent).toBe(0);
    expect(graph.startColor).toBe(0);
    expect(graph.colorMasks[0]).toBe(graph.componentBits[0]);
    expect(graph.colorMasks[1]).toBe(graph.componentBits[1]);
  });

  it("returns null for boards with invalid colors", () => {
    const board = makeBoard("invalid-color");
    const graph = buildComponentGraph(board, 0);

    expect(graph).toBeNull();
  });

  it("derives neighbors and absorbs colors in the graph", () => {
    const board = makeBoard(colors[0], { 1: colors[1] });
    const graph = buildComponentGraph(board, 0);

    if (!graph) {
      throw new Error("Graph should be defined");
    }

    const startMask = graph.componentBits[graph.startComponent];
    const neighborMask = getNeighborsOfMask(startMask, graph);

    expect(neighborMask).toBe(graph.componentBits[1]);

    const absorbed = absorbColor(startMask, 1, graph);
    expect(absorbed).toBe(graph.allMask);
  });

  it("solves trivially when the board is already uniform", () => {
    const board = makeBoard(colors[0]);
    const graph = buildComponentGraph(board, 0);

    if (!graph) {
      throw new Error("Graph should be defined");
    }

    const onComplete = jest.fn();
    solveExactlyAsync(graph, onComplete);

    expect(onComplete).toHaveBeenCalledWith(0);
  });

  it("solves a simple two-component board asynchronously", () => {
    jest.useFakeTimers();

    const board = makeBoard(colors[0], { 1: colors[1] });
    const graph = buildComponentGraph(board, 0);

    if (!graph) {
      throw new Error("Graph should be defined");
    }

    const onComplete = jest.fn();
    solveExactlyAsync(graph, onComplete);

    jest.runAllTimers();

    expect(onComplete).toHaveBeenCalledWith(1);

    jest.useRealTimers();
  });

  it("returns the optimal color path asynchronously", () => {
    jest.useFakeTimers();

    const board = makeBoard(colors[0], { 1: colors[1] });
    const graph = buildComponentGraph(board, 0);

    if (!graph) {
      throw new Error("Graph should be defined");
    }

    const onComplete = jest.fn();
    solveExactlyPathAsync(graph, onComplete);

    jest.runAllTimers();

    expect(onComplete).toHaveBeenCalledWith([1]);

    jest.useRealTimers();
  });

  it("returns an empty path for an already solved board", () => {
    const board = makeBoard(colors[0]);
    const graph = buildComponentGraph(board, 0);

    if (!graph) {
      throw new Error("Graph should be defined");
    }

    const onComplete = jest.fn();
    solveExactlyPathAsync(graph, onComplete);

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("builds a new game with valid bounds", () => {
    const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0);

    const game = buildNewGame();

    expect(game.board).toHaveLength(CELL_COUNT);
    expect(new Set(game.board)).toEqual(new Set([colors[0]]));
    expect(game.startingPoint).toBe(0);

    randomSpy.mockRestore();
  });
});

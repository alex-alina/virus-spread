import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import happyVirus from "../assets/happy-small.png";
import {
  BOARD_SIZES,
  buildComponentGraph,
  buildNewGame,
  buildTestGame,
  colors,
  extractColorName,
  formatElapsedTime,
  getConnectedCells,
  getNeighborIndices,
  GRID_SIZE,
  solveExactlyAsync,
} from "../utils/utils";
import { ChevronDown, RotateCw } from "lucide-react";
import hexLogoTwo from "../assets/logo_hex.png";
import hexLogo from "../assets/hex-games-logo.png";

const MAX_HEX_SIZE_PX = 18;
const MIN_HEX_SIZE_PX = 8;

export const VirusSpread = () => {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  const isTestMode = useMemo(
    () => new URLSearchParams(window.location.search).get("test") === "1",
    [],
  );

  const getTestGameFromStorage = useCallback(() => {
    if (!isTestMode) {
      return null;
    }

    const stored = window.localStorage.getItem("virus-spread-seeded");
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as {
        board?: string[];
        startIndex?: number;
        gridSize?: number;
      };
      if (!parsed.board || parsed.startIndex === undefined) {
        return null;
      }

      const inferredGridSize = Math.sqrt(parsed.board.length);
      const parsedGridSize =
        parsed.gridSize ??
        (Number.isInteger(inferredGridSize) ? inferredGridSize : GRID_SIZE);

      if (parsed.board.length !== parsedGridSize * parsedGridSize) {
        return null;
      }

      return {
        board: parsed.board,
        startingPoint: parsed.startIndex,
        gridSize: parsedGridSize,
      };
    } catch {
      return null;
    }
  }, [isTestMode]);

  const initialStoredTestGame = useMemo(
    () => getTestGameFromStorage(),
    [getTestGameFromStorage],
  );
  const initialBoardSize = initialStoredTestGame?.gridSize ?? GRID_SIZE;
  const initialGame = useMemo(() => {
    if (!isTestMode) {
      return {
        ...buildNewGame(initialBoardSize),
        gridSize: initialBoardSize,
      };
    }

    return (
      initialStoredTestGame ?? {
        ...buildTestGame(initialBoardSize),
        gridSize: initialBoardSize,
      }
    );
  }, [initialBoardSize, initialStoredTestGame, isTestMode]);

  const [boardSize, setBoardSize] = useState(() => initialGame.gridSize);
  const [cellColors, setCellColors] = useState(() => initialGame.board);
  const [startingPoint, setStartingPoint] = useState(
    () => initialGame.startingPoint,
  );
  const [solverBoard, setSolverBoard] = useState(() => initialGame.board);
  const [solverStart, setSolverStart] = useState(
    () => initialGame.startingPoint,
  );
  const [optimalSteps, setOptimalSteps] = useState<number | null>(null);
  const [stepsTaken, setStepsTaken] = useState(0);
  const [replayCount, setReplayCount] = useState(0);
  const [gameStartedAt, setGameStartedAt] = useState<number>(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isBoardSizeMenuOpen, setIsBoardSizeMenuOpen] = useState(false);
  const boardSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const [completedTimeSeconds, setCompletedTimeSeconds] = useState<
    number | null
  >(null);

  const boardGeometry = useMemo(() => {
    const isSmallScreen = viewportWidth < 640;
    const isWideLayout = viewportWidth >= 1280;
    const hexGapPx = isSmallScreen ? 1 : 2;
    const maxBoardWidthPx = isWideLayout
      ? Math.max(280, viewportWidth - 660)
      : isSmallScreen
        ? Math.max(280, viewportWidth - 8)
        : Math.max(280, viewportWidth - 56);
    const targetHexSpacingPx = maxBoardWidthPx / (boardSize + 0.5);
    const hexSizePx = Math.max(
      MIN_HEX_SIZE_PX,
      Math.min(MAX_HEX_SIZE_PX, (targetHexSpacingPx - hexGapPx) / Math.sqrt(3)),
    );
    const hexWidthPx = Math.sqrt(3) * hexSizePx;
    const hexHeightPx = hexSizePx * 2;
    const hexHorizontalSpacingPx = hexWidthPx + hexGapPx;
    const hexVerticalSpacingPx = hexSizePx * 1.5 + hexGapPx;

    return {
      hexWidthPx,
      hexHeightPx,
      hexHorizontalSpacingPx,
      hexVerticalSpacingPx,
      widthPx: hexHorizontalSpacingPx * boardSize + hexHorizontalSpacingPx / 2,
      heightPx: hexHeightPx + (boardSize - 1) * hexVerticalSpacingPx,
    };
  }, [boardSize, viewportWidth]);

  const connectedCells = useMemo(
    () => getConnectedCells(cellColors, startingPoint, undefined, boardSize),
    [boardSize, cellColors, startingPoint],
  );

  const neighboringCells = useMemo(() => {
    const neighbors = new Set<number>();

    connectedCells.forEach((cellIndex) => {
      getNeighborIndices(cellIndex, boardSize).forEach((neighborIndex) => {
        if (connectedCells.has(neighborIndex)) {
          return;
        }

        neighbors.add(neighborIndex);
      });
    });

    return neighbors;
  }, [boardSize, connectedCells]);

  const isGameCompleted = connectedCells.size === cellColors.length;

  const solverGraph = useMemo(
    () => buildComponentGraph(solverBoard, solverStart, boardSize),
    [boardSize, solverBoard, solverStart],
  );

  const isSolvingOptimal = solverGraph !== null && optimalSteps === null;

  useEffect(() => {
    if (!solverGraph) {
      return;
    }

    const cancel = solveExactlyAsync(solverGraph, (steps) => {
      setOptimalSteps(steps);
    });

    return cancel;
  }, [solverGraph]);

  useEffect(() => {
    if (isGameCompleted) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - gameStartedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [gameStartedAt, isGameCompleted]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        boardSizeMenuRef.current &&
        !boardSizeMenuRef.current.contains(event.target as Node)
      ) {
        setIsBoardSizeMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);

    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const createGameForSize = useCallback(
    (nextBoardSize: number) => {
      if (!isTestMode) {
        return buildNewGame(nextBoardSize);
      }

      const storedTestGame = getTestGameFromStorage();
      if (storedTestGame && storedTestGame.gridSize === nextBoardSize) {
        return {
          board: storedTestGame.board,
          startingPoint: storedTestGame.startingPoint,
        };
      }

      return buildTestGame(nextBoardSize);
    },
    [getTestGameFromStorage, isTestMode],
  );

  const handleColorClick = (nextColor: string) => {
    if (isGameCompleted) {
      return;
    }

    const currentColor = cellColors[startingPoint];

    if (currentColor === nextColor) {
      return;
    }

    const currentlyConnected = getConnectedCells(
      cellColors,
      startingPoint,
      undefined,
      boardSize,
    );
    const updatedColors = [...cellColors];

    currentlyConnected.forEach((cellIndex) => {
      updatedColors[cellIndex] = nextColor;
    });

    const updatedConnected = getConnectedCells(
      updatedColors,
      startingPoint,
      undefined,
      boardSize,
    );
    if (updatedConnected.size === updatedColors.length) {
      setCompletedTimeSeconds(elapsedSeconds);
      setElapsedSeconds(0);
    }

    setCellColors(updatedColors);
    setStepsTaken((previousSteps) => previousSteps + 1);
  };

  const handleNewGame = (nextBoardSize = boardSize) => {
    const nextGame = createGameForSize(nextBoardSize);

    setBoardSize(nextBoardSize);
    setCellColors(nextGame.board);
    setStartingPoint(nextGame.startingPoint);
    setSolverBoard(nextGame.board);
    setSolverStart(nextGame.startingPoint);
    setOptimalSteps(null);
    setStepsTaken(0);
    setReplayCount(0);
    setGameStartedAt(() => Date.now());
    setElapsedSeconds(0);
    setCompletedTimeSeconds(null);
  };

  const handleReplayGame = () => {
    setCellColors(solverBoard);
    setStartingPoint(solverStart);
    setSolverBoard(solverBoard);
    setSolverStart(solverStart);
    setStepsTaken(0);
    setReplayCount((previousCount) => previousCount + 1);
    setGameStartedAt(() => Date.now());
    setElapsedSeconds(0);
    setCompletedTimeSeconds(null);
  };

  return (
    <>
      <div className="mx-auto flex w-full flex-col items-center justify-center gap-4 px-1 xl:flex-row xl:items-start xl:gap-6 xl:px-6">
        <div className="flex h-fit w-full justify-center rounded-2xl border border-transparent bg-blue-950 p-0 sm:w-fit sm:border-blue-400 sm:p-4">
          <div
            className={clsx(
              "0 relative overflow-visible rounded-md bg-blue-950 shadow-sm",
            )}
            style={{
              width: boardGeometry.widthPx,
              height: boardGeometry.heightPx,
            }}
          >
            {cellColors.map((cellColor, index) => {
              const isConnected = connectedCells.has(index);

              const row = Math.floor(index / boardSize);
              const col = index % boardSize;
              const left =
                col * boardGeometry.hexHorizontalSpacingPx +
                (row % 2) * (boardGeometry.hexHorizontalSpacingPx / 2);
              const top = row * boardGeometry.hexVerticalSpacingPx;

              return (
                <div
                  key={index}
                  className={clsx(
                    "absolute flex items-center justify-center transition-opacity",
                    cellColor,
                    isConnected ? "opacity-100" : "opacity-75",
                    neighboringCells.has(index) && !isGameCompleted
                      ? "cursor-pointer hover:opacity-100"
                      : null,
                  )}
                  style={{
                    width: boardGeometry.hexWidthPx,
                    height: boardGeometry.hexHeightPx,
                    left,
                    top,
                    clipPath:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  }}
                  data-cell-index={index}
                  data-color={extractColorName(cellColor)}
                  data-connected={isConnected ? "true" : "false"}
                  data-neighboring={
                    neighboringCells.has(index) ? "true" : "false"
                  }
                  onClick={() => {
                    if (!neighboringCells.has(index) || isGameCompleted) {
                      return;
                    }

                    handleColorClick(cellColor);
                  }}
                >
                  {isConnected ? (
                    <img src={happyVirus} alt="happy computer virus" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-auto flex w-full flex-col justify-between self-stretch rounded-2xl border border-transparent bg-blue-950 p-4 shadow-sm sm:border-blue-400 sm:p-8 md:w-xl xl:m-0 xl:w-xl">
          <div>
            <div className="flex flex-col gap-6 sm:flex-row sm:gap-4">
              <div className="flex w-full flex-col sm:w-1/2">
                <div className="mb-4 text-xl font-bold tracking-wide text-white uppercase sm:mb-6 sm:text-2xl">
                  Controls
                </div>
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-6">
                  {colors.map((colorClass) => (
                    <button
                      key={colorClass}
                      type="button"
                      onClick={() => handleColorClick(colorClass)}
                      disabled={isGameCompleted}
                      data-color={colorClass}
                      className={clsx(
                        "h-10 w-full rounded-md text-base text-gray-950 capitalize hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-20 sm:text-xl",
                        colorClass,
                      )}
                    >
                      {extractColorName(colorClass)}
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label
                    htmlFor="board-size"
                    className="mt-4 mb-3 block text-sm font-semibold tracking-wide text-white uppercase"
                  >
                    Board size
                  </label>
                  <div className="relative" ref={boardSizeMenuRef}>
                    <button
                      id="board-size"
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isBoardSizeMenuOpen}
                      onClick={() => setIsBoardSizeMenuOpen((open) => !open)}
                      className="text-md flex h-10 w-full items-center justify-between rounded-md bg-blue-600 px-2 pr-3 text-white outline-none focus:ring-1 focus:ring-white"
                    >
                      <span>
                        {boardSize} x {boardSize}
                      </span>
                      <ChevronDown
                        className={clsx(
                          "pointer-events-none h-6 w-6 text-white transition-transform",
                          isBoardSizeMenuOpen ? "rotate-180" : null,
                        )}
                      />
                    </button>
                    {isBoardSizeMenuOpen ? (
                      <div
                        role="listbox"
                        className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-blue-300 bg-blue-600 shadow-lg"
                      >
                        {BOARD_SIZES.map((sizeOption) => (
                          <button
                            key={sizeOption}
                            type="button"
                            onClick={() => {
                              handleNewGame(sizeOption);
                              setIsBoardSizeMenuOpen(false);
                            }}
                            className={clsx(
                              "w-full px-3 py-2 text-left text-white transition-colors",
                              sizeOption === boardSize
                                ? "bg-yellow-400 text-blue-950!"
                                : "hover:bg-yellow-400 hover:text-blue-950",
                            )}
                          >
                            {sizeOption} x {sizeOption}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col sm:w-1/2">
                <div className="mb-4 text-xl font-bold tracking-wide text-white uppercase sm:mb-6 sm:text-2xl">
                  Stats
                </div>
                <div className="mb-2 rounded-md border border-blue-400 bg-white px-3 py-2 text-sm text-slate-700">
                  Time:&nbsp;
                  <span className="font-semibold">
                    {formatElapsedTime(elapsedSeconds)}
                  </span>
                </div>

                <div className="mb-2 rounded-md border border-blue-400 bg-white px-3 py-2 text-sm text-slate-700">
                  Shortest no. of steps:&nbsp;
                  {/* (BFS) */}
                  <span className="font-semibold" data-testid="optimal-steps">
                    {isSolvingOptimal
                      ? "calculating..."
                      : optimalSteps === null
                        ? "N/A"
                        : optimalSteps}
                  </span>
                </div>

                <div className="mb-4 rounded-md border border-blue-400 bg-white px-3 py-2 text-sm text-slate-700">
                  Steps taken:&nbsp;
                  <span className="font-semibold" data-testid="steps-taken">
                    {stepsTaken}
                  </span>
                </div>
                <div className="text-sm text-white">
                  Game replayed {replayCount} times.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {isGameCompleted ? (
                <div className="space-y-2">
                  <div
                    className="my-6 flex w-full justify-center rounded-md border border-emerald-700 bg-emerald-100 px-3 py-2 text-xl font-semibold text-emerald-900"
                    data-testid="game-completed"
                  >
                    Game completed in:
                    {formatElapsedTime(completedTimeSeconds ?? 0)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReplayGame}
              className="flex h-10 w-full flex-1 items-center justify-center rounded-md bg-yellow-400 px-2 text-lg text-blue-900 hover:bg-yellow-500 sm:text-xl"
            >
              <RotateCw className="mr-2 h-5 w-5" />
              Replay game
            </button>
            <button
              type="button"
              onClick={() => handleNewGame()}
              className="h-10 w-full flex-1 rounded-md bg-blue-600 px-2 text-lg text-white hover:bg-blue-700 sm:text-xl"
            >
              New game
            </button>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full p-6 text-center text-xl text-white lg:w-4xl xl:w-6xl">
        <h3 className="mt-4 mb-6 text-2xl">
          Virus Spread is a simple puzzle game using flood fill.
        </h3>
        <p>
          Help the little rascal infiltrate the neighbouring cells, like the
          chameleon he is and see if you can match the shortest number of steps
          that will conquer the world, well, the tiny viru&apos;s small “world”.
        </p>
        <p className="my-5">
          You can use it to practice spatial reasoning and predictive planning
          or just have some fun at the end of the day, or the middle, or with
          your morning coffee.
        </p>
        <p>
          Just don&apos;t get angry if your virus is slower than the
          Machine&apos;s 😅
        </p>
        <div className="mx-auto mt-6 flex w-fit items-center">
          <img src={hexLogoTwo} className="mr-6 h-20 w-50" />

          <img src={hexLogo} className="h-30 w-45" />
        </div>
      </div>
    </>
  );
};

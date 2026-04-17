import { test, expect, type TestInfo } from "@playwright/test";
import {
  absorbColor as absorbHexColor,
  buildComponentGraph as buildHexComponentGraph,
  buildTestGame as buildHexTestGame,
  CELL_COUNT as HEX_CELL_COUNT,
  colors as hexColors,
} from "../src/utils/utils";

type SolverGraph = NonNullable<ReturnType<typeof buildHexComponentGraph>>;
type SeededStoragePayload = {
  board: string[];
  startIndex: number;
};

const buildSeededBoard = (
  seed: number,
  cellCount: number,
  colors: string[],
) => {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };

  return Array.from(
    { length: cellCount },
    () => colors[Math.floor(next() * colors.length)],
  );
};

const buildSeededGame = (
  seed: number,
  cellCount: number,
  colors: string[],
) => ({
  board: buildSeededBoard(seed, cellCount, colors),
  startingPoint: 0,
});

const buildReplayBoard = (cellCount: number, colors: string[]) =>
  Array.from({ length: cellCount }, (_, index) =>
    index === 0 ? colors[0] : colors[1],
  );

const buildOptimalSequence = (
  board: string[],
  startIndex: number,
  colors: string[],
  buildComponentGraph: (
    board: string[],
    startIndex: number,
  ) => SolverGraph | null,
  absorbColor: (mask: bigint, colorIndex: number, graph: SolverGraph) => bigint,
) => {
  const graph = buildComponentGraph(board, startIndex);
  if (!graph) {
    throw new Error("Expected a valid component graph");
  }

  const startMask = graph.componentBits[graph.startComponent];
  if (startMask === graph.allMask) {
    return [] as number[];
  }

  const toKey = (mask: bigint, color: number) =>
    `${mask.toString(16)}:${color}`;
  const startKey = toKey(startMask, graph.startColor);

  const queue: Array<{ mask: bigint; color: number }> = [
    { mask: startMask, color: graph.startColor },
  ];
  const parent = new Map<string, { prev: string | null; color: number }>();
  parent.set(startKey, { prev: null, color: graph.startColor });

  let targetKey: string | null = null;

  for (let head = 0; head < queue.length && !targetKey; head += 1) {
    const current = queue[head];
    const currentKey = toKey(current.mask, current.color);

    for (let colorIndex = 0; colorIndex < colors.length; colorIndex += 1) {
      if (colorIndex === current.color) {
        continue;
      }

      const nextMask = absorbColor(current.mask, colorIndex, graph);
      if (nextMask === current.mask) {
        continue;
      }

      const nextKey = toKey(nextMask, colorIndex);
      if (parent.has(nextKey)) {
        continue;
      }

      parent.set(nextKey, { prev: currentKey, color: colorIndex });

      if (nextMask === graph.allMask) {
        targetKey = nextKey;
        break;
      }

      queue.push({ mask: nextMask, color: colorIndex });
    }
  }

  if (!targetKey) {
    throw new Error("No solution found for test game");
  }

  const sequence: number[] = [];
  let cursor = targetKey;

  while (cursor !== startKey) {
    const entry = parent.get(cursor);
    if (!entry || !entry.prev) {
      throw new Error("Failed to reconstruct solution path");
    }
    sequence.push(entry.color);
    cursor = entry.prev;
  }

  return sequence.reverse();
};

const toUrl = (path: string, testInfo: TestInfo) => {
  const baseUrlFromEnv =
    typeof globalThis === "object" && "process" in globalThis
      ? (
          globalThis as {
            process?: { env?: Record<string, string | undefined> };
          }
        ).process?.env?.PLAYWRIGHT_BASE_URL
      : undefined;

  const baseURL =
    (typeof testInfo.project.use.baseURL === "string" &&
      testInfo.project.use.baseURL) ||
    baseUrlFromEnv ||
    "http://127.0.0.1:5173";
  return new URL(path, baseURL).toString();
};

const readOptimalSteps = async (
  page: import("@playwright/test").Page,
): Promise<number> => {
  const optimalStepsLocator = page.getByTestId("optimal-steps");

  await expect
    .poll(async () => (await optimalStepsLocator.innerText()).trim(), {
      timeout: 30000,
      message: "Expected optimal steps to resolve to a numeric value",
    })
    .toMatch(/^[0-9]+$/);

  return Number((await optimalStepsLocator.innerText()).trim());
};

const solveAndAssert = async (
  page: import("@playwright/test").Page,
  testInfo: TestInfo,
  {
    path,
    colors,
    buildTestGame,
    buildComponentGraph,
    absorbColor,
  }: {
    path: string;
    colors: string[];
    buildTestGame: () => { board: string[]; startingPoint: number };
    buildComponentGraph: (
      board: string[],
      startIndex: number,
    ) => SolverGraph | null;
    absorbColor: (mask: bigint, colorIndex: number, graph: SolverGraph) => bigint;
  },
) => {
  await page.goto(toUrl(path, testInfo));

  const optimalSteps = await readOptimalSteps(page);
  const testGame = buildTestGame();
  const solution = buildOptimalSequence(
    testGame.board,
    testGame.startingPoint,
    colors,
    buildComponentGraph,
    absorbColor,
  );

  expect(solution.length).toBe(optimalSteps);

  for (const colorIndex of solution) {
    await page.locator(`button[data-color="${colors[colorIndex]}"]`).click();
  }

  await expect(page.getByTestId("game-completed")).toBeVisible();
  await expect(page.getByTestId("steps-taken")).toHaveText(
    String(optimalSteps),
  );
};

const solveAndAssertSeeded = async (
  page: import("@playwright/test").Page,
  testInfo: TestInfo,
  {
    path,
    colors,
    cellCount,
    buildComponentGraph,
    absorbColor,
  }: {
    path: string;
    colors: string[];
    cellCount: number;
    buildComponentGraph: (
      board: string[],
      startIndex: number,
    ) => SolverGraph | null;
    absorbColor: (mask: bigint, colorIndex: number, graph: SolverGraph) => bigint;
  },
) => {
  const seededGame = buildSeededGame(1337, cellCount, colors);
  const solution = buildOptimalSequence(
    seededGame.board,
    seededGame.startingPoint,
    colors,
    buildComponentGraph,
    absorbColor,
  );

  await page.addInitScript(
    ({ board, startIndex }: SeededStoragePayload) => {
      window.localStorage.setItem(
        "virus-spread-seeded",
        JSON.stringify({ board, startIndex }),
      );
    },
    { board: seededGame.board, startIndex: seededGame.startingPoint },
  );

  await page.goto(toUrl(path, testInfo));

  const optimalSteps = await readOptimalSteps(page);
  expect(solution.length).toBe(optimalSteps);

  for (const colorIndex of solution) {
    await page.locator(`button[data-color="${colors[colorIndex]}"]`).click();
  }

  await expect(page.getByTestId("game-completed")).toBeVisible();
  await expect(page.getByTestId("steps-taken")).toHaveText(
    String(optimalSteps),
  );
};

const replayAndAssert = async (
  page: import("@playwright/test").Page,
  testInfo: TestInfo,
  {
    path,
    colors,
    cellCount,
    board,
  }: {
    path: string;
    colors: string[];
    cellCount: number;
    board?: string[];
  },
) => {
  const seededBoard = board ?? buildReplayBoard(cellCount, colors);

  await page.addInitScript(
    ({ seededBoard: storedBoard }: { seededBoard: string[] }) => {
      window.localStorage.setItem(
        "virus-spread-seeded",
        JSON.stringify({ board: storedBoard, startIndex: 0 }),
      );
    },
    { seededBoard },
  );

  await page.goto(toUrl(path, testInfo));

  const startCell = page.locator('[data-cell-index="0"]');
  await expect(startCell).toHaveAttribute(
    "data-color",
    seededBoard[0].match(/-([^-]+)-/)?.[1] ?? "",
  );

  const nextColor =
    colors.find((color) => color !== seededBoard[0]) ?? colors[0];
  await page.locator(`button[data-color="${nextColor}"]`).click();
  await expect(startCell).toHaveAttribute(
    "data-color",
    nextColor.match(/-([^-]+)-/)?.[1] ?? "",
  );

  await page.getByRole("button", { name: /replay game/i }).click();
  await expect(startCell).toHaveAttribute(
    "data-color",
    seededBoard[0].match(/-([^-]+)-/)?.[1] ?? "",
  );
};

test("solves virus spread in test mode using the optimal number of steps", async ({
  page,
}, testInfo) => {
  await solveAndAssert(page, testInfo, {
    path: "/virus-spread?test=1",
    colors: hexColors,
    buildTestGame: buildHexTestGame,
    buildComponentGraph: buildHexComponentGraph,
    absorbColor: absorbHexColor,
  });
});

test("solves virus spread on a complex seeded board using the optimal number of steps", async ({
  page,
}, testInfo) => {
  await solveAndAssertSeeded(page, testInfo, {
    path: "/virus-spread?test=1",
    colors: hexColors,
    cellCount: HEX_CELL_COUNT,
    buildComponentGraph: buildHexComponentGraph,
    absorbColor: absorbHexColor,
  });
});

test("replay game restores the initial board", async ({ page }, testInfo) => {
  await replayAndAssert(page, testInfo, {
    path: "/virus-spread?test=1",
    colors: hexColors,
    cellCount: HEX_CELL_COUNT,
  });
});

test("replay game restores the initial board on a complex seeded board", async ({
  page,
}, testInfo) => {
  const complexBoard = buildSeededBoard(2024, HEX_CELL_COUNT, hexColors);
  await replayAndAssert(page, testInfo, {
    path: "/virus-spread?test=1",
    colors: hexColors,
    cellCount: HEX_CELL_COUNT,
    board: complexBoard,
  });
});

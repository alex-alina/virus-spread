import "@testing-library/jest-dom/jest-globals";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  it,
} from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VirusSpread } from "./VirusSpread";
import {
  GRID_SIZE,
  buildTestGame,
  colors,
  extractColorName,
} from "../utils/utils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const seedTestGame = (
  startColor = colors[0],
  otherColor = colors[1],
  gridSize = GRID_SIZE,
) => {
  const board = Array.from({ length: gridSize * gridSize }, (_, index) =>
    index === 0 ? startColor : otherColor,
  );
  window.localStorage.setItem(
    "virus-spread-seeded",
    JSON.stringify({ board, startIndex: 0, gridSize }),
  );

  return board;
};

const seedBoardState = (board: string[], startIndex: number, gridSize: number) => {
  window.localStorage.setItem(
    "virus-spread-seeded",
    JSON.stringify({ board, startIndex, gridSize }),
  );
};

const seedReplayGame = (gridSize = 10) => {
  const game = buildTestGame(gridSize);
  seedBoardState(game.board, game.startingPoint, gridSize);
};

const seedVariedGame = (startColor: string, gridSize = 10) => {
  const palette = [startColor, ...colors.filter((color) => color !== startColor)];
  const board = Array.from(
    { length: gridSize * gridSize },
    (_, index) => palette[index % palette.length],
  );
  board[0] = startColor;
  seedBoardState(board, 0, gridSize);
};

const makeThreeMoves = async (
  user: ReturnType<typeof userEvent.setup>,
  startCell: Element,
) => {
  const colorNames = colors.map((colorClass) => extractColorName(colorClass));
  let finalColorName = startCell.getAttribute("data-color") ?? "";

  for (let moveIndex = 0; moveIndex < 3; moveIndex += 1) {
    const currentColorIndex = colorNames.indexOf(finalColorName);
    const nextColor =
      colors[(currentColorIndex + 1 + colors.length) % colors.length];

    if (!nextColor) {
      throw new Error("Expected an available color for move");
    }

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(extractColorName(nextColor), "i"),
      }),
    );
    finalColorName = extractColorName(nextColor);
  }

  return finalColorName;
};

const enableTestMode = () => {
  window.history.pushState({}, "", "/?test=1");
};

afterEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("VirusSpreadHex replay game", () => {
  it("restores the initial board when replaying", async () => {
    seedReplayGame();
    enableTestMode();

    const { container } = render(<VirusSpread />);
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const startCell = container.querySelector('[data-cell-index="0"]');
    expect(startCell).not.toBeNull();
    if (!startCell) {
      throw new Error("Expected start cell to exist");
    }
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[0]),
    );

    const replayButton = screen.getByRole("button", { name: /replay game/i });
    expect(replayButton).toBeDisabled();

    const finalColor = await makeThreeMoves(user, startCell);
    expect(startCell.getAttribute("data-color")).toBe(
      finalColor,
    );
    expect(replayButton).toBeEnabled();

    await user.click(replayButton);
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[0]),
    );
  });

  it("replays the current game after starting a new game", async () => {
    seedReplayGame();
    enableTestMode();

    const { container } = render(<VirusSpread />);
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const startCell = container.querySelector('[data-cell-index="0"]');
    expect(startCell).not.toBeNull();
    if (!startCell) {
      throw new Error("Expected start cell to exist");
    }

    seedVariedGame(colors[2]);
    await user.click(screen.getByRole("button", { name: /new game/i }));

    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );

    const replayButton = screen.getByRole("button", { name: /replay game/i });
    expect(replayButton).toBeDisabled();

    const finalColor = await makeThreeMoves(user, startCell);
    expect(startCell.getAttribute("data-color")).toBe(
      finalColor,
    );
    expect(replayButton).toBeEnabled();

    await user.click(replayButton);
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );
  });

  it("keeps displaying optimum steps after replaying", async () => {
    seedReplayGame();
    enableTestMode();

    render(<VirusSpread />);
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const optimalStepsLabel = screen.getByTestId("optimal-steps");
    expect(optimalStepsLabel.textContent).toBe("3");

    const startCell = document.querySelector('[data-cell-index="0"]');
    expect(startCell).not.toBeNull();
    if (!startCell) {
      throw new Error("Expected start cell to exist");
    }

    await makeThreeMoves(user, startCell);
    await user.click(screen.getByRole("button", { name: /replay game/i }));

    expect(screen.getByTestId("optimal-steps").textContent).toBe("3");
  });

});

describe("VirusSpreadHex new UI controls", () => {
  it("applies selected board size and starts a matching new game in test mode", async () => {
    seedTestGame(colors[0], colors[1], GRID_SIZE);
    enableTestMode();

    const { container } = render(<VirusSpread />);
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    seedTestGame(colors[2], colors[3], 10);

    await user.click(screen.getByLabelText(/board size/i));
    await user.click(screen.getByRole("button", { name: /10 x 10/i }));

    const startCell = container.querySelector('[data-cell-index="0"]');
    expect(startCell).not.toBeNull();
    if (!startCell) {
      throw new Error("Expected start cell to exist");
    }

    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );
    expect(container.querySelectorAll("[data-cell-index]").length).toBe(100);
    expect(screen.getByLabelText(/board size/i)).toHaveTextContent(/10 x 10/i);
  });

  it("closes board size menu when clicking outside", async () => {
    seedTestGame();
    enableTestMode();

    render(<VirusSpread />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await user.click(screen.getByLabelText(/board size/i));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("resets elapsed time when starting a new game", async () => {
    seedTestGame(colors[0], colors[1], GRID_SIZE);
    enableTestMode();

    render(<VirusSpread />);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText("00:03")).toBeInTheDocument();

    seedTestGame(colors[2], colors[3], GRID_SIZE);
    await user.click(screen.getByRole("button", { name: /new game/i }));

    expect(screen.getByText("00:00")).toBeInTheDocument();
  });
});

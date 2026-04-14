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
import { GRID_SIZE, colors, extractColorName } from "../utils/utils";

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

const enableTestMode = () => {
  window.history.pushState({}, "", "/?test=1");
};

afterEach(() => {
  window.localStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("VirusSpreadHex restart game", () => {
  it("restores the initial board when restarting", async () => {
    seedTestGame();
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

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(extractColorName(colors[1]), "i"),
      }),
    );
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[1]),
    );

    await user.click(screen.getByRole("button", { name: /restart game/i }));
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[0]),
    );
  });

  it("restarts the current game after starting a new game", async () => {
    seedTestGame(colors[0], colors[1]);
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

    seedTestGame(colors[2], colors[3]);
    await user.click(screen.getByRole("button", { name: /new game/i }));

    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(extractColorName(colors[1]), "i"),
      }),
    );
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[1]),
    );

    await user.click(screen.getByRole("button", { name: /restart game/i }));
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );
  });

  it("keeps displaying optimum steps after restarting", async () => {
    seedTestGame();
    enableTestMode();

    render(<VirusSpread />);
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const optimalStepsLabel = screen.getByTestId("optimal-steps");
    expect(optimalStepsLabel.textContent).toBe("1");

    await user.click(
      screen.getByRole("button", {
        name: new RegExp(extractColorName(colors[1]), "i"),
      }),
    );
    await user.click(screen.getByRole("button", { name: /restart game/i }));

    expect(screen.getByTestId("optimal-steps").textContent).toBe("1");
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

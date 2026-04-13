import "@testing-library/jest-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VirusSpread } from "./VirusSpread";
import { CELL_COUNT, colors, extractColorName } from "../utils/utils";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const seedTestGame = (startColor = colors[0], otherColor = colors[1]) => {
  const board = Array.from({ length: CELL_COUNT }, (_, index) =>
    index === 0 ? startColor : otherColor,
  );
  window.localStorage.setItem(
    "virus-spread-seeded",
    JSON.stringify({ board, startIndex: 0 }),
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

describe("VirusSpreadHex replay game", () => {
  it("restores the initial board when replaying", async () => {
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

    await user.click(screen.getByRole("button", { name: /replay game/i }));
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[0]),
    );
  });

  it("replays the current game after starting a new game", async () => {
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

    await user.click(screen.getByRole("button", { name: /replay game/i }));
    expect(startCell.getAttribute("data-color")).toBe(
      extractColorName(colors[2]),
    );
  });
});

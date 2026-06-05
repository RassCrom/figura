import { create } from "zustand";

import { calcRoundScore, GAME_CONFIG } from "../config/gameConfig";
import type { Difficulty, Figure, RoundResult } from "../types/figure";
import { getFullName, inferContinent, normalizeName } from "../lib/figures";

type GameStatus = "idle" | "countdown" | "playing" | "paused" | "revealed" | "ended";

type StartSessionArgs = {
  nickname: string;
  difficulty: Difficulty;
  categories: string[];
  queue: Figure[];
};

type GameState = {
  nickname: string;
  sessionId: string;
  difficulty: Difficulty;
  categories: string[];
  queue: Figure[];
  roundIndex: number;
  status: GameStatus;
  countdownText: string;
  score: number;
  displayedScore: number;
  roundTimer: number;
  extraBank: number;
  wrongGuesses: number;
  firstGuessStreak: number;
  showStreak: boolean;
  currentRoundScore: number;
  timeUsed: number;
  extraUsed: number;
  hintsUsed: number;
  roundResults: RoundResult[];
  revealedFigure: Figure | null;
  toast: string | null;
  vignetteKey: number;
  inputShakeKey: number;
  leaderboardSaved: boolean;
  startSession: (args: StartSessionArgs) => void;
  setToast: (toast: string | null) => void;
  setCountdownText: (text: string) => void;
  beginRound: () => void;
  tick: (deltaSeconds: number) => void;
  submitGuess: (guess: string) => boolean;
  skipRound: () => void;
  dismissReveal: () => void;
  pause: () => void;
  resume: () => void;
  markLeaderboardSaved: () => void;
  reset: () => void;
};

const initialState = {
  nickname: "",
  sessionId: "",
  difficulty: "Explorer" as Difficulty,
  categories: [] as string[],
  queue: [] as Figure[],
  roundIndex: 0,
  status: "idle" as GameStatus,
  countdownText: "",
  score: 0,
  displayedScore: 0,
  roundTimer: GAME_CONFIG.roundSeconds,
  extraBank: GAME_CONFIG.extraBankSeconds,
  wrongGuesses: 0,
  firstGuessStreak: 0,
  showStreak: false,
  currentRoundScore: 0,
  timeUsed: 0,
  extraUsed: 0,
  hintsUsed: 0,
  roundResults: [] as RoundResult[],
  revealedFigure: null as Figure | null,
  toast: null as string | null,
  vignetteKey: 0,
  inputShakeKey: 0,
  leaderboardSaved: false,
};

function currentFigure(state: GameState): Figure | null {
  return state.queue[state.roundIndex] ?? null;
}

function reveal(state: GameState, score: number, correct: boolean): Partial<GameState> {
  const figure = currentFigure(state);
  if (!figure) {
    return { status: "ended" };
  }

  const nextTotal = state.score + score;
  return {
    status: "revealed",
    revealedFigure: figure,
    currentRoundScore: score,
    score: nextTotal,
    displayedScore: nextTotal,
    roundResults: [
      ...state.roundResults,
      {
        round: state.roundIndex + 1,
        figureName: getFullName(figure),
        score,
        hintsUsed: state.hintsUsed,
        timeUsed: Math.round(state.timeUsed + state.extraUsed),
        category: figure.category,
        continent: inferContinent(figure.coordinates_of_the_place_of_birth),
        correct,
        firstGuess: correct && state.wrongGuesses === 0,
      },
    ],
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  startSession: ({ nickname, difficulty, categories, queue }) =>
    set({
      ...initialState,
      nickname,
      sessionId: crypto.randomUUID(),
      difficulty,
      categories,
      queue,
      status: "countdown",
      countdownText: "3",
    }),
  setToast: (toast) => set({ toast }),
  setCountdownText: (countdownText) => set({ countdownText }),
  beginRound: () =>
    set({
      status: "playing",
      countdownText: "",
      roundTimer: GAME_CONFIG.roundSeconds,
      wrongGuesses: 0,
      currentRoundScore: 0,
      timeUsed: 0,
      extraUsed: 0,
      hintsUsed: 0,
      revealedFigure: null,
    }),
  tick: (deltaSeconds) =>
    set((state) => {
      if (state.status !== "playing") {
        return state;
      }

      if (state.roundTimer > 0) {
        const nextTimer = Math.max(0, state.roundTimer - deltaSeconds);
        return {
          roundTimer: nextTimer,
          timeUsed: state.timeUsed + deltaSeconds,
        };
      }

      if (state.extraBank > 0) {
        const drained = Math.min(state.extraBank, deltaSeconds);
        return {
          extraBank: Math.max(0, state.extraBank - drained),
          extraUsed: state.extraUsed + drained,
        };
      }

      return reveal(state, 0, false);
    }),
  submitGuess: (guess) => {
    const state = get();
    const figure = currentFigure(state);
    if (!figure || state.status !== "playing") {
      return false;
    }

    const isCorrect = normalizeName(getFullName(figure)) === normalizeName(guess);
    if (isCorrect) {
      const streak = state.wrongGuesses === 0 && state.firstGuessStreak >= 1;
      const nextFirstGuessStreak = state.wrongGuesses === 0 ? state.firstGuessStreak + 1 : 0;
      const roundScore = calcRoundScore(
        state.wrongGuesses,
        state.timeUsed,
        state.extraUsed,
        streak,
      );
      set((latest) => ({
        ...reveal({ ...latest, firstGuessStreak: nextFirstGuessStreak }, roundScore, true),
        firstGuessStreak: nextFirstGuessStreak,
        showStreak: nextFirstGuessStreak >= 2,
      }));
      return true;
    }

    set((latest) => {
      const wrongGuesses = latest.wrongGuesses + 1;
      if (wrongGuesses >= 3) {
        return {
          wrongGuesses,
          firstGuessStreak: 0,
          showStreak: false,
          hintsUsed: 3,
          vignetteKey: latest.vignetteKey + 1,
          inputShakeKey: latest.inputShakeKey + 1,
        };
      }

      return {
        wrongGuesses,
        firstGuessStreak: 0,
        showStreak: false,
        hintsUsed: wrongGuesses,
        vignetteKey: latest.vignetteKey + 1,
        inputShakeKey: latest.inputShakeKey + 1,
      };
    });
    return false;
  },
  skipRound: () =>
    set((state) => ({
      ...reveal(state, 0, false),
      firstGuessStreak: 0,
      showStreak: false,
    })),
  dismissReveal: () =>
    set((state) => {
      const nextRound = state.roundIndex + 1;
      if (nextRound >= state.queue.length) {
        return { status: "ended", roundIndex: nextRound, revealedFigure: null };
      }

      return {
        status: "countdown",
        countdownText: "3",
        roundIndex: nextRound,
        roundTimer: GAME_CONFIG.roundSeconds,
        wrongGuesses: 0,
        currentRoundScore: 0,
        timeUsed: 0,
        extraUsed: 0,
        hintsUsed: 0,
        revealedFigure: null,
      };
    }),
  pause: () => set((state) => (state.status === "playing" ? { status: "paused" } : state)),
  resume: () => set((state) => (state.status === "paused" ? { status: "playing" } : state)),
  markLeaderboardSaved: () => set({ leaderboardSaved: true }),
  reset: () => set(initialState),
}));

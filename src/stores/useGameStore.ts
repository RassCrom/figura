import { create } from "zustand";

import { calcRoundScore, GAME_CONFIG } from "../config/gameConfig";
import type { Difficulty, Figure, RoundResult } from "../types/figure";
import { getFullName, inferContinent, normalizeName } from "../lib/figures";

type GameStatus = "idle" | "countdown" | "playing" | "paused" | "revealed" | "ended";

type GameMode = "classic" | "daily";

type StartSessionArgs = {
  nickname: string;
  difficulty: Difficulty;
  categories: string[];
  queue: Figure[];
  mode?: GameMode;
  dailyDate?: string;
};

type GameState = {
  nickname: string;
  sessionId: string;
  difficulty: Difficulty;
  categories: string[];
  mode: GameMode;
  dailyDate: string | null;
  queue: Figure[];
  roundIndex: number;
  status: GameStatus;
  countdownText: string;
  score: number;
  roundTimer: number;
  extraBank: number;
  wrongGuesses: number;
  firstGuessStreak: number;
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
  mode: "classic" as GameMode,
  dailyDate: null as string | null,
  queue: [] as Figure[],
  roundIndex: 0,
  status: "idle" as GameStatus,
  countdownText: "",
  score: 0,
  roundTimer: GAME_CONFIG.roundSeconds,
  extraBank: GAME_CONFIG.extraBankSeconds,
  wrongGuesses: 0,
  firstGuessStreak: 0,
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

// Per-round state that must be wiped at every round boundary. Everything
// cumulative (score, queue, roundIndex, firstGuessStreak, roundResults) is
// deliberately NOT in here.
function freshRoundState(): Pick<
  GameState,
  | "roundTimer"
  | "wrongGuesses"
  | "currentRoundScore"
  | "timeUsed"
  | "extraUsed"
  | "hintsUsed"
  | "revealedFigure"
> {
  return {
    roundTimer: GAME_CONFIG.roundSeconds,
    wrongGuesses: 0,
    currentRoundScore: 0,
    timeUsed: 0,
    extraUsed: 0,
    hintsUsed: 0,
    revealedFigure: null,
  };
}

function currentFigure(state: GameState): Figure | null {
  return state.queue[state.roundIndex] ?? null;
}

// Single entry point into the "revealed" state. Always writes the same set
// of fields explicitly so currentRoundScore, score, and streak can never
// be stale from the previous round.
function reveal(state: GameState, score: number, correct: boolean): Partial<GameState> {
  const figure = currentFigure(state);
  if (!figure) {
    return { status: "ended" };
  }

  const isFirstGuess = correct && state.wrongGuesses === 0;
  // Streak counts CONSECUTIVE first-try-correct rounds; any non-first-guess
  // outcome (wrong guess, skip, timeout) resets it.
  const nextFirstGuessStreak = isFirstGuess ? state.firstGuessStreak + 1 : 0;

  return {
    status: "revealed",
    revealedFigure: figure,
    currentRoundScore: score,
    score: state.score + score,
    firstGuessStreak: nextFirstGuessStreak,
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
        firstGuess: isFirstGuess,
      },
    ],
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,
  startSession: ({ nickname, difficulty, categories, queue, mode = "classic", dailyDate }) =>
    set({
      ...initialState,
      nickname,
      sessionId: crypto.randomUUID(),
      difficulty,
      categories,
      mode,
      dailyDate: dailyDate ?? null,
      queue,
      status: "countdown",
      countdownText: "3",
    }),
  setToast: (toast) => set({ toast }),
  setCountdownText: (countdownText) => set({ countdownText }),
  beginRound: () =>
    set((state) => {
      // Only start a round from countdown. Guards against a stray beginRound
      // call (e.g. a queued setTimeout firing after pause/resume) re-entering
      // a round and wiping its progress.
      if (state.status !== "countdown") {
        return state;
      }
      return {
        ...freshRoundState(),
        status: "playing",
        countdownText: "",
      };
    }),
  tick: (deltaSeconds) =>
    set((state) => {
      if (state.status !== "playing") {
        return state;
      }

      // Drain primary timer first, spill over into extra bank, and only
      // then reveal as a timeout. Using Math.min keeps timeUsed/extraUsed
      // accurate to the actual seconds consumed — the previous version
      // could overshoot by up to deltaSeconds when the timer hit zero
      // mid-tick, which silently inflated the time-bonus penalty.
      let remaining = deltaSeconds;
      let roundTimer = state.roundTimer;
      let timeUsed = state.timeUsed;
      let extraBank = state.extraBank;
      let extraUsed = state.extraUsed;

      if (roundTimer > 0) {
        const used = Math.min(roundTimer, remaining);
        roundTimer -= used;
        timeUsed += used;
        remaining -= used;
      }

      if (remaining > 0 && extraBank > 0) {
        const used = Math.min(extraBank, remaining);
        extraBank -= used;
        extraUsed += used;
        remaining -= used;
      }

      if (remaining > 0) {
        // Both clocks are empty. Reveal as a timeout.
        return { ...state, ...reveal(state, 0, false) };
      }

      return { roundTimer, timeUsed, extraBank, extraUsed };
    }),
  submitGuess: (guess) => {
    const state = get();
    const figure = currentFigure(state);
    if (!figure || state.status !== "playing") {
      return false;
    }

    const isCorrect = normalizeName(getFullName(figure)) === normalizeName(guess);
    if (isCorrect) {
      // Streak bonus applies when this round is a first-try-correct AND the
      // player already had a streak going from prior rounds.
      const streak = state.wrongGuesses === 0 && state.firstGuessStreak >= 1;
      const roundScore = calcRoundScore(
        state.wrongGuesses,
        state.timeUsed,
        state.extraUsed,
        streak,
      );
      set(reveal(state, roundScore, true));
      return true;
    }

    set((latest) => {
      const wrongGuesses = latest.wrongGuesses + 1;
      return {
        wrongGuesses,
        // Any wrong guess breaks the streak immediately; the round can
        // still be won, but the streak bonus is gone.
        firstGuessStreak: 0,
        // hintsUsed mirrors wrongGuesses (capped at 3) — used for the
        // round-result summary and achievements.
        hintsUsed: Math.min(3, wrongGuesses),
        vignetteKey: latest.vignetteKey + 1,
        inputShakeKey: latest.inputShakeKey + 1,
      };
    });
    return false;
  },
  skipRound: () =>
    set((state) => {
      if (state.status !== "playing") {
        return state;
      }
      return reveal(state, 0, false);
    }),
  dismissReveal: () =>
    set((state) => {
      // Guard against double-fire. The PersonCard's 7s auto-dismiss timer,
      // the user's "Next" click, and the Escape keyhandler all call this;
      // without the guard, two near-simultaneous calls would advance
      // roundIndex twice and silently skip a round (the visible symptom:
      // figure + score look like they belong to the previous round).
      if (state.status !== "revealed") {
        return state;
      }
      const nextRound = state.roundIndex + 1;
      if (nextRound >= state.queue.length) {
        return { status: "ended", roundIndex: nextRound, revealedFigure: null };
      }

      return {
        ...freshRoundState(),
        status: "countdown",
        countdownText: "3",
        roundIndex: nextRound,
      };
    }),
  pause: () => set((state) => (state.status === "playing" ? { status: "paused" } : state)),
  resume: () => set((state) => (state.status === "paused" ? { status: "playing" } : state)),
  markLeaderboardSaved: () => set({ leaderboardSaved: true }),
  reset: () => set(initialState),
}));

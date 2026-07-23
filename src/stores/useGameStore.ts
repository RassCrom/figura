import { create } from "zustand";

import {
  calcReverseScore,
  calcRoundScore,
  GAME_CONFIG,
  getDifficultyRules,
  REVERSE_SCORING,
} from "../config/gameConfig";
import type { Coordinates, Difficulty, Figure, GameMode, RoundResult } from "../types/figure";
import {
  distanceKm,
  getFullName,
  inferContinent,
  normalizeName,
  parseHistoricalYear,
} from "../lib/figures";

type GameStatus = "idle" | "countdown" | "playing" | "paused" | "revealed" | "ended";

export type GameHint = "initial" | "description" | "category";

type StartSessionArgs = {
  nickname: string;
  difficulty: Difficulty;
  categories: string[];
  queue: Figure[];
  mode?: GameMode;
  dailyDate?: string;
};

export type ReverseEstimate = {
  birthYear: number | null;
  deathYear: number | null;
};

export type ReverseGuessResult = {
  distanceKm: number;
  birthYearError: number | null;
  deathYearError: number | null;
  score: number;
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
  usedGameHints: GameHint[];
  roundGameHints: GameHint[];
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
  activateGameHint: (hint: GameHint) => boolean;
  submitGuess: (guess: string) => boolean;
  submitLocation: (
    coordinates: Coordinates,
    estimate: ReverseEstimate,
  ) => ReverseGuessResult | null;
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
  mode: "reverse" as GameMode,
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
  usedGameHints: [] as GameHint[],
  roundGameHints: [] as GameHint[],
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
function freshRoundState(
  difficulty: Difficulty,
): Pick<
  GameState,
  | "roundTimer"
  | "wrongGuesses"
  | "currentRoundScore"
  | "timeUsed"
  | "extraUsed"
  | "roundGameHints"
  | "revealedFigure"
> {
  return {
    roundTimer: getDifficultyRules(difficulty).roundSeconds,
    wrongGuesses: 0,
    currentRoundScore: 0,
    timeUsed: 0,
    extraUsed: 0,
    roundGameHints: [],
    revealedFigure: null,
  };
}

function currentFigure(state: GameState): Figure | null {
  return state.queue[state.roundIndex] ?? null;
}

// Timings are rounded to 0.1s BEFORE scoring so the score we show locally is
// reproducible from the values we submit — the server recomputes every round
// score from (wrongGuesses, timeUsed, extraUsed) and must land on the same
// number, or players would see their score silently change on the leaderboard.
function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

// Single entry point into the "revealed" state. Always writes the same set
// of fields explicitly so currentRoundScore, score, and streak can never
// be stale from the previous round.
function reveal(
  state: GameState,
  score: number,
  correct: boolean,
  reverseResult?: Pick<
    RoundResult,
    | "distanceKm"
    | "birthYearError"
    | "deathYearError"
    | "guessCoordinates"
    | "locationScore"
    | "speedScore"
  >,
): Partial<GameState> {
  const figure = currentFigure(state);
  if (!figure) {
    return { status: "ended" };
  }

  const isFirstGuess = state.mode !== "reverse" && correct && state.wrongGuesses === 0;
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
        figureId: figure.id,
        figureName: getFullName(figure),
        score,
        wrongGuesses: state.wrongGuesses,
        hintsUsed: state.roundGameHints.length,
        timeUsed: roundTenth(state.timeUsed + state.extraUsed),
        extraUsed: roundTenth(state.extraUsed),
        category: figure.category,
        continent: inferContinent(figure.coordinates_of_the_place_of_birth),
        correct,
        firstGuess: isFirstGuess,
        ...reverseResult,
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
      roundTimer: getDifficultyRules(difficulty).roundSeconds,
      extraBank: getDifficultyRules(difficulty).extraBankSeconds,
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
        ...freshRoundState(state.difficulty),
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
  activateGameHint: (hint) => {
    const state = get();
    const rules = getDifficultyRules(state.difficulty);
    if (
      state.status !== "playing" ||
      state.usedGameHints.includes(hint) ||
      state.usedGameHints.length >= rules.maxHints
    ) {
      return false;
    }

    set({
      usedGameHints: [...state.usedGameHints, hint],
      roundGameHints: [...state.roundGameHints, hint],
    });
    return true;
  },
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
        roundTenth(state.timeUsed),
        roundTenth(state.extraUsed),
        streak,
        getDifficultyRules(state.difficulty).roundSeconds,
      );
      set(reveal(state, roundScore, true));
      return true;
    }

    set((latest) => ({
      wrongGuesses: latest.wrongGuesses + 1,
      // Any wrong guess breaks the streak immediately; the round can
      // still be won, but the streak bonus is gone.
      firstGuessStreak: 0,
      vignetteKey: latest.vignetteKey + 1,
      inputShakeKey: latest.inputShakeKey + 1,
    }));
    return false;
  },
  submitLocation: (coordinates, estimate) => {
    const state = get();
    const figure = currentFigure(state);
    if (!figure || state.status !== "playing" || state.mode !== "reverse") {
      return null;
    }
    if (
      getDifficultyRules(state.difficulty).reverseDatesRequired &&
      (estimate.birthYear == null || estimate.deathYear == null)
    ) {
      return null;
    }
    const distance = distanceKm(coordinates, figure.coordinates_of_the_place_of_birth);
    const actualBirthYear = parseHistoricalYear(figure.birth_date);
    const actualDeathYear = parseHistoricalYear(figure.death_date);
    const birthYearError =
      actualBirthYear == null || estimate.birthYear == null
        ? null
        : Math.abs(estimate.birthYear - actualBirthYear);
    const deathYearError =
      actualDeathYear == null || estimate.deathYear == null
        ? null
        : Math.abs(estimate.deathYear - actualDeathYear);
    const breakdown = calcReverseScore(
      distance,
      roundTenth(state.timeUsed + state.extraUsed),
      getDifficultyRules(state.difficulty).roundSeconds,
    );
    // Reverse mode accepts the surrounding region, while distance still
    // determines how many location points the player earns.
    const correct = distance <= REVERSE_SCORING.correctRadiusKm;
    set(
      reveal(state, breakdown.total, correct, {
        distanceKm: distance,
        guessCoordinates: coordinates,
        birthYearError: birthYearError ?? undefined,
        deathYearError: deathYearError ?? undefined,
        locationScore: breakdown.location,
        speedScore: breakdown.speed,
      }),
    );
    return {
      distanceKm: distance,
      birthYearError,
      deathYearError,
      score: breakdown.total,
    };
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
        ...freshRoundState(state.difficulty),
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

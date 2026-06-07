import {
  BookOpenText,
  Brush,
  Compass,
  Crown,
  Dumbbell,
  FlaskConical,
  LetterText,
  LogOut,
  Music,
  Pause,
  PenTool,
  Play,
  ScrollText,
  Tag,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type CSSProperties,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { GAME_CONFIG } from "../config/gameConfig";
import { useCountUp } from "../hooks/useCountUp";
import { useSoundManager } from "../hooks/useSoundManager";
import { en } from "../i18n/en";
import {
  distanceKm,
  getLifeDateHints,
  getLifeDateRange,
  getFullName,
  getWikipediaUrl,
  normalizeName,
} from "../lib/figures";
import type { GameMapHandle, JourneyHints } from "../lib/mapEngine";
import { buildRoundRouteOverlays } from "../lib/routeOverlays";
import { type GameHint, useGameStore } from "../stores/useGameStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Figure } from "../types/figure";

type Props = {
  figures: Figure[];
};

type MapEngine = typeof import("../lib/mapEngine");

const CATEGORY_META: Record<string, { icon: LucideIcon; label: string }> = {
  Artist: { icon: Brush, label: "Artist" },
  Explorer: { icon: Compass, label: "Explorer" },
  Leader: { icon: Crown, label: "Leader" },
  Musician: { icon: Music, label: "Musician" },
  Philosopher: { icon: ScrollText, label: "Philosopher" },
  Scientist: { icon: FlaskConical, label: "Scientist" },
  Sportsman: { icon: Dumbbell, label: "Sportsman" },
  Writer: { icon: PenTool, label: "Writer" },
};

const GAME_HINTS: Array<{
  id: GameHint;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
}> = [
  { id: "initial", icon: LetterText, label: "Reveal surname initial", shortLabel: "Initial" },
  {
    id: "description",
    icon: BookOpenText,
    label: "Show person description",
    shortLabel: "Description",
  },
  { id: "category", icon: Tag, label: "Show person category", shortLabel: "Category" },
];

function toRoman(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remaining = value;
  let out = "";
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      out += numeral;
      remaining -= amount;
    }
  }
  return out;
}

function parseHistoricalYear(value: string): number | null {
  const century = value.match(/\b(\d+)(?:st|nd|rd|th)\s+century\s+BC\b/i);
  if (century) {
    return -(Number(century[1]) - 1) * 100 - 1;
  }

  const year = value.match(/\b\d{1,4}\b/);
  if (!year) {
    return null;
  }
  const numericYear = Number(year[0]);
  return /\bBC\b/i.test(value) ? -numericYear : numericYear;
}

function getCenturyLabel(figure: Figure): string {
  const year = parseHistoricalYear(figure.birth_date);
  if (year == null) {
    return "Century unknown";
  }
  const century = Math.floor((Math.abs(year) - 1) / 100) + 1;
  return year < 0 ? `${toRoman(century)} в. до н.э.` : `${toRoman(century)} в.`;
}

function TimerArc({ seconds }: { seconds: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, seconds / GAME_CONFIG.roundSeconds));
  const dashOffset = circumference * (1 - progress);
  const statusClass = seconds <= 5 ? "danger" : seconds <= 10 ? "warning" : "";

  return (
    <div
      className={`timer-arc ${statusClass}`}
      aria-label={`${Math.ceil(seconds)} seconds remaining`}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} className="timer-track" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          className="timer-progress"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="timer-value">
        <strong>{Math.ceil(seconds)}</strong>
        <span>sec</span>
      </span>
    </div>
  );
}

function PersonCard({
  figure,
  roundScore,
  onDismiss,
  cinematic,
  autoAdvance,
}: {
  figure: Figure;
  roundScore: number;
  onDismiss: () => void;
  cinematic: boolean;
  autoAdvance: boolean;
}) {
  const [remainingMs, setRemainingMs] = useState<number>(GAME_CONFIG.revealAutoDismissMs);
  const journey = distanceKm(
    figure.coordinates_of_the_place_of_birth,
    figure.coordinates_of_the_place_of_death,
  );
  const dates = getLifeDateRange(figure);

  useEffect(() => {
    if (!autoAdvance) {
      setRemainingMs(0);
      return;
    }
    const startedAt = performance.now();
    const timer = window.setTimeout(onDismiss, GAME_CONFIG.revealAutoDismissMs);
    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setRemainingMs(Math.max(0, GAME_CONFIG.revealAutoDismissMs - elapsed));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [autoAdvance, onDismiss]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <div
      className={cinematic ? "reveal-backdrop cinematic" : "reveal-backdrop"}
      onClick={onDismiss}
      role="presentation"
    >
      <article
        className={cinematic ? "person-card cinematic-card" : "person-card"}
        onClick={(event) => event.stopPropagation()}
      >
        {autoAdvance ? <div className="reveal-progress" aria-hidden="true" /> : null}
        <button
          className="icon-button close-button"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss card"
        >
          <X aria-hidden="true" size={18} />
        </button>
        <img src={figure.photo} alt={getFullName(figure)} loading="eager" />
        <div className="person-details">
          <p className="eyebrow">Round score +{roundScore.toLocaleString()}</p>
          <h2>{getFullName(figure)}</h2>
          <p className="date-line">{dates}</p>
          <div className="tag-row">
            <span>{figure.nationality}</span>
            <span>{figure.country_of_origin}</span>
          </div>
          <p className="description-label">{en.description}</p>
          <p>{figure.description}</p>
          <div className="distance-block">
            <span>{en.journeyDistance}</span>
            <strong>{journey.toLocaleString()} km</strong>
          </div>
          <div className="reveal-controls">
            <span>
              {autoAdvance ? `Next in ${Math.ceil(remainingMs / 1000)}s` : "Ready when you are"}
            </span>
            <button className="primary-button" type="button" onClick={onDismiss}>
              Next
            </button>
          </div>
          <a className="wiki-link" href={getWikipediaUrl(figure)} target="_blank" rel="noreferrer">
            {en.wikipedia}
          </a>
        </div>
      </article>
    </div>
  );
}

export default function GamePage({ figures }: Props) {
  const navigate = useNavigate();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapEngineRef = useRef<MapEngine | null>(null);
  const mapRef = useRef<GameMapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapBearing, setMapBearing] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const guessPanelRef = useRef<HTMLFormElement>(null);
  const wrongPlaceCounter = useRef(0);
  const [guess, setGuess] = useState("");
  const [debouncedGuess, setDebouncedGuess] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [guessPanelFocused, setGuessPanelFocused] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [guessPanelHeight, setGuessPanelHeight] = useState(0);
  const [isSmallViewport, setIsSmallViewport] = useState(false);
  const [showRevealCard, setShowRevealCard] = useState(false);
  const [revealFlightActive, setRevealFlightActive] = useState(false);
  const [wrongPlace, setWrongPlace] = useState<{
    key: number;
    name: string;
    place: string;
  } | null>(null);
  const basemap = useSettingsStore((state) => state.basemap);
  const showSuggestions = useSettingsStore((state) => state.showSuggestions);
  const autoAdvanceReveal = useSettingsStore((state) => state.autoAdvanceReveal);
  const reducedMotionSetting = useSettingsStore((state) => state.reducedMotion);
  const mapTextures = useSettingsStore((state) => state.mapTextures);
  const status = useGameStore((state) => state.status);
  const queue = useGameStore((state) => state.queue);
  const roundIndex = useGameStore((state) => state.roundIndex);
  const countdownText = useGameStore((state) => state.countdownText);
  const score = useGameStore((state) => state.score);
  const roundTimer = useGameStore((state) => state.roundTimer);
  const extraBank = useGameStore((state) => state.extraBank);
  const wrongGuesses = useGameStore((state) => state.wrongGuesses);
  const usedGameHints = useGameStore((state) => state.usedGameHints);
  const roundGameHints = useGameStore((state) => state.roundGameHints);
  const roundResults = useGameStore((state) => state.roundResults);
  const firstGuessStreak = useGameStore((state) => state.firstGuessStreak);
  // Derive streak visibility instead of reading a store flag. The previous
  // `showStreak` was only ever set DURING the reveal (when the HUD is
  // hidden) and wiped on dismiss, so the badge could never actually appear
  // to the player. Showing it whenever the player carries ≥2 in a row
  // means the badge is visible during the next round, which is when it's
  // meaningful.
  const showStreak = firstGuessStreak >= 2;
  const currentRoundScore = useGameStore((state) => state.currentRoundScore);
  const revealedFigure = useGameStore((state) => state.revealedFigure);
  const vignetteKey = useGameStore((state) => state.vignetteKey);
  const inputShakeKey = useGameStore((state) => state.inputShakeKey);
  const setCountdownText = useGameStore((state) => state.setCountdownText);
  const beginRound = useGameStore((state) => state.beginRound);
  const tick = useGameStore((state) => state.tick);
  const activateGameHint = useGameStore((state) => state.activateGameHint);
  const submitGuess = useGameStore((state) => state.submitGuess);
  const skipRound = useGameStore((state) => state.skipRound);
  const dismissReveal = useGameStore((state) => state.dismissReveal);
  const pause = useGameStore((state) => state.pause);
  const resume = useGameStore((state) => state.resume);
  const reset = useGameStore((state) => state.reset);
  const { play, crossfadeTo } = useSoundManager();
  const animatedScore = useCountUp(score);
  const currentFigure = queue[roundIndex] ?? null;
  const initialSource = currentFigure?.last_name.trim() || currentFigure?.first_name.trim() || "";
  const revealedInitial = initialSource.charAt(0).toLocaleUpperCase();
  const keyboardLayoutActive = guessPanelFocused && isSmallViewport && status === "playing";
  const revealResult = roundResults[roundResults.length - 1] ?? null;
  const revealWasCorrect = Boolean(
    revealedFigure && revealResult?.round === roundIndex + 1 && revealResult.correct,
  );
  const historyRoutes = useMemo(
    () => buildRoundRouteOverlays(roundResults, queue, { correctOnly: true, ghost: true }),
    [queue, roundResults],
  );
  const screenClassName = [
    "game-screen",
    `basemap-${basemap.toLowerCase().replace(/\s+/g, "-")}`,
    keyboardLayoutActive ? "keyboard-open" : "",
    revealFlightActive ? "reveal-flight" : "",
    mapTextures ? "" : "no-map-textures",
  ]
    .filter(Boolean)
    .join(" ");
  const screenStyle = {
    "--keyboard-inset": `${keyboardInset}px`,
    "--guess-panel-height": `${Math.ceil(guessPanelHeight)}px`,
  } as CSSProperties;

  const suggestions = useMemo(() => {
    const query = normalizeName(debouncedGuess);
    if (!query) {
      return [] as Figure[];
    }

    if (!showSuggestions) {
      return [] as Figure[];
    }
    return figures
      .filter((figure) => normalizeName(getFullName(figure)).includes(query))
      .slice(0, GAME_CONFIG.maxSuggestions);
  }, [debouncedGuess, figures, showSuggestions]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedGuess(guess), GAME_CONFIG.debounceMs);
    return () => window.clearTimeout(timer);
  }, [guess]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 759px)");
    const update = () => setIsSmallViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        setKeyboardInset(0);
        return;
      }
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(Math.round(inset));
    };

    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const panel = guessPanelRef.current;
    if (!panel) {
      return;
    }

    const update = () => setGuessPanelHeight(panel.getBoundingClientRect().height);
    update();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!wrongPlace) {
      return;
    }
    const timer = window.setTimeout(() => setWrongPlace(null), 2800);
    return () => window.clearTimeout(timer);
  }, [wrongPlace]);

  useEffect(() => {
    if (!currentFigure || status === "idle") {
      return;
    }
    const image = new Image();
    image.src = currentFigure.photo;
  }, [currentFigure, status]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;
    void import("../lib/mapEngine").then((engine) => {
      if (cancelled || !mapContainerRef.current) {
        return;
      }

      mapEngineRef.current = engine;
      mapRef.current = engine.createGameMap(mapContainerRef.current, basemap);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapEngineRef.current && mapRef.current) {
        mapEngineRef.current.removeGameMap(mapRef.current);
      }
      mapRef.current = null;
      mapEngineRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapEngineRef.current || !mapRef.current) {
      return;
    }
    mapEngineRef.current.setBasemap(mapRef.current, basemap);
  }, [basemap]);

  useEffect(() => {
    if (!mapEngineRef.current || !mapRef.current || !mapReady) {
      return;
    }
    mapEngineRef.current.renderRouteOverlay(mapRef.current, historyRoutes);
  }, [historyRoutes, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current.map;
    const updateBearing = () => setMapBearing(Number(map.getBearing().toFixed(1)));
    updateBearing();
    map.on("rotate", updateBearing);

    return () => {
      map.off("rotate", updateBearing);
    };
  }, [mapReady]);

  useEffect(() => {
    const engine = mapEngineRef.current;
    const map = mapRef.current;
    if (!engine || !map || !currentFigure || !mapReady) {
      return;
    }

    const lifeDates = getLifeDateHints(currentFigure);
    const hints: JourneyHints = {
      birth: {
        primary: wrongGuesses >= 1 ? lifeDates.birthDate : null,
        secondary: wrongGuesses >= 2 ? currentFigure.place_of_birth : null,
      },
      death: {
        primary: wrongGuesses >= 1 ? lifeDates.deathDate : null,
        secondary: wrongGuesses >= 2 ? currentFigure.place_of_death : null,
      },
    };

    const reducedMotion =
      reducedMotionSetting || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    engine.renderJourney(map, currentFigure, hints, {
      animateFit: !reducedMotion && (status === "countdown" || status === "playing"),
      reducedMotion,
      compact: isSmallViewport,
    });
  }, [currentFigure, isSmallViewport, mapReady, reducedMotionSetting, wrongGuesses, status]);

  useEffect(() => {
    if (!mapEngineRef.current || !mapRef.current) {
      return;
    }
    mapEngineRef.current.setMapLocked(
      mapRef.current,
      status === "countdown" || status === "paused" || status === "revealed",
    );
  }, [mapReady, status]);

  useEffect(() => {
    if (status !== "countdown") {
      return;
    }

    const sequence = ["3", "2", "1", "GO"];
    const timers = sequence.map((label, index) =>
      window.setTimeout(() => {
        setCountdownText(label);
        play("tick");
        if (label === "GO") {
          window.setTimeout(() => {
            beginRound();
            crossfadeTo("round-tension");
            if (!isSmallViewport) {
              inputRef.current?.focus();
            }
          }, 520);
        }
      }, index * GAME_CONFIG.countdownMs),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [beginRound, crossfadeTo, isSmallViewport, play, setCountdownText, status]);

  useEffect(() => {
    if (status !== "playing") {
      return;
    }
    const interval = window.setInterval(() => tick(0.25), 250);
    return () => window.clearInterval(interval);
  }, [status, tick]);

  useEffect(() => {
    if (status === "ended") {
      navigate("/end", { replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    if (status === "playing" && (!isSmallViewport || guessPanelFocused)) {
      // Refocus on round transition AND after wrong-guess shake. The input
      // uses `key={inputShakeKey}` to re-trigger the CSS shake animation,
      // which remounts the element and drops focus — so re-grab it.
      inputRef.current?.focus();
    }
  }, [guessPanelFocused, inputShakeKey, isSmallViewport, roundIndex, status]);

  useEffect(() => {
    if (status !== "playing") {
      setGuessPanelFocused(false);
    }
  }, [status]);

  useEffect(() => {
    if (!revealedFigure) {
      setShowRevealCard(false);
      setRevealFlightActive(false);
      return;
    }

    const reducedMotion =
      reducedMotionSetting || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cinematic = revealWasCorrect && !reducedMotion;
    if (mapEngineRef.current && mapRef.current) {
      mapEngineRef.current.focusJourney(mapRef.current, revealedFigure, {
        reducedMotion,
        compact: isSmallViewport,
      });
    }

    if (!cinematic) {
      setShowRevealCard(true);
      setRevealFlightActive(false);
      return;
    }

    setShowRevealCard(false);
    setRevealFlightActive(true);
    const timer = window.setTimeout(() => {
      setRevealFlightActive(false);
      setShowRevealCard(true);
    }, 620);
    return () => window.clearTimeout(timer);
  }, [isSmallViewport, reducedMotionSetting, revealWasCorrect, revealedFigure]);

  // Round transition: clear local UI state that's only meaningful within the
  // round just ended (the typed guess, the wrong-figure toast).
  useEffect(() => {
    setGuess("");
    setDebouncedGuess("");
    setActiveSuggestion(0);
    setWrongPlace(null);
  }, [roundIndex]);

  function submitValue(value: string) {
    if (!value.trim()) {
      return;
    }
    const guessedFigure = figures.find(
      (figure) => normalizeName(getFullName(figure)) === normalizeName(value),
    );
    const correct = submitGuess(value);
    setGuess("");
    setActiveSuggestion(0);
    if (correct) {
      inputRef.current?.blur();
      setGuessPanelFocused(false);
      play("correct");
      crossfadeTo("reveal-flourish");
      return;
    }
    if (guessedFigure) {
      // Monotonic counter — Date.now() can collide if the user submits
      // twice in the same millisecond, which prevents the toast's mount
      // animation from re-triggering on the second wrong guess.
      wrongPlaceCounter.current += 1;
      setWrongPlace({
        key: wrongPlaceCounter.current,
        name: getFullName(guessedFigure),
        place: guessedFigure.place_of_birth,
      });
    }
    play("wrong");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitValue(suggestions[activeSuggestion] ? getFullName(suggestions[activeSuggestion]) : guess);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((index) => Math.min(suggestions.length - 1, index + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((index) => Math.max(0, index - 1));
    }
  }

  function handleLeaveGame() {
    reset();
    navigate("/", { replace: true });
  }

  function handleResetCompass() {
    const map = mapRef.current?.map;
    if (!map) {
      return;
    }
    map.easeTo({ bearing: 0, pitch: 0, duration: 420, essential: true });
  }

  if (!currentFigure && status !== "ended") {
    return <Navigate to="/" replace />;
  }

  return (
    <main className={screenClassName} style={screenStyle}>
      <div ref={mapContainerRef} className="map-canvas" aria-label="World map" />
      <div className="map-vignette" aria-hidden="true" />
      {vignetteKey > 0 ? (
        <div key={vignetteKey} className="wrong-vignette" aria-hidden="true" />
      ) : null}
      <button
        className="custom-compass"
        type="button"
        onClick={handleResetCompass}
        aria-label={en.resetCompass}
        disabled={!mapReady}
        style={{ "--bearing": `${-mapBearing}deg` } as CSSProperties}
      >
        <span className="compass-rose" aria-hidden="true">
          <span className="compass-cardinal compass-n">N</span>
          <span className="compass-cardinal compass-e">E</span>
          <span className="compass-cardinal compass-s">S</span>
          <span className="compass-cardinal compass-w">W</span>
          <span className="compass-needle" />
        </span>
      </button>

      <section
        className={status === "revealed" ? "game-hud hidden" : "game-hud"}
        aria-label="Game controls"
      >
        <div className="hud-top">
          <button
            className="icon-button pause-button"
            type="button"
            onClick={status === "paused" ? resume : pause}
            aria-label={status === "paused" ? en.resume : en.pause}
          >
            {status === "paused" ? (
              <Play aria-hidden="true" size={20} />
            ) : (
              <Pause aria-hidden="true" size={20} />
            )}
          </button>
          <div className="round-pill">
            <span>
              {en.round} {Math.min(roundIndex + 1, GAME_CONFIG.roundCount)} of{" "}
              {GAME_CONFIG.roundCount}
            </span>
            <div className="round-dots" aria-hidden="true">
              {Array.from({ length: GAME_CONFIG.roundCount }).map((_, index) => (
                <span key={index} className={index <= roundIndex ? "active" : undefined} />
              ))}
            </div>
          </div>
          <div className="score-box">
            <span>{en.score}</span>
            <strong>{animatedScore.toLocaleString()}</strong>
          </div>
        </div>

        <div className="hud-middle">
          <TimerArc seconds={roundTimer} />
          {extraBank > 0 ? (
            <div className="extra-pill">
              <span>{en.extraBank}</span>
              <strong>{Math.ceil(extraBank)} sec</strong>
            </div>
          ) : null}
          {showStreak ? (
            <div className="streak-badge">
              <span>{en.streak}</span>
              <strong>{firstGuessStreak}</strong>
              <small>{en.inARow}</small>
            </div>
          ) : null}
        </div>

        <form
          ref={guessPanelRef}
          className="guess-panel"
          onSubmit={handleSubmit}
          onFocusCapture={() => setGuessPanelFocused(true)}
          onBlurCapture={() => {
            window.setTimeout(() => {
              setGuessPanelFocused(
                Boolean(guessPanelRef.current?.contains(document.activeElement)),
              );
            }, 0);
          }}
        >
          <div className="field-notes">
            <div className="field-notes-header">
              <span>Field notes</span>
              <small>{3 - usedGameHints.length} left this game</small>
            </div>
            <div className="game-hint-actions" aria-label="Game hints">
              {GAME_HINTS.map((hint) => {
                const Icon = hint.icon;
                const used = usedGameHints.includes(hint.id);
                const active = roundGameHints.includes(hint.id);
                return (
                  <button
                    key={hint.id}
                    className={`game-hint-button${active ? " active" : ""}`}
                    type="button"
                    onClick={() => activateGameHint(hint.id)}
                    disabled={status !== "playing" || used}
                    aria-label={`${hint.label}. ${used ? "Already used" : "Available once this game"}.`}
                    aria-pressed={active}
                  >
                    <Icon aria-hidden="true" size={17} />
                    <span>{hint.shortLabel}</span>
                    <small>{used ? (active ? "Revealed" : "Spent") : "1 use"}</small>
                  </button>
                );
              })}
            </div>
            {roundGameHints.length > 0 && currentFigure ? (
              <div className="field-note-reveals" aria-live="polite">
                {roundGameHints.includes("initial") ? (
                  <p>
                    <span>{currentFigure.last_name.trim() ? "Surname" : "Name"} starts with</span>
                    <strong className="initial-reveal">{revealedInitial}</strong>
                  </p>
                ) : null}
                {roundGameHints.includes("category") ? (
                  <p>
                    <span>Category</span>
                    <strong>{currentFigure.category}</strong>
                  </p>
                ) : null}
                {roundGameHints.includes("description") ? (
                  <p className="description-reveal">
                    <span>Description</span>
                    <strong>{currentFigure.description}</strong>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <label htmlFor="guess-input">{en.who}</label>
          {suggestions.length > 0 ? (
            <div className="suggestions" role="listbox">
              {suggestions.map((figure, index) => {
                const meta = CATEGORY_META[figure.category] ?? {
                  icon: ScrollText,
                  label: figure.category,
                };
                const Icon = meta.icon;
                return (
                  <button
                    key={getFullName(figure)}
                    type="button"
                    className={index === activeSuggestion ? "suggestion active" : "suggestion"}
                    onClick={() => submitValue(getFullName(figure))}
                    role="option"
                    aria-selected={index === activeSuggestion}
                  >
                    <span className="suggestion-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="suggestion-copy">
                      <strong>{getFullName(figure)}</strong>
                      <small>
                        {getCenturyLabel(figure)} · {meta.label}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <input
            key={inputShakeKey}
            ref={inputRef}
            id="guess-input"
            className={inputShakeKey > 0 ? "shake" : undefined}
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={en.guessLabel}
            placeholder={en.guessPlaceholder}
            autoComplete="off"
            disabled={status !== "playing"}
          />
          <div className="hint-live" aria-live="polite">
            {wrongGuesses === 1
              ? "Hint added: life dates are visible near the birth marker."
              : null}
            {wrongGuesses === 2 ? "Hint added: place names are visible near the markers." : null}
          </div>
        </form>
      </section>

      {wrongGuesses >= 3 && status === "playing" ? (
        <button className="skip-button" type="button" onClick={skipRound}>
          {en.skipRound}
        </button>
      ) : null}

      {wrongPlace ? (
        <div key={wrongPlace.key} className="wrong-place-card" role="status" aria-live="polite">
          <span>Wrong figure</span>
          <strong>{wrongPlace.name}</strong>
          <small>Born in {wrongPlace.place}</small>
        </div>
      ) : null}

      {status === "countdown" ? (
        <div className="countdown-overlay" aria-live="assertive">
          <strong>{countdownText}</strong>
        </div>
      ) : null}

      {status === "paused" ? (
        <div className="countdown-overlay paused-overlay" role="dialog" aria-label={en.pause}>
          <div className="pause-menu">
            <button className="primary-button" type="button" onClick={resume}>
              <Play aria-hidden="true" size={18} />
              {en.resume}
            </button>
            <button className="secondary-button" type="button" onClick={handleLeaveGame}>
              <LogOut aria-hidden="true" size={18} />
              {en.leaveGame}
            </button>
          </div>
        </div>
      ) : null}

      {revealedFigure && showRevealCard ? (
        <PersonCard
          figure={revealedFigure}
          roundScore={currentRoundScore}
          onDismiss={dismissReveal}
          cinematic={revealWasCorrect}
          autoAdvance={autoAdvanceReveal}
        />
      ) : null}
    </main>
  );
}

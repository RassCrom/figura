import { LogOut, Pause, Play, Plus, Minus } from "lucide-react";
import { FieldNotes } from "../components/game/FieldNotes";
import { PersonCard } from "../components/game/PersonCard";
import { ReversePanel } from "../components/game/ReversePanel";
import { SuggestionList } from "../components/game/SuggestionList";
import { TimerArc } from "../components/game/TimerArc";
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

import { GAME_CONFIG, getDifficultyRules, REVERSE_SCORING } from "../config/gameConfig";
import { useCountUp } from "../hooks/useCountUp";
import { useSoundManager } from "../hooks/useSoundManager";
import { en } from "../i18n/en";
import { getLifeDateHints, getFullName, normalizeName, resolveFigureGuess } from "../lib/figures";
import type { GameMapHandle, JourneyHints } from "../lib/mapEngine";
import { buildRoundRouteOverlays } from "../lib/routeOverlays";
import { useGameStore } from "../stores/useGameStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { FigureIndex } from "../types/figure";

type Props = {
  figureIndex: FigureIndex[];
};

type MapEngine = typeof import("../lib/mapEngine");

const DEFAULT_REVERSE_ESTIMATE = { birthYear: 1800, deathYear: 1900 };

export default function GamePage({ figureIndex }: Props) {
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
  const [birthYearEstimate, setBirthYearEstimate] = useState(DEFAULT_REVERSE_ESTIMATE.birthYear);
  const [deathYearEstimate, setDeathYearEstimate] = useState(DEFAULT_REVERSE_ESTIMATE.deathYear);
  const reverseEstimateRef = useRef(DEFAULT_REVERSE_ESTIMATE);
  const [wrongPlace, setWrongPlace] = useState<{
    key: number;
    name: string;
    place: string;
  } | null>(null);
  const basemap = useSettingsStore((state) => state.basemap);
  const initialBasemapRef = useRef(basemap);
  const showSuggestions = useSettingsStore((state) => state.showSuggestions);
  const autoAdvanceReveal = useSettingsStore((state) => state.autoAdvanceReveal);
  const reducedMotionSetting = useSettingsStore((state) => state.reducedMotion);
  const mapTextures = useSettingsStore((state) => state.mapTextures);
  const status = useGameStore((state) => state.status);
  const mode = useGameStore((state) => state.mode);
  const difficulty = useGameStore((state) => state.difficulty);
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
  const submitLocation = useGameStore((state) => state.submitLocation);
  const skipRound = useGameStore((state) => state.skipRound);
  const dismissReveal = useGameStore((state) => state.dismissReveal);
  const pause = useGameStore((state) => state.pause);
  const resume = useGameStore((state) => state.resume);
  const reset = useGameStore((state) => state.reset);
  const { play, crossfadeTo } = useSoundManager();
  const animatedScore = useCountUp(score);
  const currentFigure = queue[roundIndex] ?? null;
  const difficultyRules = getDifficultyRules(difficulty);
  const keyboardLayoutActive = guessPanelFocused && isSmallViewport && status === "playing";
  const revealResult = roundResults[roundResults.length - 1] ?? null;
  const revealWasCorrect = Boolean(
    revealedFigure && revealResult?.round === roundIndex + 1 && revealResult.correct,
  );
  const historyRoutes = useMemo(
    () =>
      mode === "reverse"
        ? []
        : buildRoundRouteOverlays(roundResults, queue, { correctOnly: true, ghost: true }),
    [mode, queue, roundResults],
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
      return [] as FigureIndex[];
    }

    if (!showSuggestions || !difficultyRules.suggestions || mode === "reverse") {
      return [] as FigureIndex[];
    }
    return figureIndex
      .filter((figure) =>
        [getFullName(figure), ...figure.aliases].some((name) =>
          normalizeName(name).includes(query),
        ),
      )
      .slice(0, GAME_CONFIG.maxSuggestions);
  }, [debouncedGuess, difficultyRules.suggestions, figureIndex, mode, showSuggestions]);

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
      mapRef.current = engine.createGameMap(mapContainerRef.current, initialBasemapRef.current);
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
    const handle = mapRef.current;
    if (!mapReady || !handle || mode !== "reverse") return;
    const map = handle.map;
    const onClick = (event: { lngLat: { lat: number; lng: number } }) => {
      if (status !== "playing") return;
      const result = submitLocation(
        [event.lngLat.lat, event.lngLat.lng],
        reverseEstimateRef.current,
      );
      if (result == null) return;
      play(result.distanceKm <= REVERSE_SCORING.correctRadiusKm ? "correct" : "wrong");
      crossfadeTo("reveal-flourish");
    };
    map.getCanvas().style.cursor = status === "playing" ? "crosshair" : "";
    map.on("click", onClick);
    return () => {
      map.getCanvas().style.cursor = "";
      map.off("click", onClick);
    };
  }, [crossfadeTo, mapReady, mode, play, status, submitLocation]);

  useEffect(() => {
    const engine = mapEngineRef.current;
    const map = mapRef.current;
    if (!engine || !map || !currentFigure || !mapReady) {
      return;
    }

    if (mode === "reverse" && status !== "revealed") {
      engine.clearJourney(map, false);
      if (status === "countdown") {
        map.map.easeTo({
          center: [45, 20],
          zoom: 1.3,
          bearing: 0,
          pitch: 0,
          duration: reducedMotionSetting ? 0 : 420,
          essential: true,
        });
      }
      return;
    }

    const lifeDates = getLifeDateHints(currentFigure);
    const revealReverse = mode === "reverse" && status === "revealed";
    const hints: JourneyHints = {
      birth: {
        primary: revealReverse
          ? currentFigure.place_of_birth
          : wrongGuesses >= 1
            ? lifeDates.birthDate
            : null,
        secondary: revealReverse
          ? lifeDates.birthDate
          : wrongGuesses >= 2
            ? currentFigure.place_of_birth
            : null,
      },
      death: {
        primary: revealReverse
          ? currentFigure.place_of_death
          : wrongGuesses >= 1
            ? lifeDates.deathDate
            : null,
        secondary: revealReverse
          ? lifeDates.deathDate
          : wrongGuesses >= 2
            ? currentFigure.place_of_death
            : null,
      },
    };

    const reducedMotion =
      reducedMotionSetting || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    engine.renderJourney(map, currentFigure, hints, {
      animateFit: !reducedMotion && (status === "countdown" || status === "playing"),
      reducedMotion,
      compact: isSmallViewport,
    });
  }, [currentFigure, isSmallViewport, mapReady, mode, reducedMotionSetting, wrongGuesses, status]);

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
    setBirthYearEstimate(DEFAULT_REVERSE_ESTIMATE.birthYear);
    setDeathYearEstimate(DEFAULT_REVERSE_ESTIMATE.deathYear);
    reverseEstimateRef.current = DEFAULT_REVERSE_ESTIMATE;
  }, [roundIndex]);

  function updateBirthYearEstimate(year: number) {
    const birthYear = Math.min(year, deathYearEstimate);
    setBirthYearEstimate(birthYear);
    reverseEstimateRef.current = { ...reverseEstimateRef.current, birthYear };
  }

  function updateDeathYearEstimate(year: number) {
    const deathYear = Math.max(year, birthYearEstimate);
    setDeathYearEstimate(deathYear);
    reverseEstimateRef.current = { ...reverseEstimateRef.current, deathYear };
  }

  function submitValue(value: string) {
    if (!value.trim()) {
      return;
    }
    const resolvedGuess = resolveFigureGuess(value, figureIndex);
    const guessedFigure = resolvedGuess
      ? queue.find((figure) => figure.id === resolvedGuess.id)
      : undefined;
    const correct = submitGuess(resolvedGuess ? getFullName(resolvedGuess) : value);
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
        name: getFullName(resolvedGuess ?? guessedFigure),
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

  function handleZoomIn() {
    mapRef.current?.map.zoomIn({ duration: 300 });
  }

  function handleZoomOut() {
    mapRef.current?.map.zoomOut({ duration: 300 });
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

      <div className="custom-zoom-controls">
        <button type="button" onClick={handleZoomIn} aria-label="Zoom in" disabled={!mapReady}>
          <Plus size={24} />
        </button>
        <button type="button" onClick={handleZoomOut} aria-label="Zoom out" disabled={!mapReady}>
          <Minus size={24} />
        </button>
      </div>

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
          <TimerArc seconds={roundTimer} maxSeconds={difficultyRules.roundSeconds} />
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
          className={mode === "reverse" ? "guess-panel reverse-mode" : "guess-panel"}
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
          {mode !== "reverse" ? (
            <FieldNotes
              figure={currentFigure}
              usedGameHints={usedGameHints}
              roundGameHints={roundGameHints}
              maxHints={difficultyRules.maxHints}
              playing={status === "playing"}
              onActivate={activateGameHint}
            />
          ) : null}
          <label htmlFor={mode === "reverse" ? undefined : "guess-input"}>
            {mode === "reverse" ? en.where : en.who}
          </label>
          {mode === "reverse" && currentFigure ? (
            <ReversePanel
              figure={currentFigure}
              birthYearEstimate={birthYearEstimate}
              deathYearEstimate={deathYearEstimate}
              playing={status === "playing"}
              onBirthYearChange={updateBirthYearEstimate}
              onDeathYearChange={updateDeathYearEstimate}
            />
          ) : null}
          <SuggestionList
            suggestions={suggestions}
            activeSuggestion={activeSuggestion}
            showMetadata={difficultyRules.suggestionMetadata}
            onPick={submitValue}
          />
          {mode !== "reverse" ? (
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
          ) : null}
          {mode !== "reverse" ? (
            <div className="hint-live" aria-live="polite">
              {wrongGuesses === 1
                ? "Hint added: life dates are visible near the birth marker."
                : null}
              {wrongGuesses === 2 ? "Hint added: place names are visible near the markers." : null}
            </div>
          ) : null}
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
          roundResult={revealResult}
        />
      ) : null}
    </main>
  );
}

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { LevelUpCelebration } from "../components/LevelUpCelebration";
import { TopNav } from "../components/TopNav";
import { useCountUp } from "../hooks/useCountUp";
import { en } from "../i18n/en";
import { getDayNumber } from "../lib/dailyChallenge";
import { getValidatedFigures } from "../lib/figures";
import { buildRoundRouteOverlays, getRoundRouteColor, getRoundRouteLabel } from "../lib/routeOverlays";
import { buildFigureQueue } from "../lib/session";
import { useGameStore } from "../stores/useGameStore";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Figure, RoundResult } from "../types/figure";
import type { GameMapHandle } from "../lib/mapEngine";
import type { ProfileAward } from "../lib/progression";

type MapEngine = typeof import("../lib/mapEngine");

function codeForResult(result: RoundResult): string {
  if (!result.correct) return "X";
  if (result.firstGuess) return "A";
  if (result.hintsUsed <= 1) return "B";
  return "C";
}

function buildShareText(dayNumber: number, score: number, results: RoundResult[]): string {
  const grid = results.map(codeForResult).join("");
  return `#GuessTheFigure - Day ${dayNumber}\n${score.toLocaleString()} pts - ${grid}`;
}

function rankName(score: number): string {
  if (score >= 27000) {
    return "Great Khan";
  }
  if (score >= 20000) {
    return "Khan";
  }
  if (score >= 12000) {
    return "Vizier";
  }
  if (score >= 5000) {
    return "Merchant";
  }
  return "Wanderer";
}

function SessionRoutesMap({ results, queue }: { results: RoundResult[]; queue: Figure[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapEngineRef = useRef<MapEngine | null>(null);
  const mapRef = useRef<GameMapHandle | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const routes = useMemo(() => buildRoundRouteOverlays(results, queue), [queue, results]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;
    void import("../lib/mapEngine").then((engine) => {
      if (cancelled || !containerRef.current) {
        return;
      }
      mapEngineRef.current = engine;
      mapRef.current = engine.createGameMap(containerRef.current, "Steppe");
      engine.setMapLocked(mapRef.current, true);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapEngineRef.current && mapRef.current) {
        mapEngineRef.current.removeGameMap(mapRef.current);
      }
      mapEngineRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapEngineRef.current || !mapRef.current) {
      return;
    }
    mapEngineRef.current.renderRouteOverlay(mapRef.current, routes, {
      fit: true,
      animateFit: true,
      animateRoutes: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      padding: 52,
      maxZoom: 3.7,
    });
  }, [mapReady, routes]);

  if (routes.length === 0) {
    return null;
  }

  return (
    <section className="route-atlas-section" aria-labelledby="route-atlas-title">
      <div className="route-atlas-header">
        <div>
          <p className="eyebrow">Route atlas</p>
          <h2 id="route-atlas-title">All 5 journeys</h2>
        </div>
        <span>{results.filter((result) => result.correct).length}/5 solved</span>
      </div>
      <div className="routes-map-frame basemap-steppe">
        <div ref={containerRef} className="routes-map" aria-label="Map of all route arcs" />
        <div className="routes-map-vignette" aria-hidden="true" />
      </div>
      <div className="route-legend" aria-label="Route result colors">
        {results.map((result) => (
          <span
            key={`${result.round}-${result.figureName}`}
            className="route-legend-item"
            style={{ "--route-color": getRoundRouteColor(result) } as CSSProperties}
          >
            <strong>{result.round}</strong>
            {getRoundRouteLabel(result)}
          </span>
        ))}
      </div>
    </section>
  );
}

export function EndPage() {
  const navigate = useNavigate();
  const status = useGameStore((state) => state.status);
  const sessionId = useGameStore((state) => state.sessionId);
  const score = useGameStore((state) => state.score);
  const nickname = useGameStore((state) => state.nickname);
  const difficulty = useGameStore((state) => state.difficulty);
  const categories = useGameStore((state) => state.categories);
  const queue = useGameStore((state) => state.queue);
  const results = useGameStore((state) => state.roundResults);
  const mode = useGameStore((state) => state.mode);
  const dailyDate = useGameStore((state) => state.dailyDate);
  const leaderboardSaved = useGameStore((state) => state.leaderboardSaved);
  const markLeaderboardSaved = useGameStore((state) => state.markLeaderboardSaved);
  const startSession = useGameStore((state) => state.startSession);
  const reset = useGameStore((state) => state.reset);
  const setToast = useGameStore((state) => state.setToast);
  const addEntry = useLeaderboardStore((state) => state.addEntry);
  const refreshLeaderboard = useLeaderboardStore((state) => state.refresh);
  const entries = useLeaderboardStore((state) => state.entries);
  const recordGame = useProfileStore((state) => state.recordGame);
  const lastAward = useProfileStore((state) => state.lastAward);
  const unlockedAchievements = useProfileStore((state) => state.unlockedAchievements);
  const animatedScore = useCountUp(score, 1200);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [runAward, setRunAward] = useState<ProfileAward | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const dismissLevelUp = useCallback(() => setShowLevelUp(false), []);
  const shareText = useMemo(
    () => (mode === "daily" && dailyDate ? buildShareText(getDayNumber(dailyDate), score, results) : ""),
    [dailyDate, mode, results, score],
  );
  const displayAward = runAward ?? lastAward;

  async function handleCopyShare() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  useEffect(() => {
    if (status !== "ended" || leaderboardSaved || !nickname) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const award = await recordGame(
        { sessionId, score, difficulty, results },
        categories,
        { mode, dailyDate: dailyDate ?? undefined },
      );
      if (cancelled) return;
      setRunAward(award);
      setShowLevelUp(award.leveledUp && !reducedMotion);
      const achievements = [...new Set([...unlockedAchievements, ...award.unlockedNow])];
      if (mode === "classic") {
        addEntry({ nickname, score, difficulty, categories, levelName: award.levelName, achievements });
      }
      markLeaderboardSaved();
      void refreshLeaderboard(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    addEntry,
    categories,
    dailyDate,
    difficulty,
    leaderboardSaved,
    markLeaderboardSaved,
    mode,
    nickname,
    recordGame,
    refreshLeaderboard,
    results,
    score,
    sessionId,
    status,
    unlockedAchievements,
    reducedMotion,
  ]);

  if (status !== "ended" && results.length === 0) {
    return <Navigate to="/" replace />;
  }

  function handlePlayAgain() {
    const { queue } = buildFigureQueue(getValidatedFigures(), difficulty, categories);
    if (queue.length === 0) {
      setToast("No figures match the selected filters. Try adjusting your settings.");
      return;
    }
    startSession({ nickname, difficulty, categories, queue });
    navigate("/game");
  }

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel end-panel" aria-labelledby="end-title">
        <p className="eyebrow">
          {mode === "daily" && dailyDate ? `Daily - Day ${getDayNumber(dailyDate)}` : "Final Score"}
        </p>
        <h1 id="end-title">{animatedScore.toLocaleString()}</h1>
        <p className="rank-badge">{rankName(score)}</p>
        {displayAward ? (
          <div className="run-delta">
            <span>Your best: {displayAward.previousBest.toLocaleString()}</span>
            <span>This run: {score.toLocaleString()}</span>
            <strong>
              {displayAward.bestDelta >= 0 ? "+" : ""}
              {displayAward.bestDelta.toLocaleString()}
            </strong>
          </div>
        ) : null}
        {displayAward ? (
          <div className="profile-award">
            <LevelBadge level={displayAward.levelName} />
            <span>+{displayAward.xpAwarded.toLocaleString()} XP</span>
          </div>
        ) : null}
        {displayAward?.unlockedNow.length ? (
          <section className="achievement-section" aria-labelledby="new-achievements-title">
            <h2 id="new-achievements-title">Unlocked Achievements</h2>
            <div className="achievement-grid">
              {displayAward.unlockedNow.map((id) => (
                <AchievementBadge key={id} id={id} />
              ))}
            </div>
          </section>
        ) : unlockedAchievements.length ? (
          <section className="achievement-section" aria-labelledby="achievements-title">
            <h2 id="achievements-title">Achievements</h2>
            <div className="achievement-grid">
              {unlockedAchievements.map((id) => (
                <AchievementBadge key={id} id={id} />
              ))}
            </div>
          </section>
        ) : null}
        <SessionRoutesMap results={results} queue={queue} />
        {mode === "daily" && dailyDate ? (
          <section className="share-card" aria-labelledby="share-title">
            <h2 id="share-title" className="visually-hidden">
              Share today's run
            </h2>
            <pre className="share-card-text">{shareText}</pre>
            <button className="primary-button" type="button" onClick={handleCopyShare}>
              {copyState === "copied"
                ? "Copied!"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy share text"}
            </button>
          </section>
        ) : null}
        <div className="round-breakdown">
          {results.map((result) => (
            <article key={`${result.round}-${result.figureName}`}>
              <span>
                {en.round} {result.round}
              </span>
              <strong>{result.figureName}</strong>
              <small>
                {result.score.toLocaleString()} pts, {result.hintsUsed} hints, {result.timeUsed}s
              </small>
            </article>
          ))}
        </div>
        {mode === "classic" ? (
          <>
            <h2>{en.leaderboard}</h2>
            <LeaderboardTable entries={entries} full />
          </>
        ) : null}
        <div className="action-row">
          {mode === "classic" ? (
            <>
              <button className="primary-button" type="button" onClick={handlePlayAgain}>
                {en.playAgain}
              </button>
              <Link className="secondary-button" to="/settings">
                {en.changeSettings}
              </Link>
            </>
          ) : (
            <Link className="primary-button" to="/figure/today" onClick={reset}>
              Read about today's figure
            </Link>
          )}
          <Link className="secondary-button" to="/" onClick={reset}>
            {en.home}
          </Link>
        </div>
      </section>
      {showLevelUp && runAward?.leveledUp ? (
        <LevelUpCelebration level={runAward.levelName} onDismiss={dismissLevelUp} />
      ) : null}
    </main>
  );
}

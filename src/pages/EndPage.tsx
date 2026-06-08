import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Twitter, Linkedin, Image as ImageIcon, Loader2, Copy, Check, AlertCircle, Download, Globe2, Trophy, CheckCircle2, XCircle } from "lucide-react";
import { toPng } from "html-to-image";

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

/** Plain-text symbol for clipboard / social text posts */
function symbolForResult(result: RoundResult): string {
  if (!result.correct) return "✗";
  if (result.firstGuess) return "★";
  return "✓";
}

function buildShareText(mode: string, dayNumber: number | null, score: number, rank: string, results: RoundResult[]): string {
  const grid = results.map(symbolForResult).join(" ");
  const url = window.location.origin;
  if (mode === "daily" && dayNumber) {
    return `Guess The Figure – Day ${dayNumber}\n${grid}\n${score.toLocaleString()} pts · ${rank}\n${url}`;
  }
  return `Guess The Figure\n${grid}\n${score.toLocaleString()} pts · ${rank}\n${url}`;
}

/** Icon color + component for a round result cell in the share image card */
function ResultIcon({ result }: { result: RoundResult }) {
  if (!result.correct) {
    return <XCircle size={22} color="#e05555" strokeWidth={1.8} />;
  }
  if (result.firstGuess) {
    return <CheckCircle2 size={22} color="#efc75a" strokeWidth={1.8} />;
  }
  return <CheckCircle2 size={22} color="#5ec97a" strokeWidth={1.8} />;
}

/** A clean card rendered off-screen and captured as a PNG for sharing */
function ShareImageCard({
  mode,
  dayNumber,
  score,
  rank,
  results,
}: {
  mode: string;
  dayNumber: number | null;
  score: number;
  rank: string;
  results: RoundResult[];
}) {
  return (
    <div
      style={{
        width: 480,
        background: "linear-gradient(160deg, #120f08 0%, #1c1610 60%, #0e0b06 100%)",
        borderRadius: 20,
        padding: "36px 40px 32px",
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
        color: "#e8dfc8",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Globe2 size={22} color="#c8962a" strokeWidth={1.6} />
        <span style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#c8962a" }}>
          Guess The Figure
        </span>
      </div>
      {/* Day tag */}
      {mode === "daily" && dayNumber ? (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9a8a6a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Daily Challenge · Day {dayNumber}
        </p>
      ) : null}
      {/* Score row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 4 }}>
        <Trophy size={28} color="#efc75a" strokeWidth={1.6} />
        <p style={{ margin: 0, fontSize: 48, fontWeight: 800, lineHeight: 1, color: "#efc75a", fontVariantNumeric: "tabular-nums" }}>
          {score.toLocaleString()}
        </p>
      </div>
      <p style={{ margin: "0 0 22px", fontSize: 13, color: "#9a8a6a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {rank}
      </p>
      {/* Round grid */}
      <div style={{ display: "flex", gap: 8 }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: r.correct
                ? (r.firstGuess ? "rgba(239,199,90,0.12)" : "rgba(60,180,80,0.14)")
                : "rgba(220,60,60,0.14)",
              border: `1px solid ${r.correct ? (r.firstGuess ? "rgba(239,199,90,0.4)" : "rgba(60,180,80,0.4)") : "rgba(220,60,60,0.4)"}`,
              borderRadius: 10,
              padding: "10px 4px 8px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ResultIcon result={r} />
            <div style={{ fontSize: 10, color: "#9a8a6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>R{r.round}</div>
          </div>
        ))}
      </div>
      {/* Footer */}
      <p style={{ margin: "20px 0 0", fontSize: 11, color: "rgba(154,138,106,0.6)", textAlign: "center", letterSpacing: "0.04em" }}>
        {window.location.host}
      </p>
    </div>
  );
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
  const resultRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [runAward, setRunAward] = useState<ProfileAward | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const dismissLevelUp = useCallback(() => setShowLevelUp(false), []);
  const rank = rankName(score);
  const dayNumber = dailyDate ? getDayNumber(dailyDate) : null;
  const shareText = useMemo(
    () => buildShareText(mode, dayNumber, score, rank, results),
    [dayNumber, mode, results, score, rank],
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

  async function captureShareImage(): Promise<{ dataUrl: string; file: File } | null> {
    if (!shareCardRef.current || isGeneratingImage) return null;
    setIsGeneratingImage(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "guess-the-figure-result.png", { type: blob.type });
      return { dataUrl, file };
    } catch (err) {
      console.error("Failed to generate image", err);
      setToast("Could not generate image. Please try again.");
      return null;
    } finally {
      setIsGeneratingImage(false);
    }
  }

  /** Download image (desktop fallback / explicit download) */
  async function handleDownloadImage() {
    const result = await captureShareImage();
    if (!result) return;
    const link = document.createElement("a");
    link.download = "guess-the-figure-result.png";
    link.href = result.dataUrl;
    link.click();
  }

  /** Share via native share sheet — covers Instagram, Threads, WhatsApp, etc. on mobile */
  async function handleNativeShare() {
    const result = await captureShareImage();
    if (!result) return;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [result.file] })) {
      try {
        await navigator.share({ title: "Guess The Figure", text: shareText, files: [result.file] });
      } catch (err) {
        // User cancelled — not an error
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed", err);
        }
      }
    } else {
      // No native share — fall back to download
      const link = document.createElement("a");
      link.download = "guess-the-figure-result.png";
      link.href = result.dataUrl;
      link.click();
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

  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(shareText)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin)}`;

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <main className="page-shell">
      <TopNav />

      {/* Off-screen share image card — captured by html-to-image, never seen by user */}
      <div
        style={{
          position: "fixed",
          left: "-9999px",
          top: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden="true"
      >
        <div ref={shareCardRef}>
          <ShareImageCard mode={mode} dayNumber={dayNumber} score={score} rank={rank} results={results} />
        </div>
      </div>

      <section className="content-panel end-panel" aria-labelledby="end-title">
      <div ref={resultRef} className="result-preview-wrapper">
        <p className="eyebrow">
          {mode === "daily" && dailyDate ? `Daily - Day ${getDayNumber(dailyDate)}` : "Final Score"}
        </p>
        <h1 id="end-title">{animatedScore.toLocaleString()}</h1>
        <p className="rank-badge">{rank}</p>
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
      </div>
        <section className="share-card" aria-labelledby="share-title">
          <h2 id="share-title" className="visually-hidden">
            Share your run
          </h2>
          <pre className="share-card-text">{shareText}</pre>
          <div className="share-actions">
            {/* Copy text */}
            <button
              className="share-btn share-btn--copy"
              type="button"
              onClick={handleCopyShare}
              aria-label="Copy share text"
            >
              {copyState === "copied" ? (
                <><Check size={16} /> Copied!</>
              ) : copyState === "error" ? (
                <><AlertCircle size={16} /> Failed</>
              ) : (
                <><Copy size={16} /> Copy</>)}
            </button>

            {/* Download image */}
            <button
              className="share-btn share-btn--image"
              type="button"
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              aria-label="Download result image"
            >
              {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Save Image
            </button>

            {/* Native share (Instagram, Threads, WhatsApp on mobile) */}
            {canNativeShare && (
              <button
                className="share-btn share-btn--native"
                type="button"
                onClick={handleNativeShare}
                disabled={isGeneratingImage}
                aria-label="Share via apps (Instagram, Threads, WhatsApp…)"
              >
                {isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                Share via Apps
              </button>
            )}

            {/* X / Twitter */}
            <a
              className="share-btn share-btn--twitter"
              href={twitterUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Share to X (Twitter)"
            >
              <Twitter size={16} />
              X / Twitter
            </a>

            {/* Threads */}
            <a
              className="share-btn share-btn--threads"
              href={threadsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Share to Threads"
            >
              {/* Threads logo as inline SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.186v-.002C1.5 5.476 5.476 1.5 12.186 1.5c3.389 0 6.186 1.187 8.303 3.435 1.88 2.001 2.961 4.718 3.028 7.666l.003.161v.186c-.016 1.993-.654 3.614-1.9 4.82-1.007.977-2.363 1.512-3.826 1.512-.089 0-.177-.002-.266-.005-1.07-.049-1.982-.41-2.647-1.044-.694.673-1.634 1.044-2.709 1.044h-.003zm-2.47-8.123c.485.538 1.182.84 2.016.84.865 0 1.598-.322 2.086-.908.498-.6.739-1.456.739-2.618 0-1.218-.285-2.113-.848-2.658-.543-.526-1.325-.793-2.326-.793-1.058 0-1.894.355-2.484 1.056-.577.687-.87 1.681-.87 2.954 0 1.217.25 2.14.742 2.742-.001 0 .945 1.385.945 1.385zm1.909-5.45c.671 0 1.21.173 1.601.515.395.344.59.841.59 1.479 0 .704-.198 1.237-.589 1.583-.38.336-.902.507-1.553.507-.606 0-1.113-.176-1.507-.524-.402-.354-.605-.874-.605-1.546 0-.691.199-1.22.592-1.567.387-.341.896-.447 1.471-.447z"/>
              </svg>
              Threads
            </a>

            {/* LinkedIn */}
            <a
              className="share-btn share-btn--linkedin"
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Share to LinkedIn"
            >
              <Linkedin size={16} />
              LinkedIn
            </a>
          </div>
        </section>
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

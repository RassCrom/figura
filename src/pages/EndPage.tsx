import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Twitter,
  Linkedin,
  Image as ImageIcon,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Download,
} from "lucide-react";
import { toPng } from "html-to-image";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { LevelUpCelebration } from "../components/LevelUpCelebration";
import { TopNav } from "../components/TopNav";
import { ShareImageCard } from "../components/end/ShareImageCard";
import { SessionRoutesMap } from "../components/end/SessionRoutesMap";
import { useCountUp } from "../hooks/useCountUp";
import { en } from "../i18n/en";
import { getDayNumber } from "../lib/dailyChallenge";
import { fetchDailyPercentile } from "../lib/api";
import { getValidatedFigureIndex, loadFigureRecords } from "../lib/figures";
import { getRecentFigureIds, recordRecentFigures } from "../lib/recentFigures";
import { buildFigureQueue } from "../lib/session";
import { useGameStore } from "../stores/useGameStore";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { RoundResult } from "../types/figure";
import type { ProfileAward } from "../lib/progression";

/** Plain-text symbol for clipboard / social text posts */
function symbolForResult(result: RoundResult): string {
  if (!result.correct) return "✗";
  if (result.firstGuess) return "★";
  return "✓";
}

function buildShareText(
  mode: string,
  dayNumber: number | null,
  score: number,
  rank: string,
  results: RoundResult[],
): string {
  const grid = results.map(symbolForResult).join(" ");
  const url = mode === "daily" ? `${window.location.origin}/daily` : window.location.origin;
  if (mode === "daily" && dayNumber) {
    return `Guess The Figure – Day ${dayNumber}\n${grid}\n${score.toLocaleString()} pts · ${rank}\n${url}`;
  }
  return `Guess The Figure\n${grid}\n${score.toLocaleString()} pts · ${rank}\n${url}`;
}


function syncErrorMessage(code: string): string {
  switch (code) {
    case "DAILY_ALREADY_PLAYED":
      return "You already submitted today's challenge — this score was not synced.";
    case "RATE_LIMIT":
      return "Too many runs in a row — this score was not saved to the leaderboard.";
    default:
      return "This score could not be saved online. Your local progress is kept.";
  }
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
  const [dailyPercentile, setDailyPercentile] = useState<number | null>(null);
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
      // skipFonts avoids a SecurityError when html-to-image tries to read
      // cssRules from the cross-origin Google Fonts stylesheet. The share
      // card uses system serif/display fallbacks that render fine without
      // embedded web fonts.
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: true,
      });
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
      const award = await recordGame({ sessionId, score, difficulty, results }, categories, {
        mode,
        dailyDate: dailyDate ?? undefined,
      });
      if (cancelled) return;
      if (mode === "daily" && dailyDate) {
        setDailyPercentile(await fetchDailyPercentile(dailyDate, score));
      }
      setRunAward(award);
      setShowLevelUp(award.leveledUp && !reducedMotion);
      const achievements = [...new Set([...unlockedAchievements, ...award.unlockedNow])];
      if (mode === "classic") {
        addEntry({
          nickname,
          score,
          difficulty,
          categories,
          levelName: award.levelName,
          achievements,
        });
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

  async function handlePlayAgain() {
    const { queue: queueIndex } = buildFigureQueue(
      getValidatedFigureIndex(),
      difficulty,
      categories,
      getRecentFigureIds(),
    );
    if (queueIndex.length === 0) {
      setToast("No figures match the selected filters. Try adjusting your settings.");
      return;
    }
    recordRecentFigures(queueIndex.map((figure) => figure.id));
    const nextQueue = await loadFigureRecords(queueIndex);
    startSession({ nickname, difficulty, categories, queue: nextQueue, mode });
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
          <ShareImageCard
            mode={mode}
            dayNumber={dayNumber}
            score={score}
            rank={rank}
            results={results}
          />
        </div>
      </div>

      <section className="content-panel end-panel" aria-labelledby="end-title">
        <div ref={resultRef} className="result-preview-wrapper">
          <p className="eyebrow">
            {mode === "daily" && dailyDate
              ? `Daily - Day ${getDayNumber(dailyDate)}`
              : "Final Score"}
          </p>
          <h1 id="end-title">{animatedScore.toLocaleString()}</h1>
          <p className="rank-badge">{rank}</p>
          {mode === "daily" && dailyPercentile != null ? (
            <p className="daily-percentile">You beat {dailyPercentile}% of today's players</p>
          ) : null}
          {displayAward?.syncError ? (
            <p className="sync-warning" role="status">
              {syncErrorMessage(displayAward.syncError)}
            </p>
          ) : null}
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
                <>
                  <Check size={16} /> Copied!
                </>
              ) : copyState === "error" ? (
                <>
                  <AlertCircle size={16} /> Failed
                </>
              ) : (
                <>
                  <Copy size={16} /> Copy
                </>
              )}
            </button>

            {/* Download image */}
            <button
              className="share-btn share-btn--image"
              type="button"
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              aria-label="Download result image"
            >
              {isGeneratingImage ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
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
                {isGeneratingImage ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ImageIcon size={16} />
                )}
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
              <Twitter size={16} />X / Twitter
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
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.186v-.002C1.5 5.476 5.476 1.5 12.186 1.5c3.389 0 6.186 1.187 8.303 3.435 1.88 2.001 2.961 4.718 3.028 7.666l.003.161v.186c-.016 1.993-.654 3.614-1.9 4.82-1.007.977-2.363 1.512-3.826 1.512-.089 0-.177-.002-.266-.005-1.07-.049-1.982-.41-2.647-1.044-.694.673-1.634 1.044-2.709 1.044h-.003zm-2.47-8.123c.485.538 1.182.84 2.016.84.865 0 1.598-.322 2.086-.908.498-.6.739-1.456.739-2.618 0-1.218-.285-2.113-.848-2.658-.543-.526-1.325-.793-2.326-.793-1.058 0-1.894.355-2.484 1.056-.577.687-.87 1.681-.87 2.954 0 1.217.25 2.14.742 2.742-.001 0 .945 1.385.945 1.385zm1.909-5.45c.671 0 1.21.173 1.601.515.395.344.59.841.59 1.479 0 .704-.198 1.237-.589 1.583-.38.336-.902.507-1.553.507-.606 0-1.113-.176-1.507-.524-.402-.354-.605-.874-.605-1.546 0-.691.199-1.22.592-1.567.387-.341.896-.447 1.471-.447z" />
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
                {result.distanceKm != null
                  ? `${result.score.toLocaleString()} pts, ${result.distanceKm.toLocaleString()} km away, ${result.birthYearError ?? "-"}y / ${result.deathYearError ?? "-"}y off`
                  : `${result.score.toLocaleString()} pts, ${result.wrongGuesses ?? 0} wrong, ${result.hintsUsed} hints, ${Math.round(result.timeUsed)}s`}
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
            <>
              <Link className="primary-button" to="/daily" onClick={reset}>
                Daily · Day {dayNumber}
              </Link>
              <Link className="secondary-button" to="/figure/today" onClick={reset}>
                Read about today's figure
              </Link>
            </>
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

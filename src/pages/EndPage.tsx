import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toPng } from "html-to-image";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { LevelUpCelebration } from "../components/LevelUpCelebration";
import { TopNav } from "../components/TopNav";
import { ShareImageCard } from "../components/end/ShareImageCard";
import { SharePanel } from "../components/end/SharePanel";
import { SessionRoutesMap } from "../components/end/SessionRoutesMap";
import { useCountUp } from "../hooks/useCountUp";
import { en } from "../i18n/en";
import { getDayNumber } from "../lib/dailyChallenge";
import { fetchDailyPercentile } from "../lib/api";
import { getValidatedFigureIndex, hasDeathDate, loadFigureRecords } from "../lib/figures";
import { getRecentFigureIds, recordRecentFigures } from "../lib/recentFigures";
import { buildFigureQueue } from "../lib/session";
import {
  buildChallengeUrl,
  buildShareText,
  buildSocialShareUrls,
  getRunStats,
  type RunShareDetails,
} from "../lib/sharing";
import { useGameStore } from "../stores/useGameStore";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { ProfileAward } from "../lib/progression";

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
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [runAward, setRunAward] = useState<ProfileAward | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [dailyPercentile, setDailyPercentile] = useState<number | null>(null);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const dismissLevelUp = useCallback(() => setShowLevelUp(false), []);
  const rank = rankName(score);
  const dayNumber = dailyDate ? getDayNumber(dailyDate) : null;
  const shareDetails = useMemo<RunShareDetails>(
    () => ({
      origin: window.location.origin,
      mode,
      difficulty,
      dayNumber,
      score,
      rank,
      results,
    }),
    [dayNumber, difficulty, mode, rank, results, score],
  );
  const shareText = useMemo(() => buildShareText(shareDetails), [shareDetails]);
  const shareUrl = useMemo(() => buildChallengeUrl(shareDetails), [shareDetails]);
  const socialUrls = useMemo(() => buildSocialShareUrls(shareDetails), [shareDetails]);
  const runStats = useMemo(() => getRunStats(results), [results]);
  const displayAward = runAward ?? lastAward;
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

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

  async function handleChallengeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "FIGURA", text: shareText });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    }
    await handleCopyShare();
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

  if (!isRestarting && status !== "ended" && results.length === 0) {
    return <Navigate to="/" replace />;
  }

  async function handlePlayAgain() {
    setIsRestarting(true);
    const figureIndex = getValidatedFigureIndex();
    const playableFigures =
      mode === "reverse" ? figureIndex.filter((figure) => hasDeathDate(figure)) : figureIndex;
    const { queue: queueIndex, relaxed } = buildFigureQueue(
      playableFigures,
      difficulty,
      categories,
      getRecentFigureIds(),
    );
    if (queueIndex.length === 0) {
      setIsRestarting(false);
      setToast("No figures match the selected filters. Try adjusting your settings.");
      return;
    }
    recordRecentFigures(queueIndex.map((figure) => figure.id));
    if (relaxed) {
      setToast("The pool was under five figures, so filters were relaxed for this session.");
      window.setTimeout(() => setToast(null), 4200);
    }
    try {
      const nextQueue = await loadFigureRecords(queueIndex);
      startSession({ nickname, difficulty, categories, queue: nextQueue, mode });
      navigate("/game");
    } catch (error) {
      console.error("Failed to start a new run", error);
      setIsRestarting(false);
      setToast("Could not start a new run. Please try again.");
    }
  }

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
            shareUrl={shareUrl}
          />
        </div>
      </div>

      <section className="content-panel end-panel" aria-labelledby="end-title">
        <header className="result-hero">
          <p className="eyebrow">
            {mode === "daily" && dailyDate
              ? `Daily · Day ${getDayNumber(dailyDate)}`
              : "Journey complete"}
          </p>
          <div className="result-score-lockup">
            <div>
              <span>Final score</span>
              <h1 id="end-title">{animatedScore.toLocaleString()}</h1>
            </div>
            <p className="rank-badge">{rank}</p>
          </div>
          <p className="result-verdict">
            {runStats.solved === runStats.total
              ? "Every trail found. Your map is ready to challenge the next traveler."
              : `${runStats.solved} of ${runStats.total} trails found. Share the route, then return for a rematch.`}
          </p>
          <dl className="result-stat-grid" aria-label="Run summary">
            <div>
              <dt>Solved</dt>
              <dd>
                {runStats.solved}/{runStats.total}
              </dd>
            </div>
            <div>
              <dt>First try</dt>
              <dd>{runStats.firstTry}</dd>
            </div>
            <div>
              <dt>Best round</dt>
              <dd>{runStats.bestRoundScore.toLocaleString()}</dd>
            </div>
          </dl>
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
        </header>

        <SharePanel
          shareText={shareText}
          socialUrls={socialUrls}
          canNativeShare={canNativeShare}
          copyState={copyState}
          isGeneratingImage={isGeneratingImage}
          onChallengeShare={handleChallengeShare}
          onCopy={handleCopyShare}
          onDownloadImage={handleDownloadImage}
          onShareImage={handleNativeShare}
        />

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

        <SessionRoutesMap results={results} queue={queue} mode={mode} />

        <section className="round-results-section" aria-labelledby="round-results-title">
          <div className="section-heading">
            <p className="eyebrow">Field notes</p>
            <h2 id="round-results-title">Round by round</h2>
          </div>
          <div className="round-breakdown">
            {results.map((result) => (
              <article
                key={`${result.round}-${result.figureName}`}
                className={result.correct ? "is-solved" : "is-missed"}
              >
                <span>
                  {en.round} {result.round}
                </span>
                <strong>{result.figureName}</strong>
                <small>
                  {result.distanceKm != null
                    ? `${result.score.toLocaleString()} pts, ${result.distanceKm.toLocaleString()} km away${
                        result.birthYearError != null || result.deathYearError != null
                          ? `, ${result.birthYearError ?? "-"}y / ${result.deathYearError ?? "-"}y off`
                          : ""
                      }`
                    : `${result.score.toLocaleString()} pts, ${result.wrongGuesses ?? 0} wrong, ${result.hintsUsed} hints, ${Math.round(result.timeUsed)}s`}
                </small>
              </article>
            ))}
          </div>
        </section>
        {mode === "classic" ? (
          <>
            <h2>{en.leaderboard}</h2>
            <LeaderboardTable entries={entries} full />
          </>
        ) : null}
        <div className="action-row">
          {mode === "daily" ? (
            <>
              <Link className="primary-button" to="/daily" onClick={reset}>
                Daily · Day {dayNumber}
              </Link>
              <Link className="secondary-button" to="/figure/today" onClick={reset}>
                Read about today's figure
              </Link>
            </>
          ) : (
            <>
              <button
                className="primary-button"
                type="button"
                onClick={handlePlayAgain}
                disabled={isRestarting}
              >
                {en.playAgain}
              </button>
              <Link className="secondary-button" to="/settings">
                {en.changeSettings}
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

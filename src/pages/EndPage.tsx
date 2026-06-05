import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { TopNav } from "../components/TopNav";
import { useCountUp } from "../hooks/useCountUp";
import { en } from "../i18n/en";
import { getDayNumber } from "../lib/dailyChallenge";
import { getValidatedFigures } from "../lib/figures";
import { buildFigureQueue } from "../lib/session";
import { useGameStore } from "../stores/useGameStore";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import { useProfileStore } from "../stores/useProfileStore";
import type { RoundResult } from "../types/figure";

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

export function EndPage() {
  const navigate = useNavigate();
  const status = useGameStore((state) => state.status);
  const sessionId = useGameStore((state) => state.sessionId);
  const score = useGameStore((state) => state.score);
  const nickname = useGameStore((state) => state.nickname);
  const difficulty = useGameStore((state) => state.difficulty);
  const categories = useGameStore((state) => state.categories);
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
  const shareText = useMemo(
    () => (mode === "daily" && dailyDate ? buildShareText(getDayNumber(dailyDate), score, results) : ""),
    [dailyDate, mode, results, score],
  );

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
        {lastAward ? (
          <div className="run-delta">
            <span>Your best: {lastAward.previousBest.toLocaleString()}</span>
            <span>This run: {score.toLocaleString()}</span>
            <strong>
              {lastAward.bestDelta >= 0 ? "+" : ""}
              {lastAward.bestDelta.toLocaleString()}
            </strong>
          </div>
        ) : null}
        {lastAward ? (
          <div className="profile-award">
            <LevelBadge level={lastAward.levelName} />
            <span>+{lastAward.xpAwarded.toLocaleString()} XP</span>
          </div>
        ) : null}
        {lastAward?.unlockedNow.length ? (
          <section className="achievement-section" aria-labelledby="new-achievements-title">
            <h2 id="new-achievements-title">Unlocked Achievements</h2>
            <div className="achievement-grid">
              {lastAward.unlockedNow.map((id) => (
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
    </main>
  );
}

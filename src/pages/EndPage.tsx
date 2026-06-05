import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { TopNav } from "../components/TopNav";
import { useCountUp } from "../hooks/useCountUp";
import { en } from "../i18n/en";
import { getValidatedFigures } from "../lib/figures";
import { buildFigureQueue } from "../lib/session";
import { useGameStore } from "../stores/useGameStore";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import { useProfileStore } from "../stores/useProfileStore";

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
  const leaderboardSaved = useGameStore((state) => state.leaderboardSaved);
  const markLeaderboardSaved = useGameStore((state) => state.markLeaderboardSaved);
  const startSession = useGameStore((state) => state.startSession);
  const reset = useGameStore((state) => state.reset);
  const addEntry = useLeaderboardStore((state) => state.addEntry);
  const entries = useLeaderboardStore((state) => state.entries);
  const recordGame = useProfileStore((state) => state.recordGame);
  const lastAward = useProfileStore((state) => state.lastAward);
  const unlockedAchievements = useProfileStore((state) => state.unlockedAchievements);
  const animatedScore = useCountUp(score, 1200);

  useEffect(() => {
    if (status === "ended" && !leaderboardSaved && nickname) {
      const award = recordGame({ sessionId, score, difficulty, results });
      const achievements = [...new Set([...unlockedAchievements, ...award.unlockedNow])];
      addEntry({ nickname, score, difficulty, categories, levelName: award.levelName, achievements });
      markLeaderboardSaved();
    }
  }, [
    addEntry,
    categories,
    difficulty,
    leaderboardSaved,
    markLeaderboardSaved,
    nickname,
    recordGame,
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
    startSession({ nickname, difficulty, categories, queue });
    navigate("/game");
  }

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel end-panel" aria-labelledby="end-title">
        <p className="eyebrow">Final Score</p>
        <h1 id="end-title">{animatedScore.toLocaleString()}</h1>
        <p className="rank-badge">{rankName(score)}</p>
        {lastAward ? (
          <div className="run-delta">
            <span>Your best: {lastAward.previousBest.toLocaleString()}</span>
            <span>This run: {score.toLocaleString()}</span>
            <strong>{lastAward.bestDelta >= 0 ? "+" : ""}{lastAward.bestDelta.toLocaleString()}</strong>
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
        <div className="round-breakdown">
          {results.map((result) => (
            <article key={`${result.round}-${result.figureName}`}>
              <span>{en.round} {result.round}</span>
              <strong>{result.figureName}</strong>
              <small>
                {result.score.toLocaleString()} pts, {result.hintsUsed} hints, {result.timeUsed}s
              </small>
            </article>
          ))}
        </div>
        <h2>{en.leaderboard}</h2>
        <LeaderboardTable entries={entries} full />
        <div className="action-row">
          <button className="primary-button" type="button" onClick={handlePlayAgain}>
            {en.playAgain}
          </button>
          <Link className="secondary-button" to="/settings">
            {en.changeSettings}
          </Link>
          <Link className="secondary-button" to="/" onClick={reset}>
            {en.home}
          </Link>
        </div>
      </section>
    </main>
  );
}

import { Flame, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LevelBadge } from "../components/LevelBadge";
import { LevelProgress } from "../components/LevelProgress";
import { TopNav } from "../components/TopNav";
import { ACHIEVEMENTS, getLevelInfo, LEVELS } from "../lib/progression";
import { getFigureSlug } from "../lib/dailyChallenge";
import { useProfileStore } from "../stores/useProfileStore";
import type { FigureIndex } from "../types/figure";

export function MyProfilePage({ figureIndex }: { figureIndex: FigureIndex[] }) {
  const nickname = localStorage.getItem("gtf_nickname") ?? "";
  const xp = useProfileStore((state) => state.xp);
  const personalBest = useProfileStore((state) => state.personalBest);
  const totalGames = useProfileStore((state) => state.totalGames);
  const dailyStreak = useProfileStore((state) => state.dailyStreak);
  const achievements = useProfileStore((state) => state.unlockedAchievements);
  const collectedFigureIds = useProfileStore((state) => state.collectedFigureIds);
  const categoryStats = useProfileStore((state) => state.categoryStats);
  const streakFreezesUsed = useProfileStore((state) => state.streakFreezesUsed);
  const [codexQuery, setCodexQuery] = useState("");
  const level = getLevelInfo(xp);
  const collected = useMemo(() => {
    const ids = new Set(collectedFigureIds);
    const query = codexQuery.trim().toLowerCase();
    return figureIndex.filter(
      (figure) =>
        ids.has(figure.id) &&
        (!query ||
          `${figure.first_name} ${figure.last_name}`.toLowerCase().includes(query) ||
          figure.category.toLowerCase().includes(query)),
    );
  }, [codexQuery, collectedFigureIds, figureIndex]);
  const categoryProgress = useMemo(
    () =>
      [...new Set(figureIndex.map((figure) => figure.category))].sort().map((category) => {
        const total = figureIndex.filter((figure) => figure.category === category).length;
        const found = figureIndex.filter(
          (figure) => figure.category === category && collectedFigureIds.includes(figure.id),
        ).length;
        return { category, total, found };
      }),
    [collectedFigureIds, figureIndex],
  );

  return (
    <main className="page-shell">
      <TopNav />
      <section
        className="content-panel public-profile my-profile"
        aria-labelledby="my-profile-title"
      >
        <header className="profile-header">
          <div className="profile-identity">
            <p className="eyebrow">Player profile</p>
            <h1 id="my-profile-title">{nickname || "Unnamed traveler"}</h1>
            <div className="profile-badges">
              <LevelBadge level={level.levelName} />
              {dailyStreak > 0 ? (
                <span className="streak-pill">
                  <Flame aria-hidden="true" size={14} />
                  {dailyStreak} day streak
                </span>
              ) : null}
              <span className="freeze-pill">
                Streak freeze: {streakFreezesUsed < 1 ? "ready" : "used this week"}
              </span>
            </div>
          </div>
          <dl className="profile-stats">
            <div>
              <dt>Personal best</dt>
              <dd>{personalBest.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Total games</dt>
              <dd>{totalGames.toLocaleString()}</dd>
            </div>
            <div>
              <dt>XP</dt>
              <dd>{xp.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Achievements</dt>
              <dd>
                {achievements.length}/{ACHIEVEMENTS.length}
              </dd>
            </div>
          </dl>
        </header>

        <LevelProgress xp={xp} />

        <section className="profile-section" aria-labelledby="level-path-title">
          <h2 id="level-path-title">Level path</h2>
          <div className="level-path">
            {LEVELS.map((item) => (
              <div
                key={item.name}
                className={xp >= item.minXp ? "level-path-item reached" : "level-path-item"}
              >
                <LevelBadge level={item.name} emblem />
                <small>{item.minXp.toLocaleString()} XP</small>
              </div>
            ))}
          </div>
        </section>

        <section className="profile-section" aria-labelledby="collection-title">
          <h2 id="collection-title">Badge collection</h2>
          {achievements.length > 0 ? (
            <div className="achievement-grid">
              {achievements.map((id) => (
                <AchievementBadge key={id} id={id} />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              <Trophy aria-hidden="true" size={18} /> Complete games to unlock badges.
            </p>
          )}
        </section>

        <section className="profile-section" aria-labelledby="accuracy-title">
          <h2 id="accuracy-title">Accuracy by category</h2>
          <div className="category-progress-grid">
            {categoryProgress.map(({ category, total, found }) => {
              const stats = categoryStats[category] ?? { correct: 0, attempts: 0 };
              const accuracy =
                stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : 0;
              return (
                <article key={category} className="category-progress-card">
                  <strong>{category}</strong>
                  <span>
                    {found}/{total} collected ·{" "}
                    {stats.attempts ? `${accuracy}% accuracy` : "No attempts"}
                  </span>
                  <progress value={found} max={total} />
                </article>
              );
            })}
          </div>
        </section>

        <section className="profile-section" aria-labelledby="codex-title">
          <div className="codex-header">
            <div>
              <h2 id="codex-title">Codex</h2>
              <p>
                {collectedFigureIds.length.toLocaleString()} of{" "}
                {figureIndex.length.toLocaleString()} figures ·{" "}
                {Math.round((collectedFigureIds.length / figureIndex.length) * 100)}%
              </p>
            </div>
            <input
              value={codexQuery}
              onChange={(event) => setCodexQuery(event.target.value)}
              placeholder="Search collected figures..."
              aria-label="Search Codex"
            />
          </div>
          {collected.length > 0 ? (
            <div className="codex-grid">
              {collected.map((figure) => (
                <Link
                  key={figure.id}
                  to={`/figure/${getFigureSlug(figure)}`}
                  className="codex-entry"
                >
                  <strong>
                    {figure.first_name} {figure.last_name}
                  </strong>
                  <span>{figure.category}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">Correctly identify figures to add them to your Codex.</p>
          )}
        </section>

        <div className="action-row">
          <Link className="primary-button" to="/">
            Play
          </Link>
          <Link className="secondary-button" to="/settings">
            Settings
          </Link>
          {nickname ? (
            <Link className="secondary-button" to={`/profile/${nickname}`}>
              Public profile
            </Link>
          ) : null}
        </div>
      </section>
    </main>
  );
}

import { Flame, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LevelBadge } from "../components/LevelBadge";
import { LevelProgress } from "../components/LevelProgress";
import { TopNav } from "../components/TopNav";
import { ACHIEVEMENTS, getLevelInfo, LEVELS } from "../lib/progression";
import { useProfileStore } from "../stores/useProfileStore";

export function MyProfilePage() {
  const nickname = localStorage.getItem("gtf_nickname") ?? "";
  const xp = useProfileStore((state) => state.xp);
  const personalBest = useProfileStore((state) => state.personalBest);
  const totalGames = useProfileStore((state) => state.totalGames);
  const dailyStreak = useProfileStore((state) => state.dailyStreak);
  const achievements = useProfileStore((state) => state.unlockedAchievements);
  const level = getLevelInfo(xp);

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel public-profile my-profile" aria-labelledby="my-profile-title">
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
            </div>
          </div>
          <dl className="profile-stats">
            <div><dt>Personal best</dt><dd>{personalBest.toLocaleString()}</dd></div>
            <div><dt>Total games</dt><dd>{totalGames.toLocaleString()}</dd></div>
            <div><dt>XP</dt><dd>{xp.toLocaleString()}</dd></div>
            <div><dt>Achievements</dt><dd>{achievements.length}/{ACHIEVEMENTS.length}</dd></div>
          </dl>
        </header>

        <LevelProgress xp={xp} />

        <section className="profile-section" aria-labelledby="level-path-title">
          <h2 id="level-path-title">Level path</h2>
          <div className="level-path">
            {LEVELS.map((item) => (
              <div key={item.name} className={xp >= item.minXp ? "level-path-item reached" : "level-path-item"}>
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
              {achievements.map((id) => <AchievementBadge key={id} id={id} />)}
            </div>
          ) : (
            <p className="empty-state"><Trophy aria-hidden="true" size={18} /> Complete games to unlock badges.</p>
          )}
        </section>

        <div className="action-row">
          <Link className="primary-button" to="/">Play</Link>
          <Link className="secondary-button" to="/settings">Settings</Link>
          {nickname ? <Link className="secondary-button" to={`/profile/${nickname}`}>Public profile</Link> : null}
        </div>
      </section>
    </main>
  );
}

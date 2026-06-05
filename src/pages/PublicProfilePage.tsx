import { Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LevelBadge } from "../components/LevelBadge";
import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import { fetchPublicProfile, type PublicProfile } from "../lib/api";
import { ACHIEVEMENTS, getLevelInfo } from "../lib/progression";

type ProfileState = { status: "loading" } | { status: "missing" } | { status: "ready"; data: PublicProfile };

export function PublicProfilePage() {
  const { nickname = "" } = useParams<{ nickname: string }>();
  const [state, setState] = useState<ProfileState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void fetchPublicProfile(nickname).then((data) => {
      if (cancelled) return;
      setState(data ? { status: "ready", data } : { status: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [nickname]);

  if (!nickname) {
    return <Navigate to="/leaderboard" replace />;
  }

  if (state.status === "loading") {
    return (
      <main className="page-shell">
        <TopNav />
        <section className="content-panel public-profile" aria-busy="true" aria-label="Loading profile">
          <div className="profile-skeleton">
            <div className="skeleton-block skeleton-title" />
            <div className="skeleton-block skeleton-subtitle" />
            <div className="skeleton-stats-row">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton-block skeleton-stat" />
              ))}
            </div>
            <div className="skeleton-block skeleton-section" />
            <div className="skeleton-block skeleton-section skeleton-section--short" />
          </div>
        </section>
      </main>
    );
  }

  if (state.status === "missing") {
    return (
      <main className="page-shell">
        <TopNav />
        <section className="content-panel">
          <h1>Profile not found</h1>
          <p className="empty-state">No player named "{nickname}" has played yet.</p>
          <Link className="primary-button compact-action" to="/leaderboard">
            Back to leaderboard
          </Link>
        </section>
      </main>
    );
  }

  const profile = state.data;
  const levelInfo = getLevelInfo(profile.xp);
  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel public-profile" aria-labelledby="profile-title">
        <header className="profile-header">
          <div className="profile-identity">
            <h1 id="profile-title">{profile.nickname}</h1>
            <p className="muted-cell">Member since {memberSince}</p>
            <div className="profile-badges">
              <LevelBadge level={levelInfo.levelName} />
              {profile.dailyStreak > 0 ? (
                <span className="streak-pill">
                  <Flame aria-hidden="true" size={14} />
                  {profile.dailyStreak} day streak
                </span>
              ) : null}
            </div>
          </div>
          <dl className="profile-stats">
            <div>
              <dt>Personal best</dt>
              <dd>{profile.personalBest.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Total games</dt>
              <dd>{profile.totalGames.toLocaleString()}</dd>
            </div>
            <div>
              <dt>XP</dt>
              <dd>{profile.xp.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Favorite</dt>
              <dd>{profile.favoriteCategory ?? "-"}</dd>
            </div>
          </dl>
        </header>

        {profile.achievements.length > 0 ? (
          <section aria-labelledby="profile-achievements" className="profile-section">
            <h2 id="profile-achievements">Achievements</h2>
            <div className="achievement-grid">
              {ACHIEVEMENTS.filter((def) => profile.achievements.includes(def.id)).map((def) => (
                <AchievementBadge key={def.id} id={def.id} />
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="profile-difficulty" className="profile-section">
          <h2 id="profile-difficulty">Win rate by difficulty</h2>
          <table className="difficulty-table">
            <thead>
              <tr>
                <th>Difficulty</th>
                <th>Games</th>
                <th>Wins</th>
                <th>Win %</th>
              </tr>
            </thead>
            <tbody>
              {(["Explorer", "Scholar", "Conqueror"] as const).map((d) => {
                const stats = profile.difficultyStats[d];
                const games = stats?.games ?? 0;
                const wins = stats?.wins ?? 0;
                const pct = games > 0 ? Math.round((wins / games) * 100) : 0;
                return (
                  <tr key={d}>
                    <td>{d}</td>
                    <td>{games}</td>
                    <td>{wins}</td>
                    <td>{games > 0 ? `${pct}%` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {profile.bestRuns.length > 0 ? (
          <section aria-labelledby="profile-best-runs" className="profile-section">
            <h2 id="profile-best-runs">Best runs</h2>
            <ol className="best-runs">
              {profile.bestRuns.map((run, index) => (
                <li key={`${run.playedAt}-${index}`}>
                  <span className="rank">{index + 1}.</span>
                  <strong>{run.score.toLocaleString()}</strong>
                  <span className="run-meta">
                    {run.difficulty} -{" "}
                    {new Date(run.playedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                  {run.levelName ? <LevelBadge level={run.levelName} /> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <Link className="primary-button compact-action" to="/leaderboard">
          {en.leaderboard}
        </Link>
      </section>
    </main>
  );
}

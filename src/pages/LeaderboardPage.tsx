import { Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import {
  fetchHallOfFame,
  fetchWeeklyLeaderboard,
  type WeeklyArchive,
  type WeeklyEntry,
} from "../lib/api";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";

type Tab = "alltime" | "week" | "hof";

function SkeletonTable({ cols = 5, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="table-wrap">
      <table className="leaderboard-table" aria-busy="true" aria-label="Loading data">
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="skeleton-row">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex}>
                  <span
                    className="skeleton-cell"
                    style={{ width: colIndex === 0 ? "2rem" : colIndex === 1 ? "7rem" : "4rem" }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function nextMondayUtc(now: Date = new Date()): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
  );
  const day = next.getUTCDay() || 7;
  const daysUntil = day === 1 ? 7 : ((8 - day) % 7);
  next.setUTCDate(next.getUTCDate() + daysUntil);
  return next;
}

function formatCountdown(target: Date, now: Date = new Date()): string {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return "resetting...";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function WeeklyTable({ entries }: { entries: WeeklyEntry[] }) {
  if (entries.length === 0) {
    return <p className="empty-state">No runs this week yet - be the first.</p>;
  }
  return (
    <div className="table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Nickname</th>
            <th>Best</th>
            <th>Level</th>
            <th>Badges</th>
            <th>Difficulty</th>
            <th>Games</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.rank}-${entry.nickname}`}>
              <td>{entry.rank}</td>
              <td>
                <Link to={`/profile/${entry.nickname}`} className="leaderboard-nick">
                  {entry.nickname}
                </Link>
              </td>
              <td>{entry.bestScore.toLocaleString()}</td>
              <td>{entry.levelName ? <LevelBadge level={entry.levelName} /> : "Traveler"}</td>
              <td>
                {entry.achievements?.length ? (
                  <div className="leaderboard-achievements">
                    {entry.achievements.slice(0, 3).map((id) => (
                      <AchievementBadge key={id} id={id} compact />
                    ))}
                  </div>
                ) : (
                  <span className="muted-cell">None</span>
                )}
              </td>
              <td>{entry.difficulty}</td>
              <td>{entry.gamesPlayed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HallOfFameList({ archives }: { archives: WeeklyArchive[] }) {
  if (archives.length === 0) {
    return <p className="empty-state">The first weekly champions will appear here on Monday.</p>;
  }
  return (
    <div className="hof-list">
      {archives.map((archive) => {
        const champion = archive.winners[0];
        const weekEnd = new Date(`${archive.weekStart}T00:00:00Z`);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        return (
          <article key={archive.weekStart} className="hof-entry">
            <header>
              <h3>
                Week of {new Date(archive.weekStart).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </h3>
              <span className="hof-range">
                {archive.weekStart} - {weekEnd.toISOString().slice(0, 10)}
              </span>
            </header>
            {champion ? (
              <div className="hof-champion">
                <Trophy className="hof-medal" aria-hidden="true" size={20} />
                <Link to={`/profile/${champion.nickname}`} className="hof-name">
                  {champion.nickname}
                </Link>
                <span className="hof-score">{champion.bestScore.toLocaleString()} pts</span>
              </div>
            ) : null}
            {archive.winners.length > 1 ? (
              <ol className="hof-rest">
                {archive.winners.slice(1, 10).map((winner, index) => (
                  <li key={`${archive.weekStart}-${winner.nickname}-${index}`}>
                    <span className="hof-rank">{index + 2}.</span>
                    <Link to={`/profile/${winner.nickname}`}>{winner.nickname}</Link>
                    <span className="hof-score-small">{winner.bestScore.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("alltime");
  const entries = useLeaderboardStore((state) => state.entries);
  const refresh = useLeaderboardStore((state) => state.refresh);
  const [weekly, setWeekly] = useState<WeeklyEntry[] | null>(null);
  const [hof, setHof] = useState<WeeklyArchive[] | null>(null);
  const [countdown, setCountdown] = useState(() => formatCountdown(nextMondayUtc()));

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab !== "week") return;
    setWeekly(null);
    void fetchWeeklyLeaderboard().then(setWeekly);
  }, [tab]);

  useEffect(() => {
    if (tab !== "hof") return;
    setHof(null);
    void fetchHallOfFame().then(setHof);
  }, [tab]);

  useEffect(() => {
    if (tab !== "week") return;
    const interval = window.setInterval(() => setCountdown(formatCountdown(nextMondayUtc())), 60_000);
    return () => window.clearInterval(interval);
  }, [tab]);

  const tabs: Array<{ id: Tab; label: string }> = useMemo(
    () => [
      { id: "alltime", label: "All-time" },
      { id: "week", label: "This Week" },
      { id: "hof", label: "Hall of Fame" },
    ],
    [],
  );

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel" aria-labelledby="leaderboard-title">
        <h1 id="leaderboard-title">{en.leaderboard}</h1>

        <div className="tab-row" role="tablist" aria-label="Leaderboard scope">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "tab-button active" : "tab-button"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "alltime" ? <LeaderboardTable entries={entries} /> : null}

        {tab === "week" ? (
          <>
            <p className="week-meta">Resets in {countdown} (Monday 00:00 UTC).</p>
            {weekly === null ? <SkeletonTable cols={7} /> : <WeeklyTable entries={weekly} />}
          </>
        ) : null}

        {tab === "hof" ? (
          hof === null ? <SkeletonTable cols={1} rows={3} /> : <HallOfFameList archives={hof} />
        ) : null}

        <Link className="primary-button compact-action" to="/">
          {en.home}
        </Link>
      </section>
    </main>
  );
}

import { Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { AchievementBadge } from "../components/AchievementBadge";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { LevelBadge } from "../components/LevelBadge";
import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import {
  fetchDailyLeaderboard,
  fetchHallOfFame,
  fetchTopLeaderboard,
  fetchWeeklyLeaderboard,
  type DailyLeaderboardEntry,
  type WeeklyArchive,
  type WeeklyEntry,
} from "../lib/api";
import { getUtcDateString } from "../lib/dailyChallenge";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";
import type { Difficulty, GameMode, LeaderboardEntry } from "../types/figure";

type Tab = "daily" | "alltime" | "week" | "hof";
type ModeFilter = "All" | GameMode;

const MODE_LABEL: Record<GameMode, string> = {
  classic: "Classic",
  daily: "Daily",
  reverse: "Where",
};

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
  const daysUntil = day === 1 ? 7 : (8 - day) % 7;
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
            <th>Mode</th>
            <th>Level</th>
            <th>Badges</th>
            <th>Difficulty</th>
            <th>Games</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.rank}-${entry.nickname}-${entry.mode}`}>
              <td>{entry.rank}</td>
              <td>
                <Link to={`/profile/${entry.nickname}`} className="leaderboard-nick">
                  {entry.nickname}
                </Link>
              </td>
              <td>{entry.bestScore.toLocaleString()}</td>
              <td>{MODE_LABEL[entry.mode] ?? entry.mode}</td>
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
                Week of{" "}
                {new Date(archive.weekStart).toLocaleDateString(undefined, { dateStyle: "medium" })}
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
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [mode, setMode] = useState<ModeFilter>("All");
  const nickname = useMemo(() => localStorage.getItem("gtf_nickname") ?? "", []);
  const refresh = useLeaderboardStore((state) => state.refresh);
  const [weekly, setWeekly] = useState<WeeklyEntry[] | null>(null);
  const [hof, setHof] = useState<WeeklyArchive[] | null>(null);
  const [daily, setDaily] = useState<DailyLeaderboardEntry[] | null>(null);
  const [alltime, setAlltime] = useState<LeaderboardEntry[] | null>(null);
  const [countdown, setCountdown] = useState(() => formatCountdown(nextMondayUtc()));
  const requestSeq = useRef(0);

  // Warm the persisted all-time fallback only when the user lands on /alltime,
  // not on every visit to the page (the old behavior fired an extra RPC even
  // when the user only wanted Today).
  useEffect(() => {
    if (tab === "alltime") void refresh();
  }, [refresh, tab]);

  useEffect(() => {
    if (tab !== "daily") return;
    const seq = ++requestSeq.current;
    setDaily(null);
    void fetchDailyLeaderboard(
      getUtcDateString(),
      difficulty === "All" ? undefined : difficulty,
    ).then((result) => {
      if (requestSeq.current === seq) setDaily(result);
    });
  }, [difficulty, tab]);

  useEffect(() => {
    if (tab !== "alltime") return;
    const seq = ++requestSeq.current;
    setAlltime(null);
    void fetchTopLeaderboard(
      100,
      difficulty === "All" ? undefined : difficulty,
      mode === "All" ? undefined : mode,
    ).then((result) => {
      if (requestSeq.current === seq) setAlltime(result);
    });
  }, [difficulty, mode, tab]);

  useEffect(() => {
    if (tab !== "week") return;
    const seq = ++requestSeq.current;
    setWeekly(null);
    void fetchWeeklyLeaderboard(100, mode === "All" ? undefined : mode).then((result) => {
      if (requestSeq.current === seq) setWeekly(result);
    });
  }, [mode, tab]);

  useEffect(() => {
    if (tab !== "hof") return;
    const seq = ++requestSeq.current;
    setHof(null);
    void fetchHallOfFame().then((result) => {
      if (requestSeq.current === seq) setHof(result);
    });
  }, [tab]);

  useEffect(() => {
    if (tab !== "week") return;
    const interval = window.setInterval(
      () => setCountdown(formatCountdown(nextMondayUtc())),
      60_000,
    );
    return () => window.clearInterval(interval);
  }, [tab]);

  const tabs: Array<{ id: Tab; label: string }> = useMemo(
    () => [
      { id: "alltime", label: "All-time" },
      { id: "daily", label: "Today's challenge" },
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

        {tab !== "hof" ? (
          <div className="difficulty-filter" aria-label="Filter leaderboard by difficulty">
            {(["All", "Explorer", "Scholar", "Conqueror"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={difficulty === item ? "chip selected" : "chip"}
                onClick={() => setDifficulty(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}

        {tab === "alltime" || tab === "week" ? (
          <div className="difficulty-filter" aria-label="Filter leaderboard by game mode">
            {(["All", "classic", "daily", "reverse"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "chip selected" : "chip"}
                onClick={() => setMode(item)}
              >
                {item === "All" ? "All modes" : MODE_LABEL[item]}
              </button>
            ))}
          </div>
        ) : null}

        {tab === "daily" ? (
          daily === null ? (
            <SkeletonTable cols={8} />
          ) : (
            <LeaderboardTable entries={daily} currentNickname={nickname} />
          )
        ) : null}

        {tab === "alltime" ? (
          alltime === null ? (
            <SkeletonTable cols={9} />
          ) : (
            <LeaderboardTable entries={alltime} currentNickname={nickname} />
          )
        ) : null}

        {tab === "week" ? (
          <>
            <p className="week-meta">Resets in {countdown} (Monday 00:00 UTC).</p>
            {weekly === null ? (
              <SkeletonTable cols={7} />
            ) : (
              <WeeklyTable
                entries={
                  difficulty === "All"
                    ? weekly
                    : weekly.filter((entry) => entry.difficulty === difficulty)
                }
              />
            )}
          </>
        ) : null}

        {tab === "hof" ? (
          hof === null ? (
            <SkeletonTable cols={1} rows={3} />
          ) : (
            <HallOfFameList archives={hof} />
          )
        ) : null}

        <Link className="primary-button compact-action" to="/">
          {en.home}
        </Link>
      </section>
    </main>
  );
}

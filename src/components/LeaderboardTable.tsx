import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { GAME_CONFIG } from "../config/gameConfig";
import { en } from "../i18n/en";
import { cleanLeaderboardEntries } from "../lib/leaderboard";
import type { GameMode, LeaderboardEntry } from "../types/figure";
import { AchievementBadge } from "./AchievementBadge";
import { LevelBadge } from "./LevelBadge";

type Props = {
  entries: LeaderboardEntry[];
  full?: boolean;
  currentNickname?: string;
};

const MODE_LABEL: Record<GameMode, string> = {
  classic: "Classic",
  daily: "Daily",
  reverse: "Where",
};

export function LeaderboardTable({ entries, full = false, currentNickname }: Props) {
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => cleanLeaderboardEntries(entries), [entries]);
  // Precompute rank for every entry once so the render loop is O(1) per row
  // instead of O(n) per row (findIndex was O(n²) total).
  const rankMap = useMemo(
    () => new Map(sorted.map((entry, index) => [entry.id, index + 1])),
    [sorted],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / GAME_CONFIG.leaderboardPageSize));
  const visible = full
    ? sorted
    : sorted.slice(
        page * GAME_CONFIG.leaderboardPageSize,
        (page + 1) * GAME_CONFIG.leaderboardPageSize,
      );
  const currentEntry = currentNickname
    ? sorted.find((entry) => entry.nickname.toLowerCase() === currentNickname.toLowerCase())
    : sorted.find((entry) => entry.current);
  const currentOffScreen = currentEntry && !visible.some((entry) => entry.id === currentEntry.id);

  if (sorted.length === 0) {
    return <p className="empty-state">{en.noLeaderboard}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Nickname</th>
            <th>Score</th>
            <th>Mode</th>
            <th>Level</th>
            <th>Badges</th>
            <th>Difficulty</th>
            <th>Categories</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => {
            const rank = rankMap.get(entry.id) ?? 0;
            return (
              <tr
                key={entry.id}
                className={
                  entry.current ||
                  (currentNickname &&
                    entry.nickname.toLowerCase() === currentNickname.toLowerCase())
                    ? "current-row"
                    : undefined
                }
              >
                <td>{rank}</td>
                <td>
                  <Link to={`/profile/${entry.nickname}`} className="leaderboard-nick">
                    {entry.nickname}
                  </Link>
                </td>
                <td>{entry.score.toLocaleString()}</td>
                <td>{entry.mode ? (MODE_LABEL[entry.mode] ?? entry.mode) : "Classic"}</td>
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
                <td>{entry.categories.join(", ")}</td>
                <td>{new Date(entry.date).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {currentOffScreen ? (
        <button
          className="your-rank-row"
          type="button"
          onClick={() =>
            setPage(
              Math.floor((rankMap.get(currentEntry.id)! - 1) / GAME_CONFIG.leaderboardPageSize),
            )
          }
        >
          <strong>Your rank: #{rankMap.get(currentEntry.id)}</strong>
          <span>
            {currentEntry.nickname} · {currentEntry.score.toLocaleString()} pts ·{" "}
            {currentEntry.difficulty}
          </span>
        </button>
      ) : null}
      {!full && pageCount > 1 ? (
        <div className="pager">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

import { Flame } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import {
  DAILY_ROUNDS,
  getDailyFigures,
  getDayNumber,
  getUtcDateString,
  timeUntilNextDaily,
} from "../lib/dailyChallenge";
import { useGameStore } from "../stores/useGameStore";
import { useProfileStore } from "../stores/useProfileStore";
import type { Figure } from "../types/figure";

type Props = {
  figures: Figure[];
};

export function DailyChallengePage({ figures }: Props) {
  const navigate = useNavigate();
  const nickname = useMemo(() => localStorage.getItem("gtf_nickname") ?? "", []);
  const today = useMemo(() => getUtcDateString(), []);
  const dayNumber = useMemo(() => getDayNumber(today), [today]);
  const dailyFigures = useMemo(() => getDailyFigures(figures, today), [figures, today]);
  const startSession = useGameStore((state) => state.startSession);
  const setToast = useGameStore((state) => state.setToast);
  const lastDailyPlayedOn = useProfileStore((state) => state.lastDailyPlayedOn);
  const dailyStreak = useProfileStore((state) => state.dailyStreak);
  const [countdown, setCountdown] = useState(() => timeUntilNextDaily());

  const alreadyPlayed = lastDailyPlayedOn === today;

  useEffect(() => {
    if (!alreadyPlayed) return;
    setCountdown(timeUntilNextDaily());
    const interval = window.setInterval(() => setCountdown(timeUntilNextDaily()), 60_000);
    return () => window.clearInterval(interval);
  }, [alreadyPlayed]);

  function handleStart() {
    if (!nickname) {
      setToast("Pick a nickname on the home screen first.");
      navigate("/");
      return;
    }
    if (dailyFigures.length < DAILY_ROUNDS) {
      setToast("Today's challenge is unavailable. Please try again later.");
      return;
    }
    const categories = [...new Set(dailyFigures.map((figure) => figure.category))];
    startSession({
      nickname,
      difficulty: "Scholar",
      categories,
      queue: dailyFigures,
      mode: "daily",
      dailyDate: today,
    });
    navigate("/game");
  }

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel daily-panel" aria-labelledby="daily-title">
        <p className="eyebrow">Daily Challenge</p>
        <h1 id="daily-title">Day {dayNumber}</h1>
        <p className="daily-subtitle">
          Same 5 figures for every player worldwide. New set every UTC midnight.
        </p>

        {dailyStreak > 0 ? (
          <p className="streak-pill" aria-label={`Current streak ${dailyStreak} days`}>
            <Flame aria-hidden="true" size={14} />
            {dailyStreak} day streak
          </p>
        ) : null}

        {alreadyPlayed ? (
          <div className="daily-locked">
            <h2>You've played today.</h2>
            <p>Come back in {countdown}.</p>
            <Link className="primary-button" to="/leaderboard">
              See today's leaderboard
            </Link>
            <Link className="secondary-button" to="/figure/today">
              Read about today's figure
            </Link>
          </div>
        ) : (
          <div className="daily-cta">
            <p className="daily-rounds">{dailyFigures.length} figures - 30s per round</p>
            <button className="primary-button" type="button" onClick={handleStart}>
              Start Today's Challenge
            </button>
            <Link className="secondary-button" to="/figure/today">
              Today's featured figure
            </Link>
            <Link className="secondary-button" to="/">
              {en.home}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

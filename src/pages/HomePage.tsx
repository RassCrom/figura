import { ArrowRight, Flame, Globe2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AnimatedMapBackground } from "../components/AnimatedMapBackground";
import { LevelProgress } from "../components/LevelProgress";
import { Logo } from "../components/Logo";
import { en } from "../i18n/en";
import { claimNickname, fetchPlayersToday } from "../lib/api";
import { getLocalPlayersToday, recordLocalPlay } from "../lib/playerActivity";
import { buildFigureQueue } from "../lib/session";
import { isSupabaseConfigured } from "../lib/supabase";
import { useGameStore } from "../stores/useGameStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Figure } from "../types/figure";

const nicknamePattern = /^[A-Za-z0-9_.\- ]{2,20}$/;
const nicknameFormatGuard = /^[._\- ]|[._\- ]$|[._\- ]{2,}/;

type Props = {
  figures: Figure[];
  categories: string[];
};

function nicknameErrorMessage(code: string): string {
  switch (code) {
    case "NICKNAME_TAKEN":
      return "That nickname is already taken.";
    case "NICKNAME_FORBIDDEN":
      return "Please pick a different nickname.";
    case "NICKNAME_RESERVED":
      return "That nickname is reserved.";
    case "NICKNAME_FORMAT":
      return "Avoid leading, trailing, or repeated punctuation.";
    case "NICKNAME_CHARSET":
      return "Letters, numbers, underscore, hyphen, dot, and space only.";
    case "NICKNAME_LENGTH":
      return "Use 2-20 characters.";
    case "OFFLINE":
      return "You're offline. Score won't sync.";
    default:
      return "Couldn't claim that nickname. Try another.";
  }
}

export function HomePage({ figures, categories }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => localStorage.getItem("gtf_nickname") ?? "");
  const [touched, setTouched] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [playersToday, setPlayersToday] = useState(() => getLocalPlayersToday());
  const startSession = useGameStore((state) => state.startSession);
  const setToast = useGameStore((state) => state.setToast);
  const difficulty = useSettingsStore((state) => state.difficulty);
  const selectedCategories = useSettingsStore((state) => state.selectedCategories);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const xp = useProfileStore((state) => state.xp);
  const dailyStreak = useProfileStore((state) => state.dailyStreak);
  const effectiveCategories = selectedCategories.length > 0 ? selectedCategories : categories;

  const isValid = useMemo(
    () => nicknamePattern.test(nickname) && !nicknameFormatGuard.test(nickname),
    [nickname],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void fetchPlayersToday().then((count) => setPlayersToday(Math.max(count, getLocalPlayersToday())));
  }, []);

  function handleNicknameChange(event: ChangeEvent<HTMLInputElement>) {
    setNickname(event.target.value);
    setClaimError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (!isValid) {
      return;
    }

    if (selectedCategories.length === 0) {
      setSelectedCategories(categories);
    }

    if (isSupabaseConfigured) {
      setClaiming(true);
      const claim = await claimNickname(nickname);
      setClaiming(false);
      if (!claim.ok) {
        setClaimError(nicknameErrorMessage(claim.error));
        return;
      }
    }

    const { queue, relaxed } = buildFigureQueue(figures, difficulty, effectiveCategories);
    if (queue.length === 0) {
      setToast("No figures match the selected filters.");
      return;
    }

    if (relaxed) {
      setToast("The pool was under five figures, so filters were relaxed for this session.");
      window.setTimeout(() => setToast(null), 4200);
    }

    localStorage.setItem("gtf_nickname", nickname);
    recordLocalPlay();
    startSession({ nickname, difficulty, categories: effectiveCategories, queue });
    navigate("/game");
  }

  const helpId = "nickname-help";
  const errorId = claimError ? "nickname-error" : undefined;

  return (
    <main className="page-shell home-page">
      <AnimatedMapBackground />
      <section className="home-panel" aria-labelledby="home-title">
        <Logo />
        <h1 id="home-title">Figura</h1>
        <p className="home-subtitle">Who was here</p>
        {(playersToday != null && playersToday > 0) || dailyStreak > 0 ? (
          <div className="home-pills">
            {playersToday != null && playersToday > 0 ? (
              <span className="pill players-today" aria-live="polite">
                <Globe2 aria-hidden="true" size={14} />
                {playersToday.toLocaleString()} {playersToday === 1 ? "person" : "people"} played today
              </span>
            ) : null}
            {dailyStreak > 0 ? (
              <span className="pill streak-pill" aria-label={`Current streak ${dailyStreak} days`}>
                <Flame aria-hidden="true" size={14} />
                {dailyStreak} day streak
              </span>
            ) : null}
          </div>
        ) : null}
        <LevelProgress xp={xp} />
        <Link className="daily-cta-card" to="/daily">
          <span className="daily-cta-eyebrow">Today's Challenge</span>
          <span className="daily-cta-title">Same 5 figures for everyone</span>
          <ArrowRight className="daily-cta-arrow" aria-hidden="true" size={22} />
        </Link>
        <form className="menu-form" onSubmit={handleSubmit}>
          <label htmlFor="nickname">{en.nicknameLabel}</label>
          <input
            ref={inputRef}
            id="nickname"
            value={nickname}
            onChange={handleNicknameChange}
            onBlur={() => setTouched(true)}
            maxLength={20}
            aria-invalid={(touched && !isValid) || Boolean(claimError)}
            aria-describedby={errorId ? `${helpId} ${errorId}` : helpId}
            autoComplete="nickname"
          />
          <p id={helpId} className={touched && !isValid ? "field-error" : "field-help"}>
            {en.nicknameHelp}
          </p>
          {claimError ? (
            <p id={errorId} className="field-error" role="alert">
              {claimError}
            </p>
          ) : null}
          <button className="primary-button" type="submit" disabled={claiming}>
            {claiming ? "Reserving..." : en.startGame}
          </button>
          <div className="menu-actions">
            <Link className="secondary-button" to="/settings">
              {en.settings}
            </Link>
            <Link className="secondary-button" to="/leaderboard">
              {en.leaderboard}
            </Link>
            <Link className="secondary-button" to="/profile">My profile</Link>
          </div>
        </form>
      </section>
    </main>
  );
}

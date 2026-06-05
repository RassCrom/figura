import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { LevelProgress } from "../components/LevelProgress";
import { Logo } from "../components/Logo";
import { en } from "../i18n/en";
import { buildFigureQueue } from "../lib/session";
import { useGameStore } from "../stores/useGameStore";
import { useProfileStore } from "../stores/useProfileStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import type { Figure } from "../types/figure";

const nicknamePattern = /^[A-Za-z0-9_]{2,20}$/;

type Props = {
  figures: Figure[];
  categories: string[];
};

export function HomePage({ figures, categories }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => localStorage.getItem("gtf_nickname") ?? "");
  const [touched, setTouched] = useState(false);
  const startSession = useGameStore((state) => state.startSession);
  const setToast = useGameStore((state) => state.setToast);
  const difficulty = useSettingsStore((state) => state.difficulty);
  const selectedCategories = useSettingsStore((state) => state.selectedCategories);
  const setSelectedCategories = useSettingsStore((state) => state.setSelectedCategories);
  const xp = useProfileStore((state) => state.xp);
  const effectiveCategories = selectedCategories.length > 0 ? selectedCategories : categories;

  const isValid = useMemo(() => nicknamePattern.test(nickname), [nickname]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleNicknameChange(event: ChangeEvent<HTMLInputElement>) {
    setNickname(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (!isValid) {
      return;
    }

    if (selectedCategories.length === 0) {
      setSelectedCategories(categories);
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
    startSession({ nickname, difficulty, categories: effectiveCategories, queue });
    navigate("/game");
  }

  return (
    <main className="page-shell home-page">
      <section className="home-panel" aria-labelledby="home-title">
        <Logo />
        <h1 id="home-title">Figura</h1>
        <p className="home-subtitle">Who was here</p>
        <LevelProgress xp={xp} />
        <form className="menu-form" onSubmit={handleSubmit}>
          <label htmlFor="nickname">{en.nicknameLabel}</label>
          <input
            ref={inputRef}
            id="nickname"
            value={nickname}
            onChange={handleNicknameChange}
            onBlur={() => setTouched(true)}
            maxLength={20}
            aria-invalid={touched && !isValid}
            aria-describedby="nickname-help"
            autoComplete="nickname"
          />
          <p id="nickname-help" className={touched && !isValid ? "field-error" : "field-help"}>
            {en.nicknameHelp}
          </p>
          <button className="primary-button" type="submit">
            {en.startGame}
          </button>
          <Link className="secondary-button" to="/settings">
            {en.settings}
          </Link>
          <Link className="secondary-button" to="/leaderboard">
            {en.leaderboard}
          </Link>
        </form>
      </section>
    </main>
  );
}

import { useEffect, useState } from "react";

import { en } from "../i18n/en";
import { Logo } from "./Logo";

export function LoadingScreen() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhraseIndex((index) => (index + 1) % en.loadingPhrases.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="loading-screen">
      <Logo />
      <div className="loading-arc" aria-hidden="true" />
      <p aria-live="polite">{en.loadingPhrases[phraseIndex]}</p>
    </main>
  );
}

import { BookOpenText, CalendarDays, Compass, MapPin, Timer, X } from "lucide-react";
import { useEffect } from "react";

const SECTIONS = [
  {
    icon: Compass,
    title: "Follow the journey",
    body: "Each round draws one person's life across the map — from birthplace to place of death. Type who it is before the clock runs out.",
  },
  {
    icon: BookOpenText,
    title: "Use your hints",
    body: "Wrong guesses reveal life dates, then place names, on the map for free. Field notes — surname initial, description, category — are stronger but limited for the whole game.",
  },
  {
    icon: Timer,
    title: "Score fast, score clean",
    body: "A figure is worth 5,000 points. Every wrong guess costs 1,200, answering quickly earns up to 800 extra, and first-try streaks add 500.",
  },
  {
    icon: CalendarDays,
    title: "Daily Challenge",
    body: "One shared run per day — the same five figures for every player worldwide. Keep your streak alive; you get one streak freeze per week.",
  },
  {
    icon: MapPin,
    title: "Reverse mode",
    body: "The roles flip: you see the person and click their birthplace on the map. Points come only from distance and speed. Lifetime estimates are optional on Explorer and required on harder levels.",
  },
] as const;

export function HowToPlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="howto-backdrop" onClick={onClose} role="presentation">
      <section
        className="howto-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button howto-close" type="button" onClick={onClose} aria-label="Close guide">
          <X aria-hidden="true" size={18} />
        </button>
        <p className="eyebrow">Field guide</p>
        <h2 id="howto-title">How to play</h2>
        <div className="howto-sections">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="howto-section">
              <span className="howto-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="howto-footnote">
          Explorer, Scholar, and Conqueror difficulties change the timer, hint allowance, and how
          obscure the figures get — pick yours in Settings.
        </p>
        <button className="primary-button" type="button" onClick={onClose}>
          Got it — let's play
        </button>
      </section>
    </div>
  );
}

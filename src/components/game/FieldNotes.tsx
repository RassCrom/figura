import { BookOpenText, LetterText, Tag, type LucideIcon } from "lucide-react";

import type { GameHint } from "../../stores/useGameStore";
import type { Figure } from "../../types/figure";

const GAME_HINTS: Array<{
  id: GameHint;
  icon: LucideIcon;
  label: string;
  shortLabel: string;
}> = [
  { id: "initial", icon: LetterText, label: "Reveal surname initial", shortLabel: "Initial" },
  {
    id: "description",
    icon: BookOpenText,
    label: "Show person description",
    shortLabel: "Description",
  },
  { id: "category", icon: Tag, label: "Show person category", shortLabel: "Category" },
];

type Props = {
  figure: Figure | null;
  usedGameHints: GameHint[];
  roundGameHints: GameHint[];
  maxHints: number;
  playing: boolean;
  onActivate: (hint: GameHint) => void;
};

export function FieldNotes({
  figure,
  usedGameHints,
  roundGameHints,
  maxHints,
  playing,
  onActivate,
}: Props) {
  const initialSource = figure?.last_name.trim() || figure?.first_name.trim() || "";
  const revealedInitial = initialSource.charAt(0).toLocaleUpperCase();

  return (
    <div className="field-notes">
      <div className="field-notes-header">
        <span>Field notes</span>
        <small>{maxHints - usedGameHints.length} left this game</small>
      </div>
      <div className="game-hint-actions" aria-label="Game hints">
        {GAME_HINTS.map((hint) => {
          const Icon = hint.icon;
          const used = usedGameHints.includes(hint.id);
          const active = roundGameHints.includes(hint.id);
          return (
            <button
              key={hint.id}
              className={`game-hint-button${active ? " active" : ""}`}
              type="button"
              onClick={() => onActivate(hint.id)}
              disabled={!playing || used || usedGameHints.length >= maxHints}
              aria-label={`${hint.label}. ${used ? "Already used" : "Available once this game"}.`}
              aria-pressed={active}
            >
              <Icon aria-hidden="true" size={17} />
              <span>{hint.shortLabel}</span>
              <small>{used ? (active ? "Revealed" : "Spent") : "1 use"}</small>
            </button>
          );
        })}
      </div>
      {roundGameHints.length > 0 && figure ? (
        <div className="field-note-reveals" aria-live="polite">
          {roundGameHints.includes("initial") ? (
            <p>
              <span>{figure.last_name.trim() ? "Surname" : "Name"} starts with</span>
              <strong className="initial-reveal">{revealedInitial}</strong>
            </p>
          ) : null}
          {roundGameHints.includes("category") ? (
            <p>
              <span>Category</span>
              <strong>{figure.category}</strong>
            </p>
          ) : null}
          {roundGameHints.includes("description") ? (
            <p className="description-reveal">
              <span>Description</span>
              <strong>{figure.description}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

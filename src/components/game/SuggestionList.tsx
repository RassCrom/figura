import {
  Brush,
  Compass,
  Crown,
  Dumbbell,
  FlaskConical,
  Music,
  PenTool,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { en } from "../../i18n/en";
import { getFullName, parseHistoricalYear } from "../../lib/figures";
import type { FigureIndex } from "../../types/figure";

const CATEGORY_META: Record<string, { icon: LucideIcon; label: string }> = {
  Artist: { icon: Brush, label: "Artist" },
  Explorer: { icon: Compass, label: "Explorer" },
  Leader: { icon: Crown, label: "Leader" },
  Musician: { icon: Music, label: "Musician" },
  Philosopher: { icon: ScrollText, label: "Philosopher" },
  Scientist: { icon: FlaskConical, label: "Scientist" },
  Sportsman: { icon: Dumbbell, label: "Sportsman" },
  Writer: { icon: PenTool, label: "Writer" },
};

function getCenturyLabel(figure: FigureIndex): string {
  const year = parseHistoricalYear(figure.birth_date);
  if (year == null) {
    return en.centuryUnknown;
  }
  const century = Math.floor((Math.abs(year) - 1) / 100) + 1;
  return en.century(century, year < 0);
}

type Props = {
  suggestions: FigureIndex[];
  activeSuggestion: number;
  showMetadata: boolean;
  onPick: (name: string) => void;
};

export function SuggestionList({ suggestions, activeSuggestion, showMetadata, onPick }: Props) {
  if (suggestions.length === 0) {
    return null;
  }
  return (
    <div className="suggestions" role="listbox">
      {suggestions.map((figure, index) => {
        const meta = CATEGORY_META[figure.category] ?? {
          icon: ScrollText,
          label: figure.category,
        };
        const Icon = meta.icon;
        return (
          <button
            key={getFullName(figure)}
            type="button"
            className={index === activeSuggestion ? "suggestion active" : "suggestion"}
            onClick={() => onPick(getFullName(figure))}
            role="option"
            aria-selected={index === activeSuggestion}
          >
            {showMetadata ? (
              <span className="suggestion-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
            ) : null}
            <span className="suggestion-copy">
              <strong>{getFullName(figure)}</strong>
              {showMetadata ? (
                <small>
                  {getCenturyLabel(figure)} · {meta.label}
                </small>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

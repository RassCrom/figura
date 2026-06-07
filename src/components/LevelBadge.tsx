import { BookOpen, Compass, Crown, Eye, Map, type LucideIcon } from "lucide-react";

import type { PlayerLevel } from "../types/figure";

const levelIcons: Record<PlayerLevel, LucideIcon> = {
  Traveler: Compass,
  Cartographer: Map,
  Historian: BookOpen,
  Oracle: Eye,
  Legend: Crown,
};

export function LevelBadge({
  level,
  emblem = false,
}: {
  level: PlayerLevel;
  emblem?: boolean;
}) {
  const Icon = levelIcons[level];
  return (
    <span className={`level-badge level-${level.toLowerCase()}${emblem ? " emblem" : ""}`}>
      <span className="level-badge-icon" aria-hidden="true">
        <Icon size={emblem ? 28 : 15} />
      </span>
      <span>{level}</span>
    </span>
  );
}

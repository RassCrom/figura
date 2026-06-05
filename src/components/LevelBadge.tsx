import { Compass } from "lucide-react";

import type { PlayerLevel } from "../types/figure";

export function LevelBadge({ level }: { level: PlayerLevel }) {
  return (
    <span className="level-badge">
      <Compass aria-hidden="true" size={15} />
      {level}
    </span>
  );
}

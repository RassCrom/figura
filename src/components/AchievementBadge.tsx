import {
  Crown,
  Flame,
  Globe2,
  Map,
  Snowflake,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { ACHIEVEMENTS } from "../lib/progression";
import type { AchievementId } from "../types/figure";

const achievementIcons: Record<AchievementId, LucideIcon> = {
  first_blood: Target,
  lightning_round: Zap,
  ice_cold: Snowflake,
  around_the_world: Globe2,
  on_fire: Flame,
  silk_road: Map,
  great_khan: Crown,
};

export function AchievementBadge({ id, compact = false }: { id: AchievementId; compact?: boolean }) {
  const achievement = ACHIEVEMENTS.find((item) => item.id === id);
  const Icon = achievementIcons[id] ?? Trophy;

  if (!achievement) {
    return null;
  }

  return (
    <span className={compact ? "achievement-badge compact" : "achievement-badge"} title={achievement.description}>
      <Icon aria-hidden="true" size={compact ? 15 : 18} />
      <span>{achievement.name}</span>
    </span>
  );
}

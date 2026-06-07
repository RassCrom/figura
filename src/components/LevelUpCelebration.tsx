import { useEffect } from "react";

import type { PlayerLevel } from "../types/figure";
import { LevelBadge } from "./LevelBadge";

export function LevelUpCelebration({
  level,
  onDismiss,
}: {
  level: PlayerLevel;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="level-up-backdrop" role="dialog" aria-modal="true" aria-label={`Level up: ${level}`}>
      <div className="level-up-rays" aria-hidden="true" />
      <button className="level-up-card" type="button" onClick={onDismiss}>
        <span className="eyebrow">New rank attained</span>
        <LevelBadge level={level} emblem />
        <strong>Level up</strong>
        <small>Tap to continue</small>
      </button>
    </div>
  );
}

import { getLevelInfo } from "../lib/progression";

export function LevelProgress({ xp }: { xp: number }) {
  const level = getLevelInfo(xp);
  const xpToNext = level.nextMin ? Math.max(0, level.nextMin - xp) : 0;

  return (
    <section className="level-progress" aria-label="Level progress">
      <div className="level-progress-header">
        <span>{level.levelName}</span>
        <strong>{xp.toLocaleString()} XP</strong>
      </div>
      <div className="level-track" aria-hidden="true">
        <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </div>
      <p>
        {level.nextLevelName ? `${xpToNext.toLocaleString()} XP to ${level.nextLevelName}` : "Maximum level reached"}
      </p>
    </section>
  );
}

export function TimerArc({ seconds, maxSeconds }: { seconds: number; maxSeconds: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, seconds / maxSeconds));
  const dashOffset = circumference * (1 - progress);
  const statusClass = seconds <= 5 ? "danger" : seconds <= 10 ? "warning" : "";

  return (
    <div
      className={`timer-arc ${statusClass}`}
      aria-label={`${Math.ceil(seconds)} seconds remaining`}
    >
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} className="timer-track" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          className="timer-progress"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="timer-value">
        <strong>{Math.ceil(seconds)}</strong>
        <span>sec</span>
      </span>
    </div>
  );
}

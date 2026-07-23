import { Globe2, Trophy, CheckCircle2, XCircle } from "lucide-react";
import type { RoundResult } from "../../types/figure";

/** Icon color + component for a round result cell in the share image card */
export function ResultIcon({ result }: { result: RoundResult }) {
  if (!result.correct) {
    return <XCircle size={22} color="#e05555" strokeWidth={1.8} />;
  }
  if (result.firstGuess) {
    return <CheckCircle2 size={22} color="#efc75a" strokeWidth={1.8} />;
  }
  return <CheckCircle2 size={22} color="#5ec97a" strokeWidth={1.8} />;
}

/** A clean card rendered off-screen and captured as a PNG for sharing */
export function ShareImageCard({
  mode,
  dayNumber,
  score,
  rank,
  results,
  shareUrl,
}: {
  mode: string;
  dayNumber: number | null;
  score: number;
  rank: string;
  results: RoundResult[];
  shareUrl: string;
}) {
  const challengeHost = new URL(shareUrl).host;

  return (
    <div
      style={{
        width: 480,
        background: "linear-gradient(160deg, #120f08 0%, #1c1610 60%, #0e0b06 100%)",
        borderRadius: 20,
        padding: "36px 40px 32px",
        fontFamily: "'Inter', 'Outfit', system-ui, sans-serif",
        color: "#e8dfc8",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Globe2 size={22} color="#c8962a" strokeWidth={1.6} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#c8962a",
          }}
        >
          FIGURA
        </span>
      </div>
      {/* Day tag */}
      {mode === "daily" && dayNumber ? (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 12,
            color: "#9a8a6a",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Daily Challenge / Day {dayNumber}
        </p>
      ) : null}
      {/* Score row */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 4 }}>
        <Trophy size={28} color="#efc75a" strokeWidth={1.6} />
        <p
          style={{
            margin: 0,
            fontSize: 48,
            fontWeight: 800,
            lineHeight: 1,
            color: "#efc75a",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {score.toLocaleString()}
        </p>
      </div>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13,
          color: "#9a8a6a",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {rank}
      </p>
      {/* Round grid */}
      <div style={{ display: "flex", gap: 8 }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: r.correct
                ? r.firstGuess
                  ? "rgba(239,199,90,0.12)"
                  : "rgba(60,180,80,0.14)"
                : "rgba(220,60,60,0.14)",
              border: `1px solid ${r.correct ? (r.firstGuess ? "rgba(239,199,90,0.4)" : "rgba(60,180,80,0.4)") : "rgba(220,60,60,0.4)"}`,
              borderRadius: 10,
              padding: "10px 4px 8px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
            }}
          >
            <ResultIcon result={r} />
            <div
              style={{
                fontSize: 10,
                color: "#9a8a6a",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              R{r.round}
            </div>
          </div>
        ))}
      </div>
      {/* Challenge footer */}
      <p
        style={{
          margin: "22px 0 4px",
          fontSize: 14,
          fontWeight: 700,
          color: "#e8dfc8",
          textAlign: "center",
        }}
      >
        Can you beat my journey?
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: "rgba(154,138,106,0.6)",
          textAlign: "center",
          letterSpacing: "0.04em",
        }}
      >
        {mode === "daily" ? `${challengeHost}/daily` : challengeHost}
      </p>
    </div>
  );
}

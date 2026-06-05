import { Link } from "react-router-dom";

import { LeaderboardTable } from "../components/LeaderboardTable";
import { TopNav } from "../components/TopNav";
import { en } from "../i18n/en";
import { useLeaderboardStore } from "../stores/useLeaderboardStore";

export function LeaderboardPage() {
  const entries = useLeaderboardStore((state) => state.entries);

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-panel" aria-labelledby="leaderboard-title">
        <h1 id="leaderboard-title">{en.leaderboard}</h1>
        <LeaderboardTable entries={entries} />
        <Link className="primary-button compact-action" to="/">
          {en.home}
        </Link>
      </section>
    </main>
  );
}

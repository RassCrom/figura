import { Link } from "react-router-dom";

import { Logo } from "./Logo";

export function TopNav() {
  return (
    <header className="top-nav">
      <Link to="/" aria-label="Home">
        <Logo />
      </Link>
      <nav>
        <Link to="/atlas">Atlas</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/settings">Settings</Link>
        <Link to="/leaderboard">Leaderboard</Link>
      </nav>
    </header>
  );
}

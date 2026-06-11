const STORAGE_KEY = "gtf_howto_seen";

export function hasSeenHowToPlay(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage unavailable — never auto-open so we don't nag on every visit.
    return true;
  }
}

export function markHowToPlaySeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ignore: the guide stays reachable from the home screen button.
  }
}

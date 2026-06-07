const ACTIVITY_KEY = "gtf_local_activity";

type LocalActivity = {
  day: string;
  played: boolean;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordLocalPlay(): void {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify({ day: todayUtc(), played: true }));
}

export function getLocalPlayersToday(): number {
  try {
    const activity = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "null") as LocalActivity | null;
    return activity?.day === todayUtc() && activity.played ? 1 : 0;
  } catch {
    return 0;
  }
}

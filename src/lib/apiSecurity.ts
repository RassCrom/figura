const NICKNAME_CHARSET = /^[A-Za-z0-9_.\- ]+$/;
const NICKNAME_FORMAT_GUARD = /^[._\- ]|[._\- ]$|[._\- ]{2,}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const KNOWN_RPC_ERRORS = [
  "AUTH_REQUIRED",
  "BAD_DIFFICULTY",
  "BAD_MODE",
  "BAD_RESULTS_SHAPE",
  "BAD_RESULTS_LENGTH",
  "BAD_ROUND_SCORE",
  "BAD_TOTAL_SCORE",
  "BAD_CATEGORIES",
  "BAD_ACHIEVEMENTS",
  "DAILY_DATE_REQUIRED",
  "DAILY_DATE_INVALID",
  "DAILY_ALREADY_PLAYED",
  "RATE_LIMIT",
  "NICKNAME_LENGTH",
  "NICKNAME_CHARSET",
  "NICKNAME_FORMAT",
  "NICKNAME_FORBIDDEN",
  "NICKNAME_RESERVED",
  "NICKNAME_TAKEN",
] as const;

export function nicknameValidationError(nickname: string): string | null {
  if (nickname.length < 2 || nickname.length > 20) return "NICKNAME_LENGTH";
  if (!NICKNAME_CHARSET.test(nickname)) return "NICKNAME_CHARSET";
  if (NICKNAME_FORMAT_GUARD.test(nickname)) return "NICKNAME_FORMAT";
  return null;
}

export function isValidPublicNickname(nickname: string): boolean {
  return nicknameValidationError(nickname) === null;
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function clampPublicLimit(limit: number, maximum = 100): number {
  if (!Number.isFinite(limit)) return maximum;
  return Math.min(Math.max(Math.trunc(limit), 1), maximum);
}

export function parseRpcError(message: string): string {
  for (const code of KNOWN_RPC_ERRORS) {
    if (message.includes(code)) return code;
  }
  return "SERVER_ERROR";
}

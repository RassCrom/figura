import { describe, expect, it } from "vitest";

import {
  clampPublicLimit,
  isIsoDate,
  isValidPublicNickname,
  nicknameValidationError,
  parseRpcError,
} from "./apiSecurity";

describe("API security helpers", () => {
  it("does not expose unknown database error details", () => {
    expect(parseRpcError('relation "private_scores" does not exist')).toBe("SERVER_ERROR");
    expect(parseRpcError("Postgres error: RATE_LIMIT")).toBe("RATE_LIMIT");
  });

  it("validates public nicknames before sending RPC requests", () => {
    expect(isValidPublicNickname("Ada Lovelace")).toBe(true);
    expect(nicknameValidationError("../admin")).toBe("NICKNAME_CHARSET");
    expect(nicknameValidationError("a")).toBe("NICKNAME_LENGTH");
    expect(nicknameValidationError("name/route")).toBe("NICKNAME_CHARSET");
  });

  it("validates dates and clamps public query limits", () => {
    expect(isIsoDate("2026-06-15")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(clampPublicLimit(1000)).toBe(100);
    expect(clampPublicLimit(-5)).toBe(1);
  });
});

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  createSessionMock,
  toPublicProfileMock,
  enforceRateLimitMock,
  getRateLimitIdentifierMock,
  loggerWarnMock,
  requestLoggerWarnMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  createSessionMock: vi.fn(),
  toPublicProfileMock: vi.fn(),
  enforceRateLimitMock: vi.fn(),
  getRateLimitIdentifierMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  requestLoggerWarnMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
  handlers: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/services/SessionService", () => ({
  SessionService: {
    createSession: createSessionMock,
    toPublicProfile: toPublicProfileMock,
  },
}));

vi.mock("@/utils/request", () => ({
  enforceRateLimit: enforceRateLimitMock,
  getRateLimitIdentifier: getRateLimitIdentifierMock,
}));

vi.mock("@/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: loggerWarnMock,
    error: vi.fn(),
    child: vi.fn(),
  },
  createRequestLogger: vi.fn(() => ({
    warn: requestLoggerWarnMock,
  })),
}));

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/game/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/game/session", () => {
  beforeEach(() => {
    vi.resetModules();

    authMock.mockReset();
    createSessionMock.mockReset();
    toPublicProfileMock.mockReset();
    enforceRateLimitMock.mockReset();
    getRateLimitIdentifierMock.mockReset();
    loggerWarnMock.mockReset();
    requestLoggerWarnMock.mockReset();

    authMock.mockResolvedValue(null);
    enforceRateLimitMock.mockResolvedValue(undefined);
    getRateLimitIdentifierMock.mockReturnValue("ip:test");
    toPublicProfileMock.mockReturnValue({
      id: "profile-1",
      difficulty: "EASY",
      scenario: "Scenario",
    });
    createSessionMock.mockResolvedValue({
      session: {
        id: "session-1",
        guestToken: "guest-1",
        profileOrder: ["profile-1"],
        currentIndex: 0,
      },
      firstProfile: {
        id: "profile-1",
      },
    });
  });

  it("returns a guest session when auth is unavailable", async () => {
    authMock.mockRejectedValueOnce(new Error("MissingSecret"));

    const { POST } = await import("@/app/api/game/session/route");
    const response = await POST(createRequest({}));

    expect(response.status).toBe(200);
    expect(createSessionMock).toHaveBeenCalledWith(undefined);
    expect(loggerWarnMock).toHaveBeenCalledTimes(1);

    const payload = await response.json();
    expect(payload.sessionId).toBe("session-1");
    expect(payload.guestToken).toBe("guest-1");
  });
});

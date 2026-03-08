import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  profileCountMock,
  loggerErrorMock,
  redisState,
  requestLoggerWarnMock,
} = vi.hoisted(() => ({
  profileCountMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  redisState: { current: null as object | null },
  requestLoggerWarnMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profile: {
      count: profileCountMock,
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisState.current;
  },
}));

vi.mock("@/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: vi.fn(),
    error: loggerErrorMock,
    child: vi.fn(),
  },
  createRequestLogger: vi.fn(() => ({
    warn: requestLoggerWarnMock,
  })),
}));

function createRequest(): NextRequest {
  return new NextRequest("http://localhost/api/health");
}

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();

    profileCountMock.mockReset();
    loggerErrorMock.mockReset();
    requestLoggerWarnMock.mockReset();
    redisState.current = null;
  });

  it("returns 200 when guest session prerequisites are satisfied", async () => {
    profileCountMock.mockResolvedValue(8);
    redisState.current = { connected: true };
    vi.stubEnv("NEXTAUTH_SECRET", "secret");

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(createRequest());

    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.checks.guestStart.ok).toBe(true);
    expect(payload.checks.signIn.ok).toBe(true);
    expect(payload.checks.database.activeProfileCount).toBe(8);
    expect(payload.checks.redis.mode).toBe("upstash");
  });

  it("returns 503 when the database has no active profiles", async () => {
    profileCountMock.mockResolvedValue(0);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET(createRequest());

    expect(response.status).toBe(503);

    const payload = await response.json();
    expect(payload.ok).toBe(false);
    expect(payload.checks.guestStart.ok).toBe(false);
    expect(payload.checks.database.activeProfileCount).toBe(0);
    expect(payload.checks.signIn.ok).toBe(false);
  });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { withErrorHandler } from "@/utils/apiError";
import logger from "@/utils/logger";

type CheckStatus = "ok" | "warning" | "error";

type HealthCheck = {
  detail: string;
  ok: boolean;
  status: CheckStatus;
};

type DatabaseCheck = HealthCheck & {
  activeProfileCount: number | null;
};

type RedisCheck = HealthCheck & {
  mode: "upstash" | "local-fallback";
};

export const dynamic = "force-dynamic";

function getAuthCheck(): HealthCheck {
  if (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) {
    return {
      ok: true,
      status: "ok",
      detail: "Auth secret configured",
    };
  }

  return {
    ok: false,
    status: "warning",
    detail: "NEXTAUTH_SECRET/AUTH_SECRET is missing; guest play can still work, sign-in cannot",
  };
}

function getRedisCheck(): RedisCheck {
  if (redis) {
    return {
      ok: true,
      status: "ok",
      mode: "upstash",
      detail: "Redis configured",
    };
  }

  return {
    ok: true,
    status: "warning",
    mode: "local-fallback",
    detail: "Redis not configured; using in-memory fallback",
  };
}

async function getDatabaseCheck(): Promise<DatabaseCheck> {
  try {
    const activeProfileCount = await prisma.profile.count({
      where: { isActive: true },
    });

    if (activeProfileCount === 0) {
      return {
        ok: false,
        status: "error",
        activeProfileCount,
        detail: "Database reachable but no active profiles are seeded",
      };
    }

    return {
      ok: true,
      status: "ok",
      activeProfileCount,
      detail: `${activeProfileCount} active profiles available`,
    };
  } catch (error) {
    logger.error({ err: error }, "Health check database query failed");
    return {
      ok: false,
      status: "error",
      activeProfileCount: null,
      detail: "Database query failed",
    };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return withErrorHandler(request, async () => {
    const auth = getAuthCheck();
    const db = await getDatabaseCheck();
    const redisCheck = getRedisCheck();

    const guestStartReady = db.ok;

    const payload = {
      ok: guestStartReady,
      timestamp: new Date().toISOString(),
      checks: {
        guestStart: {
          ok: guestStartReady,
          status: guestStartReady ? "ok" : "error",
          detail: guestStartReady
            ? "Guest session creation prerequisites are satisfied"
            : db.detail,
        },
        signIn: auth,
        database: db,
        redis: redisCheck,
      },
    };

    return NextResponse.json(payload, {
      status: guestStartReady ? 200 : 503,
    });
  });
}

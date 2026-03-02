import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import logger, { createRequestLogger } from "@/utils/logger";

export const SESSION_NOT_FOUND = {
  code: "SESSION_NOT_FOUND",
  statusCode: 404,
} as const;

export const SESSION_EXPIRED = {
  code: "SESSION_EXPIRED",
  statusCode: 410,
} as const;

export const SESSION_ALREADY_COMPLETE = {
  code: "SESSION_ALREADY_COMPLETE",
  statusCode: 409,
} as const;

export const PROFILE_ALREADY_ANSWERED = {
  code: "PROFILE_ALREADY_ANSWERED",
  statusCode: 409,
} as const;

export const INVALID_SELECTIONS = {
  code: "INVALID_SELECTIONS",
  statusCode: 422,
} as const;

export const RATE_LIMIT_EXCEEDED = {
  code: "RATE_LIMIT_EXCEEDED",
  statusCode: 429,
} as const;

export const AI_SERVICE_UNAVAILABLE = {
  code: "AI_SERVICE_UNAVAILABLE",
  statusCode: 503,
} as const;

export const UNAUTHORIZED = {
  code: "UNAUTHORIZED",
  statusCode: 401,
} as const;

export class APIError extends Error {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? randomUUID();
}

function toErrorResponse(statusCode: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
      },
    },
    {
      status: statusCode,
      headers: {
        "x-request-id": requestId,
      },
    }
  );
}

export async function withErrorHandler(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const requestLogger = createRequestLogger(requestId);

  try {
    const response = await handler();
    response.headers.set("x-request-id", requestId);
    return response;
  } catch (error) {
    if (error instanceof APIError) {
      requestLogger.warn({ err: error, code: error.code }, "Handled API error");
      return toErrorResponse(error.statusCode, error.code, error.message, requestId);
    }

    if (error instanceof ZodError) {
      requestLogger.warn({ err: error }, "Request validation failed");
      return toErrorResponse(
        INVALID_SELECTIONS.statusCode,
        INVALID_SELECTIONS.code,
        "Invalid request payload",
        requestId
      );
    }

    logger.error({ err: error, requestId }, "Unhandled API error");
    return toErrorResponse(500, "INTERNAL_SERVER_ERROR", "Something went wrong", requestId);
  }
}

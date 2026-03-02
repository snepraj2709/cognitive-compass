import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { withRequestId } from "@/utils/logger";

export class APIError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

type RouteContext = {
  params?: Record<string, string | string[] | undefined>;
};

type Handler = (request: NextRequest, context: RouteContext) => Promise<Response>;

function resolveRequestId(request: NextRequest) {
  return request.headers.get("x-request-id") ?? randomUUID();
}

export function withErrorHandler(handler: Handler) {
  return async (request: NextRequest, context: RouteContext = {}): Promise<Response> => {
    const requestId = resolveRequestId(request);
    const reqLogger = withRequestId(requestId);

    try {
      const response = await handler(request, context);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      if (error instanceof APIError) {
        reqLogger.warn({ err: error, code: error.code }, "Handled API error");
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          {
            status: error.statusCode,
            headers: { "x-request-id": requestId },
          }
        );
      }

      if (error instanceof ZodError) {
        reqLogger.warn({ err: error }, "Validation error");
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid request payload",
              details: error.flatten(),
            },
          },
          {
            status: 400,
            headers: { "x-request-id": requestId },
          }
        );
      }

      reqLogger.error({ err: error }, "Unhandled API error");
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong",
          },
        },
        {
          status: 500,
          headers: { "x-request-id": requestId },
        }
      );
    }
  };
}

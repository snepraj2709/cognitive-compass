import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "authorization",
      "apiKey",
      "password",
      "passwordHash",
      "token",
      "jwt",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function withRequestId(requestId: string) {
  return logger.child({ requestId });
}

import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  base: {
    service: "cogos-api",
  },
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

export default logger;

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}

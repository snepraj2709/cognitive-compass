import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __cogosPrisma: PrismaClient | undefined;
}

const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

export const prisma = globalThis.__cogosPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__cogosPrisma = prisma;
}

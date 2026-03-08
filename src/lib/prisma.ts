import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __cogosPrisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient | undefined;

const createClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

function getPrismaClient(): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  prismaClient = globalThis.__cogosPrisma ?? createClient();

  if (process.env.NODE_ENV !== "production") {
    globalThis.__cogosPrisma = prismaClient;
  }

  return prismaClient;
}

// Delay Prisma client construction until the first actual DB access so builds do not
// fail while merely importing route modules on Vercel.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

export { getPrismaClient };

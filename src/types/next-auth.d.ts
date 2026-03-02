import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      xp: number;
      level: number;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    xp: number;
    level: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    xp?: number;
    level?: number;
  }
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { CredentialsSchema } from "@/validations/game.schemas";

const providers = [
  Credentials({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = CredentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user?.passwordHash) {
        return null;
      }

      const valid = await compare(parsed.data.password, user.passwordHash);
      if (!valid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        xp: user.xp,
        level: user.level,
      };
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        return true;
      }

      if (!user.email) {
        return false;
      }

      const upserted = await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          provider: account?.provider ?? "oauth",
        },
        create: {
          email: user.email,
          name: user.name,
          provider: account?.provider ?? "oauth",
        },
      });

      user.id = upserted.id;
      user.xp = upserted.xp;
      user.level = upserted.level;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.xp = user.xp;
        token.level = user.level;
        return token;
      }

      if (!token.sub) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
      if (!dbUser) {
        return token;
      }

      token.email = dbUser.email;
      token.xp = dbUser.xp;
      token.level = dbUser.level;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.xp = typeof token.xp === "number" ? token.xp : 0;
        session.user.level = typeof token.level === "number" ? token.level : 1;
      }

      return session;
    },
  },
});

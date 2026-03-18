import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/db/prisma";

const baseAdapter = PrismaAdapter(prisma);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: {
    ...baseAdapter,
    async createUser({ name, ...data }) {
      return prisma.user.create({
        data: {
          ...data,
          displayName: name ?? data.email?.split("@")[0] ?? "Member",
        },
      });
    },
    async updateUser({ id, name, ...data }) {
      return prisma.user.update({
        where: { id },
        data: {
          ...data,
          ...(typeof name === "string" ? { displayName: name } : {}),
        },
      });
    },
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      const source = user as (typeof user & { displayName?: string | null }) | undefined;

      if (source) {
        token.name = source.name ?? source.displayName ?? token.name;
        token.email = source.email ?? token.email;
        token.picture = source.image ?? token.picture;
      }

      return token;
    },
    async session({ session, token, user }) {
      const fallbackName = typeof token.name === "string" ? token.name : null;
      const fallbackEmail = typeof token.email === "string" ? token.email : session.user?.email ?? "";
      const fallbackImage = typeof token.picture === "string" ? token.picture : null;
      const userName = typeof user?.name === "string" ? user.name : null;
      const userEmail = typeof user?.email === "string" ? user.email : null;
      const userImage = typeof user?.image === "string" ? user.image : null;

      if (session.user) {
        session.user.name = userName ?? fallbackName;
        session.user.email = userEmail ?? fallbackEmail;
        session.user.image = userImage ?? fallbackImage;
      }
      return session;
    },
  },
});

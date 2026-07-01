import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { demoMode, demoPassword, findDemoUser } from "@/lib/demo";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        if (demoMode) {
          const demoUser = findDemoUser(credentials.email);
          if (!demoUser || credentials.password !== demoPassword) return null;
          return {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            roleKey: demoUser.role.key,
            roleName: demoUser.role.name,
            scope: "ASSIGNED",
            permissions: [],
            businessUnitId: null,
            departmentId: demoUser.departmentId,
            departmentName: demoUser.departmentName,
            storeId: demoUser.storeId,
            storeName: demoUser.storeName
          };
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: true, department: true, store: true }
        });
        if (!user || !user.isActive) return null;
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          roleKey: user.role.key,
          roleName: user.role.name,
          scope: user.role.scope,
          permissions: user.role.permissions,
          businessUnitId: user.businessUnitId,
          departmentId: user.departmentId,
          departmentName: user.department?.name ?? null,
          storeId: user.storeId,
          storeName: user.store?.name ?? null
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleKey = user.roleKey;
        token.roleName = user.roleName;
        token.scope = user.scope;
        token.permissions = user.permissions;
        token.businessUnitId = user.businessUnitId;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
        token.storeId = user.storeId;
        token.storeName = user.storeName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.roleKey = token.roleKey;
        session.user.roleName = token.roleName;
        session.user.scope = token.scope as string;
        session.user.permissions = token.permissions as string[];
        session.user.businessUnitId = token.businessUnitId as string | null;
        session.user.departmentId = token.departmentId as string | null;
        session.user.departmentName = token.departmentName as string | null;
        session.user.storeId = token.storeId as string | null;
        session.user.storeName = token.storeName as string | null;
      }
      return session;
    }
  }
};

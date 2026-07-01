import { RoleKey } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    roleKey: RoleKey;
    roleName: string;
    scope: string;
    permissions: string[];
    businessUnitId: string | null;
    departmentId: string | null;
    departmentName: string | null;
    storeId: string | null;
    storeName: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      roleKey: RoleKey;
      roleName: string;
      scope: string;
      permissions: string[];
      businessUnitId: string | null;
      departmentId: string | null;
      departmentName: string | null;
      storeId: string | null;
      storeName: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roleKey: RoleKey;
    roleName: string;
    scope: string;
    permissions: string[];
    businessUnitId: string | null;
    departmentId: string | null;
    departmentName: string | null;
    storeId: string | null;
    storeName: string | null;
  }
}

import type { RoleKey } from "@prisma/client";

export const demoMode = process.env.DEMO_MODE === "true";
export const demoPassword = "aaaa8888";

export const demoRoles = [
  { id: "role-gm", key: "GENERAL_MANAGER" as RoleKey, name: "\u7e3d\u7d93\u7406" },
  { id: "role-assistant", key: "EXECUTIVE_ASSISTANT" as RoleKey, name: "\u7e3d\u7d93\u7406\u7279\u52a9" },
  { id: "role-social", key: "SOCIAL_MEDIA_MANAGER" as RoleKey, name: "\u81ea\u5a92\u9ad4\u4e3b\u7ba1" },
  { id: "role-design", key: "DESIGN_MANAGER" as RoleKey, name: "\u7f8e\u5de5\u4e3b\u7ba1" },
  { id: "role-accounting", key: "ACCOUNTING_MANAGER" as RoleKey, name: "\u6703\u8a08\u4e3b\u7ba1" },
  { id: "role-construction", key: "CONSTRUCTION_MANAGER" as RoleKey, name: "\u5efa\u8a2d\u4e3b\u7ba1" },
  { id: "role-admin", key: "SYSTEM_ADMIN" as RoleKey, name: "\u7cfb\u7d71\u7ba1\u7406\u54e1" }
];

export const demoDepartments = [
  { id: "dept-gm", name: "\u7e3d\u7d93\u7406\u5ba4" },
  { id: "dept-admin", name: "\u884c\u653f\u90e8\u9580" },
  { id: "dept-hr", name: "\u4eba\u4e8b\u90e8\u9580" },
  { id: "dept-social", name: "\u81ea\u5a92\u9ad4\u90e8\u9580" },
  { id: "dept-design", name: "\u7f8e\u5de5\u90e8\u9580" },
  { id: "dept-accounting", name: "\u6703\u8a08\u90e8\u9580" },
  { id: "dept-construction", name: "\u5efa\u8a2d\u90e8\u9580" }
];

export const demoStores: Array<{ id: string; name: string; brand: string; departmentId: string; isActive: boolean }> = [];

export const demoUsers = [
  { id: "user-admin", name: "\u7cfb\u7d71\u7ba1\u7406\u54e1\u6e2c\u8a66\u5e33\u865f", email: "admin@huangxiang.local", role: demoRoles[6], departmentId: "dept-gm", departmentName: "\u7e3d\u7d93\u7406\u5ba4", storeId: null, storeName: null, isActive: true },
  { id: "user-gm", name: "\u7e3d\u7d93\u7406", email: "gm@huangxiang.local", role: demoRoles[0], departmentId: "dept-gm", departmentName: "\u7e3d\u7d93\u7406\u5ba4", storeId: null, storeName: null, isActive: true },
  { id: "user-yijing", name: "\u5b9c\u975c", email: "yijing@huangxiang.local", role: demoRoles[1], departmentId: "dept-admin", departmentName: "\u884c\u653f\u90e8\u9580", storeId: null, storeName: null, isActive: true },
  { id: "user-xiaofan", name: "\u5c0f\u51e1", email: "xiaofan@huangxiang.local", role: demoRoles[1], departmentId: "dept-hr", departmentName: "\u4eba\u4e8b\u90e8\u9580", storeId: null, storeName: null, isActive: true },
  { id: "user-michael", name: "\u9ea5\u53ef", email: "michael@huangxiang.local", role: demoRoles[2], departmentId: "dept-social", departmentName: "\u81ea\u5a92\u9ad4\u90e8\u9580", storeId: null, storeName: null, isActive: true },
  { id: "user-xiaozhi", name: "\u7b71\u667a", email: "xiaozhi@huangxiang.local", role: demoRoles[3], departmentId: "dept-design", departmentName: "\u7f8e\u5de5\u90e8\u9580", storeId: null, storeName: null, isActive: true },
  { id: "user-jiazhen", name: "\u5bb6\u8c9e", email: "jiazhen@huangxiang.local", role: demoRoles[4], departmentId: "dept-accounting", departmentName: "\u6703\u8a08\u90e8\u9580", storeId: null, storeName: null, isActive: true },
  { id: "user-boyuan", name: "\u4f2f\u6e90", email: "boyuan@huangxiang.local", role: demoRoles[5], departmentId: "dept-construction", departmentName: "\u5efa\u8a2d\u90e8\u9580", storeId: null, storeName: null, isActive: true }
];

export const demoApprovals: any[] = [];
export const demoTasks: any[] = [];
export const demoIssues: any[] = [];

type DemoAnnouncement = {
  id: string;
  title: string;
  content: string;
  requireConfirmation: boolean;
  publisher: { name: string };
  publishedAt: Date;
  reads: Array<{ userId: string }>;
  targets: Array<{ id: string; type: string; department: { name: string } | null; store: { name: string } | null }>;
  attachments: any[];
};

type DemoAuditForm = {
  id: string;
  name: string;
  isActive: boolean;
  records: any[];
  items: Array<{ id: string; sortOrder: number; label: string; maxScore: number }>;
};

export const demoAnnouncements: DemoAnnouncement[] = [];
export const demoInventoryRequests: any[] = [];
export const demoAuditForms: DemoAuditForm[] = [];

export function findDemoUser(email: string) {
  return demoUsers.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

import { PrismaClient, RoleKey, ScopeLevel } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const sharedPassword = "aaaa8888";

const text = {
  generalManager: "\u7e3d\u7d93\u7406",
  executiveAssistant: "\u7e3d\u7d93\u7406\u7279\u52a9",
  adminManager: "\u884c\u653f\u4e3b\u7ba1",
  accountingManager: "\u6703\u8a08\u4e3b\u7ba1",
  designManager: "\u7f8e\u5de5\u4e3b\u7ba1",
  socialMediaManager: "\u81ea\u5a92\u9ad4\u4e3b\u7ba1",
  hrManager: "\u4eba\u4e8b\u4e3b\u7ba1",
  constructionManager: "\u5efa\u8a2d\u4e3b\u7ba1",
  branchManager: "\u9928\u5225\u4e3b\u7ba1",
  manager: "\u4e3b\u7ba1",
  staff: "\u90e8\u9580\u4eba\u54e1",
  storeStaff: "\u9580\u5e02\u4eba\u54e1",
  systemAdmin: "\u7cfb\u7d71\u7ba1\u7406\u54e1",
  tester: "\u6e2c\u8a66\u4eba\u54e1",
  systemAdminAccount: "\u7cfb\u7d71\u7ba1\u7406\u54e1\u6e2c\u8a66\u5e33\u865f",
  hqUnit: "\u7687\u4eab\u4f01\u696d\u7e3d\u516c\u53f8",
  gmOffice: "\u7e3d\u7d93\u7406\u5ba4",
  hq: "\u7e3d\u516c\u53f8",
  adminDept: "\u884c\u653f\u90e8\u9580",
  hrDept: "\u4eba\u4e8b\u90e8\u9580",
  socialDept: "\u81ea\u5a92\u9ad4\u90e8\u9580",
  designDept: "\u7f8e\u5de5\u90e8\u9580",
  accountingDept: "\u6703\u8a08\u90e8\u9580",
  constructionDept: "\u5efa\u8a2d\u90e8\u9580",
  footMassage: "\u597d\u8173\u820d\u8db3\u9ad4\u990a\u8eab\u6703\u9928",
  pingtungStore: "\u5c4f\u6771\u745e\u5149\u9928",
  kaohsiungStore: "\u9ad8\u96c4\u4ec1\u6b66\u9928",
  efs: "EFS\u670d\u98fe\u5e97",
  warehouse: "\u5009\u7ba1\u6216\u63a1\u8cfc\u55ae\u4f4d",
  yijing: "\u5b9c\u975c",
  xiaofan: "\u5c0f\u51e1",
  michael: "\u9ea5\u53ef",
  xiaozhi: "\u7b71\u667a",
  jiazhen: "\u5bb6\u8c9e",
  boyuan: "\u4f2f\u6e90"
};

const roleDefinitions: Array<{
  key: RoleKey;
  name: string;
  description: string;
  scope: ScopeLevel;
  permissions: string[];
}> = [
  { key: "GENERAL_MANAGER", name: text.generalManager, description: "Company-wide decision maker.", scope: "GLOBAL", permissions: ["*"] },
  { key: "EXECUTIVE_ASSISTANT", name: text.executiveAssistant, description: "Tracks cross-department work for the general manager.", scope: "GLOBAL", permissions: ["dashboard:view", "tasks:manage", "pilot:view"] },
  { key: "ADMIN_MANAGER", name: text.adminManager, description: "Administrative workflow manager.", scope: "DEPARTMENT", permissions: ["tasks:manage", "services:manage"] },
  { key: "ACCOUNTING_MANAGER", name: text.accountingManager, description: "Accounting approval and document review manager.", scope: "DEPARTMENT", permissions: ["approvals:review", "sensitive:accounting"] },
  { key: "DESIGN_MANAGER", name: text.designManager, description: "Design service request manager.", scope: "DEPARTMENT", permissions: ["services:manage", "tasks:manage"] },
  { key: "SOCIAL_MEDIA_MANAGER", name: text.socialMediaManager, description: "Social media task and service request manager.", scope: "DEPARTMENT", permissions: ["services:manage", "tasks:manage"] },
  { key: "HR_MANAGER", name: text.hrManager, description: "HR task and sensitive people-data manager.", scope: "DEPARTMENT", permissions: ["tasks:manage", "sensitive:hr"] },
  { key: "CONSTRUCTION_MANAGER", name: text.constructionManager, description: "Construction and improvement task manager.", scope: "DEPARTMENT", permissions: ["tasks:manage", "services:manage"] },
  { key: "BRANCH_MANAGER", name: text.branchManager, description: "Branch-scoped manager.", scope: "BRANCH", permissions: ["tasks:manage", "issues:manage"] },
  { key: "MANAGER", name: text.manager, description: "Department manager.", scope: "DEPARTMENT", permissions: ["approvals:review", "tasks:manage"] },
  { key: "STAFF", name: text.staff, description: "Department staff.", scope: "SELF", permissions: ["approvals:create", "tasks:report"] },
  { key: "STORE_STAFF", name: text.storeStaff, description: "Store staff.", scope: "BRANCH", permissions: ["issues:create", "inventory:create"] },
  { key: "SYSTEM_ADMIN", name: text.systemAdmin, description: "System administrator.", scope: "GLOBAL", permissions: ["*"] },
  { key: "TESTER", name: text.tester, description: "Pilot tester.", scope: "SELF", permissions: ["pilot:test"] }
];

const accountDefinitions = [
  { name: text.systemAdminAccount, email: "admin@huangxiang.local", roleKey: "SYSTEM_ADMIN" as RoleKey, departmentName: text.gmOffice },
  { name: text.yijing, email: "yijing@huangxiang.local", roleKey: "EXECUTIVE_ASSISTANT" as RoleKey, departmentName: text.adminDept },
  { name: text.xiaofan, email: "xiaofan@huangxiang.local", roleKey: "EXECUTIVE_ASSISTANT" as RoleKey, departmentName: text.hrDept },
  { name: text.michael, email: "michael@huangxiang.local", roleKey: "SOCIAL_MEDIA_MANAGER" as RoleKey, departmentName: text.socialDept },
  { name: text.xiaozhi, email: "xiaozhi@huangxiang.local", roleKey: "DESIGN_MANAGER" as RoleKey, departmentName: text.designDept },
  { name: text.jiazhen, email: "jiazhen@huangxiang.local", roleKey: "ACCOUNTING_MANAGER" as RoleKey, departmentName: text.accountingDept },
  { name: text.boyuan, email: "boyuan@huangxiang.local", roleKey: "CONSTRUCTION_MANAGER" as RoleKey, departmentName: text.constructionDept },
  { name: text.generalManager, email: "gm@huangxiang.local", roleKey: "GENERAL_MANAGER" as RoleKey, departmentName: text.gmOffice }
];

async function upsertRole(definition: (typeof roleDefinitions)[number]) {
  return prisma.role.upsert({
    where: { key: definition.key },
    update: {
      name: definition.name,
      description: definition.description,
      scope: definition.scope,
      permissions: definition.permissions,
      isActive: true
    },
    create: {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      scope: definition.scope,
      permissions: definition.permissions,
      isActive: true
    }
  });
}

async function main() {
  const roles = await Promise.all(roleDefinitions.map(upsertRole));
  const roleByKey = new Map(roles.map((role) => [role.key, role]));

  const hqUnit = await prisma.businessUnit.upsert({
    where: { name: text.hqUnit },
    update: {},
    create: { name: text.hqUnit, description: "Internal company management unit." }
  });

  const departmentNames = [
    text.gmOffice,
    text.hq,
    text.adminDept,
    text.hrDept,
    text.socialDept,
    text.designDept,
    text.accountingDept,
    text.constructionDept,
    text.footMassage,
    text.pingtungStore,
    text.kaohsiungStore,
    text.efs,
    text.warehouse
  ];

  const departments = await Promise.all(
    departmentNames.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: { businessUnitId: hqUnit.id },
        create: { name, businessUnitId: hqUnit.id }
      })
    )
  );
  const departmentByName = new Map(departments.map((department) => [department.name, department]));

  const footDepartment = departmentByName.get(text.footMassage);
  const efsDepartment = departmentByName.get(text.efs);
  const stores = [
    { name: text.pingtungStore, brand: text.footMassage, departmentId: footDepartment?.id },
    { name: text.kaohsiungStore, brand: text.footMassage, departmentId: footDepartment?.id },
    { name: text.efs, brand: text.efs, departmentId: efsDepartment?.id }
  ];

  await Promise.all(
    stores.map((store) =>
      prisma.store.upsert({
        where: { name: store.name },
        update: { brand: store.brand, departmentId: store.departmentId, businessUnitId: hqUnit.id, isActive: true },
        create: { name: store.name, brand: store.brand, departmentId: store.departmentId, businessUnitId: hqUnit.id, isActive: true }
      })
    )
  );

  const passwordHash = await bcrypt.hash(sharedPassword, 10);
  for (const account of accountDefinitions) {
    const role = roleByKey.get(account.roleKey);
    const department = departmentByName.get(account.departmentName);
    if (!role) throw new Error(`Missing role: ${account.roleKey}`);
    if (!department) throw new Error(`Missing department: ${account.departmentName}`);

    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        name: account.name,
        passwordHash,
        roleId: role.id,
        businessUnitId: hqUnit.id,
        departmentId: department.id,
        storeId: null,
        isActive: true
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        roleId: role.id,
        businessUnitId: hqUnit.id,
        departmentId: department.id,
        storeId: null,
        isActive: true
      }
    });
  }

  await prisma.user.updateMany({
    where: { email: { notIn: accountDefinitions.map((account) => account.email) } },
    data: { isActive: false }
  });

  console.log(`Seed completed. Active test accounts: ${accountDefinitions.length}. Password: ${sharedPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

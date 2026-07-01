const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const password = "aaaa8888";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.role.upsert({ where: { key: "GENERAL_MANAGER" }, update: { name: "總經理", description: "查看所有資料、核准所有簽呈、管理權限與儀表板" }, create: { key: "GENERAL_MANAGER", name: "總經理", description: "查看所有資料、核准所有簽呈、管理權限與儀表板" } });
  await prisma.role.upsert({ where: { key: "MANAGER" }, update: { name: "主管", description: "查看所屬部門與門市、審核簽呈、指派任務" }, create: { key: "MANAGER", name: "主管", description: "查看所屬部門與門市、審核簽呈、指派任務" } });
  await prisma.role.upsert({ where: { key: "STAFF" }, update: { name: "部門人員", description: "提出簽呈、回報任務、查看相關案件" }, create: { key: "STAFF", name: "部門人員", description: "提出簽呈、回報任務、查看相關案件" } });
  await prisma.role.upsert({ where: { key: "STORE_STAFF" }, update: { name: "門市人員", description: "問題回報、補貨申請、稽核表、公告確認" }, create: { key: "STORE_STAFF", name: "門市人員", description: "問題回報、補貨申請、稽核表、公告確認" } });
  await prisma.role.upsert({ where: { key: "SYSTEM_ADMIN" }, update: { name: "系統管理員", description: "管理帳號、角色、部門、門市與流程設定" }, create: { key: "SYSTEM_ADMIN", name: "系統管理員", description: "管理帳號、角色、部門、門市與流程設定" } });
  const roles = Object.fromEntries((await prisma.role.findMany()).map((role) => [role.key, role]));

  const hq = await prisma.department.upsert({
    where: { name: "總公司" },
    update: { parentId: null },
    create: { name: "總公司" }
  });

  const departmentNames = [
    "人事部",
    "會計部",
    "行政部",
    "營運部",
    "自媒體部",
    "美工部",
    "倉管部",
    "稽核部",
    "好腳舍瑞光館",
    "好腳舍仁武館",
    "EFS 服飾門市"
  ];

  const departments = { "總公司": hq };
  for (const name of departmentNames) {
    departments[name] = await prisma.department.upsert({
      where: { name },
      update: { parentId: hq.id },
      create: { name, parentId: hq.id }
    });
  }

  const stores = {};
  stores["好腳舍瑞光館"] = await prisma.store.upsert({
    where: { name: "好腳舍瑞光館" },
    update: { brand: "好腳舍足體養身會館", departmentId: departments["營運部"].id, isActive: true },
    create: { name: "好腳舍瑞光館", brand: "好腳舍足體養身會館", departmentId: departments["營運部"].id }
  });
  stores["好腳舍仁武館"] = await prisma.store.upsert({
    where: { name: "好腳舍仁武館" },
    update: { brand: "好腳舍足體養身會館", departmentId: departments["營運部"].id, isActive: true },
    create: { name: "好腳舍仁武館", brand: "好腳舍足體養身會館", departmentId: departments["營運部"].id }
  });
  stores["EFS 服飾門市"] = await prisma.store.upsert({
    where: { name: "EFS 服飾門市" },
    update: { brand: "EFS 服飾", departmentId: departments["EFS 服飾門市"].id, isActive: true },
    create: { name: "EFS 服飾門市", brand: "EFS 服飾", departmentId: departments["EFS 服飾門市"].id }
  });

  const users = [
    ["gm@huangxiang.local", "皇享總經理", "GENERAL_MANAGER", "總公司", null],
    ["admin@huangxiang.local", "王大明", "SYSTEM_ADMIN", "行政部", null],
    ["manager@huangxiang.local", "林主管", "MANAGER", "行政部", null],
    ["staff@huangxiang.local", "陳小美", "STAFF", "行政部", null],
    ["warehouse@huangxiang.local", "張倉管", "STAFF", "倉管部", null],
    ["auditor@huangxiang.local", "李稽核", "MANAGER", "稽核部", null],
    ["trainer@huangxiang.local", "黃講師", "STAFF", "人事部", null],
    ["store@huangxiang.local", "吳門市", "STORE_STAFF", "營運部", "好腳舍瑞光館"]
  ];

  const createdUsers = {};
  for (const [email, name, roleKey, departmentName, storeName] of users) {
    createdUsers[email] = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        roleId: roles[roleKey].id,
        departmentId: departments[departmentName].id,
        storeId: storeName ? stores[storeName].id : null,
        passwordHash,
        isActive: true
      },
      create: {
        email,
        name,
        roleId: roles[roleKey].id,
        departmentId: departments[departmentName].id,
        storeId: storeName ? stores[storeName].id : null,
        passwordHash,
        isActive: true
      }
    });
  }

  await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { contains: "測試" } },
        { title: { contains: "???" } },
        { body: { contains: "????" } },
        { body: { contains: "外網" } },
        { dedupeKey: { contains: "test:" } }
      ]
    }
  });
  await prisma.task.deleteMany({
    where: {
      OR: [
        { title: { contains: "外網" } },
        { title: { contains: "測試" } },
        { title: { contains: "洗頭毛" } },
        { title: { contains: "???" } },
        { content: { contains: "測試" } }
      ]
    }
  });
  await prisma.approvalRequest.deleteMany({
    where: {
      OR: [
        { subject: { contains: "????" } },
        { subject: { contains: "外網" } },
        { subject: { contains: "測試" } },
        { subject: { contains: "我缺錢" } },
        { subject: { contains: "肯德基" } },
        { subject: { contains: "夏天買衣服" } },
        { subject: { contains: "ai費用" } }
      ]
    }
  });
  await prisma.issueReport.deleteMany({ where: { OR: [{ description: { contains: "外網" } }, { description: { contains: "測試" } }] } });
  await prisma.inventoryRequest.deleteMany({ where: { OR: [{ itemName: { contains: "外網" } }, { itemName: { contains: "測試" } }] } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "external-test-" } } });
  await prisma.store.deleteMany({ where: { OR: [{ name: { contains: "外網測試" } }, { name: "屏東瑞光館" }, { name: "高雄仁武館" }, { name: "EFS服飾店" }] } }).catch(() => {});
  await prisma.department.deleteMany({ where: { OR: [{ name: { contains: "外網測試" } }, { name: "???" }, { name: "EFS服飾店" }, { name: "倉管或採購單位" }, { name: "好腳舍足體養身會館" }] } }).catch(() => {});

  const formalTaskTitles = ["瑞光館櫃台用品盤點", "仁武館冷氣維修追蹤", "七月社群素材確認"];
  await prisma.task.deleteMany({ where: { title: { in: formalTaskTitles } } });
  await prisma.task.createMany({
    data: [
      {
        title: "瑞光館櫃台用品盤點",
        content: "確認櫃台耗材、表單、清潔用品庫存，缺品請回報倉管部。",
        ownerId: createdUsers["store@huangxiang.local"].id,
        creatorId: createdUsers["manager@huangxiang.local"].id,
        departmentId: departments["營運部"].id,
        dueDate: new Date(Date.now() + 86400000),
        priority: "MEDIUM",
        status: "NOT_STARTED",
        progress: 0
      },
      {
        title: "仁武館冷氣維修追蹤",
        content: "聯絡廠商確認報價與可施工時間，完成後送主管審核。",
        ownerId: createdUsers["staff@huangxiang.local"].id,
        creatorId: createdUsers["manager@huangxiang.local"].id,
        departmentId: departments["行政部"].id,
        dueDate: new Date(Date.now() + 2 * 86400000),
        priority: "HIGH",
        status: "IN_PROGRESS",
        progress: 40
      },
      {
        title: "七月社群素材確認",
        content: "整理門市活動照片，交由自媒體部排程發文。",
        ownerId: createdUsers["trainer@huangxiang.local"].id,
        creatorId: createdUsers["manager@huangxiang.local"].id,
        departmentId: departments["自媒體部"].id,
        dueDate: new Date(Date.now() - 86400000),
        priority: "HIGH",
        status: "OVERDUE",
        progress: 60
      }
    ]
  });

  await prisma.approvalRequest.deleteMany({
    where: { subject: { in: ["仁武館冷氣維修申請", "瑞光館櫃台耗材補貨申請"] } }
  });
  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  await prisma.approvalRequest.create({
    data: {
      requestNo: `HX-${dateCode}-9001`,
      applicantId: createdUsers["staff@huangxiang.local"].id,
      departmentId: departments["行政部"].id,
      storeId: stores["好腳舍仁武館"].id,
      type: "REPAIR",
      subject: "仁武館冷氣維修申請",
      description: "仁武館二樓冷氣出風異常，需請廠商檢修並提供報價。",
      amount: 3500,
      status: "REVIEWING",
      steps: { create: [{ stepOrder: 1, title: "主管審核", approverId: createdUsers["manager@huangxiang.local"].id }] },
      logs: { create: { actorId: createdUsers["staff@huangxiang.local"].id, action: "SUBMIT", toStatus: "REVIEWING", comment: "送出簽呈" } }
    }
  });
  await prisma.approvalRequest.create({
    data: {
      requestNo: `HX-${dateCode}-9002`,
      applicantId: createdUsers["store@huangxiang.local"].id,
      departmentId: departments["營運部"].id,
      storeId: stores["好腳舍瑞光館"].id,
      type: "INVENTORY_RESTOCK",
      subject: "瑞光館櫃台耗材補貨申請",
      description: "櫃台收據紙、酒精與置物袋庫存不足，請倉管協助補貨。",
      amount: null,
      status: "SUBMITTED",
      steps: { create: [{ stepOrder: 1, title: "營運主管審核", approverId: createdUsers["manager@huangxiang.local"].id }] },
      logs: { create: { actorId: createdUsers["store@huangxiang.local"].id, action: "SUBMIT", toStatus: "SUBMITTED", comment: "送出簽呈" } }
    }
  });

  console.log("MVP 操作順暢化 Sprint 01 資料清理完成");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

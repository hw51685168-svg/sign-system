const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const password = "aaaa8888";

const permissions = {
  all: [
    "task.view", "task.create", "task.assign", "task.update", "task.approve", "task.reject", "task.close", "task.export", "task.delete",
    "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "approval.handwrite_sign", "approval.checkbox_sign", "approval.export",
    "issue.view", "issue.create", "issue.assign", "issue.close", "issue.convert_to_task", "issue.convert_to_monster", "issue.view_anonymous_identity",
    "notification.view", "notification.send", "notification.manage", "notification.escalate", "notification.test_push",
    "document.view", "document.create", "document.update", "document.approve", "document.export",
    "inventory.view", "inventory.create", "inventory.update", "inventory.approve", "inventory.export",
    "course.view", "course.create", "course.assign", "course.complete", "course.report",
    "finance.view", "finance.approve", "finance.export",
    "hr.view", "hr.manage", "hr.export",
    "system.manage_users", "system.manage_roles", "system.view_audit_logs", "system.manage_settings"
  ],
  assistant: ["task.view", "task.create", "task.assign", "task.update", "task.close", "approval.view", "issue.view", "issue.assign", "notification.view", "notification.send", "notification.escalate", "document.view", "inventory.view", "course.view"],
  department: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "task.reject", "task.close", "approval.view", "approval.create", "approval.approve", "approval.reject", "approval.return_revision", "approval.checkbox_sign", "approval.handwrite_sign", "issue.view", "issue.create", "issue.assign", "notification.view", "notification.send", "document.view"],
  branch: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.checkbox_sign", "approval.handwrite_sign", "issue.view", "issue.create", "issue.assign", "inventory.view", "inventory.create", "notification.view"],
  accounting: ["task.view", "task.create", "task.update", "approval.view", "approval.approve", "approval.reject", "approval.return_revision", "approval.checkbox_sign", "finance.view", "finance.approve", "finance.export", "notification.view"],
  hr: ["task.view", "task.create", "task.assign", "task.update", "task.approve", "approval.view", "approval.create", "approval.checkbox_sign", "approval.handwrite_sign", "hr.view", "hr.manage", "hr.export", "notification.view", "course.view", "course.assign"],
  tester: ["task.view", "approval.view", "issue.view", "notification.view"]
};

async function upsertRole(key, name, description, scope, rolePermissions) {
  return prisma.role.upsert({
    where: { key },
    update: { name, description, scope, permissions: rolePermissions, isActive: true },
    create: { key, name, description, scope, permissions: rolePermissions, isActive: true }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  const roles = {};
  roles.GENERAL_MANAGER = await upsertRole("GENERAL_MANAGER", "總經理", "看全公司、做決策、核准重要簽呈", "GLOBAL", permissions.all);
  roles.EXECUTIVE_ASSISTANT = await upsertRole("EXECUTIVE_ASSISTANT", "總經理特助", "追蹤催辦、跨部門協作、彙整給總經理", "GLOBAL", permissions.assistant);
  roles.ADMIN_MANAGER = await upsertRole("ADMIN_MANAGER", "行政主管", "行政、庶務、設備、公告與文件協助", "DEPARTMENT", permissions.department);
  roles.ACCOUNTING_MANAGER = await upsertRole("ACCOUNTING_MANAGER", "會計主管", "請款、報銷、採購核銷與財務報表", "DEPARTMENT", permissions.accounting);
  roles.DESIGN_MANAGER = await upsertRole("DESIGN_MANAGER", "美工主管", "設計需求、素材、交稿與修改管理", "DEPARTMENT", permissions.department);
  roles.SOCIAL_MEDIA_MANAGER = await upsertRole("SOCIAL_MEDIA_MANAGER", "自媒體主管", "企劃、拍攝、剪輯、發布與成效追蹤", "DEPARTMENT", permissions.department);
  roles.HR_MANAGER = await upsertRole("HR_MANAGER", "人事主管", "招募、訓練、面談、試用期與離職交接", "DEPARTMENT", permissions.hr);
  roles.CONSTRUCTION_MANAGER = await upsertRole("CONSTRUCTION_MANAGER", "建設主管", "工程進度、廠商、驗收、缺失改善與請款", "DEPARTMENT", permissions.department);
  roles.BRANCH_MANAGER = await upsertRole("BRANCH_MANAGER", "館別／門市主管", "管理指定館別或門市任務、問題、庫存與簽呈", "BRANCH", permissions.branch);
  roles.SYSTEM_ADMIN = await upsertRole("SYSTEM_ADMIN", "系統管理員", "管理帳號、權限、設定、Audit Log（稽核紀錄）", "GLOBAL", permissions.all);
  roles.TESTER = await upsertRole("TESTER", "測試人員", "只看指定測試資料", "ASSIGNED", permissions.tester);
  roles.MANAGER = await upsertRole("MANAGER", "主管", "舊版相容主管角色", "DEPARTMENT", permissions.department);
  roles.STAFF = await upsertRole("STAFF", "部門人員", "舊版相容部門人員角色", "ASSIGNED", ["task.view", "task.update", "approval.view", "approval.create", "issue.create", "notification.view"]);
  roles.STORE_STAFF = await upsertRole("STORE_STAFF", "門市人員", "舊版相容門市人員角色", "BRANCH", ["task.view", "task.update", "approval.view", "approval.create", "issue.create", "inventory.create", "notification.view"]);

  const units = {};
  for (const name of ["總公司", "好腳舍", "EFS服飾"]) {
    units[name] = await prisma.businessUnit.upsert({ where: { name }, update: {}, create: { name } });
  }

  const departmentData = [
    ["總經理室", "總公司"],
    ["行政部門", "總公司"],
    ["會計部門", "總公司"],
    ["美工部門", "總公司"],
    ["自媒體部門", "總公司"],
    ["人事部門", "總公司"],
    ["建設部門", "總公司"]
  ];
  const departments = {};
  for (const [name, unit] of departmentData) {
    departments[name] = await prisma.department.upsert({
      where: { name },
      update: { businessUnitId: units[unit].id },
      create: { name, businessUnitId: units[unit].id }
    });
  }

  const branches = {};
  for (const [name, unit] of [["好腳舍仁武館", "好腳舍"], ["好腳舍高雄館", "好腳舍"], ["EFS屏東館", "EFS服飾"], ["EFS台東館", "EFS服飾"]]) {
    branches[name] = await prisma.store.upsert({
      where: { name },
      update: { brand: unit, businessUnitId: units[unit].id, isActive: true },
      create: { name, brand: unit, businessUnitId: units[unit].id, isActive: true }
    });
  }

  const accountData = [
    ["gm@huangxiang.local", "總經理測試帳號", "GENERAL_MANAGER", "總經理室", "總公司", null],
    ["assistant@huangxiang.local", "總經理特助測試帳號", "EXECUTIVE_ASSISTANT", "總經理室", "總公司", null],
    ["admin.manager@huangxiang.local", "行政主管測試帳號", "ADMIN_MANAGER", "行政部門", "總公司", null],
    ["accounting.manager@huangxiang.local", "會計主管測試帳號", "ACCOUNTING_MANAGER", "會計部門", "總公司", null],
    ["design.manager@huangxiang.local", "美工主管測試帳號", "DESIGN_MANAGER", "美工部門", "總公司", null],
    ["social.manager@huangxiang.local", "自媒體主管測試帳號", "SOCIAL_MEDIA_MANAGER", "自媒體部門", "總公司", null],
    ["hr.manager@huangxiang.local", "人事主管測試帳號", "HR_MANAGER", "人事部門", "總公司", null],
    ["construction.manager@huangxiang.local", "建設主管測試帳號", "CONSTRUCTION_MANAGER", "建設部門", "總公司", null],
    ["renwu.manager@huangxiang.local", "好腳舍仁武館主管測試帳號", "BRANCH_MANAGER", null, "好腳舍", "好腳舍仁武館"],
    ["kaohsiung.manager@huangxiang.local", "好腳舍高雄館主管測試帳號", "BRANCH_MANAGER", null, "好腳舍", "好腳舍高雄館"],
    ["efs.pingtung.manager@huangxiang.local", "EFS屏東館主管測試帳號", "BRANCH_MANAGER", null, "EFS服飾", "EFS屏東館"],
    ["efs.taitung.manager@huangxiang.local", "EFS台東館主管測試帳號", "BRANCH_MANAGER", null, "EFS服飾", "EFS台東館"],
    ["admin@huangxiang.local", "系統管理員測試帳號", "SYSTEM_ADMIN", "總經理室", "總公司", null]
  ];

  const users = {};
  for (const [email, name, roleKey, departmentName, unitName, branchName] of accountData) {
    users[email] = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        roleId: roles[roleKey].id,
        businessUnitId: units[unitName].id,
        departmentId: departmentName ? departments[departmentName].id : null,
        storeId: branchName ? branches[branchName].id : null,
        passwordHash,
        isActive: true
      },
      create: {
        email,
        name,
        roleId: roles[roleKey].id,
        businessUnitId: units[unitName].id,
        departmentId: departmentName ? departments[departmentName].id : null,
        storeId: branchName ? branches[branchName].id : null,
        passwordHash,
        isActive: true
      }
    });
  }

  await prisma.task.deleteMany({ where: { title: { startsWith: "Sprint 03" } } });
  await prisma.notification.deleteMany({ where: { dedupeKey: { startsWith: "sprint03:" } } });
  await prisma.serviceRequest.deleteMany({ where: { requestNo: { startsWith: "SR-S03-" } } });
  await prisma.approvalRequest.deleteMany({ where: { requestNo: { startsWith: "HX-S03-" } } });

  const managerAccounts = accountData.filter(([, , roleKey]) => roleKey !== "SYSTEM_ADMIN");
  let seq = 1;
  for (const [email, name, roleKey, departmentName, unitName, branchName] of managerAccounts) {
    const owner = users[email];
    const departmentId = departmentName ? departments[departmentName].id : departments["總經理室"].id;
    const storeId = branchName ? branches[branchName].id : null;
    const creatorId = users["assistant@huangxiang.local"]?.id || owner.id;
    const titles = [
      ["NOT_STARTED", 0, "待辦確認"],
      ["NOT_STARTED", 0, "主管回覆"],
      ["NOT_STARTED", 0, "資料補齊"],
      ["NOT_STARTED", 0, "現場確認"],
      ["NOT_STARTED", 0, "今日追蹤"],
      ["IN_PROGRESS", 35, "執行中 A"],
      ["IN_PROGRESS", 55, "執行中 B"],
      ["IN_PROGRESS", 70, "執行中 C"],
      ["WAITING_CONFIRMATION", 90, "待審核 A"],
      ["WAITING_CONFIRMATION", 95, "待審核 B"],
      ["OVERDUE", 60, "逾期追蹤"],
      ["REJECTED", 40, "退回修改"]
    ];
    for (const [status, progress, suffix] of titles) {
      await prisma.task.create({
        data: {
          title: `Sprint 03 ${name} ${suffix}`,
          content: `這是 ${name} 的主管測試任務，用於驗收 Role（角色）、Scope（資料範圍）、Permission（功能權限）與閉環流程。`,
          ownerId: owner.id,
          creatorId,
          departmentId,
          storeId,
          dueDate: status === "OVERDUE" ? new Date(Date.now() - 86400000) : new Date(Date.now() + seq * 3600000),
          priority: status === "OVERDUE" ? "URGENT" : "HIGH",
          status,
          progress
        }
      });
      seq += 1;
    }

    await prisma.notification.createMany({
      data: [
        { userId: owner.id, title: "P0 緊急通知", body: `${name} 有一件逾期或重大事項需立即確認。`, type: "P0_TEST", priority: "URGENT", status: "SENT", color: "red", icon: "alert", targetUrl: "/tasks?status=overdue", sourceType: "sprint03", sourceId: owner.id, dedupeKey: `sprint03:${email}:p0`, sentAt: new Date(), deliveredAt: new Date() },
        { userId: owner.id, title: "P1 高優先通知", body: `${name} 今日有主管待處理事項。`, type: "P1_TEST", priority: "HIGH", status: "SENT", color: "orange", icon: "warning", targetUrl: "/tasks?status=today", sourceType: "sprint03", sourceId: owner.id, dedupeKey: `sprint03:${email}:p1`, sentAt: new Date(), deliveredAt: new Date() },
        { userId: owner.id, title: "P2 一般通知", body: "請查看你的部門工作台與服務需求。", type: "P2_TEST", priority: "MEDIUM", status: "SENT", color: "blue", icon: "info", targetUrl: "/services", sourceType: "sprint03", sourceId: owner.id, dedupeKey: `sprint03:${email}:p2`, sentAt: new Date(), deliveredAt: new Date() }
      ]
    });

    await prisma.serviceRequest.create({
      data: {
        requestNo: `SR-S03-${String(seq).padStart(4, "0")}`,
        title: `Sprint 03 ${name} 跨部門服務需求`,
        category: roleKey === "DESIGN_MANAGER" ? "美工服務" : roleKey === "ACCOUNTING_MANAGER" ? "會計服務" : "行政服務",
        serviceName: roleKey === "DESIGN_MANAGER" ? "海報設計" : roleKey === "ACCOUNTING_MANAGER" ? "單據補件" : "文件協助",
        requesterId: owner.id,
        requesterDepartmentId: departmentId,
        businessUnitId: units[unitName].id,
        responsibleDepartmentId: departments["行政部門"].id,
        storeId,
        ownerId: users["admin.manager@huangxiang.local"].id,
        dueDate: new Date(Date.now() + 3 * 86400000),
        priority: "HIGH",
        content: "這是一筆 Sprint 03 跨部門服務需求，用於測試接單、指派、回報、確認與結案閉環。",
        logs: { create: { actorId: owner.id, action: "CREATE", comment: "建立 Sprint 03 服務需求" } }
      }
    });

    await prisma.approvalRequest.create({
      data: {
        requestNo: `HX-S03-${String(seq).padStart(4, "0")}`,
        applicantId: owner.id,
        departmentId,
        storeId,
        type: roleKey === "ACCOUNTING_MANAGER" ? "PURCHASE" : roleKey === "HR_MANAGER" ? "HR" : "OTHER",
        subject: `Sprint 03 ${name} 簽呈測試`,
        description: "這是一筆 Sprint 03 簽呈測試資料，用於驗收 checkbox（打勾式）、handwritten（手寫式）、mixed（混合式）簽核模式。",
        amount: roleKey === "ACCOUNTING_MANAGER" ? 12000 : null,
        approvalMode: seq % 3 === 0 ? "MIXED" : seq % 2 === 0 ? "HANDWRITTEN" : "CHECKBOX",
        status: "REVIEWING",
        steps: { create: [{ stepOrder: 1, title: "主管簽核", approverId: users["gm@huangxiang.local"].id }] },
        logs: { create: { actorId: owner.id, action: "SUBMIT", toStatus: "REVIEWING", comment: "送出 Sprint 03 簽呈測試" } }
      }
    });
    seq += 1;
  }

  console.log("Enterprise Closed Loop Sprint 03 seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

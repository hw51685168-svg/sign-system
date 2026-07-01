const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const oldTestKeywords = [
  "SPRINT07",
  "Sprint 07",
  "Sprint 03",
  "QA_04A1",
  "QA-APP",
  "QA-SR",
  "外網",
  "smoke",
  "paper approval",
  "gm assignment",
  "簽呈測試",
  "測試簽呈",
  "測試任務",
  "測試公告",
  "測試通知",
  "跨部門服務需求",
  "主管測試任務"
];

const demoSourceType = "lite_demo_seed";

function containsAny(fields, keywords = oldTestKeywords) {
  return fields.flatMap((field) => keywords.map((keyword) => ({ [field]: { contains: keyword } })));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function inWhere(idList) {
  return idList.length > 0 ? { in: idList } : { in: ["__NO_MATCH__"] };
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(18, 0, 0, 0);
  return date;
}

function buildApprovalDescription(description, solution) {
  return [`【說明事項】\n${description.trim()}`, `【解決 / 執行方式】\n${solution.trim()}`].join("\n\n");
}

async function requiredUser(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, department: true, store: true }
  });
  if (!user) throw new Error(`找不到使用者：${email}`);
  return user;
}

async function firstDepartment(names) {
  const department = await prisma.department.findFirst({
    where: { name: { in: names } },
    orderBy: { createdAt: "asc" }
  });
  if (!department) throw new Error(`找不到部門：${names.join(" / ")}`);
  return department;
}

async function firstStore(names) {
  const store = await prisma.store.findFirst({
    where: { name: { in: names } },
    orderBy: { createdAt: "asc" }
  });
  if (!store) throw new Error(`找不到門市：${names.join(" / ")}`);
  return store;
}

async function collectOldTestIds() {
  const [tasks, approvals, issues, services, announcements, inventoryRequests] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          ...containsAny(["title", "content", "reportContent"]),
          { sourceType: demoSourceType }
        ]
      },
      select: { id: true }
    }),
    prisma.approvalRequest.findMany({
      where: {
        OR: [
          ...containsAny(["requestNo", "subject", "description"]),
          { requestNo: { startsWith: "HX-LITE-" } }
        ]
      },
      select: { id: true }
    }),
    prisma.issueReport.findMany({
      where: {
        OR: [
          ...containsAny(["description", "closureNote"]),
          { sourceType: demoSourceType }
        ]
      },
      select: { id: true }
    }),
    prisma.serviceRequest.findMany({
      where: {
        OR: [
          ...containsAny(["requestNo", "title", "category", "serviceName", "content"]),
          { requestNo: { startsWith: "SR-LITE-" } },
          { sourceType: demoSourceType }
        ]
      },
      select: { id: true }
    }),
    prisma.announcement.findMany({
      where: { OR: containsAny(["title", "content"]) },
      select: { id: true }
    }),
    prisma.inventoryRequest.findMany({
      where: { OR: containsAny(["itemName", "purpose", "notes"]) },
      select: { id: true }
    })
  ]);

  const taskIds = tasks.map((item) => item.id);
  const approvalIds = approvals.map((item) => item.id);
  const issueIds = issues.map((item) => item.id);
  const serviceIds = services.map((item) => item.id);
  const announcementIds = announcements.map((item) => item.id);
  const inventoryIds = inventoryRequests.map((item) => item.id);
  const relatedSourceIds = unique([...taskIds, ...approvalIds, ...issueIds, ...serviceIds, ...announcementIds, ...inventoryIds]);

  const [conversations, voices, notifications] = await Promise.all([
    prisma.chatConversation.findMany({
      where: {
        OR: [
          { sourceId: inWhere(relatedSourceIds) },
          ...containsAny(["title", "sourceType", "sourceId"])
        ]
      },
      select: { id: true }
    }),
    prisma.voiceMessage.findMany({
      where: {
        OR: [
          { sourceId: inWhere(relatedSourceIds) },
          { convertedTaskId: inWhere(taskIds) },
          { convertedIssueId: inWhere(issueIds) },
          { convertedServiceRequestId: inWhere(serviceIds) },
          { attachedApprovalId: inWhere(approvalIds) },
          ...containsAny(["fileName", "storedFileName", "manualSummary", "transcriptionText", "sourceType", "sourceId"])
        ]
      },
      select: { id: true, messageId: true, conversationId: true }
    }),
    prisma.notification.findMany({
      where: {
        OR: [
          { sourceId: inWhere(relatedSourceIds) },
          ...containsAny(["title", "body", "dedupeKey", "sourceType", "sourceId"])
        ]
      },
      select: { id: true }
    })
  ]);

  return {
    taskIds,
    approvalIds,
    issueIds,
    serviceIds,
    announcementIds,
    inventoryIds,
    conversationIds: conversations.map((item) => item.id),
    voiceIds: voices.map((item) => item.id),
    voiceMessageIds: voices.map((item) => item.messageId),
    notificationIds: notifications.map((item) => item.id)
  };
}

async function cleanOldTestData(ids) {
  const counts = {};
  await prisma.$transaction(async (tx) => {
    counts.notifications = (await tx.notification.deleteMany({ where: { id: inWhere(ids.notificationIds) } })).count;
    counts.voiceMessages = (await tx.voiceMessage.deleteMany({ where: { id: inWhere(ids.voiceIds) } })).count;
    counts.chatMessages = (await tx.chatMessage.deleteMany({ where: { id: inWhere(ids.voiceMessageIds) } })).count;
    counts.chatConversations = (await tx.chatConversation.deleteMany({ where: { id: inWhere(ids.conversationIds) } })).count;

    await tx.voiceMessage.updateMany({
      where: { convertedTaskId: inWhere(ids.taskIds) },
      data: { convertedTaskId: null }
    });
    await tx.voiceMessage.updateMany({
      where: { convertedIssueId: inWhere(ids.issueIds) },
      data: { convertedIssueId: null }
    });
    await tx.voiceMessage.updateMany({
      where: { convertedServiceRequestId: inWhere(ids.serviceIds) },
      data: { convertedServiceRequestId: null }
    });
    await tx.voiceMessage.updateMany({
      where: { attachedApprovalId: inWhere(ids.approvalIds) },
      data: { attachedApprovalId: null }
    });
    await tx.pilotFeedback.updateMany({
      where: { convertedTaskId: inWhere(ids.taskIds) },
      data: { convertedTaskId: null }
    });
    await tx.pilotBugReport.updateMany({
      where: { convertedTaskId: inWhere(ids.taskIds) },
      data: { convertedTaskId: null }
    });

    counts.tasks = (await tx.task.deleteMany({ where: { id: inWhere(ids.taskIds) } })).count;
    counts.approvals = (await tx.approvalRequest.deleteMany({ where: { id: inWhere(ids.approvalIds) } })).count;
    counts.issues = (await tx.issueReport.deleteMany({ where: { id: inWhere(ids.issueIds) } })).count;
    counts.services = (await tx.serviceRequest.deleteMany({ where: { id: inWhere(ids.serviceIds) } })).count;
    counts.announcements = (await tx.announcement.deleteMany({ where: { id: inWhere(ids.announcementIds) } })).count;
    counts.inventory = (await tx.inventoryRequest.deleteMany({ where: { id: inWhere(ids.inventoryIds) } })).count;
  }, { timeout: 30000 });
  return counts;
}

async function createNotification(tx, { userId, title, body, targetUrl, sourceType, sourceId, priority = "MEDIUM", type }) {
  return tx.notification.create({
    data: {
      userId,
      title,
      body,
      targetUrl,
      sourceType,
      sourceId,
      priority,
      type,
      dedupeKey: `${demoSourceType}:${sourceType}:${sourceId}:${userId}:${type}`
    }
  });
}

async function seedLiteDemoData() {
  const [
    gm,
    assistant,
    adminManager,
    accountingManager,
    designManager,
    socialManager,
    hrManager,
    renwuManager,
    kaohsiungManager,
    storeStaff,
    warehouse,
    trainer
  ] = await Promise.all([
    requiredUser("gm@huangxiang.local"),
    requiredUser("assistant@huangxiang.local"),
    requiredUser("admin.manager@huangxiang.local"),
    requiredUser("accounting.manager@huangxiang.local"),
    requiredUser("design.manager@huangxiang.local"),
    requiredUser("social.manager@huangxiang.local"),
    requiredUser("hr.manager@huangxiang.local"),
    requiredUser("renwu.manager@huangxiang.local"),
    requiredUser("kaohsiung.manager@huangxiang.local"),
    requiredUser("store@huangxiang.local"),
    requiredUser("warehouse@huangxiang.local"),
    requiredUser("trainer@huangxiang.local")
  ]);

  const [hq, hrDept, adminDept, accountingDept, designDept, socialDept, warehouseDept, operationsDept] = await Promise.all([
    firstDepartment(["總公司"]),
    firstDepartment(["人事部門", "人事部"]),
    firstDepartment(["行政部門", "行政部"]),
    firstDepartment(["會計部門", "會計部"]),
    firstDepartment(["美工部門", "美工部"]),
    firstDepartment(["自媒體部門", "自媒體部"]),
    firstDepartment(["倉管部", "倉管或採購單位"]),
    firstDepartment(["營運部"])
  ]);

  const [ruiguangStore, renwuStore, kaohsiungStore] = await Promise.all([
    firstStore(["好腳舍瑞光館", "屏東瑞光館"]),
    firstStore(["好腳舍仁武館", "高雄仁武館"]),
    firstStore(["好腳舍高雄館", "高雄館"])
  ]);

  const taskSeeds = [
    {
      title: "好腳舍瑞光館晚班交接與環境清潔複查",
      content: "請確認櫃台現金交接、休息區整潔、足浴區地面防滑、毛巾回收與垃圾清運狀況，完成後回報照片與異常事項。",
      ownerId: storeStaff.id,
      creatorId: renwuManager.id,
      departmentId: operationsDept.id,
      storeId: ruiguangStore.id,
      dueDate: addDays(1),
      priority: "MEDIUM",
      status: "NOT_STARTED",
      progress: 0
    },
    {
      title: "好腳舍仁武館按摩床異音與冷氣濾網保養追蹤",
      content: "現場回報 2 號按摩床升降時有異音，請先拍照記錄設備編號，並安排冷氣濾網清潔與維修廠商報價。",
      ownerId: renwuManager.id,
      creatorId: adminManager.id,
      departmentId: adminDept.id,
      storeId: renwuStore.id,
      dueDate: addDays(2),
      priority: "HIGH",
      status: "IN_PROGRESS",
      progress: 45,
      reportContent: "已完成設備編號確認，等待廠商回覆維修時段。"
    },
    {
      title: "好腳舍高雄館客訴回覆與服務流程改善回報",
      content: "針對顧客反映等候時間過長，請館主管整理當日排班、預約紀錄與改善方式，回報總公司確認。",
      ownerId: kaohsiungManager.id,
      creatorId: gm.id,
      departmentId: operationsDept.id,
      storeId: kaohsiungStore.id,
      dueDate: addDays(1),
      priority: "HIGH",
      status: "WAITING_CONFIRMATION",
      progress: 85,
      reportContent: "已調整尖峰時段預約提醒，待總公司確認公告內容。"
    },
    {
      title: "好腳舍瑞光館毛巾、精油與茶水備品安全庫存盤點",
      content: "請盤點毛巾、精油、紙杯、茶包與清潔用品低於安全量的品項，整理成補貨清單提供倉管。",
      ownerId: warehouse.id,
      creatorId: storeStaff.id,
      departmentId: warehouseDept.id,
      storeId: ruiguangStore.id,
      dueDate: addDays(3),
      priority: "MEDIUM",
      status: "NOT_STARTED",
      progress: 0
    },
    {
      title: "好腳舍館別新人服務流程訓練簽到與照片回傳",
      content: "請確認本週新人訓練名單、課程簽到、服務流程演練照片與講師回饋，提供人事部建立訓練紀錄。",
      ownerId: trainer.id,
      creatorId: hrManager.id,
      departmentId: hrDept.id,
      storeId: ruiguangStore.id,
      dueDate: addDays(4),
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      progress: 30,
      reportContent: "已收到瑞光館名單，仁武館待補簽到表。"
    }
  ];

  const approvalSeeds = [
    {
      requestNo: "HX-LITE-HR-001",
      applicant: hrManager,
      departmentId: hrDept.id,
      type: "HR",
      subject: "人事部：新人到職前教育訓練與制服尺寸建檔申請",
      description: "瑞光館與仁武館下週各有新人到職，需要建立職前訓練時段、講師安排、簽到表與制服尺寸資料。",
      solution: "請核准人事部安排兩場職前訓練，並由行政協助確認制服庫存與名牌製作。若核准，訓練資料會於課後回填系統。",
      amount: null,
      status: "REVIEWING",
      firstApproverId: assistant.id,
      secondApproverId: gm.id
    },
    {
      requestNo: "HX-LITE-DESIGN-001",
      applicant: designManager,
      departmentId: designDept.id,
      type: "DESIGN",
      subject: "美工部：好腳舍七月課程活動主視覺設計申請",
      description: "好腳舍七月規劃足部保健課程，需要主視覺、門市立牌、社群貼文與 LINE 圖文素材。",
      solution: "請核准美工部排入設計時程，素材規格包含 A4 立牌、IG 方圖、限動圖與 LINE 圖文各一版。",
      amount: null,
      status: "REVIEWING",
      firstApproverId: assistant.id,
      secondApproverId: gm.id
    },
    {
      requestNo: "HX-LITE-SOCIAL-001",
      applicant: socialManager,
      departmentId: socialDept.id,
      type: "SOCIAL_MEDIA",
      subject: "自媒體部：瑞光館短影音拍攝支援與素材排程申請",
      description: "瑞光館希望拍攝師傅服務流程、足浴環境與課程預告短影音，需協調門市空檔與肖像同意。",
      solution: "請核准自媒體部於週三下午進館拍攝，由館主管安排現場配合人員，完成後提供三支短影音與一組照片素材。",
      amount: null,
      status: "REVIEWING",
      firstApproverId: assistant.id,
      secondApproverId: gm.id
    },
    {
      requestNo: "HX-LITE-ADMIN-001",
      applicant: adminManager,
      departmentId: adminDept.id,
      type: "REPAIR",
      subject: "行政部：仁武館按摩床維修與備品採購申請",
      description: "仁武館 2 號按摩床升降異音，另毛巾籃與消毒噴瓶不足，影響現場服務動線。",
      solution: "請核准行政部洽詢維修廠商報價，並同步採購毛巾籃 4 個、消毒噴瓶 12 支，完成後回報發票與照片。",
      amount: "12800",
      status: "NEEDS_REVISION",
      firstApproverId: assistant.id,
      secondApproverId: gm.id,
      revisionComment: "請補上按摩床維修報價單與備品單價明細。"
    },
    {
      requestNo: "HX-LITE-ASSISTANT-001",
      applicant: assistant,
      departmentId: hq.id,
      type: "OTHER",
      subject: "特助：跨部門主管會議追蹤表與回報節點確認",
      description: "各部門主管會議後需統一追蹤待辦事項，目前回報時間與格式不一致，容易造成總公司決策延誤。",
      solution: "請核准由特助建立每週主管追蹤表，統一欄位為負責人、期限、完成狀態、卡關原因與需要總經理決策事項。",
      amount: null,
      status: "REVIEWING",
      firstApproverId: gm.id
    },
    {
      requestNo: "HX-LITE-ACC-001",
      applicant: accountingManager,
      departmentId: accountingDept.id,
      type: "PURCHASE",
      subject: "會計部：月結請款憑證補件與付款批次確認",
      description: "部分門市請款缺少發票照片、採購明細與主管確認紀錄，會影響月結付款批次。",
      solution: "請核准會計部退回缺件案件並設定補件期限，行政與門市需於期限前補齊附件，會計再排入付款清單。",
      amount: "35600",
      status: "REVIEWING",
      firstApproverId: assistant.id,
      secondApproverId: gm.id
    }
  ];

  const created = { tasks: [], approvals: [] };

  await prisma.$transaction(async (tx) => {
    for (const seed of taskSeeds) {
      const task = await tx.task.create({
        data: {
          ...seed,
          sourceType: demoSourceType,
          comments: {
            create: [
              {
                authorId: seed.creatorId,
                content: "建立好腳舍營運情境資料，供主管測試任務追蹤與回報流程。"
              },
              ...(seed.reportContent ? [{ authorId: seed.ownerId, content: `目前回報：${seed.reportContent}` }] : [])
            ]
          }
        }
      });
      created.tasks.push(task.id);
      await createNotification(tx, {
        userId: seed.ownerId,
        title: "新的好腳舍任務",
        body: seed.title,
        targetUrl: "/gm/tasks",
        sourceType: "task",
        sourceId: task.id,
        priority: seed.priority,
        type: "TASK_ASSIGNED"
      });
    }

    for (const seed of approvalSeeds) {
      const approval = await tx.approvalRequest.create({
        data: {
          requestNo: seed.requestNo,
          applicantId: seed.applicant.id,
          departmentId: seed.departmentId,
          type: seed.type,
          subject: seed.subject,
          description: buildApprovalDescription(seed.description, seed.solution),
          amount: seed.amount,
          approvalMode: "MIXED",
          status: seed.status,
          currentStep: 1,
          steps: {
            create: [
              { stepOrder: 1, title: seed.firstApproverId === gm.id ? "總經理簽核" : "相關部門主管簽核", approverId: seed.firstApproverId },
              ...(seed.secondApproverId ? [{ stepOrder: 2, title: "總經理簽核", approverId: seed.secondApproverId }] : [])
            ]
          },
          logs: {
            create: [
              {
                actorId: seed.applicant.id,
                action: "SUBMIT",
                toStatus: "REVIEWING",
                comment: "送出簽呈"
              },
              ...(seed.status === "NEEDS_REVISION"
                ? [{
                    actorId: seed.firstApproverId,
                    action: "REQUEST_REVISION",
                    fromStatus: "REVIEWING",
                    toStatus: "NEEDS_REVISION",
                    comment: seed.revisionComment
                  }]
                : [])
            ]
          }
        }
      });
      created.approvals.push(approval.id);
      await createNotification(tx, {
        userId: seed.firstApproverId,
        title: seed.status === "NEEDS_REVISION" ? "簽呈退回補件" : "有新的簽呈待審核",
        body: seed.subject,
        targetUrl: `/approvals/${approval.id}`,
        sourceType: "approval",
        sourceId: approval.id,
        priority: "HIGH",
        type: seed.status === "NEEDS_REVISION" ? "APPROVAL_REVISION_REQUIRED" : "APPROVAL_PENDING"
      });
    }
  }, { timeout: 30000 });

  return created;
}

async function main() {
  const ids = await collectOldTestIds();
  const cleaned = await cleanOldTestData(ids);
  const created = await seedLiteDemoData();
  console.log(JSON.stringify({ cleaned, created }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

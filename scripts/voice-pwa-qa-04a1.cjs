const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const baseUrl = process.env.QA_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
const password = process.env.QA_PASSWORD || "aaaa8888";
const runId = `QA_04A1_${Date.now()}`;
const voiceDir = "C:/CompanySystem/approval-uploads/voice";

function nowPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function cookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const value = response.headers.get("set-cookie");
  if (!value) return [];
  return value.split(/,(?=[^;,]+=)/);
}

function createSession() {
  const jar = new Map();
  return {
    cookie() {
      return Array.from(jar.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
    },
    update(response) {
      for (const header of cookieHeaders(response)) {
        const pair = header.split(";")[0];
        const index = pair.indexOf("=");
        if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
    }
  };
}

async function request(session, pathOrUrl, options = {}) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const headers = new Headers(options.headers || {});
  if (session?.cookie()) headers.set("cookie", session.cookie());
  const response = await fetch(url, { ...options, headers, redirect: options.redirect || "manual" });
  session?.update(response);
  return response;
}

async function login(email) {
  const session = createSession();
  const csrfResponse = await request(session, "/api/auth/csrf");
  const csrf = await csrfResponse.json();
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    json: "true",
    redirect: "false"
  });
  const loginResponse = await request(session, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const sessionResponse = await request(session, "/api/auth/session");
  const sessionJson = await sessionResponse.json();
  return { session, loginStatus: loginResponse.status, user: sessionJson.user };
}

function pass(results, name, ok, details = {}) {
  results.push({ name, ok: Boolean(ok), details });
}

async function getRequiredData() {
  const [gm, storeUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: "gm@huangxiang.local" }, include: { department: true, role: true } }),
    prisma.user.findUnique({ where: { email: "store@huangxiang.local" }, include: { department: true, role: true } })
  ]);
  if (!gm || !storeUser) throw new Error("Missing QA users gm@huangxiang.local or store@huangxiang.local");
  return { gm, storeUser, departmentId: gm.departmentId };
}

async function createQaRecords(gm, departmentId) {
  const task = await prisma.task.create({
    data: {
      title: `${runId} 任務語音權限測試`,
      content: "QA 04A-1 任務語音權限測試資料",
      ownerId: gm.id,
      creatorId: gm.id,
      departmentId,
      dueDate: nowPlusDays(7),
      priority: "MEDIUM"
    }
  });

  const approval = await prisma.approvalRequest.create({
    data: {
      requestNo: `QA-APP-${Date.now()}`,
      applicantId: gm.id,
      departmentId,
      type: "OTHER",
      subject: `${runId} 簽呈語音權限測試`,
      description: "QA 04A-1 簽呈語音補充測試資料",
      status: "REVIEWING",
      steps: {
        create: {
          stepOrder: 1,
          title: "QA 簽核",
          approverId: gm.id,
          createdById: gm.id
        }
      },
      logs: {
        create: {
          actorId: gm.id,
          action: "SUBMIT",
          toStatus: "REVIEWING",
          comment: "QA 04A-1 建立簽呈"
        }
      }
    }
  });

  const issue = await prisma.issueReport.create({
    data: {
      reporterId: gm.id,
      type: "OTHER",
      description: `${runId} 問題語音權限測試`,
      occurredAt: new Date(),
      severity: "LOW",
      assignedDepartmentId: departmentId,
      status: "ASSIGNED",
      logs: {
        create: {
          actorId: gm.id,
          toStatus: "ASSIGNED",
          comment: "QA 04A-1 建立問題"
        }
      }
    }
  });

  const service = await prisma.serviceRequest.create({
    data: {
      requestNo: `QA-SR-${Date.now()}`,
      title: `${runId} 服務語音權限測試`,
      category: "QA 測試",
      serviceName: "語音 QA",
      requesterId: gm.id,
      requesterDepartmentId: departmentId,
      businessUnitId: gm.businessUnitId,
      responsibleDepartmentId: departmentId,
      ownerId: gm.id,
      dueDate: nowPlusDays(7),
      priority: "MEDIUM",
      content: "QA 04A-1 服務需求語音測試資料",
      logs: {
        create: {
          actorId: gm.id,
          action: "CREATE",
          comment: "QA 04A-1 建立服務需求"
        }
      }
    }
  });

  const conversations = {
    direct: await prisma.chatConversation.create({ data: { type: "DIRECT", title: `${runId} Direct 語音`, createdById: gm.id, members: { create: { userId: gm.id, role: "owner" } } } }),
    task: await prisma.chatConversation.create({ data: { type: "TASK", sourceType: "task", sourceId: task.id, title: `${runId} Task 語音`, departmentId, createdById: gm.id } }),
    approval: await prisma.chatConversation.create({ data: { type: "APPROVAL", sourceType: "approval", sourceId: approval.id, title: `${runId} Approval 語音`, departmentId, createdById: gm.id } }),
    issue: await prisma.chatConversation.create({ data: { type: "ISSUE", sourceType: "issue", sourceId: issue.id, title: `${runId} Issue 語音`, departmentId, createdById: gm.id } }),
    service: await prisma.chatConversation.create({ data: { type: "SERVICE_REQUEST", sourceType: "service_request", sourceId: service.id, title: `${runId} Service 語音`, departmentId, createdById: gm.id } })
  };

  return { task, approval, issue, service, conversations };
}

async function createDbVoice(conversation, senderId, label) {
  fs.mkdirSync(voiceDir, { recursive: true });
  const storedFileName = `${runId}-${label}.webm`;
  fs.writeFileSync(path.join(voiceDir, storedFileName), Buffer.from(`voice-${label}`));
  const message = await prisma.chatMessage.create({
    data: {
      conversationId: conversation.id,
      senderId,
      messageType: "VOICE",
      content: `${runId} ${label}`,
      sourceType: conversation.sourceType,
      sourceId: conversation.sourceId
    }
  });
  const voice = await prisma.voiceMessage.create({
    data: {
      messageId: message.id,
      conversationId: conversation.id,
      senderId,
      fileUrl: "/api/chat/voice/pending/stream",
      storedFileName,
      fileName: storedFileName,
      mimeType: "audio/webm",
      fileSize: fs.statSync(path.join(voiceDir, storedFileName)).size,
      durationSeconds: 1,
      manualSummary: `${runId} ${label}`,
      sourceType: conversation.sourceType,
      sourceId: conversation.sourceId
    }
  });
  return prisma.voiceMessage.update({
    where: { id: voice.id },
    data: { fileUrl: `/api/chat/voice/${voice.id}/stream` }
  });
}

async function uploadVoice(session, conversationId) {
  const form = new FormData();
  form.append("voice", new Blob([Buffer.from(`${runId} uploaded voice`)], { type: "audio/webm" }), `${runId}-uploaded.webm`);
  form.append("durationSeconds", "1");
  form.append("manualSummary", `${runId} uploaded voice`);
  const response = await request(session, `/api/chat/conversations/${conversationId}/voice`, { method: "POST", body: form });
  const data = await response.json();
  return { response, data };
}

async function postForm(session, url, entries) {
  return request(session, url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(entries)
  });
}

async function main() {
  const results = [];
  const { gm, storeUser, departmentId } = await getRequiredData();
  const gmLogin = await login("gm@huangxiang.local");
  const storeLogin = await login("store@huangxiang.local");
  pass(results, "登入測試 GM", gmLogin.loginStatus === 200 && gmLogin.user?.email === "gm@huangxiang.local", { status: gmLogin.loginStatus });
  pass(results, "登入測試 Store", storeLogin.loginStatus === 200 && storeLogin.user?.email === "store@huangxiang.local", { status: storeLogin.loginStatus });

  const qa = await createQaRecords(gm, departmentId);
  const directVoice = await createDbVoice(qa.conversations.direct, gm.id, "direct");
  const taskVoice = await createDbVoice(qa.conversations.task, gm.id, "task");
  const approvalVoice = await createDbVoice(qa.conversations.approval, gm.id, "approval");
  const issueVoice = await createDbVoice(qa.conversations.issue, gm.id, "issue");
  const serviceVoice = await createDbVoice(qa.conversations.service, gm.id, "service");
  const withdrawVoice = await createDbVoice(qa.conversations.direct, gm.id, "withdraw");

  const uploaded = await uploadVoice(gmLogin.session, qa.conversations.task.id);
  pass(results, "語音上傳 API", uploaded.response.status === 200 && Boolean(uploaded.data.voiceMessageId), { status: uploaded.response.status, voiceMessageId: uploaded.data.voiceMessageId });
  const uploadedVoiceId = uploaded.data.voiceMessageId;

  const publicChecks = [];
  for (const pathName of [`/${directVoice.storedFileName}`, `/voice/${directVoice.storedFileName}`, `/uploads/${directVoice.storedFileName}`]) {
    const response = await fetch(`${baseUrl}${pathName}`, { redirect: "manual" });
    publicChecks.push({ path: pathName, status: response.status });
  }
  pass(results, "語音檔案不可 public static URL 存取", publicChecks.every((item) => item.status !== 200), { publicChecks });

  const unauthStream = await fetch(`${baseUrl}/api/chat/voice/${uploadedVoiceId}/stream`, { redirect: "manual" });
  pass(results, "未登入使用者不可播放語音", unauthStream.status !== 200, { status: unauthStream.status });

  const gmUploadedStream = await request(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/stream`);
  pass(results, "GM 可播放上傳語音", gmUploadedStream.status === 200, { status: gmUploadedStream.status, voiceId: uploadedVoiceId });

  const gmVoices = [directVoice, taskVoice, approvalVoice, issueVoice, serviceVoice];
  for (const voice of gmVoices) {
    const response = await request(gmLogin.session, `/api/chat/voice/${voice.id}/stream`);
    pass(results, `GM 可播放 ${voice.sourceType || "direct"} 語音`, response.status === 200, { status: response.status, voiceId: voice.id });
  }

  for (const [label, voice] of [
    ["非聊天室成員不可播放語音", directVoice],
    ["非任務成員不可播放任務語音", taskVoice],
    ["非簽呈相關人不可播放簽呈語音", approvalVoice],
    ["非問題單相關人不可播放問題語音", issueVoice],
    ["非服務需求相關人不可播放服務需求語音", serviceVoice]
  ]) {
    const response = await request(storeLogin.session, `/api/chat/voice/${voice.id}/stream`);
    pass(results, label, response.status !== 200, { status: response.status, voiceId: voice.id, user: storeUser.email });
  }

  await request(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/listen`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionSeconds: 1, completed: false }) });
  await request(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/listen`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionSeconds: 1, completed: true }) });
  const listen = await prisma.voiceMessageListen.findUnique({ where: { voiceMessageId_userId: { voiceMessageId: uploadedVoiceId, userId: gm.id } } });
  pass(results, "VoiceMessageListen 已聽紀錄", Boolean(listen?.startedAt && listen.completedAt && listen.lastPositionSeconds >= 1), {
    startedAt: listen?.startedAt,
    completedAt: listen?.completedAt,
    lastPositionSeconds: listen?.lastPositionSeconds
  });

  const convertTask = await postForm(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/convert-to-task`, {
    title: `${runId} 語音轉任務`,
    ownerId: gm.id,
    departmentId,
    priority: "MEDIUM"
  });
  const afterTask = await prisma.voiceMessage.findUnique({ where: { id: uploadedVoiceId }, include: { convertedTask: true } });
  pass(results, "語音轉任務", convertTask.status === 303 && afterTask?.convertedTask?.sourceType === "voice_message" && afterTask.convertedTask.sourceId === uploadedVoiceId, {
    status: convertTask.status,
    convertedTaskId: afterTask?.convertedTaskId,
    taskSourceType: afterTask?.convertedTask?.sourceType,
    taskSourceId: afterTask?.convertedTask?.sourceId
  });

  const convertIssue = await postForm(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/convert-to-issue`, {
    title: `${runId} 語音轉問題`,
    type: "OTHER",
    severity: "HIGH",
    assignedDepartmentId: departmentId
  });
  const afterIssue = await prisma.voiceMessage.findUnique({ where: { id: uploadedVoiceId }, include: { convertedIssue: true } });
  pass(results, "語音轉問題回報", convertIssue.status === 303 && afterIssue?.convertedIssue?.sourceType === "voice_message" && afterIssue.convertedIssue.sourceId === uploadedVoiceId, {
    status: convertIssue.status,
    convertedIssueId: afterIssue?.convertedIssueId,
    issueSeverity: afterIssue?.convertedIssue?.severity
  });

  const convertService = await postForm(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/convert-to-service-request`, {
    title: `${runId} 語音轉服務需求`,
    category: "QA 測試",
    serviceName: "語音轉服務",
    responsibleDepartmentId: departmentId,
    ownerId: gm.id,
    priority: "MEDIUM"
  });
  const afterService = await prisma.voiceMessage.findUnique({ where: { id: uploadedVoiceId }, include: { convertedServiceRequest: true } });
  pass(results, "語音轉服務需求", convertService.status === 303 && afterService?.convertedServiceRequest?.sourceType === "voice_message" && afterService.convertedServiceRequest.sourceId === uploadedVoiceId, {
    status: convertService.status,
    convertedServiceRequestId: afterService?.convertedServiceRequestId
  });

  const attachApproval = await postForm(gmLogin.session, `/api/chat/voice/${uploadedVoiceId}/attach-to-approval`, {
    approvalId: qa.approval.id
  });
  const afterApproval = await prisma.voiceMessage.findUnique({ where: { id: uploadedVoiceId }, include: { attachedApproval: true } });
  const approvalLogCount = await prisma.approvalLog.count({ where: { approvalRequestId: qa.approval.id, comment: { contains: uploadedVoiceId } } });
  pass(results, "語音加入簽呈補充", attachApproval.status === 303 && afterApproval?.attachedApprovalId === qa.approval.id && approvalLogCount > 0, {
    status: attachApproval.status,
    attachedApprovalId: afterApproval?.attachedApprovalId,
    approvalLogCount
  });

  for (const [label, id, marker] of [
    ["任務詳情可播放來源語音", afterTask?.convertedTaskId, uploadedVoiceId],
    ["問題詳情可播放來源語音", afterIssue?.convertedIssueId, uploadedVoiceId],
    ["服務需求詳情可播放來源語音", afterService?.convertedServiceRequestId, uploadedVoiceId],
    ["簽呈詳情可播放補充語音", qa.approval.id, uploadedVoiceId]
  ]) {
    const pathPrefix = label.startsWith("任務") ? "/tasks" : label.startsWith("問題") ? "/issues" : label.startsWith("服務") ? "/services/requests" : "/approvals";
    const response = await request(gmLogin.session, `${pathPrefix}/${id}`);
    const text = await response.text();
    pass(results, label, response.status === 200 && text.includes(marker), { status: response.status, id });
  }

  const withdrawResponse = await postForm(gmLogin.session, `/api/chat/voice/${withdrawVoice.id}/withdraw`, {});
  const withdrawnStream = await request(gmLogin.session, `/api/chat/voice/${withdrawVoice.id}/stream`);
  const withdrawAuditCount = await prisma.auditLog.count({ where: { resourceType: "voice_message", resourceId: withdrawVoice.id, action: { in: ["VOICE_WITHDRAW", "VOICE_WITHDRAW_FORM"] } } });
  pass(results, "撤回後不可播放且寫入 audit log", withdrawResponse.status === 303 && withdrawnStream.status !== 200 && withdrawAuditCount >= 2, {
    withdrawStatus: withdrawResponse.status,
    streamStatus: withdrawnStream.status,
    withdrawAuditCount
  });

  const pwaStatus = await request(gmLogin.session, "/api/push/status");
  const pwaJson = await pwaStatus.json();
  pass(results, "PWA Push 狀態 API", pwaStatus.status === 200 && "pushAvailable" in pwaJson, { status: pwaStatus.status, pushAvailable: pwaJson.pushAvailable });

  for (const pathName of ["/settings/notifications", "/admin/notifications-test"]) {
    const response = await request(gmLogin.session, pathName);
    const text = await response.text();
    pass(results, `${pathName} 頁面測試`, response.status === 200 && text.includes("Push"), { status: response.status });
  }

  const voiceTaskNotificationA = await postForm(gmLogin.session, "/api/notifications/test", { target: "self", testKind: "voice-task", priority: "MEDIUM" });
  const voiceTaskNotificationB = await postForm(gmLogin.session, "/api/notifications/test", { target: "self", testKind: "voice-task", priority: "MEDIUM" });
  const voiceTaskNotificationCount = await prisma.notification.count({ where: { userId: gm.id, dedupeKey: `test:${gm.id}:voice-task:MEDIUM:${uploadedVoiceId}` } });
  pass(results, "語音通知不重複發送", voiceTaskNotificationA.status === 303 && voiceTaskNotificationB.status === 303 && voiceTaskNotificationCount === 1, {
    firstStatus: voiceTaskNotificationA.status,
    secondStatus: voiceTaskNotificationB.status,
    voiceTaskNotificationCount
  });

  const p0VoiceNotification = await postForm(gmLogin.session, "/api/notifications/test", { target: "self", testKind: "voice-p0", priority: "URGENT" });
  const p0Count = await prisma.notification.count({ where: { userId: gm.id, priority: "URGENT", type: "VOICE_MESSAGE", sourceId: uploadedVoiceId } });
  pass(results, "P0 緊急語音通知", p0VoiceNotification.status === 303 && p0Count >= 1, { status: p0VoiceNotification.status, p0Count });

  const streamAuditCount = await prisma.auditLog.count({ where: { resourceType: "voice_message", resourceId: uploadedVoiceId, action: "VOICE_STREAM" } });
  const convertAuditCount = await prisma.auditLog.count({ where: { resourceType: "voice_message", resourceId: uploadedVoiceId, action: { in: ["VOICE_CONVERT_TO_TASK", "VOICE_CONVERT_TO_ISSUE", "VOICE_CONVERT_TO_SERVICE_REQUEST", "VOICE_ATTACH_TO_APPROVAL"] } } });
  pass(results, "語音播放與轉單 audit log", streamAuditCount > 0 && convertAuditCount >= 4, { streamAuditCount, convertAuditCount });

  const summary = {
    runId,
    baseUrl,
    createdQaRecords: {
      taskId: qa.task.id,
      approvalId: qa.approval.id,
      issueId: qa.issue.id,
      serviceRequestId: qa.service.id,
      uploadedVoiceId,
      convertedTaskId: afterTask?.convertedTaskId,
      convertedIssueId: afterIssue?.convertedIssueId,
      convertedServiceRequestId: afterService?.convertedServiceRequestId
    },
    passed: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

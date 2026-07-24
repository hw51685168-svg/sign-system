import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import type { ApprovalAction, ApprovalStatus, ApprovalType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignatureContent = {
  name?: string | null;
  signedAt?: Date | null;
  note?: string | null;
  image?: Buffer | null;
  hasElectronicSignature?: boolean;
};

const approvalTypeLabels: Record<ApprovalType, string> = {
  PURCHASE: "採購申請",
  REPAIR: "維修申請",
  HR: "人事申請",
  DESIGN: "美工需求",
  SOCIAL_MEDIA: "自媒體需求",
  INVENTORY_RESTOCK: "倉管補貨",
  CUSTOMER_COMPLAINT: "客訴處理",
  STORE_INCIDENT: "門市異常回報",
  TRAINING: "課程或教育訓練申請",
  OTHER: "其他"
};

const approvalStatusLabels: Record<ApprovalStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已送出",
  REVIEWING: "審核中",
  NEEDS_REVISION: "退回修改",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  IN_PROGRESS: "執行中",
  CLOSED: "已結案"
};

const approvalActionLabels: Record<ApprovalAction, string> = {
  SUBMIT: "送出",
  APPROVE: "核准",
  REJECT: "駁回",
  REQUEST_REVISION: "退回修改",
  ADD_APPROVER: "加簽",
  TRANSFER: "轉派",
  COMMENT: "留言",
  CLOSE: "結案"
};

function collectPdf(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function findPdfFont() {
  const candidates = [
    "C:\\Windows\\Fonts\\NotoSansTC-VF.ttf",
    "C:\\Windows\\Fonts\\NotoSerifTC-VF.ttf",
    "C:\\Windows\\Fonts\\kaiu.ttf",
    "C:\\Windows\\Fonts\\simsunb.ttf"
  ];
  return candidates.find((item) => existsSync(item));
}

function applyChineseFont(doc: PDFKit.PDFDocument, fontPath?: string) {
  if (!fontPath) return false;
  try {
    doc.registerFont("zh", fontPath);
    doc.font("zh");
    return true;
  } catch {
    return false;
  }
}

function formatDateTime(date?: Date | string | null) {
  if (!date) return "未指定";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

function formatDate(date?: Date | string | null) {
  if (!date) return "未指定";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(date));
}

function formatAmount(value?: { toString(): string } | number | string | null) {
  if (value === null || value === undefined || value === "") return "未填寫";
  const amount = Number(value.toString());
  if (Number.isNaN(amount)) return "未填寫";
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(amount);
}

function cleanText(value: unknown, fallback = "未填寫") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || text === "undefined" || text === "null" || text === "NaN") return fallback;
  if (/\?{4,}/.test(text) || text.includes("\uFFFD")) return fallback;
  return text;
}

function approvalStageLabel(approval: {
  status: ApprovalStatus;
  steps: Array<{ isCompleted: boolean; title: string; approver?: { name: string } | null }>;
}) {
  if (approval.status !== "REVIEWING") return approvalStatusLabels[approval.status];
  const step = approval.steps.find((item) => !item.isCompleted);
  if (!step) return "審核中";
  const title = cleanText(step.title, "待審核");
  const approverName = cleanText(step.approver?.name, "");
  return approverName ? `${title} - ${approverName}` : title;
}

function parseDescription(value: string | null | undefined) {
  const text = cleanText(value, "");
  const solutionHeadings = ["解決 / 執行方式", "解決/執行方式", "解決方式", "執行方式"];
  const descriptionHeadings = ["說明事項", "內容說明"];
  const solutionHeading = solutionHeadings.find((heading) => text.includes(heading));
  const solutionIndex = solutionHeading ? text.indexOf(solutionHeading) : -1;

  const stripDescriptionHeading = (input: string) =>
    descriptionHeadings.reduce((current, heading) => current.replace(heading, ""), input).trim();

  if (solutionHeading && solutionIndex >= 0) {
    return {
      description: stripDescriptionHeading(text.slice(0, solutionIndex)),
      solution: text.slice(solutionIndex + solutionHeading.length).trim()
    };
  }

  return {
    description: stripDescriptionHeading(text),
    solution: ""
  };
}

function signatureBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(?:png|jpeg);base64,(.+)$/);
  if (!match) return null;
  const base64 = match[1].trim();
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function fitText(value: string | null | undefined, maxLength = 520) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function cell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  text = "",
  options: { align?: "left" | "center" | "right"; fontSize?: number; padding?: number; lineGap?: number; fill?: string } = {}
) {
  const padding = options.padding ?? 7;
  doc.save();
  if (options.fill) doc.rect(x, y, width, height).fillAndStroke(options.fill, "#111827");
  else doc.rect(x, y, width, height).strokeColor("#111827").lineWidth(0.8).stroke();
  doc.restore();
  doc
    .fontSize(options.fontSize ?? 10)
    .fillColor("#111827")
    .text(text || "", x + padding, y + padding, {
      width: width - padding * 2,
      height: height - padding * 2,
      align: options.align ?? "left",
      lineGap: options.lineGap ?? 3
    });
}

function labelCell(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, text: string) {
  cell(doc, x, y, width, height, text, { align: "center", fontSize: 10, fill: "#f8fafc", padding: 6, lineGap: 2 });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor("#111827").text(title);
  doc.moveTo(50, doc.y + 3).lineTo(545, doc.y + 3).strokeColor("#9ca3af").stroke();
  doc.moveDown(0.65).fillColor("#111827");
}

function writeLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).fillColor("#374151").text(`${label}：`, { continued: true });
  doc.fillColor("#111827").text(value || "未填寫", { lineGap: 3 });
}

function drawSignatureFallback(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, signerName?: string | null) {
  doc.save();
  doc.fontSize(16).fillColor("#111827").text(cleanText(signerName, "已簽核"), x, y + Math.max(10, height / 2 - 18), {
    width,
    align: "center"
  });
  doc.moveTo(x + width * 0.2, y + height - 18).lineTo(x + width * 0.8, y + height - 18).strokeColor("#111827").stroke();
  doc.fontSize(8).fillColor("#475569").text("電子簽名紀錄", x, y + height - 14, { width, align: "center" });
  doc.restore();
}

function drawApprovalSigner(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, content: SignatureContent) {
  const lines = [cleanText(content.name, ""), content.signedAt ? formatDateTime(content.signedAt) : content.note].filter(Boolean).join("\n");
  doc.fontSize(9).fillColor("#111827").text(lines || "待簽核", x + 8, y + 8, { width: width - 16, height: 30, align: "center", lineGap: 2 });
  if (content.image) {
    try {
      doc.image(content.image, x + 10, y + 42, { fit: [width - 20, height - 50], align: "center", valign: "center" });
    } catch {
      drawSignatureFallback(doc, x + 10, y + 42, width - 20, height - 50, content.name);
    }
  } else if (content.hasElectronicSignature) {
    drawSignatureFallback(doc, x + 10, y + 42, width - 20, height - 50, content.name);
  }
}

function isGeneralManagerStep(title: string) {
  return title.includes("總經理") || title.toLowerCase().includes("general manager");
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const url = new URL(request.url);
  const forceDownload = url.searchParams.get("download") === "1";
  const previewMode = url.searchParams.get("preview") === "1" || !forceDownload;
  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: id }, scopedApprovalWhere(user)] },
    include: {
      applicant: { include: { role: true } },
      department: true,
      store: true,
      steps: { include: { approver: true }, orderBy: { stepOrder: "asc" } },
      logs: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      signatures: { include: { signer: true }, orderBy: { signedAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!approval) {
    const exists = await prisma.approvalRequest.count({ where: { id: id } });
    return NextResponse.json({ error: exists ? "您沒有權限匯出此簽呈 PDF。" : "找不到簽呈。" }, { status: exists ? 403 : 404 });
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent");
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "APPROVAL_PDF_EXPORT",
      resourceType: "approval_request",
      resourceId: approval.id,
      metadata: JSON.stringify({ requestNo: approval.requestNo, subject: approval.subject, status: approval.status }),
      ipAddress,
      userAgent
    }
  });

  const fontPath = findPdfFont();
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: { Title: `內部簽呈請示單 ${approval.requestNo}`, Author: "JU數位管理" }
  });
  const ready = collectPdf(doc);
  const hasChineseFont = applyChineseFont(doc, fontPath);
  if (!hasChineseFont) {
    doc.font("Helvetica");
  }

  const sections = parseDescription(approval.description);
  const unitName = cleanText(approval.store?.name ?? approval.department?.name, "未指定");
  const applicantSignatures = approval.signatures.filter((signature) => signature.signaturePurpose === "APPLICANT");
  const approverSignatures = approval.signatures.filter((signature) => signature.signaturePurpose === "APPROVER");
  const signatureBySigner = new Map(approverSignatures.map((signature) => [signature.signerId, signature]));
  const gmStep = approval.steps.find((step) => isGeneralManagerStep(step.title));
  const departmentStep = approval.steps.find((step) => step.id !== gmStep?.id);
  const signerContent = (step?: (typeof approval.steps)[number]): SignatureContent => {
    const signature = step?.approverId ? signatureBySigner.get(step.approverId) : null;
    if (signature) {
      return {
        name: signature.signer.name,
        signedAt: signature.signedAt,
        image: signatureBuffer(signature.signatureDataUrl),
        hasElectronicSignature: true
      };
    }
    if (step?.isCompleted) return { name: step.approver?.name ?? "已核准", signedAt: step.completedAt, note: "勾選核准" };
    return { name: step?.approver?.name ?? null, note: "待簽核" };
  };

  const x = 50;
  const width = 495;
  let y = 54;

  doc.fontSize(24).fillColor("#111827").text("內部簽呈請示單", x, y, { width, align: "center" });
  y += 36;
  doc.fontSize(9).fillColor("#475569").text(`簽呈編號：${approval.requestNo}`, x, y, { width: 230 });
  doc.text(`匯出時間：${formatDateTime(new Date())}`, x + 250, y, { width: 245, align: "right" });

  y += 28;
  labelCell(doc, x, y, 64, 32, "部門");
  cell(doc, x + 64, y, 176, 32, unitName, { align: "center", fontSize: 11 });
  labelCell(doc, x + 240, y, 64, 32, "申請日期");
  cell(doc, x + 304, y, width - 304, 32, formatDate(approval.createdAt), { align: "center", fontSize: 11 });
  y += 32;

  labelCell(doc, x, y, 64, 34, "申請人");
  cell(doc, x + 64, y, 176, 34, cleanText(approval.applicant.name), { align: "center", fontSize: 12 });
  labelCell(doc, x + 240, y, 64, 34, "職位");
  cell(doc, x + 304, y, width - 304, 34, cleanText(approval.applicant.role.name), { align: "center", fontSize: 12 });
  y += 34;

  labelCell(doc, x, y, 64, 42, "主題");
  cell(doc, x + 64, y, width - 64, 42, cleanText(approval.subject), { fontSize: 12, lineGap: 2 });
  y += 42;

  labelCell(doc, x, y, 64, 145, "說明事項");
  cell(doc, x + 64, y, width - 64, 145, fitText(sections.description, 460), { fontSize: 10.5, lineGap: 4 });
  y += 145;

  labelCell(doc, x, y, 64, 160, "解決 /\n執行方式");
  cell(doc, x + 64, y, width - 64, 160, fitText(sections.solution, 520), { fontSize: 10.5, lineGap: 4 });
  y += 160;

  const sigHeight = 96;
  const col1 = 165;
  const col2 = 165;
  const col3 = width - col1 - col2;
  labelCell(doc, x, y, col1, 30, "相關部門主管簽核");
  labelCell(doc, x + col1, y, col2, 30, "總經理簽核");
  labelCell(doc, x + col1 + col2, y, col3, 30, "核准結果");
  y += 30;
  cell(doc, x, y, col1, sigHeight, "", { padding: 0 });
  drawApprovalSigner(doc, x, y, col1, sigHeight, signerContent(departmentStep));
  cell(doc, x + col1, y, col2, sigHeight, "", { padding: 0 });
  drawApprovalSigner(doc, x + col1, y, col2, sigHeight, signerContent(gmStep));
  cell(doc, x + col1 + col2, y, col3, sigHeight, `${approvalStatusLabels[approval.status]}\n${approvalStageLabel(approval)}`, {
    align: "center",
    fontSize: 11,
    lineGap: 8
  });
  y += sigHeight + 16;

  doc.fontSize(9).fillColor("#475569").text("申請人填寫後送相關部門主管簽核，再依流程送總經理或相關單位完成核准。", x, y, { width });

  doc.addPage();
  applyChineseFont(doc, fontPath);
  doc.fontSize(18).fillColor("#111827").text("簽呈補充資料與簽核紀錄", { align: "center" });

  sectionTitle(doc, "基本資料");
  writeLine(doc, "簽呈類型", approvalTypeLabels[approval.type]);
  writeLine(doc, "所屬單位", unitName);
  writeLine(doc, "金額", formatAmount(approval.amount));
  writeLine(doc, "目前狀態", `${approvalStatusLabels[approval.status]} / ${approvalStageLabel(approval)}`);

  sectionTitle(doc, "附件清單");
  if (approval.attachments.length === 0) {
    doc.fontSize(10).fillColor("#64748b").text("無附件");
  } else {
    approval.attachments.forEach((attachment, index) => {
      doc.fontSize(10).fillColor("#111827").text(`${index + 1}. ${cleanText(attachment.fileName, "附件")}`, { lineGap: 3 });
    });
  }

  sectionTitle(doc, "簽核流程");
  approval.steps.forEach((step) => {
    doc.fontSize(10).fillColor("#111827").text(
      `第 ${step.stepOrder} 關：${cleanText(step.title, "簽核")} / 簽核人：${cleanText(step.approver?.name, "未指定")} / ${
        step.isCompleted ? `完成時間：${formatDateTime(step.completedAt)}` : "待簽核"
      }`,
      { lineGap: 3 }
    );
  });

  sectionTitle(doc, "簽核紀錄");
  approval.logs.forEach((log) => {
    doc.fontSize(9).fillColor("#111827").text(
      `${formatDateTime(log.createdAt)}  ${cleanText(log.actor.name)}  ${approvalActionLabels[log.action]}  ${
        log.fromStatus ? approvalStatusLabels[log.fromStatus] : "-"
      } -> ${log.toStatus ? approvalStatusLabels[log.toStatus] : "-"}`,
      { lineGap: 3 }
    );
    if (log.comment) doc.fontSize(9).fillColor("#475569").text(`備註：${cleanText(log.comment)}`, { lineGap: 3 });
  });

  sectionTitle(doc, "電子手寫簽名");
  if (applicantSignatures.length === 0 && approverSignatures.length === 0) {
    doc.fontSize(10).fillColor("#64748b").text("目前沒有電子手寫簽名。");
  } else {
    [...applicantSignatures, ...approverSignatures].forEach((signature, index) => {
      const purposeLabel = signature.signaturePurpose === "APPLICANT" ? "申請人送出簽名" : "簽核人核准簽名";
      doc.fontSize(10).fillColor("#111827").text(`${index + 1}. ${purposeLabel}：${cleanText(signature.signer.name)} / ${formatDateTime(signature.signedAt)}`);
      const image = signatureBuffer(signature.signatureDataUrl);
      const top = doc.y + 6;
      doc.rect(doc.x, top, 220, 80).strokeColor("#cbd5e1").stroke();
      if (image) {
        try {
          doc.image(image, doc.x + 8, top + 8, { fit: [204, 64] });
        } catch {
          drawSignatureFallback(doc, doc.x + 8, top + 8, 204, 64, signature.signer.name);
        }
      } else {
        drawSignatureFallback(doc, doc.x + 8, top + 8, 204, 64, signature.signer.name);
      }
      doc.y = top + 92;
    });
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#64748b").text("此 PDF 由 JU數位管理系統自動產生，包含簽呈內容、簽核流程、簽核紀錄與電子手寫簽名。", { align: "center" });
  doc.end();

  const buffer = await ready;
  const fileName = encodeURIComponent(`${approval.requestNo}.pdf`);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${previewMode ? "inline" : "attachment"}; filename*=UTF-8''${fileName}`,
      "cache-control": "no-store"
    }
  });
}

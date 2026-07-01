import { existsSync } from "fs";
import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { approvalStageLabel, parseApprovalDescription } from "@/lib/approval-lite";
import { approvalActionLabels, approvalStatusLabels, approvalTypeLabels, formatAmount, formatDate, formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const runtime = "nodejs";

type SignatureContent = {
  name?: string | null;
  signedAt?: Date | null;
  note?: string | null;
  image?: Buffer | null;
  hasElectronicSignature?: boolean;
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
    "C:\\Windows\\Fonts\\ARIALUNI.ttf",
    "C:\\Windows\\Fonts\\NotoSansTC-VF.ttf",
    "C:\\Windows\\Fonts\\kaiu.ttf",
    "C:\\Windows\\Fonts\\arial.ttf"
  ];
  return candidates.find((item) => existsSync(item));
}

function useChineseFont(doc: PDFKit.PDFDocument, fontPath?: string) {
  if (!fontPath) return;
  try {
    doc.registerFont("zh", fontPath);
    doc.font("zh");
  } catch {
    // Keep PDFKit default font if the local Windows font cannot be registered.
  }
}

function signatureBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(?:png|jpeg);base64,(.+)$/);
  if (!match) return null;
  const base64 = match[1].trim();
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function fitText(value: string | null | undefined, maxLength = 520) {
  const text = (value ?? "未填寫").trim() || "未填寫";
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

function drawSignatureFallback(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  signerName?: string | null
) {
  doc.save();
  doc.fontSize(16).fillColor("#111827").text(signerName ?? "已簽名", x, y + Math.max(10, height / 2 - 18), {
    width,
    align: "center"
  });
  doc.moveTo(x + width * 0.2, y + height - 18).lineTo(x + width * 0.8, y + height - 18).strokeColor("#111827").stroke();
  doc.fontSize(8).fillColor("#475569").text("電子手寫簽名已儲存", x, y + height - 14, { width, align: "center" });
  doc.restore();
}

function drawApprovalSigner(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  content: SignatureContent
) {
  const lines = [content.name, content.signedAt ? formatDateTime(content.signedAt) : content.note].filter(Boolean).join("\n");
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: params.id }, scopedApprovalWhere(user)] },
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
    const exists = await prisma.approvalRequest.count({ where: { id: params.id } });
    return NextResponse.json({ error: exists ? "權限不足，無法匯出這張簽呈。" : "找不到簽呈。" }, { status: exists ? 403 : 404 });
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
    font: fontPath,
    info: { Title: `內部簽呈請示單 ${approval.requestNo}`, Author: "皇享企業電子簽呈系統" }
  });
  const ready = collectPdf(doc);
  useChineseFont(doc, fontPath);

  const sections = parseApprovalDescription(approval.description);
  const signatureBySigner = new Map(approval.signatures.map((signature) => [signature.signerId, signature]));
  const gmStep = approval.steps.find((step) => step.stepOrder === 2 || step.title.includes("總經理"));
  const departmentStep = approval.steps.find((step) => step.id !== gmStep?.id);
  const signerContent = (step?: (typeof approval.steps)[number]): SignatureContent => {
    const signature = step?.approverId ? signatureBySigner.get(step.approverId) : null;
    if (signature)
      return {
        name: signature.signer.name,
        signedAt: signature.signedAt,
        image: signatureBuffer(signature.signatureDataUrl),
        hasElectronicSignature: true
      };
    if (step?.isCompleted) return { name: step.approver?.name ?? "已核准", signedAt: step.completedAt, note: "打勾式核准" };
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
  cell(doc, x + 64, y, 176, 32, approval.department?.name ?? "未填寫", { align: "center", fontSize: 11 });
  labelCell(doc, x + 240, y, 64, 32, "申請日期");
  cell(doc, x + 304, y, width - 304, 32, formatDate(approval.createdAt), { align: "center", fontSize: 11 });
  y += 32;

  labelCell(doc, x, y, 64, 34, "申請人");
  cell(doc, x + 64, y, 176, 34, approval.applicant.name, { align: "center", fontSize: 12 });
  labelCell(doc, x + 240, y, 64, 34, "職位");
  cell(doc, x + 304, y, width - 304, 34, approval.applicant.role.name, { align: "center", fontSize: 12 });
  y += 34;

  labelCell(doc, x, y, 64, 42, "主題");
  cell(doc, x + 64, y, width - 64, 42, approval.subject, { fontSize: 12, lineGap: 2 });
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
  cell(
    doc,
    x + col1 + col2,
    y,
    col3,
    sigHeight,
    `${approvalStatusLabels[approval.status]}\n${approvalStageLabel(approval)}`,
    { align: "center", fontSize: 11, lineGap: 8 }
  );
  y += sigHeight + 16;

  doc
    .fontSize(9)
    .fillColor("#475569")
    .text("申請人填寫相關部門主管簽核後，送總經理簽核，最後依核准結果執行。", x, y, { width });

  doc.addPage();
  useChineseFont(doc, fontPath);
  doc.fontSize(18).fillColor("#111827").text("簽呈附件與簽核紀錄", { align: "center" });

  sectionTitle(doc, "基本資料");
  writeLine(doc, "簽呈類型", approvalTypeLabels[approval.type]);
  writeLine(doc, "所屬門市", approval.store?.name ?? "未填寫");
  writeLine(doc, "金額", formatAmount(approval.amount));
  writeLine(doc, "目前狀態", `${approvalStatusLabels[approval.status]} / ${approvalStageLabel(approval)}`);

  sectionTitle(doc, "附件清單");
  if (approval.attachments.length === 0) {
    doc.fontSize(10).fillColor("#64748b").text("無附件");
  } else {
    approval.attachments.forEach((attachment, index) => {
      doc.fontSize(10).fillColor("#111827").text(`${index + 1}. ${attachment.fileName}`, { lineGap: 3 });
    });
  }

  sectionTitle(doc, "簽核流程");
  approval.steps.forEach((step) => {
    doc.fontSize(10).fillColor("#111827").text(
      `第 ${step.stepOrder} 關：${step.title} / 簽核人：${step.approver?.name ?? "未指定"} / ${step.isCompleted ? `完成時間：${formatDateTime(step.completedAt)}` : "待簽核"}`,
      { lineGap: 3 }
    );
  });

  sectionTitle(doc, "簽核紀錄");
  approval.logs.forEach((log) => {
    doc.fontSize(9).fillColor("#111827").text(
      `${formatDateTime(log.createdAt)}  ${log.actor.name}  ${approvalActionLabels[log.action]}  ${log.fromStatus ? approvalStatusLabels[log.fromStatus] : "-"} -> ${log.toStatus ? approvalStatusLabels[log.toStatus] : "-"}`,
      { lineGap: 3 }
    );
    if (log.comment) doc.fontSize(9).fillColor("#475569").text(`意見：${log.comment}`, { lineGap: 3 });
  });

  sectionTitle(doc, "電子手寫簽名");
  if (approval.signatures.length === 0) {
    doc.fontSize(10).fillColor("#64748b").text("尚無電子手寫簽名");
  } else {
    approval.signatures.forEach((signature, index) => {
      doc.fontSize(10).fillColor("#111827").text(`${index + 1}. ${signature.signer.name} / ${formatDateTime(signature.signedAt)}`);
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
  doc
    .fontSize(8)
    .fillColor("#64748b")
    .text("此 PDF 由皇享企業電子簽呈系統自動產生，包含簽呈內容、簽核流程、操作紀錄、附件清單與電子手寫簽名快照。", { align: "center" });
  doc.end();

  const buffer = await ready;
  const fileName = encodeURIComponent(`${approval.requestNo}.pdf`);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${fileName}`,
      "cache-control": "no-store"
    }
  });
}

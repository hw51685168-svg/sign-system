import { Download, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { AndroidPdfPreview } from "@/components/android-pdf-preview";
import { LinkButton, PageHeader, Panel } from "@/components/ui";
import { PdfReturnActions } from "@/components/pdf-return-actions";
import { formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { scopedApprovalWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalPdfPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const user = await requireUser();
  const approval = await prisma.approvalRequest.findFirst({
    where: { AND: [{ id: resolvedParams.id }, scopedApprovalWhere(user)] },
    select: {
      id: true,
      requestNo: true,
      subject: true,
      updatedAt: true,
      applicant: { select: { name: true } },
      department: { select: { name: true } },
      store: { select: { name: true } }
    }
  });

  if (!approval) notFound();

  const detailHref = `/approvals/${approval.id}`;
  const previewHref = `/api/approvals/${approval.id}/export?preview=1`;
  const downloadHref = `/api/approvals/${approval.id}/export?download=1`;
  const unitName = approval.store?.name ?? approval.department?.name ?? "未填寫";

  return (
    <>
      <PageHeader
        title="簽呈 PDF 預覽"
        description={`${approval.requestNo} · ${approval.subject}`}
        actions={
          <>
            <PdfReturnActions fallbackHref={detailHref} />
            <LinkButton href={detailHref} variant="secondary">返回簽呈</LinkButton>
            <LinkButton href={previewHref} variant="secondary" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              新分頁預覽
            </LinkButton>
            <LinkButton href={downloadHref} variant="secondary">
              <Download className="h-4 w-4" />
              下載 PDF
            </LinkButton>
          </>
        }
      />

      <Panel className="mb-4 border-brand-100 bg-brand-50">
        <div className="grid gap-2 text-base font-semibold text-slate-700 md:grid-cols-3">
          <p><span className="font-black text-slate-950">申請人：</span>{approval.applicant.name}</p>
          <p><span className="font-black text-slate-950">所屬單位：</span>{unitName}</p>
          <p><span className="font-black text-slate-950">更新時間：</span>{formatDateTime(approval.updatedAt)}</p>
        </div>
        <p className="mt-3 text-sm font-bold text-brand-800">
          手機若無法使用系統返回鍵，請點上方「結束返回」或「返回簽呈」。
        </p>
      </Panel>

      <AndroidPdfPreview previewHref={previewHref} downloadHref={downloadHref} fileName={`${approval.requestNo}.pdf`} />

      <Panel className="mt-4 md:hidden">
        <p className="text-base font-bold leading-7 text-slate-700">
          若手機瀏覽器無法直接顯示 PDF 預覽，請改用新分頁預覽或下載 PDF。
        </p>
        <div className="mt-3 grid gap-2">
          <LinkButton href={previewHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            新分頁預覽 PDF
          </LinkButton>
          <LinkButton href={downloadHref} variant="secondary">
            <Download className="h-4 w-4" />
            下載 PDF
          </LinkButton>
          <LinkButton href={detailHref} variant="secondary">返回簽呈</LinkButton>
        </div>
      </Panel>
    </>
  );
}

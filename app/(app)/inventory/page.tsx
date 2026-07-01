import { InventoryUrgency } from "@prisma/client";
import { PackagePlus } from "lucide-react";
import { Button, Field, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { formatDateTime, inventoryReviewStatusLabels, inventoryUrgencyLabels, shipmentStatusLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { isExecutive } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoInventoryRequests, demoMode, demoStores } from "@/lib/demo";

export default async function InventoryPage() {
  const user = await requireUser();
  const where = isExecutive(user.roleKey)
    ? {}
    : { OR: [{ applicantId: user.id }, { storeId: user.storeId ?? undefined }] };
  const [requests, stores] = demoMode
    ? [demoInventoryRequests, demoStores]
    : await Promise.all([
        prisma.inventoryRequest.findMany({ where, include: { store: true, applicant: true }, orderBy: { updatedAt: "desc" } }),
        prisma.store.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })
      ]);

  return (
    <>
      <PageHeader title="倉管補貨申請" description="門市提出補貨申請，倉管或行政審核、出貨並追蹤收貨確認。" />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Panel>
          <h2 className="mb-4 font-bold text-slate-950">新增補貨申請</h2>
          <form action="/api/inventory" method="post" encType="multipart/form-data" className="grid gap-4">
            <Field label="申請門市">
              <select name="storeId" defaultValue={user.storeId ?? ""}>
                <option value="">未指定</option>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </Field>
            <Field label="品項名稱"><input name="itemName" required /></Field>
            <Field label="數量"><input name="quantity" type="number" min="1" required /></Field>
            <Field label="用途"><textarea name="purpose" required /></Field>
            <Field label="急迫程度">
              <select name="urgency">{Object.values(InventoryUrgency).map((urgency) => <option key={urgency} value={urgency}>{inventoryUrgencyLabels[urgency]}</option>)}</select>
            </Field>
            <Field label="備註"><input name="notes" /></Field>
            <Field label="附件"><input name="attachments" type="file" multiple /></Field>
            <Button type="submit"><PackagePlus className="h-4 w-4" />送出補貨申請</Button>
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-4 font-bold text-slate-950">補貨追蹤</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr><th className="px-3 py-3">門市</th><th className="px-3 py-3">品項</th><th className="px-3 py-3">數量</th><th className="px-3 py-3">審核</th><th className="px-3 py-3">出貨</th><th className="px-3 py-3">建立時間</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-3">{request.store?.name ?? "-"}</td>
                    <td className="px-3 py-3 font-semibold">{request.itemName}</td>
                    <td className="px-3 py-3">{request.quantity}</td>
                    <td className="px-3 py-3"><StatusBadge label={inventoryReviewStatusLabels[request.reviewStatus as keyof typeof inventoryReviewStatusLabels]} tone={statusTone(request.reviewStatus)} /></td>
                    <td className="px-3 py-3"><StatusBadge label={shipmentStatusLabels[request.shipmentStatus as keyof typeof shipmentStatusLabels]} tone={statusTone(request.shipmentStatus)} /></td>
                    <td className="px-3 py-3 text-slate-500">{formatDateTime(request.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

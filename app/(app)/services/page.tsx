import { Send, Wrench } from "lucide-react";
import { AndroidDateInput } from "@/components/android-date-input";
import { AndroidSelectInput } from "@/components/android-select-input";
import { Button, Field, PageHeader, Panel, StatusBadge, statusTone } from "@/components/ui";
import { formatDate, safeText, serviceRequestStatusLabels, taskPriorityLabels } from "@/lib/labels";
import { visibleDepartmentOptions } from "@/lib/org-options";
import { prisma } from "@/lib/prisma";
import { scopedServiceRequestWhere } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

const serviceCatalog = [
  ["行政服務", ["設備維修", "辦公用品", "場地庶務", "公告發布", "文件協助"]],
  ["會計服務", ["請款", "報銷", "採購核銷", "單據補件", "金額確認"]],
  ["美工服務", ["海報設計", "社群圖片", "門市物料", "LOGO素材", "完稿輸出", "修改需求"]],
  ["自媒體服務", ["拍攝需求", "素材提供", "發文需求", "影片剪輯", "數據回收", "月報資料"]],
  ["人事服務", ["招募需求", "新人訓練", "課程安排", "面談紀錄", "離職交接", "權限移除"]],
  ["建設服務", ["工程維修", "廠商追蹤", "現場拍照", "缺失改善", "驗收", "請款"]],
  ["好腳舍門市服務", ["客訴回報", "師傅服務流程", "櫃檯訓練", "清潔消毒", "課程銷售", "現場異常"]],
  ["EFS服飾服務", ["商品異常", "直播商品", "預購追蹤", "退換貨", "庫存盤點", "社群新品"]]
] as const;

export default async function ServicesPage() {
  const user = await requireUser();
  const [departments, users, serviceRequests] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.serviceRequest.findMany({
      where: scopedServiceRequestWhere(user),
      include: { requester: true, requesterDepartment: true, responsibleDepartment: true, owner: true },
      orderBy: { updatedAt: "desc" },
      take: 30
    })
  ]);
  const departmentOptions = visibleDepartmentOptions(departments);
  const categoryOptions = serviceCatalog.map(([category]) => ({ value: category, label: category }));
  const serviceNameOptions = serviceCatalog.flatMap(([category, items]) => items.map((item) => ({ value: item, label: `${category} / ${item}` })));
  const responsibleDepartmentOptions = departmentOptions.map((department) => ({ value: department.id, label: department.name }));
  const ownerOptions = [{ value: "", label: "先由承接部門接單" }, ...users.map((item) => ({ value: item.id, label: item.name }))];
  const priorityOptions = Object.entries(taskPriorityLabels).map(([key, label]) => ({ value: key, label }));

  return (
    <>
      <PageHeader
        title="部門服務需求"
        description="跨部門需要協助時從這裡提出，系統會留下發起部門、承接部門、承辦人、期限、留言與歷程紀錄。"
      />

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black text-slate-950">
            <Wrench className="h-6 w-6 text-brand-700" />
            建立服務需求
          </h2>
          <form action="/api/services" method="post" encType="multipart/form-data" className="grid gap-4">
            <Field label="需求標題"><input name="title" required placeholder="例：好腳舍屏東館活動海報設計需求、EFS屏東館新品拍攝需求" /></Field>
            <Field label="服務分類">
              <AndroidSelectInput name="category" options={categoryOptions} required />
            </Field>
            <Field label="服務項目">
              <AndroidSelectInput name="serviceName" options={serviceNameOptions} required />
            </Field>
            <Field label="承接部門（需求交給哪個部門）">
              <AndroidSelectInput name="responsibleDepartmentId" options={responsibleDepartmentOptions} required />
            </Field>
            <Field label="承辦人（誰主要處理）">
              <AndroidSelectInput name="ownerId" options={ownerOptions} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="期限"><AndroidDateInput name="dueDate" label="請輸入期限" /></Field>
              <Field label="優先級">
                <AndroidSelectInput name="priority" options={priorityOptions} defaultValue="MEDIUM" />
              </Field>
            </div>
            <Field label="需求內容">
              <textarea
                name="content"
                required
                placeholder="請寫清楚背景、需要協助的事項、希望交付成果、期限與注意事項。例如：需要美工部門協助製作活動海報，尺寸 A4，文案已附檔，請於週五前提供初稿。"
              />
            </Field>
            <Field label="附件"><input name="attachments" type="file" multiple /></Field>
            <Button type="submit"><Send className="h-5 w-5" />送出服務需求</Button>
          </form>
        </Panel>

        <div className="grid gap-5">
          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">服務分類</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {serviceCatalog.map(([category, items]) => (
                <div key={category} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-lg font-bold text-slate-950">{category}</p>
                  <p className="mt-2 text-base leading-7 text-slate-700">{items.join("、")}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-4 text-2xl font-black text-slate-950">我的服務需求</h2>
            <div className="grid gap-3">
              {serviceRequests.length === 0 ? <p className="text-slate-700">尚無內容</p> : null}
              {serviceRequests.map((request) => (
                <a key={request.id} href={`/services/requests/${request.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-300 hover:bg-brand-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-mono text-sm font-bold text-slate-500">{request.requestNo}</p>
                      <p className="text-xl font-black text-slate-950">{safeText(request.title, "未命名需求")}</p>
                      <p className="mt-1 text-base text-slate-700">
                        發起：{safeText(request.requesterDepartment?.name, "未指定")} → 承接：{safeText(request.responsibleDepartment?.name, "未指定")} · 承辦：{safeText(request.owner?.name, "未指定")}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">期限：{formatDate(request.dueDate)}</p>
                    </div>
                    <StatusBadge label={serviceRequestStatusLabels[request.status]} tone={statusTone(request.status)} />
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

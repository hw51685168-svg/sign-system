import type { RoleKey } from "@prisma/client";

import { PilotBanner } from "@/components/pilot-banner";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import { canManageSystem } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type PermissionSummary = {
  label: string;
  scope: string;
  tasks: string[];
  approvals: string[];
  sensitive: string[];
  system: string[];
  note: string;
};

const roleOrder: RoleKey[] = [
  "GENERAL_MANAGER",
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "MANAGER",
  "BRANCH_MANAGER",
  "STAFF",
  "STORE_REQUESTER",
  "STORE_STAFF",
  "SYSTEM_ADMIN",
  "TESTER"
];

const rolePermissionMatrix: Record<RoleKey, PermissionSummary> = {
  GENERAL_MANAGER: {
    label: "總經理",
    scope: "GLOBAL（全公司）",
    tasks: ["查看全部任務", "建立交辦", "交辦任務", "查看交辦進度"],
    approvals: ["查看全部簽呈", "最終簽核", "核准 / 駁回 / 退回修改", "電子手寫簽名", "匯出 PDF"],
    sensitive: ["可查看全公司敏感資料", "敏感操作需留 Audit Log"],
    system: ["查看通知", "接收 P0 / P1 通知", "查看權限表"],
    note: "公司最高決策與最終簽核角色。"
  },
  EXECUTIVE_ASSISTANT: {
    label: "總經理特助",
    scope: "COMPANY（總公司與跨部門）",
    tasks: ["查看跨部門任務", "建立追蹤任務", "指派協作任務", "催辦與追蹤"],
    approvals: ["查看全部簽呈進度", "協助追蹤待簽核", "可依授權審核"],
    sensitive: ["可查看跨部門必要資料", "不得查看未授權個資細節"],
    system: ["查看通知", "發送催辦通知", "查看測試與錯誤中心"],
    note: "協助總經理追蹤卡關事項，不取代總經理最終簽核。"
  },
  ADMIN_MANAGER: {
    label: "行政主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看行政與門市庶務任務", "建立任務", "指派行政處理", "更新進度"],
    approvals: ["查看全部簽呈", "審核行政相關簽呈", "退回補件"],
    sensitive: ["可查看行政處理必要資料", "不可查看人事薪資細節"],
    system: ["查看通知", "發送行政通知"],
    note: "負責設備、庶務、行政流程與門市支援。"
  },
  ACCOUNTING_MANAGER: {
    label: "會計主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看請款相關任務", "建立缺件追蹤", "更新處理狀態"],
    approvals: ["查看全部簽呈", "審核請款 / 採購 / 費用簽呈", "要求補附件", "駁回不合規請款"],
    sensitive: ["可查看財務資料", "財務匯出需留 Audit Log", "不可查看人事敏感資料"],
    system: ["查看通知", "接收財務待辦通知"],
    note: "負責金額、單據、請款與財務合規檢查。"
  },
  DESIGN_MANAGER: {
    label: "美工主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看設計需求", "建立設計任務", "指派設計工作", "回報完成狀態"],
    approvals: ["查看全部簽呈", "審核美工需求", "要求補素材"],
    sensitive: ["僅查看設計案件必要資料"],
    system: ["查看通知", "接收設計需求通知"],
    note: "負責素材、設計需求、修改需求與交付追蹤。"
  },
  SOCIAL_MEDIA_MANAGER: {
    label: "自媒體主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看拍攝 / 剪輯 / 發布任務", "建立內容任務", "要求門市補素材"],
    approvals: ["查看全部簽呈", "審核自媒體需求", "追蹤企劃補充"],
    sensitive: ["僅查看內容製作必要資料"],
    system: ["查看通知", "接收拍攝與發布通知"],
    note: "負責拍攝、剪輯、發布、素材與現場配合。"
  },
  HR_MANAGER: {
    label: "人事主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看訓練與人事任務", "建立教育訓練", "追蹤試用期與課程"],
    approvals: ["查看全部簽呈", "審核人事申請", "退回補件"],
    sensitive: ["可查看人事敏感資料", "人事資料不可給無權主管查看", "匯出需留 Audit Log"],
    system: ["查看通知", "接收人事提醒"],
    note: "負責人事、教育訓練、新人與試用期流程。"
  },
  CONSTRUCTION_MANAGER: {
    label: "建設主管",
    scope: "COMPANY（總公司與門市）",
    tasks: ["查看工程任務", "建立工程交辦", "追蹤缺失改善", "更新現場進度"],
    approvals: ["查看全部簽呈", "審核工程 / 維修 / 請款簽呈"],
    sensitive: ["可查看工程與請款必要資料"],
    system: ["查看通知", "接收工程與維修通知"],
    note: "負責工程進度、修繕、缺失改善與現場回報。"
  },
  MANAGER: {
    label: "主管",
    scope: "DEPARTMENT（所屬部門）",
    tasks: ["查看所屬部門任務", "建立任務", "指派部門人員", "更新進度"],
    approvals: ["查看部門簽呈", "審核部門簽呈", "核准 / 駁回 / 退回修改"],
    sensitive: ["僅查看所屬職責必要資料"],
    system: ["查看通知", "接收待審通知"],
    note: "一般部門主管，依部門與職責範圍審核。"
  },
  BRANCH_MANAGER: {
    label: "館別主管",
    scope: "BRANCH（館別 / 門市）",
    tasks: ["查看自己館別任務", "建立館別任務", "指派館內人員", "更新進度"],
    approvals: ["查看自己館別簽呈", "送出簽呈", "審核館別相關事項"],
    sensitive: ["只能查看自己館別資料", "不可查看其他館別"],
    system: ["查看通知", "接收館別通知"],
    note: "只能管理自己負責的館別或門市。"
  },
  STAFF: {
    label: "部門人員",
    scope: "SELF / COMPANY（自己與被指派事項）",
    tasks: ["查看我的任務", "更新進度", "送出回報"],
    approvals: ["新增簽呈", "查看我的簽呈進度", "修改草稿 / 退回修改"],
    sensitive: ["不可查看敏感資料"],
    system: ["查看通知"],
    note: "以送簽呈、處理自己任務、查看通知為主。"
  },
  STORE_STAFF: {
    label: "門市人員",
    scope: "BRANCH（自己門市）",
    tasks: ["查看自己門市任務", "更新接收到的任務", "送出回報"],
    approvals: ["新增簽呈", "查看自己門市簽呈", "修改草稿 / 退回修改"],
    sensitive: ["只能查看自己門市資料", "不可查看其他館別或總公司敏感資料"],
    system: ["查看通知", "確認公告"],
    note: "一般門市使用者，只能處理自己門市範圍。"
  },
  STORE_REQUESTER: {
    label: "門市申請與溝通",
    scope: "BRANCH（自己館別）",
    tasks: ["查看自己館別相關任務", "只可在自己參與的任務留言"],
    approvals: ["新增簽呈", "查看自己館別簽呈", "補充與留言"],
    sensitive: ["不可查看其他館別或總公司敏感資料"],
    system: ["查看通知"],
    note: "只供館別申請簽呈與溝通使用，不能建立、指派、開始、完成或結案任務，也不能簽核。"
  },
  SYSTEM_ADMIN: {
    label: "系統管理員",
    scope: "GLOBAL_SYSTEM（系統管理）",
    tasks: ["系統測試與資料檢查", "協助排查任務問題"],
    approvals: ["系統測試與資料檢查", "協助排查簽呈問題"],
    sensitive: ["可處理系統維護必要資料", "不得任意查看非維護目的資料"],
    system: ["管理帳號", "管理角色", "管理部門 / 門市", "查看錯誤中心", "查看 Audit Log"],
    note: "負責系統維護，不是日常業務簽核角色。"
  },
  TESTER: {
    label: "測試人員",
    scope: "SELF（測試資料）",
    tasks: ["查看測試任務"],
    approvals: ["查看測試簽呈"],
    sensitive: ["不可查看敏感資料"],
    system: ["查看測試通知"],
    note: "僅供測試流程使用，不可處理正式資料。"
  }
};

function PermissionList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li key={item} className="rounded-md bg-slate-50 px-2.5 py-1.5 text-sm font-semibold leading-6 text-slate-800">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function RolesPermissionsPage() {
  const user = await requireUser();
  if (!canManageSystem(user) && user.roleKey !== "GENERAL_MANAGER") {
    return (
      <Panel>
        <p className="text-lg font-bold text-slate-800">你沒有權限查看角色權限表。</p>
      </Panel>
    );
  }

  const roles = await prisma.role.findMany();
  const sortedRoles = roles.sort((a, b) => {
    const aIndex = roleOrder.indexOf(a.key);
    const bIndex = roleOrder.indexOf(b.key);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="角色權限比對表"
        description="Role（角色）代表職務，Scope（資料範圍）代表能看哪些資料，Permission（操作權限）代表能做哪些動作。"
      />

      <Panel>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-base font-semibold leading-7 text-amber-900">
          這張表是給管理者快速確認權限用。實際 API 仍會在後端再次檢查權限，一般門市不能靠改網址查看其他館別資料。
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-base">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-800">
              <tr>
                <th className="px-3 py-3">角色名稱</th>
                <th className="px-3 py-3">Scope（資料範圍）</th>
                <th className="px-3 py-3">任務</th>
                <th className="px-3 py-3">簽呈</th>
                <th className="px-3 py-3">敏感資料</th>
                <th className="px-3 py-3">系統與通知</th>
                <th className="px-3 py-3">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRoles.map((role) => {
                const summary = rolePermissionMatrix[role.key] ?? {
                  label: role.name,
                  scope: `${role.scope}（資料範圍依系統設定）`,
                  tasks: ["依角色設定"],
                  approvals: ["依角色設定"],
                  sensitive: ["依角色設定"],
                  system: ["依角色設定"],
                  note: role.description ?? "尚未補充說明。"
                };

                return (
                  <tr key={role.id} className="align-top hover:bg-slate-50">
                    <td className="w-[210px] px-3 py-4">
                      <p className="text-lg font-black text-slate-950">{summary.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{role.key}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{summary.note}</p>
                    </td>
                    <td className="w-[210px] px-3 py-4 font-bold text-slate-900">{summary.scope}</td>
                    <td className="px-3 py-4"><PermissionList items={summary.tasks} /></td>
                    <td className="px-3 py-4"><PermissionList items={summary.approvals} /></td>
                    <td className="px-3 py-4"><PermissionList items={summary.sensitive} /></td>
                    <td className="px-3 py-4"><PermissionList items={summary.system} /></td>
                    <td className="w-[90px] px-3 py-4">
                      <StatusBadge label={role.isActive ? "啟用" : "停用"} tone={role.isActive ? "green" : "slate"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

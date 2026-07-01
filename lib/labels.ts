import {
  ApprovalAction,
  ApprovalStatus,
  ApprovalType,
  AuditRecordStatus,
  InventoryReviewStatus,
  InventoryUrgency,
  IssueSeverity,
  IssueStatus,
  IssueType,
  RoleKey,
  ShipmentStatus,
  ServiceRequestStatus,
  TaskPriority,
  TaskStatus
} from "@prisma/client";

export const roleLabels: Record<RoleKey, string> = {
  GENERAL_MANAGER: "總經理",
  EXECUTIVE_ASSISTANT: "總經理特助",
  ADMIN_MANAGER: "行政主管",
  ACCOUNTING_MANAGER: "會計主管",
  DESIGN_MANAGER: "美工主管",
  SOCIAL_MEDIA_MANAGER: "自媒體主管",
  HR_MANAGER: "人事主管",
  CONSTRUCTION_MANAGER: "建設主管",
  BRANCH_MANAGER: "館別主管",
  MANAGER: "主管",
  STAFF: "部門人員",
  STORE_STAFF: "門市人員",
  SYSTEM_ADMIN: "系統管理員",
  TESTER: "測試人員"
};

export const approvalTypeLabels: Record<ApprovalType, string> = {
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

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已送出",
  REVIEWING: "審核中",
  NEEDS_REVISION: "退回補件",
  APPROVED: "已核准",
  REJECTED: "已駁回",
  IN_PROGRESS: "執行中",
  CLOSED: "已結案"
};

export const approvalActionLabels: Record<ApprovalAction, string> = {
  SUBMIT: "送出",
  APPROVE: "核准",
  REJECT: "駁回",
  REQUEST_REVISION: "退回補件",
  ADD_APPROVER: "加簽",
  TRANSFER: "轉派",
  COMMENT: "留言",
  CLOSE: "結案"
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  URGENT: "緊急"
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  NOT_STARTED: "未開始",
  IN_PROGRESS: "進行中",
  WAITING_CONFIRMATION: "待確認",
  REJECTED: "駁回修改",
  COMPLETED: "已完成",
  OVERDUE: "已逾期",
  CANCELLED: "已取消"
};

export const issueTypeLabels: Record<IssueType, string> = {
  CUSTOMER_COMPLAINT: "客訴",
  EQUIPMENT_REPAIR: "設備維修",
  PERSONNEL: "人員問題",
  CLEANLINESS: "環境清潔",
  SHORTAGE: "商品或用品短缺",
  SYSTEM: "系統問題",
  EMERGENCY: "緊急事件",
  OTHER: "其他"
};

export const issueSeverityLabels: Record<IssueSeverity, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "嚴重"
};

export const issueStatusLabels: Record<IssueStatus, string> = {
  OPEN: "已開立",
  ASSIGNED: "已指派",
  PROCESSING: "處理中",
  WAITING_CONFIRMATION: "待確認",
  CLOSED: "已結案"
};

export const inventoryUrgencyLabels: Record<InventoryUrgency, string> = {
  NORMAL: "一般",
  URGENT: "急件",
  EMERGENCY: "緊急"
};

export const inventoryReviewStatusLabels: Record<InventoryReviewStatus, string> = {
  PENDING: "待審核",
  APPROVED: "已核准",
  REJECTED: "已駁回"
};

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  NOT_SHIPPED: "未出貨",
  PREPARING: "備貨中",
  SHIPPED: "已出貨",
  RECEIVED: "已收貨"
};

export const serviceRequestStatusLabels: Record<ServiceRequestStatus, string> = {
  SUBMITTED: "已送出",
  ACCEPTED: "已接單",
  IN_PROGRESS: "處理中",
  WAITING_CONFIRMATION: "待確認",
  COMPLETED: "已完成",
  REJECTED: "已退回",
  CLOSED: "已結案"
};

export const auditRecordStatusLabels: Record<AuditRecordStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已送出",
  IMPROVEMENT_REQUIRED: "需改善",
  CLOSED: "已結案"
};

export function formatDateTime(date?: Date | string | null) {
  if (!date) return "尚未設定";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export function formatDate(date?: Date | string | null) {
  if (!date) return "未設定";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(date));
}

export function safeText(value: unknown, fallback = "未填寫") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || text === "undefined" || text === "null" || text === "NaN") return fallback;
  if (text.includes("????")) return fallback;
  return text;
}

export function formatAmount(value?: { toString(): string } | number | string | null) {
  if (value === null || value === undefined || value === "") return "未填寫";
  const amount = Number(value.toString());
  if (Number.isNaN(amount)) return "未填寫";
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(amount);
}

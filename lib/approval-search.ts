import { ApprovalType, Prisma } from "@prisma/client";
import { approvalTypeLabels } from "@/lib/labels";

function textContains(term: string) {
  return { contains: term, mode: "insensitive" as const };
}

function matchingApprovalTypes(term: string) {
  const upperTerm = term.toUpperCase();
  return Object.entries(approvalTypeLabels)
    .filter(([key, label]) => key.includes(upperTerm) || label.includes(term))
    .map(([key]) => key as ApprovalType);
}

function termApprovalSearchWhere(term: string): Prisma.ApprovalRequestWhereInput {
  const types = matchingApprovalTypes(term);
  const or: Prisma.ApprovalRequestWhereInput[] = [
    { subject: textContains(term) },
    { requestNo: textContains(term) },
    { description: textContains(term) },
    { applicant: { name: textContains(term) } },
    { applicant: { email: textContains(term) } },
    { department: { name: textContains(term) } },
    { store: { name: textContains(term) } },
    {
      steps: {
        some: {
          OR: [
            { title: textContains(term) },
            { approver: { name: textContains(term) } },
            { approver: { email: textContains(term) } },
            { approver: { department: { name: textContains(term) } } },
            { approver: { store: { name: textContains(term) } } }
          ]
        }
      }
    }
  ];

  if (types.length > 0) {
    or.push({ type: { in: types } });
  }

  return { OR: or };
}

export function approvalKeywordWhere(query?: string | null): Prisma.ApprovalRequestWhereInput {
  const terms = (query ?? "")
    .replace(/\u3000/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (terms.length === 0) return {};

  return {
    AND: terms.map(termApprovalSearchWhere)
  };
}

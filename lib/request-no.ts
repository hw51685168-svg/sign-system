import { prisma } from "@/lib/prisma";

export async function nextApprovalNo() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const count = await prisma.approvalRequest.count({
    where: {
      requestNo: {
        startsWith: `HX-${stamp}`
      }
    }
  });
  return `HX-${stamp}-${String(count + 1).padStart(4, "0")}`;
}

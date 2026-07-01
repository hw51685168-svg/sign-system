import { NextResponse } from "next/server";
import { buildPilotDailyReport, getPilotMonitoringData } from "@/lib/pilot-monitoring";
import { canAccessPilotAdmin } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

export async function GET() {
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    return new Response("你沒有匯出主管測試日報的權限。", { status: 403 });
  }

  const data = await getPilotMonitoringData();
  const report = buildPilotDailyReport(data);
  const date = report.date;

  return new NextResponse(JSON.stringify(report, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pilot-daily-report-${date}.json"`
    }
  });
}

import { Plus } from "lucide-react";
import { Button, EmptyState, LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { announcementVisibleWhere, canApprove } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { demoAnnouncements, demoMode } from "@/lib/demo";

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const announcements = demoMode
    ? demoAnnouncements
    : await prisma.announcement.findMany({
        where: announcementVisibleWhere(user),
        include: {
          publisher: true,
          reads: true,
          targets: { include: { department: true, store: true } },
          attachments: true
        },
        orderBy: { publishedAt: "desc" }
      });

  return (
    <>
      <PageHeader
        title="公告確認"
        description="查看總公司與主管發布的公告，並追蹤已讀與未讀狀態。"
        actions={
          canApprove(user) ? (
            <LinkButton href="/announcements/new">
              <Plus className="h-4 w-4" />
              新增公告
            </LinkButton>
          ) : null
        }
      />
      <div className="grid gap-4">
        {announcements.length === 0 ? (
          <Panel>
            <EmptyState title="目前沒有公告" description="有新公告時會出現在這裡。" />
          </Panel>
        ) : (
          announcements.map((announcement) => {
            const read = announcement.reads.some((item) => item.userId === user.id);
            return (
              <Panel key={announcement.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{announcement.title}</h2>
                      {announcement.requireConfirmation ? (
                        <StatusBadge label={read ? "已讀確認" : "尚未確認"} tone={read ? "green" : "amber"} />
                      ) : (
                        <StatusBadge label="無需確認" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {announcement.publisher.name} · {formatDateTime(announcement.publishedAt)}
                    </p>
                  </div>
                  {announcement.requireConfirmation && !read ? (
                    <form action={`/api/announcements/${announcement.id}/read`} method="post">
                      <Button type="submit">已讀確認</Button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{announcement.content}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>發布對象：</span>
                  {announcement.targets.map((target) => (
                    <span key={target.id} className="rounded-full bg-slate-100 px-2 py-1">
                      {target.type === "ALL" ? "全公司" : target.department?.name ?? target.store?.name ?? "指定對象"}
                    </span>
                  ))}
                </div>
                {canApprove(user) ? (
                  <p className="mt-3 text-xs text-slate-500">
                    已讀 {announcement.reads.length} 人 · 未讀名單可於下一階段加入人員明細匯出
                  </p>
                ) : null}
              </Panel>
            );
          })
        )}
      </div>
    </>
  );
}

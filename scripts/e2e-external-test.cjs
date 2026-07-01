const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const base = process.env.E2E_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
const password = 'aaaa8888';
let jar = [];
const cookieHeader = () => jar.map(c => c.split(';')[0]).join('; ');
const merge = (headers) => {
  for (const c of (headers.getSetCookie ? headers.getSetCookie() : [])) {
    const name = c.split('=')[0];
    jar = jar.filter(x => x.split('=')[0] !== name);
    jar.push(c);
  }
};
async function login() {
  let r = await fetch(`${base}/api/auth/csrf`);
  merge(r.headers);
  const csrf = await r.json();
  r = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: 'gm@huangxiang.local', password, callbackUrl: `${base}/`, json: 'true' }),
    redirect: 'manual',
  });
  merge(r.headers);
  return r.status;
}
async function postForm(path, entries) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  const r = await fetch(`${base}${path}`, { method: 'POST', headers: { cookie: cookieHeader() }, body: fd, redirect: 'manual' });
  return { path, status: r.status, location: r.headers.get('location') };
}
(async () => {
  const users = await prisma.user.findMany({ include: { role: true } });
  const manager = users.find(u => u.email === 'manager@huangxiang.local');
  const staff = users.find(u => u.email === 'staff@huangxiang.local');
  const gm = users.find(u => u.email === 'gm@huangxiang.local');
  const dept = await prisma.department.findFirst({ where: { name: '行政部' } });
  const store = await prisma.store.findFirst({ where: { name: '屏東瑞光館' } });
  const role = await prisma.role.findFirst({ where: { key: 'STAFF' } });
  const loginStatus = await login();
  const stamp = Date.now();
  const results = [];
  results.push(await postForm('/api/approvals', [
    ['type', 'REPAIR'], ['amount', '1200'], ['departmentId', dept.id], ['storeId', store.id],
    ['subject', `外網送出測試簽呈 ${stamp}`], ['description', '測試新增簽呈送出後導向是否正常。'],
    ['firstApproverId', manager.id]
  ]));
  const createdApprovalId = results[0].location?.split('/approvals/')[1] || (await prisma.approvalRequest.findFirst({ orderBy: { createdAt: 'desc' } })).id;
  results.push(await postForm(`/api/approvals/${createdApprovalId}/actions`, [['action', 'COMMENT'], ['comment', '外網留言測試']]));
  results.push(await postForm('/api/announcements', [
    ['title', `外網公告測試 ${stamp}`], ['content', '測試公告送出。'], ['targetType', 'ALL'], ['requireConfirmation', 'on']
  ]));
  const announcement = await prisma.announcement.findFirst({ orderBy: { createdAt: 'desc' } });
  results.push(await postForm(`/api/announcements/${announcement.id}/read`, []));
  results.push(await postForm('/api/tasks', [
    ['title', `外網任務測試 ${stamp}`], ['content', '測試任務建立。'], ['ownerId', staff.id], ['departmentId', dept.id], ['dueDate', '2026-07-10'], ['priority', 'MEDIUM']
  ]));
  const task = await prisma.task.findFirst({ orderBy: { createdAt: 'desc' } });
  results.push(await postForm(`/api/tasks/${task.id}/status`, [['status', 'IN_PROGRESS'], ['progress', '50'], ['reportContent', '外網更新進度測試']]));
  results.push(await postForm('/api/issues', [
    ['storeId', store.id], ['type', 'SYSTEM'], ['description', `外網問題回報測試 ${stamp}`], ['occurredAt', '2026-06-29T15:55'], ['severity', 'MEDIUM'], ['assignedDepartmentId', dept.id]
  ]));
  results.push(await postForm('/api/inventory', [
    ['storeId', store.id], ['itemName', `外網補貨測試 ${stamp}`], ['quantity', '1'], ['purpose', '測試補貨送出'], ['urgency', 'NORMAL'], ['notes', '外網測試']
  ]));
  results.push(await postForm('/api/admin/departments', [['name', `外網測試部門 ${stamp}`]]));
  results.push(await postForm('/api/admin/stores', [['name', `外網測試門市 ${stamp}`], ['brand', '測試品牌'], ['departmentId', dept.id]]));
  results.push(await postForm('/api/admin/users', [
    ['name', `外網測試人員 ${stamp}`], ['email', `external-test-${stamp}@huangxiang.local`], ['password', 'aaaa8888'], ['roleId', role.id], ['departmentId', dept.id]
  ]));
  await prisma.$disconnect();
  console.log(JSON.stringify({ loginStatus, results }, null, 2));
})().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });

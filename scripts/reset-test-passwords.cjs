const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const sharedPassword = 'aaaa8888';

async function main() {
  const prisma = new PrismaClient();
  const accounts = [
    ['gm@huangxiang.local', '總經理', sharedPassword],
    ['admin@huangxiang.local', '系統管理員', sharedPassword],
    ['manager@huangxiang.local', '主管', sharedPassword],
    ['staff@huangxiang.local', '部門人員', sharedPassword],
    ['store@huangxiang.local', '門市人員', sharedPassword],
  ];
  for (const [email, , pass] of accounts) {
    await prisma.user.update({ where: { email }, data: { passwordHash: await bcrypt.hash(pass, 10) } });
  }
  await prisma.$disconnect();
  const text = [
    '皇享企業簽呈協作系統測試帳號',
    `產生時間：${new Date().toLocaleString('zh-TW')}`,
    '',
    '登入網址：',
    '本機：http://localhost:3000',
    '內網：http://192.168.1.25:3000',
    '',
    ...accounts.map(([email, role, pass]) => `${role}：${email} / ${pass}`),
    '',
    '注意：舊密碼已停用，請一律使用上方統一密碼。',
  ].join('\n');
  const files = [
    'C:/CompanySystem/approval-system/測試帳號密碼.txt',
    `${process.env.USERPROFILE}/Desktop/皇享系統測試帳號密碼.txt`,
  ];
  for (const file of files) {
    fs.writeFileSync(file, text, 'utf8');
  }
  console.log(text);
}
main().catch((e) => { console.error(e); process.exit(1); });

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const prisma = new PrismaClient();
const sharedPassword = 'aaaa8888';
const accounts = [
  ['gm@huangxiang.local', '總經理'],
  ['admin@huangxiang.local', '系統管理員'],
  ['manager@huangxiang.local', '主管'],
  ['staff@huangxiang.local', '部門人員'],
  ['store@huangxiang.local', '門市人員'],
];

async function main() {
  const passwordHash = await bcrypt.hash(sharedPassword, 10);
  for (const [email] of accounts) {
    await prisma.user.update({ where: { email }, data: { passwordHash } });
  }
  await prisma.$disconnect();

  const text = [
    '皇享企業簽呈協作系統測試帳號',
    `更新時間：${new Date().toLocaleString('zh-TW')}`,
    '',
    '登入網址：',
    '本機：http://localhost:3000',
    '內網：http://192.168.1.25:3000',
    '外網：請依實際固定網址或 APP_BASE_URL 設定',
    '',
    `統一測試密碼：${sharedPassword}`,
    '',
    ...accounts.map(([email, role]) => `${role}：${email}`),
    '',
    '注意：舊密碼已停用，請一律使用上方統一密碼。',
  ].join('\n');

  fs.writeFileSync('C:/CompanySystem/approval-system/測試帳號密碼.txt', text, 'utf8');
  fs.writeFileSync(`${process.env.USERPROFILE}/Desktop/皇享系統測試帳號密碼.txt`, text, 'utf8');
  console.log(text);
}

main().catch((error) => { console.error(error); process.exit(1); });

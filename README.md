# 皇享企業內部電子簽呈系統

Approval Lite Mode 內部電子簽呈系統。

## 技術

- Next.js
- Tailwind CSS
- PostgreSQL
- Prisma
- NextAuth
- RBAC 權限控管
- Node.js 20+

## 本機啟動

```powershell
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma migrate deploy
npm.cmd run build
npm.cmd run start
```

請先依 `.env.example` 建立 `.env`，並填入正式資料庫與系統密鑰。

## 注意

請勿將 `.env`、token、log、帳密文字檔、uploads、backups 推上 GitHub。

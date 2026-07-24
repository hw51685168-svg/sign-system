# JU 電簽 / JU 數位管理系統

JU 電簽 / JU 數位管理系統是公司內部電子簽呈與任務追蹤系統，用於讓簽呈、任務、附件、PDF 與通知流程可以被追蹤、稽核與回查。

## 專案用途

- 簽呈申請
- 主管審核
- 總經理核示
- 任務交辦
- 附件管理
- PDF 匯出
- 通知與 PWA / Android 測試

## 目前狀態

- 目前可進入有限內測。
- 不建議直接全公司正式上線。
- P0：目前未發現。
- P1：仍需收斂 Git dirty、文件、lockfile 決策、低權限帳號完整 RBAC 測試。

## 正式 Gate 指令

目前正式 Gate 暫定採 npm。

正式 Gate 詳見：[docs/RELEASE_GATE.md](docs/RELEASE_GATE.md)。

正式 Gate 不可在 production live path 直接跑 `npm run build`。請依照 [docs/RELEASE_GATE.md](docs/RELEASE_GATE.md) 建立 release-check workspace 後再執行完整 Gate。

```powershell
npx prisma validate
npx prisma migrate status
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
```

RBAC 黑箱測試：

```powershell
$env:BLACKBOX_BASE="http://127.0.0.1:3000"
$env:BLACKBOX_PWD="<由系統管理員提供>"
node work\blackbox-permission-complete-final2.mjs
```

注意事項：

- 不要把 `BLACKBOX_PWD` 寫入任何檔案。
- 不要把測試密碼提交到 Git。
- 不要把 `.env` 提交到 Git。

## 套件管理標準

目前短期以 npm 作為 Gate 標準。

`package-lock.json` 與 `pnpm-lock.yaml` 混用問題已列入 P1-5B 後續任務，不要自行刪除任一 lockfile。

## 開發注意事項

- 不要直接 `git add .`。
- 不要直接 `git reset`。
- 不要直接 `git clean`。
- 不要碰 `.env`。
- 不要停止 production 3000，除非任務明確要求。
- 修改前先確認 Git 回復點或安全封存。
- 每次只處理單一小任務。

## 重要路徑

- production repo：`C:\CompanySystem\approval-system`
- production uploads：`C:\CompanySystem\approval-uploads`
- production backups：`C:\CompanySystem\backups`

## 交接原則

這套系統目前已具備有限內測條件，但正式全公司上線前仍需要完成 P1 收斂。請優先保持系統穩定、資料安全、權限正確與可回復，不要一次大量修改。
# Release-check Gate 補充

Release-check 安全環境變數與 Gate 缺項說明：

- [docs/RELEASE_CHECK_ENVIRONMENT.md](docs/RELEASE_CHECK_ENVIRONMENT.md)

正式 Gate 仍禁止在 production live path 直接執行 `npm run build`。

沒有 `DATABASE_URL` 時，DB Gate 與 `npx next build` 不可宣告完整通過。
沒有 `BLACKBOX_PWD` 時，不可執行 RBAC 黑箱測試。

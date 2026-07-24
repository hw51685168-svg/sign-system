"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { BarChart3, CheckCircle2, Eye, EyeOff, FilePenLine, LockKeyhole, Mail, ShieldCheck, Smartphone, UserCheck } from "lucide-react";

const rememberedEmailKey = "huangxiang-login-email";

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <img className="h-12 w-12 rounded-xl bg-white object-cover shadow-sm ring-1 ring-white/40" src="/app-icon-192.png" alt="JU數位管理" />
      <div>
        <p className="text-xl font-black tracking-wide text-white">JU數位管理</p>
        <p className="text-sm font-bold text-white/70">流程管理 × 核准簽署 × 安全追蹤</p>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, body }: { icon: typeof FilePenLine; title: string; body: string }) {
  return (
    <div className="grid gap-2 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-white/30 bg-white/15">
        <Icon className="h-7 w-7" />
      </div>
      <p className="text-lg font-black">{title}</p>
      <p className="text-sm font-semibold leading-6 text-white/85">{body}</p>
    </div>
  );
}

function BenefitItem({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) {
  return (
    <div className="grid gap-2 px-4 py-3 text-center sm:border-r sm:border-slate-200 last:sm:border-r-0">
      <Icon className="mx-auto h-8 w-8 text-brand-600" />
      <p className="text-lg font-black text-slate-950">{title}</p>
      <p className="text-base font-semibold leading-7 text-slate-600">{body}</p>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem(rememberedEmailKey);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberEmail(true);
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const callbackUrl = searchParams.get("callbackUrl") ?? "/";
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl
      });

      if (!result?.ok || result.error) {
        setError("登入失敗，請確認帳號或密碼是否正確。");
        return;
      }

      if (rememberEmail) {
        window.localStorage.setItem(rememberedEmailKey, email);
      } else {
        window.localStorage.removeItem(rememberedEmailKey);
      }

      // Let the browser perform a single full navigation after NextAuth sets the session cookie.
      window.location.assign(result.url || callbackUrl);
    } catch {
      setError("登入暫時無法完成，請確認網路後再試一次。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <label className="text-base font-black text-slate-900" htmlFor="email">帳號 Email</label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="email"
            name="email"
            className="w-full pl-12"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="請輸入公司帳號 Email"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-base font-black text-slate-900" htmlFor="password">密碼</label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            name="password"
            className="w-full pl-12 pr-12"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="請輸入密碼"
            required
          />
          <button
            aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-base font-semibold text-slate-700" htmlFor="remember-email">
          <input
            id="remember-email"
            className="h-5 min-h-0 w-5 rounded border-slate-300 p-0 accent-brand-700"
            type="checkbox"
            checked={rememberEmail}
            onChange={(event) => setRememberEmail(event.target.checked)}
          />
          記住帳號
        </label>
        <p className="text-sm font-semibold text-slate-500">請勿把帳密提供給非授權人員。</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-base font-bold text-red-700">{error}</p> : null}

      <button
        className="inline-flex min-h-14 items-center justify-center rounded-lg bg-brand-700 px-5 text-xl font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={loading}
      >
        {loading ? "登入中..." : "登入"}
      </button>

      <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-brand-900">
        <ShieldCheck className="mt-1 h-6 w-6 flex-none text-brand-700" />
        <p className="text-base font-bold leading-7">本系統僅供公司授權同仁使用，所有簽呈、任務與通知操作都會留下紀錄。</p>
      </div>
    </form>
  );
}

function LoginShell() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(67,168,115,0.16),transparent_34rem),radial-gradient(circle_at_top_right,rgba(120,210,160,0.14),transparent_30rem),linear-gradient(180deg,#fbfffc_0%,#f2faf5_55%,#eaf6ef_100%)] text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] items-center gap-6 px-4 py-6 lg:grid-cols-[1.02fr_1fr] lg:px-8">
        <section className="relative hidden min-h-[680px] overflow-hidden rounded-lg bg-brand-800 p-10 text-white shadow-[0_20px_54px_rgba(15,23,42,0.18)] lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.32),transparent_24%),linear-gradient(135deg,#174b35_0%,#2f8f60_48%,#d8f4e8_100%)]" />
          <div className="absolute -bottom-16 -left-10 h-56 w-72 rounded-[55%_45%_0_0] bg-white/12" />
          <div className="absolute bottom-0 right-0 h-60 w-[620px] rounded-tl-[100%] bg-white/18" />
          <div className="absolute right-12 top-28 h-48 w-36 rotate-12 rounded-2xl border-4 border-white/20" />
          <div className="absolute right-28 top-52 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/20">
            <CheckCircle2 className="h-8 w-8 text-white/35" />
          </div>

          <div className="relative z-10 flex min-h-[600px] flex-col justify-between">
            <BrandMark />

            <div className="max-w-xl">
              <img className="mb-8 w-full max-w-lg rounded-lg bg-white/95 object-contain p-5 shadow-sm" src="/brand/ju-digital-management-horizontal.png" alt="JU數位管理" />
              <h1 className="text-5xl font-black leading-tight">流程更清楚，簽核更安心。</h1>
              <p className="mt-5 text-2xl font-bold leading-10 text-white/90">把簽呈、任務、附件、通知與追蹤整合在同一個地方。</p>
              <div className="mt-10 flex items-center gap-3 text-white/70">
                <span className="h-px flex-1 bg-white/45" />
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="h-px flex-1 bg-white/45" />
              </div>
              <div className="mt-10 grid grid-cols-3 gap-5">
                <FeatureItem icon={FilePenLine} title="線上填寫" body="快速建立簽呈與任務" />
                <FeatureItem icon={UserCheck} title="流程簽核" body="清楚知道誰處理中" />
                <FeatureItem icon={BarChart3} title="進度追蹤" body="通知與紀錄可查" />
              </div>
            </div>

            <p className="text-sm font-semibold text-white/75">JU數位管理 · 僅供授權同仁使用</p>
          </div>
        </section>

        <section className="relative grid min-h-[calc(100vh-3rem)] content-center py-4 lg:min-h-[680px]">
          <div className="absolute inset-x-0 bottom-0 h-32 rounded-t-[80%] bg-brand-100/70 lg:hidden" />
          <div className="relative z-10 mx-auto w-full max-w-[520px]">
            <div className="mb-6 grid justify-items-center gap-3 text-center lg:hidden">
              <img className="h-20 w-20 rounded-2xl object-cover shadow-sm" src="/app-icon-192.png" alt="JU數位管理" />
              <p className="text-lg font-black text-slate-950">JU數位管理</p>
              <h1 className="text-4xl font-black leading-tight text-brand-800">內部流程管理系統</h1>
              <p className="text-lg font-bold text-slate-600">簽呈、任務、通知一次整合</p>
            </div>

            <div className="rounded-lg border border-white/80 bg-white/95 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.14)] backdrop-blur sm:p-9">
              <div className="mb-7 grid justify-items-center gap-3 text-center">
                <img className="h-20 w-20 rounded-2xl object-cover shadow-sm" src="/app-icon-192.png" alt="JU數位管理" />
                <div>
                  <h2 className="text-3xl font-black text-slate-950">登入系統</h2>
                  <div className="mx-auto mt-4 h-px w-14 bg-slate-300" />
                </div>
              </div>
              <LoginForm />
            </div>

            <p className="mt-5 text-center text-sm font-semibold text-slate-500">JU數位管理 · 內部流程管理</p>
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/90 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur lg:col-span-2 lg:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BenefitItem icon={ShieldCheck} title="安全可靠" body="登入驗證與權限控管，保護公司資料。" />
            <BenefitItem icon={CheckCircle2} title="流程清楚" body="送出、審核、退回與核准都有紀錄。" />
            <BenefitItem icon={Smartphone} title="手機可用" body="支援網頁、iPhone PWA 與 Android App。" />
            <BenefitItem icon={BarChart3} title="追蹤方便" body="待辦、通知與進度更容易掌握。" />
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-100 text-base font-semibold text-slate-600">載入登入頁...</div>}>
      <LoginShell />
    </Suspense>
  );
}

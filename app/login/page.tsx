"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, CheckCircle2, Eye, EyeOff, FilePenLine, Leaf, LockKeyhole, Mail, ShieldCheck, Smartphone, UserCheck } from "lucide-react";

const rememberedEmailKey = "huangxiang-login-email";

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-sm">
        <Leaf className="h-6 w-6" />
      </div>
      <p className="text-lg font-black tracking-wide text-white">皇享企業管理系統</p>
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
  const router = useRouter();
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

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    setLoading(false);

    if (result?.error) {
      setError("登入失敗，請確認帳號或密碼是否正確。");
      return;
    }

    if (rememberEmail) {
      window.localStorage.setItem(rememberedEmailKey, email);
    } else {
      window.localStorage.removeItem(rememberedEmailKey);
    }

    router.push(searchParams.get("callbackUrl") ?? "/");
    router.refresh();
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <label className="text-base font-black text-slate-900" htmlFor="email">帳號</label>
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
            placeholder="請輸入帳號或 Email"
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
        <p className="text-sm font-semibold text-slate-500">忘記密碼請洽系統管理員</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-base font-bold text-red-700">{error}</p> : null}

      <button
        className="inline-flex min-h-14 items-center justify-center rounded-md bg-brand-700 px-5 text-xl font-black text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={loading}
      >
        {loading ? "登入中" : "登入"}
      </button>

      <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-brand-900">
        <ShieldCheck className="mt-1 h-6 w-6 flex-none text-brand-700" />
        <p className="text-base font-bold leading-7">目前為內部測試版，請勿輸入正式敏感資料。</p>
      </div>
    </form>
  );
}

function LoginShell() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f8f4] text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-[1500px] items-center gap-6 px-4 py-6 lg:grid-cols-[1.02fr_1fr] lg:px-8">
        <section className="relative hidden min-h-[680px] overflow-hidden rounded-lg bg-brand-800 p-10 text-white shadow-soft lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.28),transparent_24%),linear-gradient(135deg,#063d24_0%,#15703d_52%,#dcefe0_100%)]" />
          <div className="absolute -bottom-16 -left-10 h-56 w-72 rounded-[55%_45%_0_0] bg-white/12" />
          <div className="absolute bottom-0 right-0 h-60 w-[620px] rounded-tl-[100%] bg-white/18" />
          <div className="absolute right-12 top-28 h-48 w-36 rotate-12 rounded-2xl border-4 border-white/20" />
          <div className="absolute right-28 top-52 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/20">
            <CheckCircle2 className="h-8 w-8 text-white/35" />
          </div>

          <div className="relative z-10 flex min-h-[600px] flex-col justify-between">
            <BrandMark />

            <div className="max-w-xl">
              <h1 className="text-5xl font-black leading-tight">內部電子簽呈系統</h1>
              <p className="mt-5 text-2xl font-bold leading-10 text-white/90">線上填寫、簽核與追蹤公司內部簽呈</p>
              <div className="mt-10 flex items-center gap-3 text-white/70">
                <span className="h-px flex-1 bg-white/45" />
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="h-px flex-1 bg-white/45" />
              </div>
              <div className="mt-10 grid grid-cols-3 gap-5">
                <FeatureItem icon={FilePenLine} title="線上填寫" body="快速填寫簽呈" />
                <FeatureItem icon={UserCheck} title="流程簽核" body="即時簽核處理" />
                <FeatureItem icon={BarChart3} title="進度追蹤" body="流程透明可查" />
              </div>
            </div>

            <p className="text-sm font-semibold text-white/75">皇享企業內部系統 · 僅供授權同仁使用</p>
          </div>
        </section>

        <section className="relative grid min-h-[calc(100vh-3rem)] content-center py-4 lg:min-h-[680px]">
          <div className="absolute inset-x-0 bottom-0 h-32 rounded-t-[80%] bg-brand-100/70 lg:hidden" />
          <div className="relative z-10 mx-auto w-full max-w-[520px]">
            <div className="mb-6 grid justify-items-center gap-3 text-center lg:hidden">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-sm">
                <Leaf className="h-8 w-8" />
              </div>
              <p className="text-lg font-black text-slate-950">皇享企業管理系統</p>
              <h1 className="text-4xl font-black leading-tight text-brand-800">內部電子簽呈系統</h1>
              <p className="text-lg font-bold text-slate-600">線上填寫、簽核與追蹤</p>
            </div>

            <div className="rounded-lg border border-white/80 bg-white/95 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur sm:p-9">
              <div className="mb-7 grid justify-items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <LockKeyhole className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-950">登入系統</h2>
                  <div className="mx-auto mt-4 h-px w-14 bg-slate-300" />
                </div>
              </div>
              <LoginForm />
            </div>

            <p className="mt-5 text-center text-sm font-semibold text-slate-500">Supervisor Pilot v0.1 · Approval Lite Mode</p>
          </div>
        </section>

        <section className="rounded-lg border border-white bg-white p-4 shadow-soft lg:col-span-2 lg:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BenefitItem icon={ShieldCheck} title="安全可靠" body="登入驗證與權限控管，保護公司資料。" />
            <BenefitItem icon={CheckCircle2} title="快速高效" body="簡化簽核流程，減少紙本往返。" />
            <BenefitItem icon={Smartphone} title="行動便利" body="支援手機操作，外出也能追蹤進度。" />
            <BenefitItem icon={BarChart3} title="統計追蹤" body="工作進度與待辦事項清楚掌握。" />
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

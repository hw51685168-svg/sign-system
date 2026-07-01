"use client";

import { LogOut, Repeat2 } from "lucide-react";
import { signOut } from "next-auth/react";

export function AccountSessionActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login?switch=1" })}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-brand-700 px-5 text-lg font-black text-white hover:bg-brand-800"
      >
        <Repeat2 className="h-5 w-5" />
        切換帳號
      </button>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login?logout=1" })}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-lg font-black text-slate-800 hover:bg-slate-50"
      >
        <LogOut className="h-5 w-5" />
        登出
      </button>
    </div>
  );
}

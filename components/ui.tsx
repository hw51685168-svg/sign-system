import clsx from "clsx";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { forwardRef } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-lg border border-white/80 bg-white/85 px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-4xl font-black leading-tight tracking-normal text-slate-950 md:text-5xl">{title}</h1>
        {description ? <p className="mt-2 max-w-4xl text-base font-medium leading-7 text-slate-500 md:text-lg md:leading-8">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div> : null}
    </div>
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
  }
>(function Button({ children, variant = "primary", className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-black shadow-sm transition duration-150 ease-out hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand-700 text-white shadow-brand-900/10 hover:bg-brand-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-900",
        variant === "danger" && "bg-red-700 text-white shadow-red-900/10 hover:bg-red-800",
        variant === "ghost" && "text-slate-700 shadow-none hover:bg-slate-100 hover:text-slate-950",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function LinkButton({
  children,
  href,
  variant = "primary",
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <a
      href={href}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-black shadow-sm transition duration-150 ease-out hover:-translate-y-0.5",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-900"
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("min-w-0 rounded-lg border border-white/80 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur", className)}>{children}</section>;
}

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-base font-black text-slate-950">{label}</label>
      {children}
      {hint ? <p className="text-sm font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "green" | "amber" | "red" | "blue" | "purple" | "slate" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-black",
        tone === "green" && "border-emerald-100 bg-emerald-50 text-emerald-700",
        tone === "amber" && "border-amber-100 bg-amber-50 text-amber-700",
        tone === "red" && "border-red-100 bg-red-50 text-red-700",
        tone === "blue" && "border-sky-100 bg-sky-50 text-sky-700",
        tone === "purple" && "border-purple-100 bg-purple-50 text-purple-700",
        tone === "slate" && "border-slate-200 bg-slate-100 text-slate-700"
      )}
    >
      {label}
    </span>
  );
}

export function statusTone(status: string) {
  if (["APPROVED", "COMPLETED", "CLOSED", "RECEIVED"].includes(status)) return "green" as const;
  if (["REJECTED", "OVERDUE", "CRITICAL"].includes(status)) return "red" as const;
  if (["WAITING_CONFIRMATION", "REVIEWING"].includes(status)) return "purple" as const;
  if (["IN_PROGRESS", "PROCESSING", "SHIPPED"].includes(status)) return "blue" as const;
  if (["NEEDS_REVISION", "PENDING", "NOT_STARTED"].includes(status)) return "amber" as const;
  return "slate" as const;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center shadow-inner">
      <p className="text-xl font-black text-slate-950">{title}</p>
      <p className="mt-2 text-base font-medium text-slate-500">{description}</p>
    </div>
  );
}

export function TimelineIcon({ kind }: { kind: "done" | "waiting" | "rejected" }) {
  const className = "h-5 w-5";
  if (kind === "done") return <CheckCircle2 className={clsx(className, "text-emerald-600")} />;
  if (kind === "rejected") return <XCircle className={clsx(className, "text-red-600")} />;
  return <Clock3 className={clsx(className, "text-slate-400")} />;
}

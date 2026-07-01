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
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-black leading-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-2 text-lg font-semibold leading-8 text-slate-700">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
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
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "bg-red-700 text-white hover:bg-red-800",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
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
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 py-2 text-base font-semibold transition",
        variant === "primary" && "bg-brand-700 text-white hover:bg-brand-800",
        variant === "secondary" && "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-lg border border-slate-200 bg-white p-5", className)}>{children}</section>;
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
    <div className="grid gap-1.5">
      <label>{label}</label>
      {children}
      {hint ? <p className="text-sm text-slate-600">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: "green" | "amber" | "red" | "blue" | "purple" | "slate" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold",
        tone === "green" && "bg-emerald-50 text-emerald-700",
        tone === "amber" && "bg-amber-50 text-amber-700",
        tone === "red" && "bg-red-50 text-red-700",
        tone === "blue" && "bg-sky-50 text-sky-700",
        tone === "purple" && "bg-purple-50 text-purple-700",
        tone === "slate" && "bg-slate-100 text-slate-700"
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
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export function TimelineIcon({ kind }: { kind: "done" | "waiting" | "rejected" }) {
  const className = "h-5 w-5";
  if (kind === "done") return <CheckCircle2 className={clsx(className, "text-emerald-600")} />;
  if (kind === "rejected") return <XCircle className={clsx(className, "text-red-600")} />;
  return <Clock3 className={clsx(className, "text-slate-400")} />;
}

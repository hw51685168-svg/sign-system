type Variant = "card" | "pill";

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function GmTaskFilterLink({
  href,
  label,
  value,
  active = false,
  urgent = false,
  variant = "card"
}: {
  href: string;
  label: string;
  value?: number;
  active?: boolean;
  urgent?: boolean;
  variant?: Variant;
}) {
  if (variant === "pill") {
    return (
      <a
        href={href}
        aria-current={active ? "page" : undefined}
        className={classNames(
          "inline-flex min-h-12 items-center justify-center rounded-md px-4 py-3 text-base font-bold transition hover:-translate-y-0.5 active:translate-y-px active:scale-[0.98]",
          active ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        )}
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={`${label}，${value ?? 0} 筆，點擊查看`}
      className={classNames(
        "group block min-h-32 rounded-lg border bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50 hover:shadow-md active:translate-y-px active:scale-[0.99]",
        active ? "border-brand-500 ring-4 ring-brand-100" : "border-white/80",
        urgent && (value ?? 0) > 0 ? "hover:border-red-200 hover:bg-red-50" : ""
      )}
    >
      <p className="text-base font-bold text-slate-600">{label}</p>
      <p className={classNames("mt-1 text-3xl font-black", urgent && (value ?? 0) > 0 ? "text-red-700" : "text-slate-950")}>
        {value ?? 0}
      </p>
      <p className="mt-2 text-sm font-black text-brand-700 opacity-0 transition group-hover:opacity-100">點擊查看</p>
    </a>
  );
}

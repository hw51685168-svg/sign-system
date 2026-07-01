import { AlertTriangle } from "lucide-react";
import { pilotDataProtectionWarnings, pilotVersionLabel, pilotWarning } from "@/lib/pilot";

export function PilotBanner({ compact = false }: { compact?: boolean }) {
  return (
    <section className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
          <div>
            <p className="text-lg font-black">{pilotVersionLabel}</p>
            <p className="mt-1 text-base font-semibold">{pilotWarning}</p>
          </div>
        </div>
        {!compact ? (
          <div className="grid gap-1 text-sm font-semibold md:min-w-80">
            {pilotDataProtectionWarnings.map((warning) => (
              <span key={warning}>• {warning}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

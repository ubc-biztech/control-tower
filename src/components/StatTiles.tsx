import { cn } from "@/lib/utils";

/** The stat tiles under Apollo's welcome banner. */
export function StatTiles({
  items,
}: {
  items: { value: React.ReactNode; label: string; tone?: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <div
          key={s.label}
          className="flex min-w-[124px] flex-1 items-center gap-2.5 rounded border border-border bg-card px-3 py-2"
        >
          {s.icon && <div className="shrink-0 text-muted-foreground">{s.icon}</div>}
          <div className="leading-tight">
            <div className={cn("mono text-[17px] font-semibold", s.tone)}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

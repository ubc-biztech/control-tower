import { cn } from "@/lib/utils";

/** Apollo's page banner: white band, title + one line of context, actions right. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 border-b border-border bg-card px-5 py-4", className)}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[19px] font-bold leading-tight tracking-[-0.01em]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {meta && <div className="mt-3">{meta}</div>}
    </div>
  );
}

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

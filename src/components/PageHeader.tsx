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

import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CircleAlert, Info, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const calloutVariants = cva("flex gap-2.5 rounded border px-3 py-2.5", {
  variants: {
    tone: {
      info: "border-status-blue-line bg-status-blue-bg/60 text-foreground",
      success: "border-status-green-line bg-status-green-bg/70 text-foreground",
      warning: "border-status-amber-line bg-status-amber-bg/70 text-foreground",
      danger: "border-status-red-line bg-status-red-bg/70 text-foreground",
      neutral: "border-border bg-secondary text-foreground",
    },
  },
  defaultVariants: { tone: "info" },
});

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: AlertTriangle,
  danger: CircleAlert,
  neutral: Info,
} as const;

const ICON_TONE = {
  info: "text-status-blue-fg",
  success: "text-status-green-fg",
  warning: "text-status-amber-fg",
  danger: "text-status-red-fg",
  neutral: "text-muted-foreground",
} as const;

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof calloutVariants> {
  title?: React.ReactNode;
  icon?: boolean;
}

export function Callout({
  className,
  tone = "info",
  title,
  icon = true,
  children,
  ...props
}: CalloutProps) {
  const key = tone ?? "info";
  const Icon = ICONS[key];
  return (
    <div className={cn(calloutVariants({ tone }), className)} {...props}>
      {icon && <Icon className={cn("mt-[1px] h-4 w-4 shrink-0", ICON_TONE[key])} />}
      <div className="min-w-0 flex-1">
        {title && <div className="text-[12.5px] font-semibold">{title}</div>}
        {children && (
          <div className={cn("text-[11.5px] leading-relaxed", title && "mt-0.5")}>{children}</div>
        )}
      </div>
    </div>
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-[1px] text-[10px] font-bold uppercase tracking-[0.05em]",
  {
    variants: {
      tone: {
        green: "border-status-green-line bg-status-green-bg text-status-green-fg",
        blue: "border-status-blue-line bg-status-blue-bg text-status-blue-fg",
        amber: "border-status-amber-line bg-status-amber-bg text-status-amber-fg",
        red: "border-status-red-line bg-status-red-bg text-status-red-fg",
        gray: "border-status-gray-line bg-status-gray-bg text-status-gray-fg",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Lowercase, non-tracked variant for inline metadata like branch names. */
export function Chip({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "mono inline-flex items-center rounded-sm border border-border bg-secondary px-1.5 py-[1px] text-[10.5px] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16">
      <Spinner size={22} />
      {label && <span className="text-[11.5px] text-muted-foreground">{label}</span>}
    </div>
  );
}

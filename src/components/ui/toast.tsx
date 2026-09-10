import * as React from "react";
import { CircleCheck, CircleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastMessage {
  id: number;
  tone: "success" | "danger" | "info";
  message: React.ReactNode;
  action?: { label: string; href: string };
}

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(t: Omit<ToastMessage, "id">, timeout = 6000) {
  const id = nextId++;
  toasts = [...toasts, { ...t, id }];
  emit();
  if (timeout) setTimeout(() => dismiss(id), timeout);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastMessage[]>([]);
  React.useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[380px] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded border bg-card px-3 py-2.5 shadow-[0_8px_28px_rgba(16,24,40,0.14)]",
            t.tone === "success" && "border-status-green-line",
            t.tone === "danger" && "border-status-red-line",
            t.tone === "info" && "border-border",
          )}
        >
          {t.tone === "success" ? (
            <CircleCheck className="mt-[1px] h-4 w-4 shrink-0 text-status-green-fg" />
          ) : t.tone === "danger" ? (
            <CircleAlert className="mt-[1px] h-4 w-4 shrink-0 text-status-red-fg" />
          ) : null}
          <div className="min-w-0 flex-1 text-[12px] leading-snug">
            {t.message}
            {t.action && (
              <a
                href={t.action.href}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-primary hover:underline"
              >
                {t.action.label}
              </a>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

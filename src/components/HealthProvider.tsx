import { createContext, useContext, useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { Health } from "@/lib/types";

const HealthContext = createContext<Health | null>(null);

/** Reads what the server will and will not do, once, at startup. */
export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) =>
        setHealth({
          ok: false,
          writesEnabled: false,
          source: "live",
          reason: e instanceof Error ? e.message : "Could not reach the API",
        }),
      );
  }, []);

  return <HealthContext.Provider value={health}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  return useContext(HealthContext);
}

/** Why rollback is unavailable, or null when it is available. */
export function useRollbackBlockedReason(): string | null {
  const health = useHealth();
  if (!health) return "Checking what this build can do…";
  if (!health.writesEnabled)
    return "This build is read-only. Rollback is not implemented yet — it is the write path, and it needs its own scoped credentials first.";
  return null;
}

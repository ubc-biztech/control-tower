import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getHealth, getSession } from "@/lib/api";
import type { AuthState, Health } from "@/lib/types";

interface SessionValue {
  auth: AuthState | null;
  health: Health | null;
  loading: boolean;
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({
  auth: null,
  health: null,
  loading: true,
  refresh: () => {},
});

/**
 * Who is signed in, and what the server will let them do. Both are read from
 * the server — nothing here is derived in the browser, because a role decided
 * in the browser decides nothing.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([getSession(), getHealth().catch(() => null)])
      .then(([a, h]) => {
        setAuth(a);
        setHealth(h);
      })
      .catch(() =>
        setAuth({
          authenticated: false,
          authConfigured: false,
          devLogin: false,
          domain: "ubcbiztech.com",
          defaultRole: "viewer",
          user: null,
          unreachable: true,
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  // Any 401 from a data route means the session went away underneath us.
  useEffect(() => {
    const onExpired = () => refresh();
    window.addEventListener("control-tower:unauthenticated", onExpired);
    return () => window.removeEventListener("control-tower:unauthenticated", onExpired);
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ auth, health, loading, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export function useHealth() {
  return useSession().health;
}

export function useCurrentUser() {
  return useSession().auth?.user ?? null;
}

/** Why rollback is unavailable to this person, or null if it is available. */
export function useRollbackBlockedReason(): string | null {
  const { auth, health, loading } = useSession();
  if (loading) return "Checking what you can do…";

  const role = auth?.user?.role;
  if (!role) return "Sign in to roll back.";
  if (role === "viewer")
    return `Rolling back needs the deployer role and you have viewer. Access is granted by a pull request adding ${auth?.user?.email} to access.json.`;
  if (!health?.writesEnabled)
    return "Your role allows this, but the write path is not built yet. Rollback runs in GitHub Actions (R2.3) and needs `sls rollback --timestamp` verified on Framework v4 first.";
  return null;
}

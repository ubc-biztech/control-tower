import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Eye, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { useSession } from "@/components/SessionProvider";

/** Shown instead of the app whenever there is no session. */
export function LoginPage() {
  const { auth } = useSession();
  const [error, setError] = useState<string | null>(null);

  // The OAuth callback redirects to /#/login?error=… on failure.
  useEffect(() => {
    const hash = window.location.hash;
    const q = hash.includes("?") ? new URLSearchParams(hash.slice(hash.indexOf("?") + 1)) : null;
    const e = q?.get("error");
    if (e) {
      setError(e);
      window.history.replaceState(null, "", window.location.pathname + "#/");
    }
  }, []);

  const domain = auth?.domain ?? "ubcbiztech.com";
  const configured = auth?.authConfigured ?? false;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-rail px-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center gap-3">
          <img src="/assets/biztech_logo.svg" alt="BizTech" className="h-9 w-9 rounded" />
          <div>
            <div className="text-[20px] font-bold leading-tight text-white">Control Tower</div>
            <div className="text-[12px] text-rail-muted">UBC BizTech infrastructure</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          {auth?.unreachable ? (
            <Callout tone="danger" title="Cannot reach Control Tower's API">
              The server is not responding. Check that <span className="mono">npm run dev</span> is
              running.
            </Callout>
          ) : configured ? (
            <>
              <h1 className="text-[16px] font-bold">Sign in</h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Control Tower is for <span className="mono">@{domain}</span> Google accounts.
                Everyone on the domain can read; rolling anything back needs an entry in{" "}
                <span className="mono">access.json</span>.
              </p>

              {error && (
                <Callout tone="danger" className="mt-3">
                  {error}
                </Callout>
              )}

              <Button variant="primary" className="mt-4 w-full" asChild>
                <a href="/api/auth/login">
                  Continue with Google
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-[16px] font-bold">Sign-in is not configured</h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Control Tower needs a Google OAuth client before anyone can sign in. Set these in{" "}
                <span className="mono">.env</span> and restart:
              </p>
              <pre className="mono mt-3 whitespace-pre-wrap break-all rounded border border-border bg-[#0D172C] px-3 py-2.5 text-[11px] leading-relaxed text-[#A2B1D5]">
{`GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=http://localhost:5273/api/auth/callback
TOWER_SESSION_SECRET=…`}
              </pre>
              <Callout tone="neutral" className="mt-3">
                To work on the app without OAuth, set{" "}
                <span className="mono">TOWER_DEV_LOGIN_EMAIL</span> to an address on{" "}
                <span className="mono">@{domain}</span>. It is ignored in production. See{" "}
                <span className="mono">docs/auth.md</span>.
              </Callout>
            </>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11.5px] leading-relaxed text-rail-muted">
          <Eye className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          <span>
            This build reads AWS and writes nothing. Rollback is not implemented yet.
          </span>
        </div>
        <div className="mt-1.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-rail-muted">
          <ShieldCheck className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          <span>Write access is granted by a pull request, and revoked by one.</span>
        </div>
        {auth?.devLogin && (
          <div className="mt-1.5 flex items-start gap-2 text-[11.5px] leading-relaxed text-status-amber-fg">
            <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0" />
            <span>Local dev login is on.</span>
          </div>
        )}
      </div>
    </div>
  );
}

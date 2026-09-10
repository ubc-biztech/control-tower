import { NavLink } from "react-router-dom";
import {
  Boxes,
  Eye,
  FileText,
  GitBranch,
  History,
  LayoutGrid,
  Map,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Terminal,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { AWS_ACCOUNT, AWS_REGION, DEPLOYABLES } from "@/mock/world";
import { isSimulatingOutage, setSimulateOutage } from "@/lib/api";
import { relTime } from "@/lib/format";
import { STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";

const RAIL_LINK =
  "flex items-center gap-2.5 px-4 py-[7px] text-[12.5px] text-rail-text no-underline transition-colors hover:bg-rail-hover hover:text-white";

export function Shell({
  children,
  fetchedAt,
  stale,
  loading,
  onRefresh,
}: {
  children: React.ReactNode;
  fetchedAt?: string | null;
  stale?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-card px-5">
          <Tooltip content="Tower reads AWS and can trigger exactly one thing: a rollback, in GitHub Actions.">
            <span className="flex cursor-help items-center gap-1.5 rounded-sm border border-status-green-line bg-status-green-bg px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.05em] text-status-green-fg">
              <Eye className="h-3 w-3" />
              read-only
            </span>
          </Tooltip>

          <div className="flex-1" />

          <Tooltip content="Simulate AWS being unreachable, to exercise the stale-state path (R1.7)">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Switch
                checked={isSimulatingOutage()}
                onCheckedChange={(v) => {
                  setSimulateOutage(v);
                  onRefresh?.();
                }}
              />
              simulate outage
            </label>
          </Tooltip>

          <div className="h-5 w-px bg-border" />

          {fetchedAt && (
            <span
              className={cn(
                "mono text-[11px]",
                stale ? "font-medium text-status-amber-fg" : "text-muted-foreground",
              )}
            >
              {stale ? "stale as of" : "updated"} {relTime(fetchedAt)} ago
            </span>
          )}
          {onRefresh && (
            <Button variant="default" size="icon-sm" onClick={onRefresh} title="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}

function Rail() {
  return (
    <nav className="rail-scroll flex w-[224px] shrink-0 flex-col overflow-y-auto bg-rail">
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
        <img src="/assets/biztech_logo.svg" alt="" className="h-[22px] w-[22px] rounded" />
        <div className="leading-none">
          <div className="text-[15px] font-bold tracking-[0.02em] text-white">Tower</div>
        </div>
      </div>

      <Section label="Home" icon={LayoutGrid} to="/" end />

      <Section label="Environments" icon={Boxes}>
        {STAGES.map((s) => (
          <SubLink key={s} to={`/environment/${s}`} label={s} />
        ))}
      </Section>

      <Section label="Services" icon={Boxes} to="/services" />
      <Section label="Logs" icon={Terminal} to="/logs" />

      <div className="mt-4 px-4">
        <div className="eyebrow text-rail-muted">Not in this build</div>
      </div>
      {[
        { label: "Releases", icon: GitBranch },
        { label: "Assets", icon: ShieldCheck },
        { label: "Audit", icon: History },
        { label: "Change requests", icon: FileText },
      ].map((n) => (
        <div
          key={n.label}
          className="flex cursor-not-allowed items-center gap-2.5 px-4 py-[7px] text-[12.5px] text-rail-muted/70"
          title="Planned for v1"
        >
          <n.icon className="h-4 w-4 shrink-0" />
          {n.label}
        </div>
      ))}

      <div className="flex-1" />

      <div className="border-t border-rail-line py-1">
        <div className={cn(RAIL_LINK, "cursor-not-allowed opacity-55")} title="Planned for v1">
          <Map className="h-4 w-4 shrink-0" />
          Install map
        </div>
        <a
          href="https://github.com/ubc-biztech/serverless-biztechapp"
          target="_blank"
          rel="noreferrer"
          className={RAIL_LINK}
        >
          <ScrollText className="h-4 w-4 shrink-0" />
          Documentation
        </a>
        <div className={cn(RAIL_LINK, "cursor-not-allowed opacity-55")} title="Planned for v1">
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </div>
      </div>

      <div className="border-t border-rail-line px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rail-line">
            <User className="h-3.5 w-3.5 text-rail-text" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[12px] text-white">dev@ubcbiztech.com</div>
            <div className="text-[10px] text-rail-muted">single-user · v0 has no auth</div>
          </div>
        </div>
        <div className="mono mt-2.5 text-[10px] leading-relaxed text-rail-muted">
          <div>acct {AWS_ACCOUNT}</div>
          <div>
            {AWS_REGION} · {DEPLOYABLES.length} deployables
          </div>
        </div>
        <Badge tone="amber" className="mt-2">
          P0 · mock data
        </Badge>
      </div>
    </nav>
  );
}

function Section({
  label,
  icon: Icon,
  to,
  end,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  end?: boolean;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="eyebrow">{label}</span>
    </>
  );

  return (
    <div className="mt-1">
      {to ? (
        <NavLink
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 border-l-[3px] px-4 py-[7px] no-underline transition-colors",
              isActive
                ? "border-bt-green-400 bg-rail-hover text-white"
                : "border-transparent text-rail-text hover:bg-rail-hover hover:text-white",
            )
          }
          style={{ paddingLeft: 13 }}
        >
          {inner}
        </NavLink>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-[7px] text-white">{inner}</div>
      )}
      {children}
    </div>
  );
}

function SubLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "mono block border-l-[3px] py-[5px] pl-[38px] pr-4 text-[12px] no-underline transition-colors",
          isActive
            ? "border-bt-green-400 bg-rail-hover text-white"
            : "border-transparent text-rail-text hover:bg-rail-hover hover:text-white",
        )
      }
    >
      {label}
    </NavLink>
  );
}

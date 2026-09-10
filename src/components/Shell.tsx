import { Button, Switch, Tag, Tooltip } from "@blueprintjs/core";
import { NavLink } from "react-router-dom";
import { AWS_ACCOUNT, AWS_REGION } from "@/mock/world";
import { isSimulatingOutage, setSimulateOutage } from "@/lib/api";
import { relTime } from "@/lib/format";

const NAV = [
  { to: "/", label: "Environments", icon: "grid-view", end: true },
  { to: "/services", label: "Services", icon: "cube" },
  { to: "/logs", label: "Logs", icon: "console" },
];

const NAV_V1 = [
  { label: "Releases", icon: "git-branch" },
  { label: "Assets", icon: "shield" },
  { label: "Audit", icon: "history" },
  { label: "Settings", icon: "cog" },
];

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
      {/* Left rail */}
      <nav
        className="flex w-[196px] shrink-0 flex-col border-r"
        style={{ background: "var(--tower-panel)", borderColor: "var(--tower-edge)" }}
      >
        <div
          className="flex h-[46px] shrink-0 items-center gap-2.5 border-b px-3"
          style={{ borderColor: "var(--tower-edge)" }}
        >
          <img src="/assets/biztech_logo.svg" alt="" className="h-[22px] w-[22px] rounded-[5px]" />
          <div className="leading-none">
            <div className="text-[14px] font-bold tracking-[0.16em] text-white">TOWER</div>
            <div className="mt-[3px] text-[9px] tracking-[0.1em]" style={{ color: "var(--tower-dimmer)" }}>
              UBC BIZTECH
            </div>
          </div>
        </div>

        <div className="py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `rail-link ${isActive ? "active" : ""}`}
            >
              <span className={`bp5-icon bp5-icon-${n.icon}`} />
              {n.label}
            </NavLink>
          ))}
        </div>

        <div
          className="mt-1 border-t pt-2"
          style={{ borderColor: "var(--tower-edge-soft)" }}
        >
          <div
            className="px-3 pb-1.5 text-[9px] font-bold tracking-[0.11em]"
            style={{ color: "var(--tower-dimmer)" }}
          >
            V1 — NOT IN THIS BUILD
          </div>
          {NAV_V1.map((n) => (
            <div key={n.label} className="rail-link disabled">
              <span className={`bp5-icon bp5-icon-${n.icon}`} />
              {n.label}
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div
          className="border-t px-3 py-2.5 text-[10px] leading-relaxed"
          style={{ borderColor: "var(--tower-edge)", color: "var(--tower-dimmer)" }}
        >
          <div className="mono">acct {AWS_ACCOUNT}</div>
          <div className="mono">{AWS_REGION}</div>
          <div className="mt-1.5">
            <Tag minimal intent="warning">
              P0 · mock data
            </Tag>
          </div>
        </div>
      </nav>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-[46px] shrink-0 items-center gap-3 border-b px-4"
          style={{ background: "var(--tower-panel)", borderColor: "var(--tower-edge)" }}
        >
          <Tag minimal icon="eye-open" intent="none">
            read-only
          </Tag>
          <span className="text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
            Rollback is the only write Tower can cause.
          </span>

          <div className="flex-1" />

          <Tooltip
            content="Simulate AWS being unreachable, to exercise the stale-state path (R1.7)"
            compact
          >
            <Switch
              className="!mb-0 !text-[11px]"
              checked={isSimulatingOutage()}
              label="outage"
              onChange={(e) => {
                setSimulateOutage(e.currentTarget.checked);
                onRefresh?.();
              }}
            />
          </Tooltip>

          {fetchedAt && (
            <span className="mono text-[11px]" style={{ color: stale ? "#d9822b" : "var(--tower-dimmer)" }}>
              {stale ? "stale as of" : "fetched"} {relTime(fetchedAt)} ago
            </span>
          )}
          {onRefresh && (
            <Button minimal small icon="refresh" loading={loading} onClick={onRefresh} />
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

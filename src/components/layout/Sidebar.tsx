import { NavLink } from "react-router-dom";
import {
  Boxes,
  FileText,
  GitBranch,
  History,
  LayoutGrid,
  Map,
  ScrollText,
  Settings,
  ShieldCheck,
  Terminal,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AWS_ACCOUNT, AWS_REGION, DEPLOYABLES } from "@/mock/world";
import { STAGES } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The left navigation rail. Apollo's shape: product wordmark, grouped sections
 * with environments nested underneath, then utilities pinned to the bottom.
 */
export function Sidebar() {
  return (
    <nav className="sidebar-scroll flex w-[224px] shrink-0 flex-col overflow-y-auto bg-rail">
      <Wordmark />

      <SidebarSection label="Home" icon={LayoutGrid} to="/" end />

      <SidebarSection label="Environments" icon={Boxes}>
        {STAGES.map((stage) => (
          <SidebarSubLink key={stage} to={`/environment/${stage}`} label={stage} />
        ))}
      </SidebarSection>

      <SidebarSection label="Services" icon={Boxes} to="/services" />
      <SidebarSection label="Logs" icon={Terminal} to="/logs" />

      <div className="mt-4 px-4">
        <div className="eyebrow text-rail-muted">Not in this build</div>
      </div>
      {NOT_YET_BUILT.map((item) => (
        <SidebarPlaceholder key={item.label} {...item} />
      ))}

      <div className="flex-1" />

      <div className="border-t border-rail-line py-1">
        <SidebarPlaceholder label="Install map" icon={Map} inline />
        <a
          href="https://github.com/ubc-biztech/serverless-biztechapp"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 px-4 py-[7px] text-[12.5px] text-rail-text no-underline transition-colors hover:bg-rail-hover hover:text-white"
        >
          <ScrollText className="h-4 w-4 shrink-0" />
          Documentation
        </a>
        <SidebarPlaceholder label="Settings" icon={Settings} inline />
      </div>

      <AccountBlock />
    </nav>
  );
}

const NOT_YET_BUILT = [
  { label: "Releases", icon: GitBranch },
  { label: "Assets", icon: ShieldCheck },
  { label: "Audit", icon: History },
  { label: "Change requests", icon: FileText },
] as const;

function Wordmark() {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
      <img src="/assets/biztech_logo.svg" alt="BizTech" className="h-[22px] w-[22px] rounded" />
      <span className="text-[15px] font-bold tracking-[0.01em] text-white">Control Tower</span>
    </div>
  );
}

function SidebarSection({
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
              "flex items-center gap-2.5 border-l-[3px] py-[7px] pl-[13px] pr-4 no-underline transition-colors",
              isActive
                ? "border-bt-green-400 bg-rail-hover text-white"
                : "border-transparent text-rail-text hover:bg-rail-hover hover:text-white",
            )
          }
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

function SidebarSubLink({ to, label }: { to: string; label: string }) {
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

/** A nav entry for something planned but not in this build. */
function SidebarPlaceholder({
  label,
  icon: Icon,
  inline,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  inline?: boolean;
}) {
  return (
    <div
      title="Planned for v1"
      className={cn(
        "flex cursor-not-allowed items-center gap-2.5 px-4 py-[7px] text-[12.5px]",
        inline ? "text-rail-text opacity-55" : "text-rail-muted/70",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}

function AccountBlock() {
  return (
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
  );
}

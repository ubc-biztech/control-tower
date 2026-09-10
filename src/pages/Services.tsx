import { useState } from "react";
import { Link } from "react-router-dom";
import { InputGroup, Tag } from "@blueprintjs/core";
import { DEPLOYABLES } from "@/mock/world";
import type { MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { StatusTag } from "@/components/StatusTag";

/** The inventory view: deployables as config, not code (R9.3). */
export function ServicesPage({ matrix }: { matrix: MatrixResponse | null }) {
  const [q, setQ] = useState("");
  const rows = DEPLOYABLES.filter((d) =>
    (d.name + d.path + d.repo).toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
      >
        <div>
          <div className="text-[14px] font-bold leading-none text-white">Services</div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
            Deployable inventory from <span className="mono">deployables.json</span> — adding one is a
            config entry, not code
          </div>
        </div>
        <div className="flex-1" />
        <InputGroup
          small
          leftIcon="search"
          className="w-[220px]"
          placeholder="Filter"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="tower-table">
          <thead>
            <tr>
              <th style={{ width: 210 }}>Service</th>
              <th style={{ width: 116 }}>Kind</th>
              <th style={{ width: 300 }}>Source</th>
              <th style={{ width: 230 }}>Stack pattern</th>
              <th style={{ width: 70 }}>Fns</th>
              <th>Stages</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.name}>
                <td>
                  <Link
                    to={`/service/${encodeURIComponent(d.name)}/prod`}
                    className="mono text-[12.5px] text-white no-underline hover:underline"
                  >
                    {d.name}
                  </Link>
                </td>
                <td>
                  <Tag minimal>{d.kind}</Tag>
                </td>
                <td className="mono text-[11.5px]" style={{ color: "var(--tower-dim)" }}>
                  {d.repo}
                  <div style={{ color: "var(--tower-dimmer)" }}>{d.path}</div>
                </td>
                <td className="mono text-[11.5px]" style={{ color: "var(--tower-dim)" }}>
                  {d.stackPattern}
                </td>
                <td className="mono text-[11.5px]">{d.functions.length}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((s: Stage) => {
                      const cell = matrix?.cells[cellKey(d.name, s)];
                      return (
                        <span key={s} className="flex items-center gap-1">
                          <span className="mono text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
                            {s}
                          </span>
                          <StatusTag
                            status={cell?.status ?? "unknown"}
                            behindBy={cell?.behindBy}
                            behindOf={cell?.behindOf}
                          />
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

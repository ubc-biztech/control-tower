import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/** Sidebar + top bar + the routed page. */
export function AppLayout({
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
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar fetchedAt={fetchedAt} stale={stale} loading={loading} onRefresh={onRefresh} />
        <main className="min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
      </div>
    </div>
  );
}

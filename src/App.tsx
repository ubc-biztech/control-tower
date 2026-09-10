import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { LogsDrawer } from "@/components/LogsDrawer";
import { RollbackDialog, type RollbackTarget } from "@/components/RollbackDialog";
import { MatrixPage } from "@/pages/Matrix";
import { ServiceDetailPage } from "@/pages/ServiceDetail";
import { ServicesPage } from "@/pages/Services";
import { LogsPage } from "@/pages/Logs";
import { getMatrix } from "@/lib/api";
import type { MatrixResponse, Stage } from "@/lib/types";
import { toast } from "@/lib/toaster";

const MATRIX_POLL_MS = 30_000;

export default function App() {
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [logsTarget, setLogsTarget] = useState<{ service: string; stage: Stage } | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<RollbackTarget | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMatrix(await getMatrix());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read AWS");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the matrix warm; the real server caches for 30s behind this same poll.
  useEffect(() => {
    const t = setInterval(() => void refresh(), MATRIX_POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const openLogs = useCallback((service: string, stage: Stage) => {
    setLogsTarget({ service, stage });
  }, []);

  const openRollback = useCallback((service: string, stage: Stage, timestamp?: string) => {
    setRollbackTarget({ service, stage, timestamp });
  }, []);

  const onRollbackCompleted = useCallback(() => {
    void refresh();
    setReloadToken((n) => n + 1);
    void toast({
      intent: "success",
      icon: "tick-circle",
      message: "Rollback completed. Deployment history updated.",
      timeout: 6000,
    });
  }, [refresh]);

  return (
    <>
      <Shell
        fetchedAt={matrix?.fetchedAt}
        stale={matrix?.stale}
        loading={loading}
        onRefresh={() => void refresh()}
      >
        <Routes>
          <Route
            path="/"
            element={
              <MatrixPage
                data={matrix}
                loading={loading}
                error={error}
                onLogs={openLogs}
                onRollback={openRollback}
              />
            }
          />
          <Route path="/services" element={<ServicesPage matrix={matrix} />} />
          <Route path="/logs" element={<LogsPage matrix={matrix} onLogs={openLogs} />} />
          <Route
            path="/service/:name/:stage"
            element={
              <ServiceDetailPage
                matrix={matrix}
                onLogs={openLogs}
                onRollback={openRollback}
                reloadToken={reloadToken}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>

      <LogsDrawer
        service={logsTarget?.service ?? null}
        stage={logsTarget?.stage ?? null}
        onClose={() => setLogsTarget(null)}
      />

      <RollbackDialog
        target={rollbackTarget}
        onClose={() => setRollbackTarget(null)}
        onCompleted={onRollbackCompleted}
        onDispatched={() => void refresh()}
      />
    </>
  );
}

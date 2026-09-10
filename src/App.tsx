import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HealthProvider } from "@/components/HealthProvider";
import { LogsDrawer } from "@/components/LogsDrawer";
import { RollbackDialog, type RollbackTarget } from "@/components/RollbackDialog";
import { EnvironmentsPage } from "@/pages/EnvironmentsPage";
import { EnvironmentDetailPage } from "@/pages/EnvironmentDetailPage";
import { ServiceDetailPage } from "@/pages/ServiceDetailPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { LogsPage } from "@/pages/LogsPage";
import { getMatrix } from "@/lib/api";
import type { MatrixResponse, Stage } from "@/lib/types";
import { Toaster, toast } from "@/components/ui/toast";

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
    toast({
      tone: "success",
      message: "Rollback completed. Deployment history updated.",
    });
  }, [refresh]);

  return (
    <TooltipProvider delayDuration={250}>
      <HealthProvider>
      <AppLayout
        fetchedAt={matrix?.fetchedAt}
        stale={matrix?.stale}
        loading={loading}
        onRefresh={() => void refresh()}
      >
        <Routes>
          <Route
            path="/"
            element={
              <EnvironmentsPage
                data={matrix}
                loading={loading}
                error={error}
                onLogs={openLogs}
                onRollback={openRollback}
              />
            }
          />
          <Route
            path="/environment/:stage"
            element={
              <EnvironmentDetailPage
                matrix={matrix}
                loading={loading}
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
      </AppLayout>

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

        <Toaster />
      </HealthProvider>
    </TooltipProvider>
  );
}

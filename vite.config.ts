import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Mounts the read-only API inside the dev server, so `npm run dev` is one
 * process and AWS credentials stay in Node. The browser never sees them.
 * The same handler runs standalone via `npm run serve:api`.
 */
function controlTowerApi(): PluginOption {
  return {
    name: "control-tower-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const { handleApi } = await server.ssrLoadModule("/server/handler.ts");
        if (!(await handleApi(req, res))) next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), controlTowerApi()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5273 },
});

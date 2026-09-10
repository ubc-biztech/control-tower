/**
 * Standalone API server, for running Control Tower's backend outside Vite.
 * In development the same handler is mounted as Vite middleware instead, so
 * `npm run dev` is one process. See vite.config.ts.
 */
import { createServer } from "node:http";
import { handleApi } from "./handler.js";

const port = Number(process.env.PORT ?? 5274);

createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "NotFound" }));
}).listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Control Tower API (read-only) on http://localhost:${port}`);
});

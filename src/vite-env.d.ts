/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOWER_DATA_SOURCE?: "live" | "mock";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

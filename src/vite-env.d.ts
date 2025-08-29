/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ZENHUB_ENDPOINT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
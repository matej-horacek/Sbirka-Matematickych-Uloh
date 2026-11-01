/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Demo login: sent as `Authorization: Bearer <value>` (mock API: jan, eva, petr). */
  readonly VITE_DEMO_USER?: string
}

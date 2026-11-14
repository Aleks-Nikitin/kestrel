import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { projects: [
    { extends: true, test: { name: "unit", include: ["tests/{contracts,finance,feasibility,providers,reporting,security,ui}/**/*.test.ts"] } },
    { extends: true, test: { name: "integration", include: ["tests/{api,agent}/**/*.test.ts"] } },
    { extends: true, test: { name: "live", include: ["tests/live/**/*.test.ts"], testTimeout: 65000 } },
  ] },
});

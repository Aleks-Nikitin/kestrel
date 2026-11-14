import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", use: { baseURL: "http://127.0.0.1:3000" }, webServer: { command: "npm run build && npm run start -- --hostname 127.0.0.1", url: "http://127.0.0.1:3000", reuseExistingServer: false, env: { NEXT_PUBLIC_MAP_STYLE_URL: "" }, timeout: 180000 } });

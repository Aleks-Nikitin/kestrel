import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("isolated local demo port", () => {
  it.each(["0", "80", "65536", "3101;echo", "invalid"])("rejects unsafe port %s before loading protected configuration", port => {
    const result = spawnSync(process.execPath, ["scripts/start-local-demo.mjs"], {
      cwd: process.cwd(), env: { NODE_ENV: "test", KESTREL_DEMO_PORT: port }, encoding: "utf8", timeout: 5000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("KESTREL_DEMO_PORT must be an integer from 1024 to 65535.");
    expect(result.stdout).toBe("");
  });
});

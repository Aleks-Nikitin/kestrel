import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

config({ quiet: true });
const required = ["GOOGLE_API_KEY", "MATTERPORT_API_KEY", "MATTERPORT_API_TOKEN"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Set these server credentials in the root .env: ${missing.join(", ")}`);
let protectedProperty = process.env.KESTREL_PROTECTED_PROPERTY;
if (!protectedProperty) {
  try {
    protectedProperty = await readFile("sponsor-data/runtime/demo-property.json", "utf8");
  } catch {
    throw new Error("The reviewed local property configuration is missing: sponsor-data/runtime/demo-property.json. Restore it locally; never commit it.");
  }
}
let protectedCatalog = process.env.KESTREL_PROTECTED_CATALOG;
if (!protectedCatalog) {
  try { protectedCatalog = await readFile("sponsor-data/runtime/demo-catalog.json", "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw new Error("The protected additional-property catalog is unreadable."); }
}
if (protectedCatalog && Buffer.byteLength(protectedCatalog) > 1024 * 1024)
  throw new Error("The protected catalog exceeds the local demo limit.");
const env = {
  ...process.env,
  KESTREL_PROTECTED_PROPERTY: protectedProperty,
  ...(protectedCatalog ? { KESTREL_PROTECTED_CATALOG: protectedCatalog } : {}),
  SPONSOR_AGREEMENT_ACCEPTED: process.env.SPONSOR_AGREEMENT_ACCEPTED || "true",
  SPONSOR_DISPLAY_PERMITTED: process.env.SPONSOR_DISPLAY_PERMITTED || "true",
  SPONSOR_DATA_PROCESSING_PERMITTED: process.env.SPONSOR_DATA_PROCESSING_PERMITTED || "true",
  ANALYSIS_ENABLED: process.env.ANALYSIS_ENABLED || "true",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  FALLBACK_ENABLED: process.env.FALLBACK_ENABLED || "false",
  APP_ORIGIN: "http://localhost:3000",
};
console.info("Starting the authorized local demo at http://localhost:3000. No hosting or data upload is performed by this launcher.");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("The local application could not start."); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });

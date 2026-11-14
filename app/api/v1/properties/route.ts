import { connection } from "next/server";
import { createHandlers } from "@/lib/api/handlers";
import { createRuntimeProviders } from "@/lib/providers/runtime";
export async function GET(request: Request) {
  await connection();
  return createHandlers(createRuntimeProviders).catalog(request);
}

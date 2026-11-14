import { createHandlers } from "@/lib/api/handlers";
import { createRuntimeProviders } from "@/lib/providers/runtime";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return createHandlers(createRuntimeProviders).catalog(request);
}
